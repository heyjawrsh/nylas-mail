import {beforeEach, describe, expect, it, vi} from 'vitest'
const mocks = vi.hoisted(() => ({forShared: vi.fn(), observeDeltas: vi.fn(), build: vi.fn(), send: vi.fn()}))
vi.mock('cloud-core', () => ({DatabaseConnector: {forShared: mocks.forShared}, PubsubConnector: {observeDeltas: mocks.observeDeltas}}))
vi.mock('isomorphic-core', () => ({DeltaStreamBuilder: {buildAPIStream: mocks.build, DELTA_CONNECTION_TIMEOUT_MS: 100}, MetricsReporter: {sendToHoneycomb: mocks.send}}))
import registerDeltaRoutes from '../src/routes/delta'
import registerHoneycombRoutes from '../src/routes/honeycomb'
import {getMockServer, getToolkit} from './helpers'

describe('delta and metrics routes', () => {
  beforeEach(() => vi.clearAllMocks())
  it('builds and closes a delta stream', async () => {
    let endHandler
    const stream = {once: vi.fn((_event, handler) => { endHandler = handler }), close: vi.fn()}
    mocks.build.mockResolvedValue(stream); mocks.forShared.mockReturnValue('db'); mocks.observeDeltas.mockReturnValue('deltas')
    const server = getMockServer(); registerDeltaRoutes(server)
    const request = {auth: {credentials: {account: {id: 'a'}}}, query: {cursor: 'c'}, logger: {info: vi.fn()}, raw: {res: {end: vi.fn()}}}
    expect((await server.routes[0].handler(request, getToolkit())).value).toBe(stream)
    expect(mocks.build).toHaveBeenCalledWith(request, expect.objectContaining({accountId: 'a', cursor: 'c'}))
    endHandler(); expect(stream.close).toHaveBeenCalled()
  })
  it('ends a delta response after its timeout', async () => {
    vi.useFakeTimers()
    const stream = {once: vi.fn(), close: vi.fn()}; mocks.build.mockResolvedValue(stream)
    const server = getMockServer(); registerDeltaRoutes(server)
    const end = vi.fn(); const info = vi.fn()
    await server.routes[0].handler({auth: {credentials: {account: {id: 'a'}}}, query: {cursor: 'c'}, logger: {info}, raw: {res: {end}}}, getToolkit())
    vi.advanceTimersByTime(100); expect(end).toHaveBeenCalled(); expect(info).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
  it('forwards metrics and acknowledges ingestion', () => {
    const server = getMockServer(); registerHoneycombRoutes(server)
    expect(server.routes[0].handler({payload: {metric: 1}})).toEqual({success: true})
    expect(mocks.send).toHaveBeenCalledWith({metric: 1})
  })
})
