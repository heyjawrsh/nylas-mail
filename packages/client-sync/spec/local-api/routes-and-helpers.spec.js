import {beforeEach, describe, expect, it, vi} from 'vitest'

const syncActivity = vi.hoisted(() => ({
  getLastSyncActivity: vi.fn(),
  getLastSyncActivityForAccount: vi.fn(),
}))
const wakeWorkerForAccount = vi.hoisted(() => vi.fn())

vi.mock('../../src/shared/sync-activity.js', () => ({default: syncActivity}))
vi.mock('../../src/local-sync-worker/sync-process-manager.js', () => ({default: {wakeWorkerForAccount}}))

import healthRoutes from '../../src/local-api/routes/health.js'
import {createAndReplyWithSyncbackRequest} from '../../src/local-api/route-helpers.js'

beforeEach(() => vi.clearAllMocks())

describe('local API route helpers', () => {
  it('creates, replies with, and wakes a syncback request', async () => {
    const created = {type: 'StarThread', toJSON: () => ({type: 'StarThread'})}
    const request = {
      auth: {credentials: {id: 'a1'}},
      getAccountDatabase: vi.fn(async () => ({SyncbackRequest: {create: vi.fn(async () => created)}})),
    }
    const reply = vi.fn()
    const h = {response: (x) => { reply(x); return x }}
    const body = await createAndReplyWithSyncbackRequest(request, h, {type: 'StarThread'})
    expect(body).toBe(JSON.stringify({type: 'StarThread'}, null, 2)) // h.response passthrough
    expect(reply).toHaveBeenCalledWith(JSON.stringify({type: 'StarThread'}, null, 2))
    expect(wakeWorkerForAccount).toHaveBeenCalledWith('a1', expect.objectContaining({interrupt: true}))
  })

  it('can skip waking and converts failures into replies', async () => {
    const created = {type: 'Draft', toJSON: () => ({type: 'Draft'})}
    const request = {auth: {credentials: {id: 'a1'}}, getAccountDatabase: async () => ({SyncbackRequest: {create: async () => created}})}
    await createAndReplyWithSyncbackRequest(request, {response: () => {}}, {wakeSync: false})
    expect(wakeWorkerForAccount).not.toHaveBeenCalled()

    const reply = vi.fn()
    const h = {response: (x) => reply(x)}
    await expect(createAndReplyWithSyncbackRequest({...request, getAccountDatabase: async () => { throw new Error('db down') }}, h)).rejects.toMatchObject({isBoom: true})
  })
})

describe('health routes', () => {
  const replyOf = () => { const calls = []; const h = {response: (x) => { calls.push(x); return x }}; return {h, calls} }
  function handlers() {
    const routes = []
    healthRoutes({route: definition => routes.push(definition)})
    return routes.map(route => route.handler)
  }

  it('registers both health handlers and serializes activity', () => {
    const [all, account] = handlers()
    syncActivity.getLastSyncActivity.mockReturnValue({a1: {status: 'ok'}})
    syncActivity.getLastSyncActivityForAccount.mockReturnValue({status: 'ok'})
    const reply = vi.fn()
    const h = {response: (x) => reply(x)}
    all({logger: {error: vi.fn()}}, h)
    account({params: {accountId: 'a1'}, logger: {error: vi.fn()}}, h)
    expect(reply).toHaveBeenNthCalledWith(1, JSON.stringify({a1: {status: 'ok'}}))
    expect(reply).toHaveBeenNthCalledWith(2, JSON.stringify({status: 'ok'}))
  })

  it('logs and replies with errors from either health lookup', () => {
    const [all, account] = handlers()
    const error = new Error('unhealthy')
    syncActivity.getLastSyncActivity.mockImplementation(() => { throw error })
    syncActivity.getLastSyncActivityForAccount.mockImplementation(() => { throw error })
    const request = {params: {accountId: 'a1'}, logger: {error: vi.fn()}}
    const reply = vi.fn()
    const h = {response: (x) => reply(x)}
    expect(() => all(request, h)).toThrow('unhealthy')
    expect(() => account(request, h)).toThrow('unhealthy')
    expect(request.logger.error).toHaveBeenCalledTimes(2)
  })
})
