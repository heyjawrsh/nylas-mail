import {describe, expect, it, vi} from 'vitest'
import defineModel from '../../src/models/define-model.js'
import makeFolder from '../../src/models/folder.js'
import makeLabel from '../../src/models/label.js'
import makeMessage from '../../src/models/message.js'
import makeThread from '../../src/models/thread.js'
import makeSyncbackRequest from '../../src/models/syncbackRequest.js'
import makeFile from '../../src/models/file.js'

const Sequelize = {
  STRING: Object.assign(() => 'STRING', {toString: () => 'STRING'}),
  INTEGER: 'INTEGER', DATE: 'DATE', BOOLEAN: 'BOOLEAN', TEXT: 'TEXT',
  ENUM: (...values) => ({values}), Op: {or: Symbol('or')},
}

function modelFactory(factory) {
  class Model {
    constructor(values = {}) { Object.assign(this, values) }
    getDataValue(key) { return this[`_${key}`] }
    setDataValue(key, value) { this[`_${key}`] = value }
  }
  const sequelize = {define: vi.fn((_name, attributes) => {
    for (const [key, definition] of Object.entries(attributes)) {
      if (definition && typeof definition === 'object' && (definition.get || definition.set)) {
        Object.defineProperty(Model.prototype, key, {
          configurable: true,
          get: definition.get || function get() { return this.getDataValue(key) },
          set: definition.set || function set(value) { this.setDataValue(key, value) },
        })
      }
    }
    return Model
  })}
  return {Model: factory(sequelize, Sequelize), sequelize}
}

