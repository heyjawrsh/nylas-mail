import {beforeEach, describe, expect, it, vi} from 'vitest'
const mocks = vi.hoisted(() => ({forShared: vi.fn(), captureException: vi.fn()}))
vi.mock('cloud-core', () => ({DatabaseConnector: {forShared: mocks.forShared}}))
vi.mock('../src/sentry', () => ({captureException: mocks.captureException}))
import registerMetadataRoutes from '../src/routes/metadata'
import {getMockServer} from './helpers'

const toolkit = () => ({response: (value) => ({value, code(statusCode) { this.statusCode = statusCode; return this }})})
describe('metadata routes', () => {
  let Metadata, route, request
  beforeEach(() => {
    Metadata = {find: vi.fn(), findAll: vi.fn().mockResolvedValue([]), create: vi.fn()}
    mocks.forShared.mockResolvedValue({Metadata})
    const server = getMockServer(); registerMetadataRoutes(server)
    route = server.routes.find(({method}) => Array.isArray(method))
    request = {auth: {credentials: {account: {id: 'account'}}},
      params: {objectId: '123', pluginId: 'plugin'},
      payload: {objectType: 'message', version: 0, value: '{"key":"value"}'}}
  })
  it('creates metadata with parsed JSON', async () => {
    Metadata.find.mockResolvedValue(null); Metadata.create.mockImplementation(async value => value)
    expect(JSON.parse(await route.handler(request, toolkit())).value).toEqual({key: 'value'})
  })
  it('returns 400 for malformed JSON', async () => {
    request.payload.value = 'not json'
    expect((await route.handler(request, toolkit())).statusCode).toBe(400)
  })
  it('returns 409 for a version conflict', async () => {
    Metadata.find.mockResolvedValue({version: 2})
    expect((await route.handler(request, toolkit())).statusCode).toBe(409)
  })
})
