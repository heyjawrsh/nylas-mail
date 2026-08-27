import Boom from '@hapi/boom'
import Hapi from '@hapi/hapi'
import Joi from 'joi'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {beforeEach, describe, expect, it, vi} from 'vitest'

const mocks = vi.hoisted(() => ({
  activity: {
    getLastSyncActivity: vi.fn(() => ({account: {activity: 'idle'}})),
    getLastSyncActivityForAccount: vi.fn(() => ({activity: 'idle'})),
  },
  buildForSend: vi.fn(),
  wakeWorkerForAccount: vi.fn(),
}))

vi.mock('../../src/shared/sync-activity.js', () => ({default: mocks.activity}))
vi.mock('../../src/local-sync-worker/sync-process-manager.js', () => ({
  default: {
    addWorkerForAccount: vi.fn(),
    wakeWorkerForAccount: mocks.wakeWorkerForAccount,
  },
}))
vi.mock('../../src/local-api/default-sync-policy.js', () => ({default: {}}))
vi.mock('../../src/shared/local-database-connector.js', () => ({default: {forShared: vi.fn()}}))
vi.mock('../../src/shared/dedupe-accounts.js', () => ({preventCreationOfDuplicateAccounts: vi.fn()}))
vi.mock('../../src/local-api/search.js', () => ({searchClientForAccount: vi.fn()}))
vi.mock('isomorphic-core', () => ({
  AuthHelpers: {
    imapAuthRouteConfig: () => ({auth: false}),
    imapAuthHandler: () => (_request, h) => h.response({}),
  },
  Errors: {APIError: class APIError extends Error {}},
  MessageUtils: {buildForSend: mocks.buildForSend},
  ModelUtils: {isValidId: id => /^[0-9a-z]+$/.test(id)},
  Provider: {},
}))

const model = value => ({...value, toJSON: () => value})
const jsonResult = response => JSON.parse(response.payload)
const routesDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/local-api/routes',
)
const routeFiles = [
  'auth.js', 'calendars.js', 'categories.js', 'contacts.js', 'drafts.js', 'events.js',
  'files.js', 'health.js', 'messages.js', 'ping.js', 'send.js', 'threads.js',
]

function makeDb() {
  const category = kind => ({
    findAll: vi.fn(async () => [{
      ...model({id: `${kind}-1`, object: kind, account_id: 'a1', name: kind, display_name: kind}),
      save: vi.fn(async () => {}),
    }]),
    findOne: vi.fn(async () => ({...model({id: `${kind}-1`, name: kind}), getMessages: vi.fn(async () => [])})),
    findByPk: vi.fn(async () => ({...model({id: `${kind}-1`}), save: vi.fn(async () => {})})),
  })
  return {
    Folder: category('folder'),
    Label: category('label'),
    Message: {
      rawAttributes: {id: {}, body: {}},
      findOne: vi.fn(async () => model({id: 'message-1', object: 'message'})),
    },
    Thread: {
      findAll: vi.fn(async () => [model({id: 'thread-1', object: 'thread'})]),
      findOne: vi.fn(async () => model({id: 'thread-1', object: 'thread'})),
    },
    Contact: {
      findAll: vi.fn(async () => [model({id: 'contact-1', object: 'contact'})]),
      findOne: vi.fn(async () => model({id: 'contact-1', object: 'contact'})),
    },
    File: {findOne: vi.fn(async () => ({fetch: vi.fn(async () => Buffer.from('file data'))}))},
    SyncbackRequest: {
      create: vi.fn(async args => model({...args, id: 'syncback-1', object: 'syncback_request'})),
    },
  }
}

async function makeServer({authenticated = true} = {}) {
  const testDb = makeDb()
  const server = new Hapi.Server({})
  server.validator(Joi)
  server.auth.scheme('test', () => ({
    authenticate: (request, h) => authenticated
      ? h.authenticated({credentials: {id: 'test-account-id', emailAddress: 'a@b.c', provider: 'imap'}})
      : h.unauthenticated(Boom.unauthorized()),
  }))
  server.auth.strategy('api-consumer', 'test')
  server.auth.default('api-consumer')
  server.decorate('request', 'getAccountDatabase', async () => testDb)
  server.decorate('request', 'logger', {info: vi.fn(), error: vi.fn()})
  for (const filename of routeFiles) {
    const register = (await import(pathToFileURL(path.join(routesDirectory, filename)).href)).default
    register(server)
  }
  return {server, testDb}
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.buildForSend.mockResolvedValue(model({id: 'draft-1'}))
})

