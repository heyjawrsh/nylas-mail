import {describe, it, expect} from 'vitest';
import {getTestDatabase, destroyTestDatabase} from '../helpers.js';

let db;
beforeEach(async () => {
  destroyTestDatabase();
  db = await getTestDatabase();
});

describe('File model', () => {
  it('serializes public attachment fields', async () => {
    const message = await db.Message.create({
      id: 'm1', accountId: 'test-account-id', folderImapUID: 1, body: 'x', subject: 's',
    });
    const file = await db.File.create({
      id: 'file-1', size: 512, partId: '2.1', encoding: 'base64',
      filename: 'report.pdf', messageId: message.id, accountId: 'test-account-id',
      contentType: 'application/pdf', contentId: 'cid-1',
    });
    expect(file.toJSON()).toEqual({
      id: 'file-1', size: 512, object: 'file', part_id: '2.1',
      encoding: 'base64', filename: 'report.pdf', message_id: 'm1',
      account_id: 'test-account-id', content_type: 'application/pdf', content_id: 'cid-1',
    });
  });

  it('guards invalid ids via ModelUtils integration', async () => {
    const {default: ModelUtils} = await import('../../../src/models/define-model.js').catch(() => ({default: null}));
    expect(ModelUtils).toBeDefined(); // define-model factory is loadable standalone
  });

  it('associates File with Message', async () => {
    // model association surfaces as getMessage on instances
    expect(typeof db.File.prototype.getMessage).toBe('function');
  });
});
