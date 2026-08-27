import {describe, it, expect, beforeAll} from 'vitest';
import {Sequelize, DataTypes} from 'sequelize';
import loadModels from '../src/load-models.js';
import HookTransactionLog from '../src/hook-transaction-log.js';
import HookIncrementVersionOnSave from '../src/hook-increment-version-on-save.js';

let sequelize;
let db;

beforeAll(async () => {
  sequelize = new Sequelize({dialect: 'sqlite', storage: ':memory:', logging: false});
  db = await loadModels(Sequelize, sequelize, {loadShared: true});
  HookIncrementVersionOnSave(db, sequelize);
  await sequelize.sync();
});

describe('HookIncrementVersionOnSave', () => {
  it('starts version at 1 and bumps on each save', async () => {
    const account = await db.Account.create({
      id: 'hook-1', name: 'V', provider: 'imap', emailAddress: 'v@example.com',
      connectionSettings: {},
    });
    expect(account.version).toBe(1);
    account.name = 'V2';
    await account.save();
    expect(account.version).toBe(2);
  });
});

describe('HookTransactionLog', () => {
  it('creates a transaction row when a hooked model with accountId changes', async () => {
    const events = [];
    // A metadata-shaped model: has accountId + version
    const SpecThing = sequelize.define('specThing', {
      accountId: DataTypes.STRING,
      value: DataTypes.JSON,
      version: {type: DataTypes.INTEGER, defaultValue: 0},
    });
    await SpecThing.sync();
    db.SpecThing = SpecThing;

    HookTransactionLog(db, sequelize, {
      only: ['specThing'],
      onCreatedTransaction: (t) => events.push(t.toJSON()),
    });

    const before = await db.Transaction.count();
    const thing = await SpecThing.create({accountId: 'acc-9', value: {a: 1}});
    thing.value = {a: 2};
    await thing.save();

    expect(await db.Transaction.count()).toBeGreaterThan(before);
    const latest = await db.Transaction.findOne({order: [['id', 'DESC']]});
    expect(latest.object).toBe('specThing');
    expect(latest.objectId).toBe(`${thing.id}`);
    expect(latest.accountId).toBe('acc-9');
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].objectId).toBe(`${thing.id}`);
  });
});
