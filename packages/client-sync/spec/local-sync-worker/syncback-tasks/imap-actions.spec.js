import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createLogger} from '../../../src/shared/logger.js'

const mocks = vi.hoisted(() => ({
  forEachFolderOfThread: vi.fn(),
  setLabelsForMessages: vi.fn(),
  syncRun: vi.fn(),
  factoryCreate: vi.fn(),
}))

vi.mock('../../../src/local-sync-worker/imap-helpers.js', () => ({default: {
  forEachFolderOfThread: mocks.forEachFolderOfThread,
  setLabelsForMessages: mocks.setLabelsForMessages,
}}))
vi.mock('../../../src/local-sync-worker/sync-task-factory.js', () => ({default: {
  create: mocks.factoryCreate,
}}))

import MarkRead from '../../../src/local-sync-worker/syncback-tasks/mark-thread-as-read.imap.js'
import MarkUnread from '../../../src/local-sync-worker/syncback-tasks/mark-thread-as-unread.imap.js'
import Star from '../../../src/local-sync-worker/syncback-tasks/star-thread.imap.js'
import Unstar from '../../../src/local-sync-worker/syncback-tasks/unstar-thread.imap.js'
import SetLabels from '../../../src/local-sync-worker/syncback-tasks/set-thread-labels.imap.js'
import MoveToFolder from '../../../src/local-sync-worker/syncback-tasks/move-thread-to-folder.imap.js'
import SetFolderAndLabels from '../../../src/local-sync-worker/syncback-tasks/set-thread-folder-and-labels.imap.js'
import CreateCategory from '../../../src/local-sync-worker/syncback-tasks/create-category.imap.js'
import DeleteFolder from '../../../src/local-sync-worker/syncback-tasks/delete-folder.imap.js'
import RenameLabel from '../../../src/local-sync-worker/syncback-tasks/rename-label.imap.js'

const account = {id: 'account', provider: 'imap'}
const request = props => ({props, status: 'NEW', type: 'test'})

function commonDb(thread) {
  return {
    Thread: {findByPk: vi.fn().mockResolvedValue(thread)},
    sequelize: {transaction: vi.fn(fn => fn({id: 'tx'}))},
  }
}

