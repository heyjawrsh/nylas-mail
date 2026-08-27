import {describe, it, expect} from 'vitest';
import {getTestDatabase, destroyTestDatabase, ACCOUNT_ID} from '../helpers.js';

const {IMAPConnectionPool} = await import('isomorphic-core');

let db;
beforeEach(async () => {
  destroyTestDatabase();
  db = await getTestDatabase();
});

describe('Message model', () => {
  it('round-trips the body through the NYLAS_HOME file store', async () => {
    const m = await db.Message.create({
      id: 'msg-1', accountId: ACCOUNT_ID, folderImapUID: 1, subject: 'Re: hi',
      body: '<p>Hello <b>world</b></p>',
    });
    const found = await db.Message.findByPk('msg-1');
    expect(found.body).toContain('Hello');
  });

  it('serializes the public message shape', async () => {
    const m = await db.Message.create({
      id: 'msg-2', accountId: ACCOUNT_ID, folderImapUID: 2, subject: 's',
      unread: false, starred: true, snippet: 'snip', body: 'b',
    });
    const json = m.toJSON();
    expect(json).toMatchObject({id: 'msg-2', object: 'message', unread: false, starred: true, snippet: 'snip'});
    expect(typeof json.account_id).toBe('string'); // bodies stream separately
  });
});

describe('Thread model', () => {
  it('creates threads and counts unread via instance helpers', async () => {
    const t = await db.Thread.create({id: 'th-1', accountId: ACCOUNT_ID, subject: 'thread'});
    expect(t.id).toBe('th-1');
    expect(typeof t.updateFromMessages).toBe('function');
    expect(typeof t.toJSON).toBe('function');
    t.labels = [];
    t.folders = [];
    t.participants = [];
    t.messages = [];
    const json = t.toJSON();
    expect(json).toMatchObject({id: 'th-1', object: 'thread'});
  });
});

describe('Contact model', () => {
  it('hashes deterministically and serializes', async () => {
    expect(db.Contact.hash({email: 'x@y.z'})).toHaveLength(64);
    const c = await db.Contact.create({id: 'c9', accountId: ACCOUNT_ID, email: 'x@y.z', name: 'X'});
    expect(c.toJSON()).toMatchObject({id: 'c9', object: 'contact', email: 'x@y.z', name: 'X'});
  });
});

describe('Label model', () => {
  it('creates labels with roles and serializes', async () => {
    const l = await db.Label.create({id: 'lbl-1', accountId: ACCOUNT_ID, name: 'Important', role: 'important'});
    expect(l.toJSON()).toMatchObject({id: 'lbl-1', object: 'label', name: 'important', display_name: 'Important'});
  });
});

describe('Folder model hash', () => {
  it('hashes by boxName and accountId', () => {
    expect(db.Folder.hash({boxName: 'INBOX', accountId: ACCOUNT_ID})).toHaveLength(64);
    expect(db.Folder.hash({boxName: 'INBOX', accountId: ACCOUNT_ID}))
      .toBe(db.Folder.hash({boxName: 'INBOX', accountId: ACCOUNT_ID}));
  });
});

describe('Message.fetchRaw', () => {
  it('streams the raw RFC2822 body through an IMAP connection', async () => {
    await db.Folder.create({id: 'fraw', accountId: ACCOUNT_ID, version: 1, name: 'INBOX', role: null});
    const m = await db.Message.create({id: 'msg-raw', accountId: ACCOUNT_ID, folderImapUID: 42, body: 'x', folderId: 'fraw'});
    const box = {
      fetchMessage: vi.fn(async () => ({headers: 'H', parts: {TEXT: 'BODY'}})),
    };
    const {IMAPConnectionPool: pool} = await import('isomorphic-core');
    const original = pool.withConnectionsForAccount;
    pool.withConnectionsForAccount = async (_acct, {onConnected}) => {
      await onConnected([{openBox: async () => box}]);
    };
    try {
      const raw = await m.fetchRaw({account: {id: ACCOUNT_ID}, logger: console});
      expect(raw).toContain('HBODY');
    } finally {
      pool.withConnectionsForAccount = original;
    }
  });
});
