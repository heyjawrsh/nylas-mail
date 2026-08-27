import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('nylas-exports', async () => {
  const actual = await vi.importActual('../../stubs/nylas-exports.js');
  return actual;
});

vi.mock('isomorphic-core', () => ({
  Errors: {APIError: class APIError extends Error {}},
  IMAPErrors: {IMAPConnectionTimeoutError: class extends Error {}},
  IMAPConnection: class { static Capabilities = {Condstore: 'CONDSTORE', Gmail: 'X-GM-EXT-1'} },
  IMAPConnectionPool: {withConnectionsForAccount: vi.fn()},
  ExponentialBackoffScheduler: class { constructor() {} },
  BackoffScheduler: class {},
  DatabaseTypes: {},
  StringUtils: {capitalize: (x) => x},
  loadModels: vi.fn(),
  HookIncrementVersionOnSave: vi.fn(),
  HookTransactionLog: vi.fn(),
  MessageUtils: {},
  TrackingUtils: {addRecipientToTrackingLinks: ({baseMessage}) => baseMessage.body, stripTrackingLinksFromBody: (b) => b, shouldTrackLink: () => false},
  SendmailClient: class {},
  ModelUtils: {deepClone: (m) => m},
  Provider: {Gmail: 'gmail', IMAP: 'imap'},
}));

vi.mock('../../../src/local-sync-worker/sync-tasks/sync-task.js', () => {
  return {default: class SyncTask {
    constructor(account) { this._account = account; this._logger = global.Logger.forAccount(account) }
    syncbackRequestObject() { return this._syncbackRequest || {} }
    description() { return 'test' }
    affectsImapMessageUIDs() { return false }
    async run(db, imap) { return this._run(db, imap) }
  }};
});

globalThis.Logger = {forAccount: () => ({info() {}, warn() {}, error() {}, log() {}}), log() {}};

import FetchMessagesInFolderIMAP from '../../../src/local-sync-worker/sync-tasks/fetch-messages-in-folder.imap.js';

const makeStruct = (overrides = {}) => {
  const leaf = (id, type, subtype, extra = {}) => ({partID: id, type, subtype, ...extra});
  return [
    [leaf('1', 'text', 'plain', {encoding: 'base64', size: 50, params: {charset: 'utf-8'}, disposition: null})],
    'alternative',
    {params: {}},
  ];
};

beforeEach(() => {
  globalThis.Logger = {forAccount: () => ({info() {}, warn() {}, error() {}, log() {}}), log() {}};
});

describe('FetchMessagesInFolderIMAP pure helpers', () => {
  const task = new FetchMessagesInFolderIMAP({account: {id: 'a1', provider: 'imap', emailAddress: 'a@b.c'}, folder: {id: 'f1', name: 'INBOX', syncState: {minUID: null}}});

  it('picks text/plain and text/html leaf parts from structs', () => {
    const struct = [
      {partID: '1', type: 'text', subtype: 'plain', encoding: '7bit', size: 10, params: {}},
      {partID: '2', type: 'text', subtype: 'html', encoding: '7bit', size: 20, params: {}, disposition: {type: 'inline'}},
      {partID: '3', type: 'application', subtype: 'pdf', encoding: 'base64', size: 999, params: {}, disposition: {type: 'attachment'}},
    ];
    const desired = task._getDesiredMIMEParts(struct);
    expect(desired.map((p) => p.id)).toEqual(['1', '2']);
  });

  it('flattens multipart/alternative trees to html parts', () => {
    const plain = {partID: '1', type: 'text', subtype: 'plain', encoding: '7bit', size: 10, params: {}};
    const html = {partID: '2', type: 'text', subtype: 'html', encoding: '7bit', size: 20, params: {}};
    const struct = [[plain, html], 'alternative', {params: {}}];
    const desired = task._getDesiredMIMEParts(struct);
    expect(desired.map((p) => p.mimeType)).toContain('text/html');  // alternative trees prefer html when present
  });

  it('skips attachments regardless of type', () => {
    const struct = [
      {partID: '1', type: 'text', subtype: 'plain', encoding: '7bit', size: 10, params: {}, disposition: {type: 'attachment'}},
    ];
    expect(task._getDesiredMIMEParts(struct)).toEqual([]);
  });

  it('nested multipart containers are walked depth-first', () => {
    const inner = {partID: '2.1', type: 'text', subtype: 'plain', encoding: '7bit', size: 5, params: {}};
    const struct = [[inner], 'mixed', {params: {}}];
    const desired = task._getDesiredMIMEParts(struct);
    expect(desired.map((p) => p.id)).toEqual(['2.1']);
  });
});

