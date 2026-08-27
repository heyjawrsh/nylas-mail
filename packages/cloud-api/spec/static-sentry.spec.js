import {beforeEach, describe, expect, it, vi} from 'vitest'
const sentry = vi.hoisted(() => ({init: vi.fn(), captureException: vi.fn()}))
vi.mock('@sentry/node', () => sentry)
import sentryPlugin, {captureException} from '../src/sentry'
import registerStaticRoutes from '../src/routes/static'
import {getMockServer} from './helpers'

describe('static and Sentry integration', () => {
  beforeEach(() => vi.clearAllMocks())
  it('registers the static directory', () => {
    const server = getMockServer(); registerStaticRoutes(server)
    expect(server.routes[0]).toEqual(expect.objectContaining({path: '/static/{file*}', handler: {directory: expect.objectContaining({listing: true})}}))
  })
  it('initializes, exposes, and captures request errors', () => {
    let listener; const server = {expose: vi.fn(), events: {on: vi.fn((_name, fn) => { listener = fn })}}
    sentryPlugin.register(server, {dsn: 'dsn', client: {debug: true}, tags: {service: 'api'}})
    expect(sentry.init).toHaveBeenCalledWith({dsn: 'dsn', debug: true}); expect(server.expose).toHaveBeenCalledWith('client', expect.anything())
    listener({}, {}, {}); expect(sentry.captureException).not.toHaveBeenCalled()
    const error = new Error('bad'); listener({info: {received: 1, id: 'i', remoteAddress: 'ip'}, method: 'get', path: '/x'}, {error}, {error: true})
    expect(sentry.captureException).toHaveBeenCalledWith(error, expect.objectContaining({tags: {service: 'api'}}))
    captureException(error); expect(sentry.captureException).toHaveBeenCalledWith(error)
  })
})
