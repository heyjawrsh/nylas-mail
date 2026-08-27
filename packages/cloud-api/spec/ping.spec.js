import {beforeEach, describe, expect, it, vi} from 'vitest'
import Hapi from '@hapi/hapi'
const forShared = vi.hoisted(() => vi.fn())
vi.mock('cloud-core', () => ({DatabaseConnector: {forShared}}))
import registerPingRoutes from '../src/routes/ping'

describe('ping routes', () => {
  let server
  beforeEach(() => {
    server = Hapi.server()
    server.decorate('request', 'logger', {info: vi.fn(), debug: vi.fn()})
    registerPingRoutes(server)
  })
  it('responds to the basic health check', async () => {
    const response = await server.inject('/ping/basic')
    expect(response.statusCode).toBe(200); expect(response.result).toBe('Pong')
  })
  it('checks the database and boomifies failures', async () => {
    const query = vi.fn().mockResolvedValue([])
    forShared.mockResolvedValueOnce({sequelize: {query}})
    expect((await server.inject('/ping')).result).toBe('DB Okay')
    forShared.mockRejectedValueOnce(new Error('down'))
    expect((await server.inject('/ping')).statusCode).toBe(500)
  })
  it('preserves explicit error statuses', async () => {
    expect((await server.inject('/ping/400')).statusCode).toBe(400)
    expect((await server.inject('/ping/401')).statusCode).toBe(401)
    expect((await server.inject('/ping/500')).statusCode).toBe(500)
  })
  it('formats thrown and downstream errors', async () => {
    expect((await server.inject('/ping/broken')).statusCode).toBe(500)
    const downstream = await server.inject('/ping/downstream_error')
    expect(downstream.statusCode).toBe(400); expect(downstream.result.message).toBe('Extra info here: Downstream badness')
  })
})
