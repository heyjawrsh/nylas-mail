/* eslint global-require: 0 */
/* eslint import/no-dynamic-require: 0 */
import detectThread from '../../src/message-processor/detect-thread.js';
import {FIXTURES_PATH, ACCOUNT_ID, getTestDatabase} from '../helpers.js';

function messagesFromFixture({Message}, folder, name) {
  const {A, B} = require(`${FIXTURES_PATH}/Threading/${name}`)

  const msgA = Message.build(A);
  msgA.folder = folder;
  msgA.labels = [];

  const msgB = Message.build(B);
  msgB.folder = folder;
  msgB.labels = [];

  return {msgA, msgB};
}

describe('threading', function threadingSpecs() {
  beforeEach(async () => {
      this.db = await getTestDatabase()
      this.folder = await this.db.Folder.create({
        id: 'test-folder-id',
        accountId: ACCOUNT_ID,
        version: 1,
        name: 'Test Folder',
        role: null,
      });
    
  });

  describe("when remote thread ids are present", () => {
    it('threads emails with the same gthreadid', async () => {
        const {msgA, msgB} = messagesFromFixture(this.db, this.folder, 'remote-thread-id-yes');
        const threadA = await detectThread({db: this.db, message: msgA});
        const threadB = await detectThread({db: this.db, message: msgB});
        expect(threadB.id).toEqual(threadA.id);
      
    });

    it('does not thread other emails', async () => {
        const {msgA, msgB} = messagesFromFixture(this.db, this.folder, 'remote-thread-id-no');
        const threadA = await detectThread({db: this.db, message: msgA});
        const threadB = await detectThread({db: this.db, message: msgB});
        expect(threadB.id).not.toEqual(threadA.id);
      
    });
  });
  describe("when subject matching", () => {
    it('threads emails with the same subject', async () => {
        const {msgA, msgB} = messagesFromFixture(this.db, this.folder, 'subject-matching-yes');
        const threadA = await detectThread({db: this.db, message: msgA});
        const threadB = await detectThread({db: this.db, message: msgB});
        expect(threadB.id).toEqual(threadA.id);
      
    });

    it('does not thread other emails', async () => {
        const {msgA, msgB} = messagesFromFixture(this.db, this.folder, 'subject-matching-no');
        const threadA = await detectThread({db: this.db, message: msgA});
        const threadB = await detectThread({db: this.db, message: msgB});
        expect(threadB.id).not.toEqual(threadA.id);
      
    });
  });
});
