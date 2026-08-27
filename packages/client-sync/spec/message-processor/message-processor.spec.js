import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import MessageProcessor from '../../src/message-processor/index.js'
import LocalDatabaseConnector from '../../src/shared/local-database-connector.js'
import {silentLogger} from '../helpers.js'

describe('MessageProcessor observable units', () => {
  beforeEach(() => {
    global.Logger = silentLogger
    vi.spyOn(LocalDatabaseConnector, 'forAccount')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.NYLAS_DEBUG
  })

  it('reports queue state and computes battery-aware throttling', () => {
    const originalLength = MessageProcessor._queueLength
    const originalStart = MessageProcessor._currentChunkStart
    MessageProcessor._queueLength = 500
    expect(MessageProcessor.queueIsFull()).toBe(true)
    expect(MessageProcessor.queueLength()).toBe(500)
    MessageProcessor._queueLength = 499
    expect(MessageProcessor.queueIsFull()).toBe(false)
    MessageProcessor._currentChunkStart = Date.now() - 100
    expect(MessageProcessor._computeThrottlingTimeout()).toBeGreaterThan(0)
    MessageProcessor._queueLength = originalLength
    MessageProcessor._currentChunkStart = originalStart
  })

  it('creates missing references once and preserves their source order', async () => {
    const existing = {id: 7, rfc2822MessageId: '<old>'}
    const created = {id: 8, rfc2822MessageId: '<new>'}
    const Reference = {
      findAll: vi.fn().mockResolvedValue([existing]),
      create: vi.fn().mockResolvedValue(created),
    }
    const message = {addReferences: vi.fn().mockResolvedValue(undefined)}
    const thread = {id: 'thread', addReferences: vi.fn().mockResolvedValue(undefined)}
    await MessageProcessor._addReferences({Reference}, message, thread, ['<new>', '<old>'])
    expect(Reference.findAll).toHaveBeenCalledWith({where: {rfc2822MessageId: ['<new>', '<old>']}})
    expect(Reference.create).toHaveBeenCalledWith({rfc2822MessageId: '<new>', threadId: 'thread'})
    expect(message.referencesOrder).toEqual([8, 7])
    expect(message.addReferences).toHaveBeenCalledWith([created, existing])
    expect(thread.addReferences).toHaveBeenCalledWith([created, existing])
  })

  it('does not query references for an empty header list', async () => {
    const Reference = {findAll: vi.fn(), create: vi.fn()}
    const message = {addReferences: vi.fn()}
    const thread = {addReferences: vi.fn()}
    await MessageProcessor._addReferences({Reference}, message, thread, [])
    expect(Reference.findAll).not.toHaveBeenCalled()
    expect(Reference.create).not.toHaveBeenCalled()
    expect(message.referencesOrder).toEqual([])
  })

  it('updates a processed existing message without replacing its body', async () => {
    const thread = {updateLabelsAndFolders: vi.fn(), updateFromMessages: vi.fn()}
    const existingMessage = {
      id: 'm', isProcessed: true, body: 'keep me',
      update: vi.fn(), setLabels: vi.fn(), getThread: vi.fn().mockResolvedValue(thread), save: vi.fn(),
    }
    LocalDatabaseConnector.forAccount.mockResolvedValue({Folder: {}, Label: {}})
    const result = await MessageProcessor._processExistingMessage({
      existingMessage,
      messageValues: {id: 'm', accountId: 'a', body: 'discard me', subject: 'updated', labels: ['l'], references: []},
      struct: [],
    })
    expect(existingMessage.update).toHaveBeenCalledWith({id: 'm', accountId: 'a', subject: 'updated', labels: ['l'], references: []})
    expect(existingMessage.setLabels).toHaveBeenCalledWith(['l'])
    expect(existingMessage.save).toHaveBeenCalled()
    expect(thread.updateLabelsAndFolders).toHaveBeenCalled()
    expect(result).toBe(existingMessage)
  })

  it('rejects a processed orphan and skips setting empty labels', async () => {
    const existingMessage = {
      id: 'orphan', isProcessed: true, update: vi.fn(), setLabels: vi.fn(),
      getThread: vi.fn().mockResolvedValue(null), save: vi.fn(),
    }
    LocalDatabaseConnector.forAccount.mockResolvedValue({Folder: {}, Label: {}})
    await expect(MessageProcessor._processExistingMessage({
      existingMessage,
      messageValues: {accountId: 'a', body: 'new', labels: [], references: []},
      struct: [],
    })).rejects.toThrow(/doesn't have thread/)
    expect(existingMessage.setLabels).not.toHaveBeenCalled()
  })

  it('records parse failures, deduplicating failed UIDs', async () => {
    const folder = {
      name: 'Inbox', syncState: {failedUIDs: [4]}, updateSyncState: vi.fn().mockResolvedValue(undefined),
    }
    const logger = {error: vi.fn()}
    const error = new Error('bad mime')
    await MessageProcessor._onError({
      imapMessage: {attributes: {uid: 4}}, desiredParts: ['1'], folder, err: error, logger,
    })
    expect(logger.error).toHaveBeenCalledWith('MessageProcessor: Could not build message', expect.objectContaining({err: error}))
    expect(NylasEnv.reportError).toHaveBeenCalledWith(error, expect.objectContaining({fingerprint: expect.any(Array)}))
    expect(folder.updateSyncState).toHaveBeenCalledWith({failedUIDs: [4]})
  })

  it('does not write failed UID state when the server supplied no UID', async () => {
    const folder = {name: 'Inbox', syncState: {}, updateSyncState: vi.fn()}
    await MessageProcessor._onError({
      imapMessage: {attributes: {}}, desiredParts: [], folder, err: new Error('bad'), logger: {error: vi.fn()},
    })
    expect(folder.updateSyncState).not.toHaveBeenCalled()
  })
})
