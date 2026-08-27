import {beforeEach, describe, expect, it, vi} from 'vitest'
import FetchMessages from '../../../src/local-sync-worker/sync-tasks/fetch-messages-in-folder.imap.js'
import FetchNewMessages from '../../../src/local-sync-worker/sync-tasks/fetch-new-messages-in-folder.imap.js'
import FetchSpecificMessages from '../../../src/local-sync-worker/sync-tasks/fetch-specific-messages-in-folder.imap.js'
import {silentLogger} from '../../helpers.js'

function folder(syncState = {}) {
  return {id: 'folder-id', name: 'Inbox', syncState, updateSyncState: vi.fn()}
}

function taskOf(Type = FetchMessages, options = {}) {
  global.Logger = silentLogger
  return new Type({account: {id: 'account-id'}, folder: folder(), ...options})
}

describe('fetch message task seams', () => {
  beforeEach(() => { global.Logger = silentLogger })

  it('selects body text, prefers one HTML alternative, and ignores attachments', () => {
    const task = taskOf()
    task._logger = {warn: vi.fn()}
    const alternative = [
      {type: 'alternative'},
      {type: 'text', subtype: 'plain', size: 10, partID: '2.1', encoding: '7bit', params: {charset: 'utf-8'}},
      {type: 'text', subtype: 'html', size: 20, partID: '2.2', encoding: 'quoted-printable'},
      {type: 'text', subtype: 'html', size: 30, partID: '2.3'},
    ]
    const mixed = [
      {type: 'mixed'},
      {type: 'text', subtype: 'plain', size: 5, partID: '1', encoding: '8bit'},
      alternative,
      {type: 'text', subtype: 'html', size: 50, partID: '3', disposition: {type: 'ATTACHMENT'}},
      {type: 'image', subtype: 'png', size: 100, partID: '4'},
    ]

    expect(task._getDesiredMIMEParts(mixed)).toEqual([
      {id: '1', transferEncoding: '8bit', charset: null, mimeType: 'text/plain'},
      {id: '2.2', transferEncoding: 'quoted-printable', charset: null, mimeType: 'text/html'},
    ])
    expect(task._logger.warn).not.toHaveBeenCalled()
  })

  it('warns when a nonempty structure has no displayable body', () => {
    const task = taskOf()
    task._logger = {warn: vi.fn()}
    expect(task._getDesiredMIMEParts([{type: 'application', subtype: 'pdf', size: 4, partID: '1'}])).toEqual([])
    expect(task._logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not find good part'), {
      available_options: 'application/pdf',
    })
  })

  it('validates fetch ranges and computes bounded batch sizes', async () => {
    const task = taskOf()
    task._syncWorker = {_batchProcessedUids: new Map(), _latestOpenTimesByFolder: new Map(), throttlingEnabled: () => false}
    task._logger = {log: vi.fn()}
    await expect(task._fetchAndProcessMessages({min: 1, max: 2, uids: [3]}).next()).rejects.toThrow(/uid set/)
    await expect(task._fetchAndProcessMessages({min: -1, max: 2}).next()).rejects.toThrow(/must be > 0/)
    expect(task._batchSizeForFolder()).toBe(30)
    task._syncWorker._latestOpenTimesByFolder.set('Inbox', 100)
    expect(task._batchSizeForFolder()).toBe(30)
    task._syncWorker._latestOpenTimesByFolder.set('Inbox', 10000)
    expect(task._batchSizeForFolder()).toBe(300)
  })

  it('clears deleted local UIDs and recovers UID invalidity', async () => {
    const task = taskOf()
    const Message = {update: vi.fn().mockResolvedValue(undefined)}
    task._db = {Message}
    await task._removeDeletedMessages({'2': {}}, [{folderImapUID: 1}, {folderImapUID: 2}])
    expect(Message.update).toHaveBeenCalledWith(
      {folderImapUID: null, folderId: null},
      {where: {folderId: 'folder-id', folderImapUID: [1]}},
    )
    Message.update.mockClear()
    await task._removeDeletedMessages({'2': {}}, [{folderImapUID: 2}])
    expect(Message.update).not.toHaveBeenCalled()
    await task._recoverFromUIDInvalidity(99)
    expect(task._folder.updateSyncState).toHaveBeenCalledWith({fetchedmax: null, fetchedmin: null, minUID: null, uidvalidity: 99})
  })

  it('fetches only specific UIDs outside the recorded range', async () => {
    const f = folder({fetchedmin: 10, fetchedmax: 20})
    const task = new FetchSpecificMessages({account: {id: 'a'}, folder: f, uids: [5, 15, 25]})
    task._fetchAndProcessMessages = vi.fn(() => 'fetch-step')
    const imap = {openBox: vi.fn().mockResolvedValue({uidnext: 30})}
    const gen = task.runTask({}, imap, {syncWorker: {}})
    expect((await gen.next()).value).toBe('fetch-step')
    await gen.next()
    expect(task._fetchAndProcessMessages).toHaveBeenCalledWith({uids: [5, 25], throttle: false})
  })

  it('skips specific UIDs already fetched and handles new-message status', async () => {
    const f = folder({fetchedmin: 10, fetchedmax: 20})
    const specific = new FetchSpecificMessages({account: {id: 'a'}, folder: f, uids: [12]})
    const openBox = vi.fn()
    expect((await specific.runTask({}, {openBox}, {syncWorker: {}}).next()).done).toBe(true)
    expect(openBox).not.toHaveBeenCalled()

    const newer = new FetchNewMessages({account: {id: 'a'}, folder: f})
    newer._fetchAndProcessMessages = vi.fn(() => 'new-fetch')
    const imap = {
      getLatestBoxStatus: vi.fn().mockResolvedValue({uidnext: 21}),
      openBox: vi.fn().mockResolvedValue({uidnext: 22}),
    }
    const gen = newer.runTask({}, imap, {syncWorker: {}})
    expect((await gen.next()).value).toEqual({uidnext: 21})
    expect((await gen.next({uidnext: 21})).value).toBe('new-fetch')
    await gen.next()
    expect(newer._fetchAndProcessMessages).toHaveBeenCalledWith({min: 20, max: 22, throttle: false})
  })
})
