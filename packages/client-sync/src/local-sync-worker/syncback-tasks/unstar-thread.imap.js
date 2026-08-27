import * as IsomorphicCore from 'isomorphic-core'
const {Errors: {APIError}} = IsomorphicCore
import {SyncbackIMAPTask} from './syncback-task.js';
import IMAPHelpers from '../imap-helpers.js';

class UnstarThread extends SyncbackIMAPTask {
  description() {
    return `UnstarThread`;
  }

  affectsImapMessageUIDs() {
    return false
  }

  async * _run(db, imap) {
    const {sequelize, Thread} = db
    const threadId = this.syncbackRequestObject().props.threadId
    if (!threadId) {
      throw new APIError('threadId is required')
    }

    const thread = yield Thread.findByPk(threadId)
    if (!thread) {
      throw new APIError(`Can't find thread`, 404)
    }
    const threadMessages = yield thread.getMessages()
    yield IMAPHelpers.forEachFolderOfThread({
      db,
      imap,
      threadMessages,
      callback({messageImapUIDs, box}) {
        return box.delFlags(messageImapUIDs, 'FLAGGED')
      },
    })
    // If IMAP succeeds, save the model updates
    yield sequelize.transaction(async (transaction) => {
      await Promise.all(threadMessages.map((m) => m.update({starred: false}, {transaction})))
      await thread.update({starredCount: 0}, {transaction})
    })
  }
}
export default UnstarThread;