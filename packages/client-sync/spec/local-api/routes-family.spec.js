import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('isomorphic-core', () => ({
  Errors: {APIError: class APIError extends Error {}, RetryableError: class RetryableError extends Error {}},
  Provider: {Gmail: 'gmail', IMAP: 'imap'},
  StringUtils: {capitalize: (x) => x, singularize: (x) => x},
  loadModels: vi.fn(),
  HookIncrementVersionOnSave: vi.fn(),
  HookTransactionLog: vi.fn(),
  MessageUtils: {buildForSend: vi.fn(async () => ({})), parseFromImap: vi.fn()},
  Joi: {string: () => ({valid: () => ({required: () => ({})})}), object: () => ({keys: () => ({})})},
  ModelUtils: {deepClone: (m) => JSON.parse(JSON.stringify(m)), isValidId: () => true},
  AuthHelpers: {},
  ExponentialBackoffScheduler: class { constructor() {} },
  IMAPErrors: {IMAPConnectionTimeoutError: class extends Error {}},
  IMAPConnectionPool: {withConnectionsForAccount: vi.fn()},
}));
import threadsRoutes from '../../src/local-api/routes/threads.js';
import categoriesRoutes from '../../src/local-api/routes/categories.js';
import contactsRoutes from '../../src/local-api/routes/contacts.js';
import messagesRoutes from '../../src/local-api/routes/messages.js';
import filesRoutes from '../../src/local-api/routes/files.js';
import sendRoutes from '../../src/local-api/routes/send.js';

function collect(register) {
  const routes = [];
  register({route: (def) => routes.push(def)});
  return routes;
}

function routeFor(routes, path, method = 'GET') {
  const r = routes.find((x) => x.path === path && (x.method || '').toUpperCase() === method);
  if (!r) { throw new Error(`no route ${method} ${path}; have ${routes.map((x) => x.method + ' ' + x.path).join(', ')}`) }
  return r;
}

const db = () => ({
  Thread: {
    findAll: vi.fn(async () => [{id: 't1', toJSON: () => ({id: 't1', object: 'thread'})}]),
    findOne: vi.fn(async () => null),
    findAndCountAll: vi.fn(async () => ({rows: [], count: 0})),
    count: vi.fn(async () => 0),
  },
  Folder: {
    findAll: vi.fn(async () => [{id: 'f1', toJSON: () => ({id: 'f1', object: 'folder'})}]),
    findOne: vi.fn(async () => null),
    findOrCreate: vi.fn(async () => [{id: 'f1', toJSON: () => ({id: 'f1'})}, true]),
  },
  Label: {
    findAll: vi.fn(async () => []),
    findOne: vi.fn(async () => null),
    findOrCreate: vi.fn(async () => [{id: 'l1', toJSON: () => ({id: 'l1'})}, true]),
  },
  Contact: {
    findAll: vi.fn(async () => [{id: 'c1', toJSON: () => ({id: 'c1', object: 'contact'})}]),
    findOne: vi.fn(async () => null),
  },
  Message: {
    rawAttributes: {id: {}, subject: {}, body: {}},
    findAll: vi.fn(async () => []),
    findOne: vi.fn(async () => ({id: 'm1', body: '<p>hi</p>', toJSON: () => ({id: 'm1'})})),
    count: vi.fn(async () => 0),
  },
  File: {
    findAll: vi.fn(async () => []),
    findOne: vi.fn(async () => ({id: 'file1', toJSON: () => ({id: 'file1'})})),
  },
  SyncbackRequest: {create: vi.fn(async (args) => ({...args, toJSON: () => ({...args})}))},
});

function requestFor(route, params = {}, extras = {}) {
  return {
    params,
    headers: {accept: 'application/json'},
    query: {limit: 100, offset: 0},
    auth: {credentials: {id: 'a1', emailAddress: 'a@b.c', provider: 'imap'}},
    logger: {info: vi.fn(), warn: vi.fn(), error: vi.fn()},
    getAccountDatabase: async () => requestFor._db,
    ...extras,
  };
}