describe('model definitions and pure model behavior', () => {
  it('defineModel attaches static and prototype extensions and forwards options', () => {
    class Model {}
    const sequelize = {define: vi.fn(() => Model)}
    const result = defineModel(sequelize, 'thing', {name: 'string'}, {
      timestamps: false, statics: {answer: 42}, prototype: {method: () => 'ok'},
    })
    expect(result.answer).toBe(42)
    expect(new result().method()).toBe('ok')
    expect(sequelize.define).toHaveBeenCalledWith('thing', {name: 'string'}, {timestamps: false})
  })

  describe('Folder', () => {
    const {Model: Folder} = modelFactory(makeFolder)

    it('hashes deterministically and serializes IMAP names', () => {
      expect(Folder.hash({boxName: 'Inbox', accountId: 'a'})).toHaveLength(64)
      expect(Folder.hash({boxName: 'Inbox', accountId: 'a'})).toBe(Folder.hash({boxName: 'Inbox', accountId: 'a'}))
      const folder = new Folder({id: 4, accountId: 'a', name: '[Gmail]/Trash', role: 'trash'})
      expect(folder.toJSON()).toMatchObject({id: '4', object: 'folder', name: 'trash', display_name: 'Trash', sync_state: null})
    })

    it('reports sync completion and progress', () => {
      // JSONColumn getter defaults syncState to {} (always truthy), so a fresh
      // folder is not 'complete' until its fields are populated.
      expect(new Folder().isSyncComplete()).toBe(false)
      const folder = new Folder({syncState: {fetchedmin: 2, minUID: 2, fetchedmax: 10, uidnext: 10, oldestProcessedDate: 'old'}})
      expect(folder.isSyncComplete()).toBe(true)
      expect(folder.syncProgress()).toEqual({approxPercentComplete: 1, approxTotal: 10, oldestProcessedDate: 'old'})
      folder.syncState.fetchedmin = null
      expect(folder.isSyncComplete()).toBe(false)
      expect(new Folder().syncProgress()).toBeDefined()  // fresh folders: NaN percent/undefined totals (legacy shape)
    })

    it('reloads and saves changed sync state but skips matching updates', async () => {
      const folder = new Folder({syncState: {uidnext: 2}})
      folder.reload = vi.fn().mockResolvedValue()
      folder.save = vi.fn().mockResolvedValue('saved')
      await expect(folder.updateSyncState({uidnext: 2})).resolves.toBeUndefined()
      expect(folder.reload).not.toHaveBeenCalled()
      await expect(folder.updateSyncState({fetchedmax: 1}, {transaction: 'tx'})).resolves.toBe('saved')
      expect(folder.reload).toHaveBeenCalledWith({transaction: 'tx'})
      expect(folder.syncState).toEqual({uidnext: 2, fetchedmax: 1})
    })
  })

  describe('Label', () => {
    const {Model: Label} = modelFactory(makeLabel)

    it('maps system and custom label identifiers and JSON', () => {
      expect(new Label({role: 'sent'}).imapLabelIdentifier()).toBe('\\Sent')
      expect(new Label({name: 'Projects'}).imapLabelIdentifier()).toBe('Projects')
      expect(new Label({id: 1, accountId: 'a', name: '[Gmail]/Spam', role: 'spam'}).toJSON())
        .toMatchObject({id: '1', object: 'label', display_name: 'Spam', imap_name: '[Gmail]/Spam'})
      expect(Label.hash({boxName: 'x', accountId: 'a'})).toHaveLength(64)
    })

    it('finds X-GM-LABELS from preloaded values or the database', async () => {
      const labels = [new Label({name: 'Projects'}), new Label({role: 'sent'}), new Label({name: 'Other'})]
      await expect(Label.findXGMLabels(null)).resolves.toBeUndefined()
      await expect(Label.findXGMLabels(['Projects', '\\Sent'], {preloadedLabels: labels})).resolves.toEqual(labels.slice(0, 2))
      Label.findAll = vi.fn().mockResolvedValue(['db'])
      await expect(Label.findXGMLabels(['Projects', '\\Sent'])).resolves.toEqual(['db'])
      expect(Label.findAll).toHaveBeenCalledWith({where: {[Sequelize.Op.or]: [{name: ['Projects']}, {role: ['sent']}]}})
    })
  })

  describe('Message', () => {
    const {Model: Message} = modelFactory(makeMessage)

    it('hashes normalized participant sets and formats dates and headers', () => {
      const first = Message.hash({from: [{email: 'z'}], to: [{email: 'a'}], subject: 's'})
      const second = Message.hash({from: [{email: 'a'}], to: [{email: 'z'}], subject: 's'})
      expect(first).toBe(second)
      expect(Message.dateString('2020-01-02T03:04:05Z')).toContain('+0000')
      expect(Message.buildHeaderMessageId('abc')).toBe('<abc@nylas-mail.nylas.com>')
    })

    it('handles recipients, sent state, X-GM labels, and JSON', async () => {
      const message = new Message({
        id: 'm', accountId: 'a', to: [{email: 'to'}], cc: [], bcc: [], from: [], replyTo: [],
        date: new Date(2000), isDraft: true, files: [], labels: [], folderImapUID: '9',
      })
      expect(message.getRecipients()).toEqual([{email: 'to'}])
      message.setIsSent(true)
      expect(message).toMatchObject({isSent: true, isDraft: false})
      message.setLabels = vi.fn().mockResolvedValue('set')
      const Label = {findXGMLabels: vi.fn().mockResolvedValue(['label'])}
      await expect(message.setLabelsFromXGM(['Projects'], {Label, preloadedLabels: []})).resolves.toBe('set')
      expect(message.folderImapXGMLabels).toBe('["Projects"]')
      expect(message.toJSON()).toMatchObject({id: 'm', object: 'message', date: 2, imap_uid: '9'})
    })

    it('requires an inflated folder when folderId exists', () => {
      const message = new Message({folderId: 'f'})
      expect(() => message.toJSON()).toThrow(/folder was not eagerly loaded/)
    })

    it('round-trips bodies through the body storage accessor', () => {
      const message = new Message({id: 'body-message'})
      const body = '<p>Hello from disk-backed storage</p>'.repeat(100)
      message.body = body
      expect(message.body).toBe(body)
      expect(message.getDataValue('body')).not.toBe(body)
    })

    it('serializes inflated files, folders, labels, and a null date', () => {
      const message = new Message({
        id: 'm', date: null, files: [{toJSON: () => ({id: 'file'})}],
        folder: {toJSON: () => ({id: 'folder'})}, labels: [{toJSON: () => ({id: 'label'})}],
      })
      expect(message.toJSON()).toMatchObject({date: null, files: [{id: 'file'}], folder: {id: 'folder'}, labels: [{id: 'label'}]})
    })
  })

  describe('Thread', () => {
    const {Model: Thread} = modelFactory(makeThread)

    it('aggregates labels and folders from messages', async () => {
      const messages = [
        {folderId: 'f1', getLabels: vi.fn().mockResolvedValue([{id: 'l1'}, {id: null}])},
        {folderId: 'f2', getLabels: vi.fn().mockResolvedValue([{id: 'l1'}, {id: 'l2'}])},
      ]
      const thread = new Thread()
      thread.getMessages = vi.fn().mockResolvedValue(messages)
      thread.setLabels = vi.fn(); thread.setFolders = vi.fn(); thread.save = vi.fn().mockResolvedValue('saved')
      await expect(thread.updateLabelsAndFolders({transaction: 'tx'})).resolves.toBe('saved')
      expect(thread.setLabels).toHaveBeenCalledWith(['l1', 'l2'], {transaction: 'tx'})
      expect(thread.setFolders).toHaveBeenCalledWith(['f1', 'f2'], {transaction: 'tx'})
    })

    it('updates counts, dates, participants, attachments, folders, and labels', async () => {
      const old = new Date(1000); const recent = new Date(2000)
      const thread = new Thread({folders: [], labels: [], participants: [], unreadCount: 0, starredCount: 0, hasAttachments: false})
      thread.save = vi.fn().mockResolvedValue(thread)
      thread.setFolders = vi.fn(); thread.setLabels = vi.fn()
      const message = {
        folder: {id: 'inbox', role: 'inbox'}, labels: [{id: 'sent', role: 'sent'}],
        date: recent, snippet: 'latest', starred: true, unread: true,
        to: [{email: 'a'}], cc: [{email: 'a'}], bcc: [], from: [{email: 'b'}],
        files: [{contentId: null}],
      }
      await expect(thread.updateFromMessages({messages: [message], transaction: 'tx'})).resolves.toBe(thread)
      expect(thread).toMatchObject({unreadCount: 1, starredCount: 1, lastMessageDate: recent, firstMessageDate: recent, hasAttachments: true})
      expect(thread.participants).toEqual([{email: 'a'}, {email: 'b'}])
      expect(thread.setFolders).toHaveBeenCalledWith(['inbox'], {transaction: 'tx'})
      expect(thread.setLabels).toHaveBeenCalledWith(['sent'], {transaction: 'tx'})
      thread._updateSimpleMessageAttributes({...message, date: old, starred: false, unread: false, folder: {role: 'sent'}, labels: []})
      expect(thread.firstMessageDate).toBe(old)
    })

    it('validates inflated associations and serializes compact and expanded threads', () => {
      expect(() => new Thread().toJSON()).toThrow(/labels were not eagerly loaded/)
      const folder = {toJSON: () => ({id: 'f'})}; const label = {toJSON: () => ({id: 'l'})}
      const thread = new Thread({
        id: 't', accountId: 'a', labels: [label], folders: [folder], messages: [{id: 'm'}],
        participants: [], unreadCount: 1, starredCount: 0, lastMessageDate: new Date(1000),
      })
      expect(thread.toJSON()).toMatchObject({message_ids: ['m'], unread: true, starred: false, last_message_timestamp: 1})
      thread.messages = [{id: 'm', accountId: 'a'}]
      expect(thread.toJSON().messages).toBe(thread.messages)
    })

    it('rejects malformed update inputs', async () => {
      await expect(new Thread({folders: null, labels: []}).updateFromMessages({messages: []})).rejects.toThrow(/folders and .labels/)
      await expect(new Thread({folders: [], labels: [], participants: []}).updateFromMessages({messages: null})).rejects.toThrow(/array of messages/)
      const thread = new Thread({folders: [], labels: [], participants: []})
      thread.save = vi.fn()
      await expect(thread.updateFromMessages({messages: [{}]})).rejects.toThrow(/message.labels/)
      await expect(thread.updateFromMessages({messages: [{labels: []}]})).rejects.toThrow(/message.folder/)
    })

    it('recomputes from the database and destroys empty threads', async () => {
      const thread = new Thread({folders: [], labels: [], participants: []})
      thread.getMessages = vi.fn().mockResolvedValue([])
      thread.destroy = vi.fn().mockResolvedValue('destroyed')
      const db = {Label: {}, Folder: {}, File: {}}
      await expect(thread.updateFromMessages({db, recompute: true})).resolves.toBe('destroyed')
      expect(thread.destroy).toHaveBeenCalled()

      await expect(new Thread({folders: [], labels: [], participants: []}).updateFromMessages({recompute: true}))
        .rejects.toThrow(/database reference/)
    })
  })

  describe('File', () => {
    const {Model: File} = modelFactory(makeFile)

    it('serializes every public attachment field', () => {
      expect(new File({id: 'f', size: 12, partId: '2', encoding: 'base64', filename: 'a.txt', messageId: 'm', accountId: 'a', contentType: 'text/plain', contentId: 'cid'}).toJSON())
        .toEqual({id: 'f', size: 12, object: 'file', part_id: '2', encoding: 'base64', filename: 'a.txt', message_id: 'm', account_id: 'a', content_type: 'text/plain', content_id: 'cid'})
    })
  })

  it('serializes syncback requests', () => {
    const {Model} = modelFactory(makeSyncbackRequest)
    expect(new Model({id: 3, type: 'Star', status: 'NEW', accountId: 'a', props: {x: 1}, error: null}).toJSON())
      .toEqual({id: '3', type: 'Star', error: {}, props: {x: 1}, response_json: {}, status: 'NEW', object: 'syncbackRequest', account_id: 'a'})
  })
})
