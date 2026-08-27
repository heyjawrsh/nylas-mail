import _ from 'underscore'
import Boom from '@hapi/boom';
import Serialization from './serialization.js';
import SyncProcessManager from '../local-sync-worker/sync-process-manager.js'


const wakeSyncWorker = _.debounce((accountId, reason) => {
  SyncProcessManager.wakeWorkerForAccount(accountId, {interrupt: true, reason})
}, 500, true) // `true` so that we debounce on the leading edge instead of the trailing edge

export async function createAndReplyWithSyncbackRequest(request, h, syncRequestArgs = {}) {
  try {
    const account = request.auth.credentials
    const {wakeSync = true} = syncRequestArgs
    syncRequestArgs.accountId = account.id

    const db = await request.getAccountDatabase()
    const syncbackRequest = await db.SyncbackRequest.create(syncRequestArgs)

    if (wakeSync) {
      wakeSyncWorker(account.id, `Need to run task ${syncbackRequest.type}`)
    }
    return h.response(Serialization.jsonStringify(syncbackRequest))
  } catch (err) {
    throw Boom.boomify(err)
  }
}