describe('small IMAP syncback actions', () => {
  beforeEach(() => {
    global.Logger = createLogger()
    vi.clearAllMocks()
    mocks.factoryCreate.mockReturnValue({run: mocks.syncRun})
    mocks.syncRun.mockResolvedValue()
    mocks.forEachFolderOfThread.mockImplementation(async ({callback, threadMessages}) => callback({
      box: {addFlags: vi.fn(), delFlags: vi.fn(), moveFromBox: vi.fn()},
      folder: {id: 'source'}, messages: threadMessages, messageImapUIDs: [10, 11],
    }))
  })

  it.each([
    [MarkRead, 'addFlags', 'SEEN', {unread: false}, {unreadCount: 0}],
    [MarkUnread, 'delFlags', 'SEEN', {unread: true}, {unreadCount: 2}],
    [Star, 'addFlags', 'FLAGGED', {starred: true}, {starredCount: 2}],
    [Unstar, 'delFlags', 'FLAGGED', {starred: false}, {starredCount: 0}],
  ])('%p updates flags and local models', async (Task, method, flag, messageChange, threadChange) => {
    const messages = [{update: vi.fn()}, {update: vi.fn()}]
    const thread = {getMessages: vi.fn().mockResolvedValue(messages), update: vi.fn()}
    const db = commonDb(thread)
    let usedBox
    mocks.forEachFolderOfThread.mockImplementation(async ({callback}) => {
      usedBox = {addFlags: vi.fn(), delFlags: vi.fn()}
      return callback({box: usedBox, messageImapUIDs: [10, 11]})
    })
    const task = new Task(account, request({threadId: 'thread'}))
    await task.run(db, {})
    expect(usedBox[method]).toHaveBeenCalledWith([10, 11], flag)
    expect(messages[0].update).toHaveBeenCalledWith(messageChange, {transaction: {id: 'tx'}})
    expect(thread.update).toHaveBeenCalledWith(threadChange, {transaction: {id: 'tx'}})
    expect(task.affectsImapMessageUIDs()).toBe(false)
  })

  it.each([MarkRead, MarkUnread, Star, Unstar, SetLabels])('%p validates thread ids', async Task => {
    const task = new Task(account, request({}))
    await expect(task.run(commonDb(null), {})).rejects.toThrow(/threadId is required/)
  })

  it('rejects a missing thread', async () => {
    await expect(new MarkRead(account, request({threadId: 'gone'})).run(commonDb(null), {}))
      .rejects.toThrow(/find thread/i)
  })

  it('sets remote and local labels for all messages', async () => {
    const messages = [{setLabels: vi.fn()}, {setLabels: vi.fn()}]
    const thread = {getMessages: vi.fn().mockResolvedValue(messages), setLabels: vi.fn()}
    const db = commonDb(thread)
    mocks.forEachFolderOfThread.mockImplementation(({callback}) => callback({box: {}, messages}))
    await new SetLabels(account, request({threadId: 't', labelIds: ['l1']})).run(db, {})
    expect(mocks.setLabelsForMessages).toHaveBeenCalledWith({db, box: {}, messages, labelIds: ['l1']})
    expect(messages[0].setLabels).toHaveBeenCalledWith(['l1'], {transaction: {id: 'tx'}})
    expect(thread.setLabels).toHaveBeenCalledWith(['l1'], {transaction: {id: 'tx'}})
  })

  it('moves thread messages and triggers target-folder synchronization', async () => {
    const messages = [{id: 'm'}]
    const thread = {getMessages: vi.fn().mockResolvedValue(messages)}
    const target = {id: 'target', name: 'Archive'}
    const db = {...commonDb(thread), Folder: {findByPk: vi.fn().mockResolvedValue(target)}}
    const moveFromBox = vi.fn()
    mocks.forEachFolderOfThread.mockImplementation(({callback}) => callback({
      box: {moveFromBox}, folder: {id: 'source'}, messageImapUIDs: [4], messages,
    }))
    await new MoveToFolder(account, request({threadId: 't', folderId: 'target'})).run(db, {}, {syncWorker: 'worker'})
    expect(moveFromBox).toHaveBeenCalledWith([4], 'Archive')
    expect(mocks.factoryCreate).toHaveBeenCalledWith('FetchNewMessagesInFolder', {account, folder: target})
    expect(mocks.syncRun).toHaveBeenCalledWith(db, {}, {syncWorker: 'worker'})
  })

  it('does not move messages already in the target folder', async () => {
    const target = {id: 'target', name: 'Archive'}
    const thread = {getMessages: vi.fn().mockResolvedValue([])}
    const db = {...commonDb(thread), Folder: {findByPk: vi.fn().mockResolvedValue(target)}}
    const moveFromBox = vi.fn()
    mocks.forEachFolderOfThread.mockImplementation(({callback}) => callback({box: {moveFromBox}, folder: target, messageImapUIDs: []}))
    await new MoveToFolder(account, request({threadId: 't', folderId: 'target'})).run(db, {})
    expect(moveFromBox).not.toHaveBeenCalled()
  })

  it('sets labels before moving in the combined action', async () => {
    const messages = [{id: 'm'}]
    const thread = {getMessages: vi.fn().mockResolvedValue(messages)}
    const target = {id: 'target', name: 'Archive'}
    const db = {...commonDb(thread), Folder: {findByPk: vi.fn().mockResolvedValue(target)}}
    const moveFromBox = vi.fn()
    const box = {moveFromBox}
    mocks.forEachFolderOfThread.mockImplementation(({callback}) => callback({box, folder: {id: 'old'}, messages, messageImapUIDs: [8]}))
    await new SetFolderAndLabels(account, request({threadId: 't', folderId: 'target', labelIds: ['l']})).run(db, {})
    expect(mocks.setLabelsForMessages).toHaveBeenCalledWith({db, box, messages, labelIds: ['l']})
    expect(moveFromBox).toHaveBeenCalledWith([8], 'Archive')
  })

  it.each([MoveToFolder, SetFolderAndLabels])('%p validates folder inputs and lookup', async Task => {
    await expect(new Task(account, request({folderId: 'f'})).run({}, {})).rejects.toThrow(/threadId is required/)
    await expect(new Task(account, request({threadId: 't'})).run({}, {})).rejects.toThrow(/targetFolderId is required/)
    const db = {...commonDb({}), Folder: {findByPk: vi.fn().mockResolvedValue(null)}}
    await expect(new Task(account, request({threadId: 't', folderId: 'f'})).run(db, {})).rejects.toThrow(/targetFolder not found/)
  })

  it('creates a category after adding its mailbox', async () => {
    const category = {toJSON: () => ({id: 'hash', name: 'Projects'})}
    const model = {hash: vi.fn(() => 'hash'), create: vi.fn().mockResolvedValue(category)}
    const db = {accountId: 'account', Label: model}
    const imap = {addBox: vi.fn()}
    const result = await new CreateCategory(account, request({objectClass: 'Label', displayName: 'Projects'})).run(db, imap)
    expect(imap.addBox).toHaveBeenCalledWith('Projects')
    expect(model.hash).toHaveBeenCalledWith({boxName: 'Projects', accountId: 'account'})
    expect(result).toEqual({id: 'hash', name: 'Projects'})
  })

  it('deletes an existing folder and treats a missing one as success', async () => {
    const folder = {name: 'Old', destroy: vi.fn()}
    const db = {Folder: {findByPk: vi.fn().mockResolvedValueOnce(folder).mockResolvedValueOnce(null)}}
    const imap = {delBox: vi.fn()}
    await new DeleteFolder(account, request({folderId: 'f'})).run(db, imap)
    expect(imap.delBox).toHaveBeenCalledWith('Old')
    expect(folder.destroy).toHaveBeenCalled()
    await expect(new DeleteFolder(account, request({folderId: 'missing'})).run(db, imap)).resolves.toBeUndefined()
  })

  it('renames a label and migrates message and thread associations', async () => {
    const newLabel = {id: 'new', toJSON: () => ({id: 'new'})}
    const message = {labels: [{id: 'old'}, {id: 'keep'}], setLabels: vi.fn(), save: vi.fn()}
    const thread = {labels: [{id: 'old'}], setLabels: vi.fn(), save: vi.fn()}
    const oldLabel = {id: 'old', name: 'Old', getMessages: vi.fn().mockResolvedValue([message]), getThreads: vi.fn().mockResolvedValue([thread]), destroy: vi.fn()}
    const Label = {findByPk: vi.fn().mockResolvedValue(oldLabel), hash: vi.fn(() => 'new'), create: vi.fn().mockResolvedValue(newLabel)}
    const db = {accountId: 'account', Label, sequelize: {transaction: vi.fn(fn => fn('tx'))}}
    const imap = {renameBox: vi.fn()}
    const result = await new RenameLabel(account, request({labelId: 'old', newLabelName: 'New'})).run(db, imap)
    expect(imap.renameBox).toHaveBeenCalledWith('Old', 'New')
    expect(message.setLabels).toHaveBeenCalledWith([newLabel, {id: 'keep'}], {transaction: 'tx'})
    expect(thread.setLabels).toHaveBeenCalledWith([newLabel], {transaction: 'tx'})
    expect(oldLabel.destroy).toHaveBeenCalledWith({transaction: 'tx'})
    expect(result).toEqual({id: 'new'})
  })
})