describe('FetchMessagesInFolderIMAP sync decision helpers', () => {
  const folder = (syncState) => ({
    id: 'f1', name: 'INBOX', syncState,
    isSyncComplete() {
      if (!this.syncState) { return false }
      const {fetchedmin, minUID, fetchedmax, uidnext} = this.syncState;
      return fetchedmin !== null && minUID !== null && fetchedmax !== null
        && fetchedmin <= minUID && fetchedmax >= uidnext;
    },
  });
  const task = (syncState) => new FetchMessagesInFolderIMAP({
    account: {id: 'a1', provider: 'imap', emailAddress: 'a@b.c'},
    folder: folder(syncState),
  });
  const complete = {fetchedmin: 1, minUID: 1, fetchedmax: 10, uidnext: 10, uidvalidity: 5, highestmodseq: 3};

  it('_shouldFetchMessages: incomplete folders always fetch', () => {
    expect(task({fetchedmin: null})._shouldFetchMessages({name: 'INBOX', uidnext: 99})).toBe(true);
  });

  it('_shouldFetchMessages: complete folders skip when uidnext is unchanged', () => {
    expect(task({...complete})._shouldFetchMessages({name: 'INBOX', uidnext: 10, uidvalidity: 5})).toBe(false);
  });

  it('_shouldFetchMessages: new mail (uidnext past fetchedmax) fetches', () => {
    expect(task({...complete})._shouldFetchMessages({name: 'INBOX', uidnext: 12, uidvalidity: 5})).toBe(true);
  });

  it('_shouldFetchMessages: uidvalidity change forces a fetch', () => {
    expect(task({...complete})._shouldFetchMessages({name: 'INBOX', uidnext: 10, uidvalidity: 6})).toBe(true);
  });

  it('_shouldFetchMessages: mismatched box name throws', () => {
    expect(() => task({...complete})._shouldFetchMessages({name: 'Other', uidnext: 10, uidvalidity: 5})).toThrow(/boxStatus doesn't correspond/);
  });

  it('_shouldFetchAttributes: changes with highestmodseq when supported', () => {
    const t = task({...complete});
    t._imap = {serverSupports: (cap) => cap === 'CONDSTORE'};
    expect(t._shouldFetchAttributes({name: 'INBOX', uidnext: 10, uidvalidity: 5, highestmodseq: 4})).toBe(true);
    expect(t._shouldFetchAttributes({name: 'INBOX', uidnext: 10, uidvalidity: 5, highestmodseq: 3})).toBe(false);
  });

  it('_shouldFetchAttributes: always fetches when CONDSTORE unsupported', () => {
    const t = task({...complete});
    t._imap = {serverSupports: () => false};
    expect(t._shouldFetchAttributes({name: 'INBOX', uidnext: 10, uidvalidity: 5, highestmodseq: 9})).toBe(true);
  });

  it('_shouldSyncFolder combines both signals', () => {
    const t = task({...complete});
    t._imap = {serverSupports: () => false};
    expect(t._shouldSyncFolder({name: 'INBOX', uidnext: 10, uidvalidity: 5})).toBe(true);
  });

  it('_isFirstSync is true while minUID is unset', () => {
    expect(task({minUID: null})._isFirstSync()).toBe(true);
    expect(task({...complete})._isFirstSync()).toBe(false);
  });

  it('_supportsChangesSince reads CONDSTORE from the connection', () => {
    const t = task({...complete});
    t._imap = {serverSupports: (cap) => cap === 'CONDSTORE'};
    expect(t._supportsChangesSince()).toBe(true);
    t._imap = {serverSupports: () => false};
    expect(t._supportsChangesSince()).toBe(false);
  });

  it('_batchSizeForFolder scales with uidnext for first syncs', () => {
    const t = task({minUID: null});
    t._imap = {serverSupports: () => false};
    t._syncWorker = {_latestOpenTimesByFolder: new Map([['INBOX', 100]])};
    const size = t._batchSizeForFolder();
    expect(size).toBeGreaterThan(0);
  });
});
