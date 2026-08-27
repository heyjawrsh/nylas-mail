import {beforeEach, describe, expect, it, vi} from 'vitest'

const {RetryableError} = vi.hoisted(() => ({
  RetryableError: class RetryableError extends Error {},
}))

vi.mock('isomorphic-core', () => ({
  Errors: {RetryableError},
  IMAPErrors: {},
}))

vi.mock('../../src/local-sync-worker/sync-utils.js', () => ({
  runWithRetryLogic: vi.fn(async ({run, onRetryableError}) => {
    try {
      return await run()
    } catch (error) {
      if (error instanceof RetryableError) {
        return onRetryableError(error)
      }
      throw error
    }
  }),
}))

vi.mock('../../src/local-sync-worker/syncback-task-factory.js', () => ({
  default: {create: vi.fn((_account, request) => request.task)},
}))

import {Errors} from 'isomorphic-core'
import SyncbackTaskRunner from '../../src/local-sync-worker/syncback-task-runner.js'
import SyncbackTask from '../../src/local-sync-worker/syncback-tasks/syncback-task.js'

const account = {id: 'a1', provider: 'imap'}
const logger = {log: vi.fn(), warn: vi.fn(), error: vi.fn()}

class FakeTask extends SyncbackTask {
  constructor(request, {description = 'Flag', affects = false, resource = 'imap', result = {ok: true}, error} = {}) {
    super(account, request)
    this._description = description
    this._affects = affects
    this._resource = resource
    this._result = result
    this._error = error
  }
  description() { return this._description }
  affectsImapMessageUIDs() { return this._affects }
  resource() { return this._resource }
  async * _run() {
    if (this._error) {
      const error = this._error
      if (error instanceof Errors.RetryableError) this._error = null
      throw error
    }
    return this._result
  }
}

function request(props = {}, options = {}) {
  const req = {props, status: 'NEW', type: options.description || 'Flag', save: vi.fn(async () => {}), toJSON() { return {...this} }}
  req.task = new FakeTask(req, options)
  return req
}

function makeRunner({batches = [], messages = []} = {}) {
  const db = {
    SyncbackRequest: {findAll: vi.fn().mockImplementation(() => Promise.resolve(batches.shift() || []))},
    Message: {findAll: vi.fn(async () => messages)},
  }
  const imap = {runOperation: vi.fn(async task => task.run(db, imap, {timeoutDelay: 100}))}
  const smtp = {}
  return {db, imap, runner: new SyncbackTaskRunner({db, account, syncWorker: {}, logger, imap, smtp})}
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.Logger = {forAccount: () => logger}
})

describe('SyncbackTaskRunner', () => {
  it('validates all constructor dependencies', () => {
    for (const key of ['db', 'account', 'logger', 'imap', 'smtp', 'syncWorker']) {
      const args = {db: {}, account, logger, imap: {}, smtp: {}, syncWorker: {}}
      delete args[key]
      expect(() => new SyncbackTaskRunner(args)).toThrow(`need to pass ${key}`)
    }
  })

  it('returns no work and prioritizes non-UID work', async () => {
    await expect(makeRunner({batches: [[], []]}).runner.getNewSyncbackTasks()).resolves.toEqual([])
    const priority = request({}, {description: 'EnsureMessageInSentFolder'})
    const ordinary = request({}, {description: 'Read'})
    const uid = request({messageId: 'm1'}, {description: 'Move', affects: true})
    await expect(makeRunner({batches: [[priority], [ordinary, uid]]}).runner.getNewSyncbackTasks())
      .resolves.toEqual([priority.task, ordinary.task, uid.task])
  })

  it('deduplicates folder changes and stops before other UID-changing tasks', async () => {
    const rename1 = request({folderId: 'f1'}, {description: 'RenameFolder', affects: true})
    const rename2 = request({folderId: 'f1'}, {description: 'DeleteFolder', affects: true})
    const move = request({messageId: 'm1'}, {description: 'Move', affects: true})
    const tasks = await makeRunner({batches: [[], [rename1, rename2, move]]}).runner.getNewSyncbackTasks()
    expect(tasks).toEqual([rename1.task])
  })

  it('deduplicates message and thread UID changes', async () => {
    const one = request({messageId: 'm1'}, {affects: true})
    const duplicate = request({messageId: 'm1'}, {affects: true})
    const threadConflict = request({threadId: 't1'}, {affects: true})
    const threadFree = request({threadId: 't2'}, {affects: true})
    const {runner} = makeRunner({batches: [[], [one, duplicate, threadConflict, threadFree]], messages: [{id: 'm2'}]})
    // Supply different message sets for the two thread lookups.
    runner._db.Message.findAll.mockResolvedValueOnce([{id: 'm1'}]).mockResolvedValueOnce([{id: 'm2'}])
    await expect(runner.getNewSyncbackTasks()).resolves.toEqual([one.task, threadFree.task])
  })

  it('repairs lingering retryable and non-retryable requests', async () => {
    const retry = {status: 'INPROGRESS-RETRYABLE', save: vi.fn()}
    const failed = {status: 'INPROGRESS-NOTRETRYABLE', type: 'Delete', save: vi.fn()}
    const {runner} = makeRunner({batches: [[retry], [failed]]})
    await runner.updateLingeringTasksInProgress()
    expect(retry.status).toBe('NEW')
    expect(failed.status).toBe('FAILED')
    expect(failed.error.message).toContain('App was closed')
  })

  it('runs IMAP and SMTP tasks and persists their responses', async () => {
    const imapReq = request({}, {result: {imap: true}})
    const setup = makeRunner()
    await setup.runner.runSyncbackTask(imapReq.task)
    expect(imapReq.status).toBe('SUCCEEDED')
    expect(imapReq.responseJSON).toEqual({imap: true})

    const smtpReq = request({}, {resource: 'smtp', result: null})
    setup.runner._smtp = {name: 'smtp'}
    await setup.runner.runSyncbackTask(smtpReq.task)
    expect(smtpReq.status).toBe('SUCCEEDED')
    expect(smtpReq.responseJSON).toEqual({})
  })

  it('rejects invalid tasks, records permanent failures, and rethrows retryable failures', async () => {
    const {runner} = makeRunner()
    await expect(runner.runSyncbackTask({})).rejects.toThrow('must pass a SyncbackTask')

    const permanent = request({}, {error: new Error('broken')})
    await runner.runSyncbackTask(permanent.task)
    expect(permanent.status).toBe('FAILED')
    expect(NylasEnv.reportError).toHaveBeenCalled()

    const retryable = request({}, {error: new Errors.RetryableError('later')})
    await expect(runner.runSyncbackTask(retryable.task)).rejects.toThrow('failed with retryable error: later')
    expect(retryable.status).toBe('NEW')
  })

  it('fails unknown resources', async () => {
    const bad = request({}, {resource: 'http'})
    const {runner} = makeRunner()
    await runner.runSyncbackTask(bad.task)
    expect(bad.status).toBe('FAILED')
    expect(bad.error.message).toContain('unknown resource')
  })
})
