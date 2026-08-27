import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('nylas-exports', async () => {
  const actual = await vi.importActual('../../stubs/nylas-exports.js');
  return actual;
});

vi.mock('isomorphic-core', () => ({
  Errors: {APIError: class APIError extends Error {}},
  IMAPErrors: {IMAPConnectionTimeoutError: class extends Error {}},
  IMAPConnection: class {},
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

globalThis.Logger = {forAccount: () => ({info() {}, warn() {}, error() {}}), log() {}};

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
  globalThis.Logger = {forAccount: () => ({info() {}, warn() {}, error() {}}), log() {}};
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
