
import FetchFolderList from '../../../src/local-sync-worker/sync-tasks/fetch-folder-list.imap.js';
import {forEachJSONFixture, silentLogger, getTestDatabase, destroyTestDatabase} from '../../helpers.js';

describe("FetchFolderList", function FetchFolderListSpecs() {
  let db, imap, stubImapBoxes

  beforeEach(async () => {
    destroyTestDatabase()
    db = await getTestDatabase()

    stubImapBoxes = null;
    imap = {
      getBoxes: () => {
        return Promise.resolve(stubImapBoxes);
      },
    };
  });

  describe("initial syncing", () => {
    forEachJSONFixture('FetchFolderList', (filename, json) => {
      it(`should create folders and labels correctly for boxes (${filename})`, async () => {
        const {boxes, expectedFolders, expectedLabels} = json;
        const provider = filename.split('-')[0];
        stubImapBoxes = boxes;

        global.Logger = silentLogger;
        const task = new FetchFolderList({account: {provider, emailAddress: 'sync-spec@example.com'}});
        await task.run(db, imap);

        const folders = await db.Folder.findAll();
        expect(folders.map((f) => { return {name: f.name, role: f.role} })).toEqual(expectedFolders);

        const labels = await db.Label.findAll();
        expect(labels.map(f => { return {name: f.name, role: f.role} })).toEqual(expectedLabels);
      });
    });
  });
});
