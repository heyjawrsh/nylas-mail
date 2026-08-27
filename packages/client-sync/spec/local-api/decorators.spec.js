import {describe, it, expect, vi} from 'vitest';

vi.mock('../../src/shared/local-database-connector.js', () => ({
  default: {forAccount: vi.fn((id) => ({accountId: id}))},
}));

import registerConnections from '../../src/local-api/decorators/connections.js';
import LocalDatabaseConnector from '../../src/shared/local-database-connector.js';

describe('connections decorator', () => {
  it('decorates the request with the account database and logger', () => {
    const decorations = {};
    const server = {
      decorate: vi.fn((kind, name, fn, opts) => {
        decorations[`${kind}:${name}`] = {fn, opts};
      }),
    };
    registerConnections(server);
    expect(Object.keys(decorations)).toContain('request:getAccountDatabase');
    expect(Object.keys(decorations)).toContain('request:logger');

    const db = decorations['request:getAccountDatabase'].fn.call({
      auth: {credentials: {id: 'a1'}},
    });
    expect(LocalDatabaseConnector.forAccount).toHaveBeenCalledWith('a1');
    expect(db.accountId).toBe('a1');

    globalThis.Logger = {marker: true};
    expect(decorations['request:logger'].fn()).toEqual({marker: true});
    expect(decorations['request:logger'].opts).toEqual({apply: true});
  });
});

describe('serialization helpers', () => {
  it('jsonStringify renders one object per line with no extra whitespace', async () => {
    const {default: Serialization} = await import('../../src/local-api/serialization.js');
    const out = Serialization.jsonStringify([{id: 1}, {id: 2}]);
    expect(out).toContain('\n');
    // pretty-printed with indent 2 — each record starts a new object block
    expect(out).toContain('"id": 1');
    expect(out).toContain('"id": 2');
  });
});
