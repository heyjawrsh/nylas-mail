import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'
const aws = vi.hoisted(() => ({send: vi.fn(), command: vi.fn()}))
vi.mock('@aws-sdk/client-s3', () => ({S3Client: class { send(...args) { return aws.send(...args) } }, PutObjectCommand: class { constructor(value) { aws.command(value); Object.assign(this, value) } }}))
import {getMockServer, getToolkit} from './helpers'

describe('blob routes', () => {
  let registerBlobsRoutes
  beforeAll(async () => {
    vi.stubEnv('BUCKET_NAME', 'bucket'); vi.stubEnv('BUCKET_AWS_ACCESS_KEY_ID', 'key'); vi.stubEnv('BUCKET_AWS_SECRET_ACCESS_KEY', 'secret')
    ;({default: registerBlobsRoutes} = await import('../src/routes/blobs'))
  })
  beforeEach(() => vi.clearAllMocks())
  it('rejects incomplete uploads', async () => {
    const server = getMockServer(); registerBlobsRoutes(server)
    const result = await server.routes[0].handler({payload: {}, auth: {credentials: {account: {id: 'a'}}}}, getToolkit())
    expect(result.statusCode).toBe(400)
  })
  it('uploads a blob to S3', async () => {
    aws.send.mockResolvedValue({}); const server = getMockServer(); registerBlobsRoutes(server)
    const file = {_data: Buffer.from('x'), hapi: {filename: 'x.txt'}}
    const result = await server.routes[0].handler({payload: {id: 'i', file}, auth: {credentials: {account: {id: 'a'}}}, logger: {error: vi.fn()}}, getToolkit())
    expect(JSON.parse(result)).toEqual({filename: 'x.txt'}); expect(aws.command).toHaveBeenCalledWith(expect.objectContaining({Bucket: 'bucket', Key: 'a-i'}))
  })
  it('formats upload failures', async () => {
    aws.send.mockRejectedValue(new Error('S3 down')); const server = getMockServer(); registerBlobsRoutes(server); const error = vi.fn()
    const result = await server.routes[0].handler({payload: {id: 'i', file: {_data: Buffer.from('x'), hapi: {filename: 'x'}}}, auth: {credentials: {account: {id: 'a'}}}, logger: {error}}, getToolkit())
    expect(result.statusCode).toBe(500); expect(error).toHaveBeenCalled()
  })
})
