import {describe, it, expect, beforeAll} from 'vitest';

process.env.DB_ENCRYPTION_ALGORITHM = 'aes-256-ctr';
process.env.DB_ENCRYPTION_PASSWORD = 'unit-test-password';

const {default: Sequelize} = await import('sequelize');
const {default: loadModels} = await import('../src/load-models.js');
const {JSONColumn, JSONArrayColumn} = await import('../src/database-types.js');
const {MAX_INDEXABLE_LENGTH} = await import('../src/db-utils.js');

let sequelize;
let db;

beforeAll(async () => {
  sequelize = new Sequelize({dialect: 'sqlite', storage: ':memory:', logging: false});
  db = await loadModels(Sequelize, sequelize, {loadShared: true});
  await sequelize.sync();
});

describe('loadModels', () => {
  it('loads the shared models with capitalized keys', () => {
    expect(Object.keys(db).sort()).toEqual(['Account', 'AccountToken', 'Transaction'].sort());
  });

  it('associates models (Account has tokens)', () => {
    expect(db.Account.associations.tokens).toBeDefined();
  });
});

describe('models on sqlite', () => {
  it('Account round-trips encrypted credentials via setCredentials/decryptedCredentials', async () => {
    const account = await db.Account.create({
      id: 'acc-1',
      name: 'Test',
      provider: 'gmail',
      emailAddress: 'test@example.com',
      connectionSettings: {imap_host: 'imap.gmail.com', imap_port: '993'},
    });
    expect(account.connectionSettings.imap_host).toBe('imap.gmail.com');

    account.setCredentials({xoauth2: 'secret-token', expiry_date: 123});
    await account.save();

    const found = await db.Account.findByPk(account.id);
    expect(found.connectionCredentials).not.toContain('secret-token'); // encrypted at rest
    const creds = found.decryptedCredentials();
    expect(creds.xoauth2).toBe('secret-token');
    expect(creds.expiry_date).toBe(123);
  });

  it('Account.upsertWithCredentials creates account+token and updates on second call', async () => {
    const {account, token} = await db.Account.upsertWithCredentials({
      name: 'Upsert', provider: 'imap', emailAddress: 'up@example.com',
      connectionSettings: {imap_host: 'x'},
    }, {imap_password: 'pw'});
    expect(token.value).toMatch(/[0-9a-f-]{36}/);
    expect(account.decryptedCredentials().imap_password).toBe('pw');

    const {account: updated, token: secondToken} = await db.Account.upsertWithCredentials({
      name: 'Upsert2', provider: 'imap', emailAddress: 'up@example.com',
      connectionSettings: {imap_host: 'x'},
    }, {imap_password: 'pw2'});
    expect(secondToken).toBeDefined();
    expect(updated.name).toBe('Upsert'); // params only apply on create; credentials update in place
    expect(updated.decryptedCredentials().imap_password).toBe('pw2');
  });

  it('Account.hash is deterministic on emailAddress + settings', () => {
    const a = db.Account.hash({emailAddress: 'a@b.c', connectionSettings: {host: 'x'}});
    const b = db.Account.hash({emailAddress: 'a@b.c', connectionSettings: {host: 'x'}});
    const c = db.Account.hash({emailAddress: 'other@b.c', connectionSettings: {host: 'x'}});
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });

  it('Account.errored reflects a set syncError', async () => {
    const account = await db.Account.create({
      id: 'acc-err', name: 'E', provider: 'imap', emailAddress: 'e@example.com',
      connectionSettings: {},
    });
    account.syncError = {message: 'boom'};
    expect(account.errored()).toBe(true);
    expect(account.toJSON().provider).toBe('imap');
  });

  it('AccountToken generates UUIDs and cascades on account delete', async () => {
    const account = await db.Account.create({
      id: 'acc-tok', name: 'Tok', provider: 'imap', emailAddress: 'tok@example.com',
      connectionSettings: {},
    });
    const token = await db.AccountToken.create({accountId: account.id});
    expect(token.value).toMatch(/[0-9a-f-]{36}/);
    await account.destroy();
    const tokensLeft = await db.AccountToken.count({where: {accountId: account.id}});
    expect(tokensLeft).toBe(0);
  });

  it('Transaction stores changedFields as a JSON array', async () => {
    const t = await db.Transaction.create({
      accountId: 'acc-1',
      object: 'thread', objectId: 'thread-1', event: 'changed',
      changedFields: ['subject', 'unread'],
    });
    const found = await db.Transaction.findByPk(t.id);
    expect(found.changedFields).toEqual(['subject', 'unread']);
    expect(found.toJSON().event).toBe('changed');
  });
});

describe('database-types', () => {
  it('JSONColumn parses string values and defaults to {}', () => {
    const col = JSONColumn('value');
    expect(col.get.call({getDataValue: () => '{"a":1}'})).toEqual({a: 1});
    expect(col.get.call({getDataValue: () => null})).toEqual({});
    expect(col.defaultValue).toBeUndefined();
  });

  it('JSONArrayColumn validates array shape both ways', () => {
    const col = JSONArrayColumn('ids');
    expect(col.get.call({getDataValue: () => '[1,2]'})).toEqual([1, 2]);
    expect(col.get.call({getDataValue: () => null})).toEqual([]);
    expect(() => col.get.call({getDataValue: () => '{"a":1}'})).toThrow(/should be an array/);
    expect(() => col.set.call({setDataValue: () => {}}, 'nope')).toThrow(/should be an array/);
    const seen = {};
    col.set.call({setDataValue: (f, v) => { seen[f] = v } }, [1]);
    expect(seen.ids).toEqual([1]);
  });
});

describe('db-utils', () => {
  it('exposes the utf8mb4 indexable length', () => {
    expect(MAX_INDEXABLE_LENGTH).toBe(191);
  });
});
