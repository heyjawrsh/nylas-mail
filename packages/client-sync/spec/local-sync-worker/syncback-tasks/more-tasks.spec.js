import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('isomorphic-core', () => ({
  Errors: {APIError: class APIError extends Error {}, RetryableError: class RetryableError extends Error {}},
  MessageUtils: {
    buildForSend: vi.fn(async () => ({
      body: 'body', setIsSent: vi.fn(), save: vi.fn(async () => {}), toJSON: () => ({id: 'm1'}),
    })),
  },
  TrackingUtils: {stripTrackingLinksFromBody: vi.fn((b) => b)},
  ModelUtils: {deepClone: (m) => JSON.parse(JSON.stringify(m))},
}));

import SetThreadLabelsIMAP from '../../../src/local-sync-worker/syncback-tasks/set-thread-labels.imap.js';
import SyncUnknownUIDsIMAP from '../../../src/local-sync-worker/syncback-tasks/sync-unknown-uids.imap.js';
import SendMessagePerRecipientSMTP from '../../../src/local-sync-worker/syncback-tasks/send-message-per-recipient.smtp.js';
import SyncbackTaskRunner from '../../../src/local-sync-worker/syncback-task-runner.js';

const account = {id: 'acct-1', emailAddress: 'a@example.com', provider: 'gmail'};

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.Logger = {forAccount: () => ({info() {}, warn() {}, error() {}}), log() {}};
});

function threadDb({labels = []} = {}) {
  const thread = {id: 't1', labels, getMessages: vi.fn(async () => []), update: vi.fn(async () => {}), addLabel: vi.fn(async () => {}), removeLabel: vi.fn(async () => {})};
  return {
    sequelize: {transaction: async (fn) => fn({})},
    Thread: {findByPk: vi.fn(async (id) => (id === 't1' ? thread : null))},
    Label: {findAll: vi.fn(async () => labels), findOne: vi.fn(async () => labels[0] || null)},
    thread,
  };
}

describe('SyncbackTaskRunner', () => {
  it('exposes the queue lifecycle contract', async () => {
    expect(SyncbackTaskRunner).toBeDefined();
    expect(typeof SyncbackTaskRunner).toBe('function');
    const r = new SyncbackTaskRunner({account: {id: 'a1'}, syncWorker: {}, imap: {}, smtp: {}, db: {sequelize: {transaction: async (f) => f({})}, SyncbackRequest: {findAll: vi.fn(async () => []), update: vi.fn(async () => {})}}, logger: {warn: vi.fn(), error: vi.fn(), info: vi.fn()}});
    expect(typeof r.getNewSyncbackTasks).toBe('function');
    expect(typeof r.runSyncbackTask).toBe('function');
    await expect(r.getNewSyncbackTasks()).resolves.toEqual([]);
  });
});
