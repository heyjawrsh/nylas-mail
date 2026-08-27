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
  it('updates existing metadata and rejects unexpected persistence errors', async () => {
    const existing = {version: 0, save: vi.fn().mockResolvedValue({saved: true})}; Metadata.find.mockResolvedValue(existing)
    expect(JSON.parse(await route.handler(request, toolkit()))).toEqual({saved: true})
    expect(existing.value).toEqual({key: 'value'})
    Metadata.find.mockRejectedValueOnce(new Error('database unavailable'))
    expect((await route.handler(request, toolkit())).statusCode).toBe(500)
  })
  it('validates expiration dates', async () => {
    request.payload.value = '{"expiration":"not-a-date"}'
    expect((await route.handler(request, toolkit())).statusCode).toBe(400)
  })
  it('lists account metadata with pagination', async () => {
    const server = getMockServer(); registerMetadataRoutes(server); const get = server.routes.find(({method}) => method === 'GET')
    Metadata.findAll.mockResolvedValue([{id: 1}])
    expect(JSON.parse(await get.handler({...request, query: {limit: 10, offset: 2}}))).toEqual([{id: 1}])
    expect(Metadata.findAll).toHaveBeenCalledWith({limit: 10, offset: 2, where: {accountId: 'account'}})
  })
  it('merges equivalent thread metadata and reports key conflicts', async () => {
    const destroy = vi.fn(); const save = vi.fn().mockResolvedValue({merged: true})
    Metadata.findAll.mockResolvedValue([{objectId: 't:one', version: 3, value: {same: 1}, save}, {objectId: 't:two', value: {same: 2}, destroy}])
    Metadata.find.mockResolvedValue({version: 3, save})
    request.payload = {objectType: 'thread', version: 0, value: '{"new":3}', messageIds: ['one', 'two']}
    expect(JSON.parse(await route.handler(request, toolkit()))).toEqual({merged: true})
    expect(destroy).toHaveBeenCalled(); expect(mocks.captureException).toHaveBeenCalled()
  })
  it('soft deletes metadata and maps conflicts', async () => {
    const server = getMockServer(); registerMetadataRoutes(server); const del = server.routes.find(({method}) => method === 'DELETE')
    const delRequest = {...request, payload: {objectType: 'message', version: 0}}
    Metadata.find.mockResolvedValue({version: 0, save: vi.fn().mockResolvedValue({deleted: true})})
    expect(JSON.parse(await del.handler(delRequest, toolkit()))).toEqual({deleted: true})
    Metadata.find.mockRejectedValueOnce(new Error('conflict')); expect((await del.handler(delRequest, toolkit())).statusCode).toBe(409)
  })
})
