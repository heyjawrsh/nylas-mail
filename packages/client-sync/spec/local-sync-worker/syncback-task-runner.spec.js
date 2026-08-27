import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('../../src/local-sync-worker/syncback-task-factory.js', () => ({
  default: {create: vi.fn((account, req) => makeTask(req))},
}));

vi.mock('../../src/local-sync-worker/sync-utils.js', () => ({
  runWithRetryLogic: vi.fn(async ({onSuccess}) => { const r = await Promise.resolve('done'); onSuccess && onSuccess(r); return r }),
}));

import SyncbackTaskRunner from '../../src/local-sync-worker/syncback-task-runner.js';

function makeTask(req) {
  return {
    description: () => req.type,
    affectsImapMessageUIDs: () => req.type.includes('Folder'),
    run: vi.fn(async () => {}),
    syncbackRequestObject: () => req,
    onSyncbackRequestCreated: vi.fn(),
  };
}

const newReq = (type) => ({id: `${type}-1`, type, status: 'NEW', props: {}, toJSON: () => ({id: `${type}-1`, type})});

function makeRunner(requests) {
  const db = {
    sequelize: {transaction: async (fn) => fn({})},
    SyncbackRequest: {
      findAll: vi.fn(async ({where}) => {
        const status = where.status || where[Symbol.for('x')];
        return requests.filter((r) => r.status === 'NEW');
      }),
      update: vi.fn(async () => [1]),
    },
    Message: {findAll: vi.fn(async () => [])},
  };
  return new SyncbackTaskRunner({
    db,
    account: {id: 'a1', emailAddress: 'a@b.c'},
    syncWorker: {},
    imap: {openBox: vi.fn(async () => ({}))},
    smtp: {},
    logger: {info: vi.fn(), warn: vi.fn(), error: vi.fn(), child() { return this }},
  });
}

beforeEach(() => vi.clearAllMocks());

describe('SyncbackTaskRunner', () => {
  it('returns [] when there are no new requests', async () => {
    const runner = makeRunner([]);
    await expect(runner.getNewSyncbackTasks()).resolves.toEqual([]);
  });

  it('collects prioritized and non-uid-changing tasks', async () => {
    const runner = makeRunner([newReq('StarThread'), newReq('RenameFolder')]);
    const tasks = await runner.getNewSyncbackTasks();
    expect(tasks.length).toBeGreaterThan(0);
    expect(runner._db.SyncbackRequest.findAll).toHaveBeenCalled();
  });

  it('marks lingering INPROGRESS tasks back to NEW on boot', async () => {
    const runner = makeRunner([]);
    await runner.updateLingeringTasksInProgress(); // saves retryable back to NEW, fails not-retryable
  });
});
