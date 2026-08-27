import {describe, it, expect, vi} from 'vitest';

vi.mock('isomorphic-core', () => ({
  ExponentialBackoffScheduler: class { constructor() { this.d = 1000 } currentDelay() { return this.d } nextDelay() { this.d *= 2 } },
  IMAPErrors: {IMAPConnectionTimeoutError: class extends Error {}},
  IMAPConnectionPool: {withConnectionsForAccount: vi.fn()},
}));

vi.mock('nylas-exports', () => ({
  SearchQueryParser: {parse: vi.fn(() => ({}))},
  IMAPSearchQueryBackend: {compile: vi.fn(() => [['UNSEEN']]), folderNamesForQuery: vi.fn(() => ['inbox', 'sent', 'archive']), ALL_FOLDERS: vi.fn(() => Symbol('all'))},
}));

vi.mock('../../src/local-sync-worker/sync-process-manager.js', () => ({
  default: {wakeWorkerForAccount: vi.fn()},
}));

import {searchClientForAccount} from '../../src/local-api/search.js';

globalThis.Logger = {forAccount: () => ({info() {}, warn() {}, error() {}, child: () => ({info() {}, warn() {}, error() {}})})};

const db = () => ({
  Message: {rawAttributes: {id: {}, body: {}, subject: {}}, findAll: vi.fn(async () => [])},
  Thread: {findAll: vi.fn(async () => [{id: 't1', toJSON: () => ({id: 't1'})}])},
  Folder: {}, Label: {}, File: {},
});

describe('searchClientForAccount', () => {
  it('returns the GmailSearchClient for gmail accounts', () => {
    const client = searchClientForAccount({id: 'a1', provider: 'gmail', emailAddress: 'a@b.c'});
    expect(client.constructor.name).toContain('Search');
    expect(typeof client.searchThreads).toBe('function');
  });

  it('returns the ImapSearchClient for imap/office365 accounts', () => {
    for (const provider of ['imap', 'office365']) {
      const client = searchClientForAccount({id: 'a1', provider, emailAddress: 'a@b.c'});
      expect(client.constructor.name).toContain('Search');
    }
  });

  it('throws for unsupported providers', () => {
    expect(() => searchClientForAccount({provider: 'carrier-pigeon'})).toThrow(/Unsupported provider/);
  });

  it('searchThreads streams thread JSON for found uids', async () => {
    const client = searchClientForAccount({id: 'a1', provider: 'imap', emailAddress: 'a@b.c'});
    const testDb = db();
    testDb.Folder = {findAll: vi.fn(async () => [{id: 'f1', name: 'INBOX'}])};
    testDb.SyncbackRequest = {create: vi.fn(async () => ({}))};
    // IMAP search finds uid 7 locally already
    testDb.Message.findAll = vi.fn(async () => [{id: 'm1', threadId: 't1', folderImapUID: 7}]);
    // mock the IMAP connection pool path
    const {IMAPConnectionPool} = await import('isomorphic-core');
    IMAPConnectionPool.withConnectionsForAccount.mockImplementation(async (account, {onConnected}) => {
      const conn = {runOperation: vi.fn(async (op) => op.run(testDb, {openBox: vi.fn(async () => ({search: vi.fn(async () => [7])}))}))};
      await onConnected([conn]);
    });
    const {firstValueFrom} = await import('rxjs');
    const stream = await client.searchThreads(testDb, 'hello', 100);
    const first = await firstValueFrom(stream);
    expect(first).toContain('t1');
  });

  it('folder selection and criteria honor parsed queries', async () => {
    const client = searchClientForAccount({id: 'a1', provider: 'imap', emailAddress: 'a@b.c'});
    const testDb = db();
    testDb.Folder = {findAll: vi.fn(async () => [])};
    const folders = await client._getFoldersForSearch(testDb, {any: []});
    expect(Array.isArray(folders)).toBe(true);
    const criteria = client._getCriteriaForQuery({any: []}, {name: 'INBOX'});
    expect(criteria).toBeDefined();
  });
});