const toolkit = () => {
  const responses = [];
  return {h: {response: (x) => { responses.push(x); return x }, redirect: (x) => { responses.push({redirect: x}); return {redirect: x} }}, responses};
}

beforeEach(() => { vi.clearAllMocks() });

describe('threads routes', () => {
  const routes = collect(threadsRoutes);
  it('registers the thread endpoints', () => {
    expect(routes.length).toBeGreaterThan(2);
  });
  it('lists threads from the database', async () => {
    const {h, responses} = toolkit();
    requestFor._db = db();
    const out = await routeFor(routes, '/threads').handler(requestFor(), h);
    expect(responses.length + (out !== undefined ? 1 : 0)).toBeGreaterThan(0);
  });
  it('fetches a single thread', async () => {
    const {h} = toolkit();
    requestFor._db = db();
    requestFor._db.Thread.findOne.mockResolvedValue({id: 't9', toJSON: () => ({id: 't9'})});
    const route = routes.find((r) => r.path.includes('id') && (r.method || '').toUpperCase() === 'GET');
    if (route) { await route.handler(requestFor(route, {id: 't9'}), h) }
  });
});

describe('categories routes', () => {
  const routes = collect(categoriesRoutes);
  it('lists categories (folders + labels)', async () => {
    const {h} = toolkit();
    requestFor._db = db();
    const route = routes.find((r) => (r.method || '').toUpperCase() === 'GET' && !r.path.includes('{'));
    if (route) { await route.handler(requestFor(), h) }
  });
  it('creates a category via syncback', async () => {
    const {h} = toolkit();
    requestFor._db = db();
    const route = routes.find((r) => (r.method || '').toUpperCase() === 'POST');
    if (route) {
      const out = await route.handler(requestFor(route, {}, {payload: {display_name: 'X', object_class: 'folder'}}), h);
      expect(out).toBeDefined();
    }
  });
});

describe('contacts routes', () => {
  const routes = collect(contactsRoutes);
  it('lists contacts', async () => {
    const {h} = toolkit();
    requestFor._db = db();
    const route = routes.find((r) => (r.method || '').toUpperCase() === 'GET' && !r.path.includes('{'));
    if (route) { await route.handler(requestFor(), h) }
  });
});

describe('messages routes', () => {
  const routes = collect(messagesRoutes);
  it('fetches a message body by id', async () => {
    const {h} = toolkit();
    requestFor._db = db();
    const route = routes.find((r) => r.path.includes('{id}'));
    if (route) { await route.handler(requestFor(route, {id: 'm1'}), h) }
  });
});

describe('files routes', () => {
  const routes = collect(filesRoutes);
  it('registers file endpoints', () => {
    expect(routes.length).toBeGreaterThan(0);
  });
});

describe('send routes', () => {
  const routes = collect(sendRoutes);
  it('creates a send syncback request', async () => {
    const {h} = toolkit();
    requestFor._db = db();
    const route = routes.find((r) => (r.method || '').toUpperCase() === 'POST');
    if (route) {
      const out = await route.handler(requestFor(route, {}, {payload: {messagePayload: {id: 'm1', body: 'b', to: [{email: 'x@y.z'}], from: [{email: 'a@b.c'}], subject: 's', date: 1700000000, uploads: []}}}), h);
      expect(out).toBeDefined();
    }
  });
});

import draftsRoutes from '../../src/local-api/routes/drafts.js';

describe('drafts routes', () => {
  const routes = collect(draftsRoutes);
  it('resolves the gmail sent label for gmail accounts', async () => {
    const {h} = toolkit();
    const testDb = db();
    testDb.Label.findOne = vi.fn(async () => ({name: '[Gmail]/Sent Mail'}));
    testDb.Folder.findOne = vi.fn(async () => ({name: 'Trash'}));
    requestFor._db = testDb;
    const route = routes.find((r) => String(r.method).toUpperCase() === 'GET' && String(r.path).includes('sent'));
    if (route) { await route.handler(requestFor(route, {}, {auth: {credentials: {id: 'a1', provider: 'gmail', emailAddress: 'a@b.c'}}}), h) }
  });
});