describe('Hapi 21 local API routes', () => {
  it('serves public ping and authenticated health routes without binding a socket', async () => {
    const {server} = await makeServer()
    expect((await server.inject('/ping')).payload).toBe('Pong')
    expect(jsonResult(await server.inject('/health'))).toEqual({account: {activity: 'idle'}})
    expect(jsonResult(await server.inject('/health/a1'))).toEqual({activity: 'idle'})
  })

  it('validates pagination and serves placeholder collection routes', async () => {
    const {server} = await makeServer()
    for (const path of ['/drafts', '/events', '/calendars']) {
      expect(jsonResult(await server.inject(path))).toEqual([])
    }
    expect((await server.inject('/drafts?limit=0')).statusCode).toBe(400)
    expect((await server.inject('/drafts?offset=-1')).statusCode).toBe(400)
  })

  it('lists and fetches messages and threads', async () => {
    const {server, testDb} = await makeServer()
    expect(jsonResult(await server.inject('/messages/message-1')).id).toBe('message-1')
    expect(jsonResult(await server.inject('/threads?limit=7&offset=2'))[0].id).toBe('thread-1')
    expect(testDb.Thread.findAll).toHaveBeenCalledWith(expect.objectContaining({limit: 7, offset: 2}))
    expect(jsonResult(await server.inject('/threads/thread-1')).id).toBe('thread-1')
  })

  it('serves raw messages and reports missing records', async () => {
    const {server, testDb} = await makeServer()
    testDb.Message.findOne.mockResolvedValueOnce({fetchRaw: vi.fn(async () => 'raw message')})
    expect((await server.inject({url: '/messages/message-1', headers: {accept: 'message/rfc822'}})).payload)
      .toBe('raw message')
    testDb.Message.findOne.mockResolvedValueOnce(null)
    expect((await server.inject('/messages/missing')).statusCode).toBe(404)
    testDb.Thread.findOne.mockResolvedValueOnce(null)
    expect((await server.inject('/threads/missing')).statusCode).toBe(404)
    testDb.Contact.findOne.mockResolvedValueOnce(null)
    expect((await server.inject('/contacts/missing')).statusCode).toBe(404)
    testDb.File.findOne.mockResolvedValueOnce(null)
    expect((await server.inject('/files/missing/download')).statusCode).toBe(404)
  })

  it('covers folder and label list, create, update, and delete paths', async () => {
    const {server, testDb} = await makeServer()
    for (const kind of ['folder', 'label']) {
      expect((await server.inject(`/${kind}s`)).statusCode).toBe(200)
      expect((await server.inject({method: 'POST', url: `/${kind}s`, payload: {display_name: 'New'}})).statusCode).toBe(200)
      expect((await server.inject({method: 'PUT', url: `/${kind}s/id1`, payload: {display_name: 'Renamed'}})).statusCode).toBe(200)
      expect((await server.inject({method: 'DELETE', url: `/${kind}s/id1`})).statusCode).toBe(200)
    }
    expect(testDb.SyncbackRequest.create).toHaveBeenCalledTimes(6)
  })

  it('updates category roles locally', async () => {
    const {server, testDb} = await makeServer()
    const response = await server.inject({method: 'PUT', url: '/folders/id1', payload: {role: 'archive'}})
    expect(response.statusCode).toBe(200)
    expect(testDb.Folder.findByPk).toHaveBeenCalledWith('id1')
  })

  it('serves contacts and file downloads', async () => {
    const {server} = await makeServer()
    expect(jsonResult(await server.inject('/contacts'))[0].id).toBe('contact-1')
    expect(jsonResult(await server.inject('/contacts/contact-1')).id).toBe('contact-1')
    expect(jsonResult(await server.inject('/contacts/rankings'))).toEqual([])
    expect((await server.inject('/files/file-1/download')).payload).toBe('file data')
  })

  it('builds drafts and creates serialized send syncback requests', async () => {
    const {server, testDb} = await makeServer()
    const draft = await server.inject({method: 'POST', url: '/drafts/build', payload: {subject: 'Hi'}})
    expect(jsonResult(draft)).toMatchObject({id: 'draft-1', sentFolderName: 'folder', trashFolderName: 'folder'})
    const sent = await server.inject({
      method: 'POST',
      url: '/ensure-message-in-sent-folder/abc123',
      payload: {customSentMessage: true},
    })
    expect(jsonResult(sent)).toMatchObject({type: 'EnsureMessageInSentFolder', accountId: 'test-account-id'})
    expect(testDb.SyncbackRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      props: {messageId: 'abc123', customSentMessage: true},
    }))
  })

  it('maps every thread update and rejects empty updates', async () => {
    const {server, testDb} = await makeServer()
    const updates = [
      {payload: {folder_id: 'f1', label_ids: ['l1']}, type: 'SetThreadFolderAndLabels'},
      {payload: {folder: 'f1'}, type: 'MoveThreadToFolder'},
      {payload: {labels: ['l1']}, type: 'SetThreadLabels'},
      {payload: {unread: false}, type: 'MarkThreadAsRead'},
      {payload: {unread: true}, type: 'MarkThreadAsUnread'},
      {payload: {starred: false}, type: 'UnstarThread'},
      {payload: {starred: true}, type: 'StarThread'},
    ]
    for (const update of updates) {
      const response = await server.inject({method: 'PUT', url: '/threads/t1', payload: update.payload})
      expect(jsonResult(response).type).toBe(update.type)
    }
    expect(testDb.SyncbackRequest.create).toHaveBeenCalledTimes(updates.length)
    expect((await server.inject({method: 'PUT', url: '/threads/t1', payload: {}})).statusCode).toBe(400)
  })

  it('turns syncback persistence failures into server errors', async () => {
    const {server, testDb} = await makeServer()
    testDb.SyncbackRequest.create.mockRejectedValueOnce(new Error('write failed'))
    expect((await server.inject({
      method: 'POST',
      url: '/ensure-message-in-sent-folder/abc123',
      payload: {customSentMessage: false},
    })).statusCode).toBe(500)
    expect((await server.inject({
      method: 'POST',
      url: '/ensure-message-in-sent-folder/not-valid!',
      payload: {customSentMessage: false},
    })).statusCode).toBe(400)
  })

  it('returns 401 when the default authentication strategy rejects a request', async () => {
    const {server} = await makeServer({authenticated: false})
    expect((await server.inject('/events')).statusCode).toBe(401)
    expect((await server.inject('/ping')).statusCode).toBe(200)
  })

  it('registers the public auth handler supplied by isomorphic-core', async () => {
    const {server} = await makeServer({authenticated: false})
    expect((await server.inject({method: 'POST', url: '/auth'})).statusCode).toBe(200)
  })
})
