import {describe, it, expect, vi} from 'vitest';

vi.mock('isomorphic-core', () => ({
  AuthHelpers: {
    imapAuthRouteConfig: () => ({auth: false, validate: {}}),
    imapAuthHandler: vi.fn((upsertAccount) => async (request, h) => {
      const result = await upsertAccount({email: 'a@b.c', name: 'A', provider: 'imap', settings: {}}, {xoauth2: 't'});
      return h.response(JSON.stringify({ok: true, id: result.account.id}));
    }),
  },
}));

vi.mock('../../src/shared/local-database-connector.js', () => ({
  default: {forShared: vi.fn(async () => ({Account: {upsertWithCredentials: vi.fn(async () => ({account: {id: 'acct-1'}, token: {value: 'tok'}}))}}))},
}));

vi.mock('../../src/local-sync-worker/sync-process-manager.js', () => ({
  default: {addWorkerForAccount: vi.fn()},
}));

vi.mock('../../src/shared/dedupe-accounts.js', () => ({
  preventCreationOfDuplicateAccounts: vi.fn(async () => {}),
}));

import registerAuth from '../../src/local-api/routes/auth.js';
import {AuthHelpers} from 'isomorphic-core';
import SyncProcessManager from '../../src/local-sync-worker/sync-process-manager.js';
import {preventCreationOfDuplicateAccounts} from '../../src/shared/dedupe-accounts.js';

describe('local auth route', () => {
  it('registers POST /auth with the shared imap handler', () => {
    const routes = [];
    registerAuth({route: (def) => routes.push(def)});
    expect(routes).toHaveLength(1);
    expect(routes[0].method.toUpperCase()).toBe('POST');
    expect(routes[0].path).toBe('/auth');
    expect(AuthHelpers.imapAuthHandler).toHaveBeenCalled();
  });

  it('the upsert path dedupes, upserts credentials, and boots a sync worker', async () => {
    // drive the registered route handler (which invokes the mocked imapAuthHandler wrapper)
    const routes = [];
    registerAuth({route: (def) => routes.push(def)});
    const responses = [];
    const h = {response: (x) => { responses.push(x); return x }};
    await routes[0].handler({payload: {email: 'a@b.c', name: 'A', provider: 'imap', settings: {}}}, h);
    expect(preventCreationOfDuplicateAccounts).toHaveBeenCalled();
    expect(SyncProcessManager.addWorkerForAccount).toHaveBeenCalled();
    expect(responses.length).toBeGreaterThan(0);
  });
});
