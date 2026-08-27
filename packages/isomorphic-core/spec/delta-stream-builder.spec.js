import {EventEmitter} from 'node:events';
import {filter, firstValueFrom, of, Subject, take, toArray} from 'rxjs';
import {describe, expect, it, vi} from 'vitest';
import DeltaStreamBuilder from '../src/delta-stream-builder.js';

function database(transactions = []) {
  const models = [{id: 'm1', toJSON: () => ({id: 'm1', subject: 'hello'})}];
  return {
    Transaction: {
      streamAll: vi.fn(() => of(transactions)),
      findOne: vi.fn(),
    },
    Message: {
      requiredAssociationsForJSON: vi.fn(() => ['labels']),
      findAll: vi.fn(async () => models),
    },
  };
}

describe('DeltaStreamBuilder', () => {
  it('inflates initial and live transactions in its observable', async () => {
    const initial = {id: 1, object: 'message', objectId: 'm1', event: 'modify', toJSON() { return {...this, toJSON: undefined}; }};
    const live = {id: 2, object: 'message', objectId: 'm1', event: 'modify'};
    const db = database([initial]);
    const values = await firstValueFrom(DeltaStreamBuilder.buildDeltaObservable({
      db, cursor: 4, accountId: 'a1', deltasSource: of(live),
    }).pipe(take(2), toArray()));
    expect(db.Transaction.streamAll).toHaveBeenCalledWith({where: {id: {$gt: 4}, accountId: 'a1'}});
    expect(values.flat()).toEqual(expect.arrayContaining([
      expect.objectContaining({cursor: 1, accountId: 'a1', attributes: {id: 'm1', subject: 'hello'}}),
      expect.objectContaining({cursor: 2, accountId: 'a1', attributes: {id: 'm1', subject: 'hello'}}),
    ]));
    expect(db.Message.requiredAssociationsForJSON).toHaveBeenCalledWith(db);
  });

  it('retains delete transactions without querying an object id', async () => {
    const db = database([]);
    db.Message.findAll.mockResolvedValue([]);
    const batch = await firstValueFrom(DeltaStreamBuilder.buildDeltaObservable({
      db, accountId: 'a', deltasSource: of({id: 3, object: 'message', objectId: 'gone', event: 'delete'}),
    }).pipe(filter((b) => b.length > 0), take(1)));
    expect(batch[0]).toMatchObject({cursor: 3, event: 'delete', accountId: 'a'});
    expect(db.Message.findAll).toHaveBeenCalledWith({where: {id: []}, include: ['labels']});
  });

  it('builds current cursors including an empty database', async () => {
    const db = database();
    db.Transaction.findOne.mockResolvedValue({id: 88});
    await expect(DeltaStreamBuilder.buildCursor({databasePromise: Promise.resolve(db)})).resolves.toBe(88);
    db.Transaction.findOne.mockResolvedValue(null);
    await expect(DeltaStreamBuilder.buildCursor({databasePromise: Promise.resolve(db)})).resolves.toBe(0);
  });

  it('writes newline-delimited transactions and unsubscribes on request lifecycle events', async () => {
    const db = database([{id: 1, object: 'message', objectId: 'm1', event: 'create'}]);
    const rawReq = new EventEmitter();
    const request = new EventEmitter();
    request.raw = {req: rawReq};
    request.logger = {error: vi.fn(), info: vi.fn()};
    const live = new Subject();
    const output = await DeltaStreamBuilder.buildAPIStream(request, {
      databasePromise: Promise.resolve(db), cursor: null, accountId: 'a', deltasSource: live,
    });
    const chunks = [];
    output.on('data', (chunk) => chunks.push(chunk.toString()));
    await new Promise((resolve) => setImmediate(resolve));
    expect(chunks.join('')).toContain('"cursor":1');
    rawReq.emit('error', new Error('closed badly'));
    rawReq.emit('close');
    rawReq.emit('end');
    request.emit('disconnect');
    expect(request.logger.error).toHaveBeenCalled();
    expect(request.logger.info).toHaveBeenCalledTimes(3);
    output.destroy();
  });
});
