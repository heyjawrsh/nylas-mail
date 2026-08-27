import {beforeEach, describe, expect, it, vi} from 'vitest'

const mocks = vi.hoisted(() => ({
  listen: vi.fn(), unsubscribe: vi.fn(), forAccount: vi.fn(), forShared: vi.fn(),
  ensureToken: vi.fn(), runTask: vi.fn(), SendmailClient: vi.fn(), Runner: vi.fn(),
}))

vi.mock('nylas-exports', () => ({Actions: {runSendRequest: {listen: mocks.listen}}}))
vi.mock('isomorphic-core', () => ({SendmailClient: mocks.SendmailClient}))
vi.mock('../../src/shared/local-database-connector.js', () => ({
  default: {forAccount: mocks.forAccount, forShared: mocks.forShared},
}))
vi.mock('../../src/local-sync-worker/sync-utils.js', () => ({ensureGmailAccessToken: mocks.ensureToken}))
vi.mock('../../src/local-sync-worker/send-task-runner.js', () => ({
  default: class SendTaskRunner {
    constructor(args) { mocks.Runner(args); this.expiresAtInMs = Infinity }
    runTask(task) { return mocks.runTask(task) }
  },
}))

import manager from '../../src/local-sync-worker/send-task-manager.js'

beforeEach(async () => {
  vi.clearAllMocks()
  mocks.listen.mockReturnValue(mocks.unsubscribe)
  mocks.forAccount.mockResolvedValue({name: 'account-db'})
  mocks.ensureToken.mockResolvedValue(null)
  mocks.runTask.mockResolvedValue({id: 'sent'})
  globalThis.Logger = {forAccount: vi.fn(() => ({log: vi.fn()}))}
  await manager.activate()
})

describe('SendTaskManager', () => {
  it('subscribes and unsubscribes', async () => {
    expect(mocks.listen).toHaveBeenCalledWith(manager._runSendRequest)
    await manager.deactivate()
    expect(mocks.unsubscribe).toHaveBeenCalled()
  })

  it('runs requests and routes success and errors to callbacks', async () => {
    const task = {_account: {id: 'a1', provider: 'imap'}}
    vi.spyOn(manager, '_createTask').mockResolvedValueOnce(task).mockRejectedValueOnce(new Error('bad request'))
    vi.spyOn(manager, '_runTask').mockResolvedValue({id: 'sent'})
    const onSuccess = vi.fn(); const onError = vi.fn()
    await manager._runSendRequest({syncbackRequestJSON: {}, onSuccess, onError})
    expect(onSuccess).toHaveBeenCalledWith({id: 'sent'})
    await manager._runSendRequest({syncbackRequestJSON: {}, onSuccess, onError})
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({message: 'bad request'}))
    manager._createTask.mockRestore(); manager._runTask.mockRestore()
  })

  it('creates and reuses a per-account runner', async () => {
    const account = {id: 'a1', provider: 'imap'}
    const task = {_account: account}
    await expect(manager._runTask(task)).resolves.toEqual({id: 'sent'})
    await manager._runTask(task)
    expect(mocks.Runner).toHaveBeenCalledTimes(1)
    expect(mocks.SendmailClient).toHaveBeenCalledTimes(1)
  })

  it('refreshes gmail credentials and replaces stale runners', async () => {
    const account = {id: 'gmail', provider: 'gmail'}
    const task = {_account: account}
    mocks.ensureToken.mockResolvedValueOnce({accessToken: 'new'}).mockResolvedValueOnce(null)
    await manager._runTask(task)
    expect(mocks.ensureToken).toHaveBeenCalledWith(expect.objectContaining({account, expiryBufferInSecs: 120}))
    manager._sendTaskRunnersByAccountId.gmail.expiresAtInMs = Date.now() - 61_000
    await manager._runTask(task)
    expect(mocks.Runner).toHaveBeenCalledTimes(2)
  })
})
