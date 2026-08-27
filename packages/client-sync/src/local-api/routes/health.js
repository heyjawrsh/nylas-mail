import Joi from 'joi';
import SyncActivity from '../../shared/sync-activity.js';

export default (server) => {
  server.route({
    method: 'GET',
    path: '/health',
    options: {
      description: 'Returns information about the last recorded sync activity for all accounts',
      tags: ['health'],
    },
    handler: (request, h) => {
      let response;
      try {
        response = SyncActivity.getLastSyncActivity()
        response = JSON.stringify(response)
        return h.response(response)
      } catch (err) {
        const context = response ? "" : "Could not retrieve last sync activity"
        request.logger.error(err, context)
        throw err
      }
    },
  })

  server.route({
    method: 'GET',
    path: '/health/{accountId}',
    options: {
      description: 'Returns information about the last recorded sync activity for the specified account',
      tags: ['health'],
      validate: {
        params: {
          accountId: Joi.string(),
        },
      },
    },
    handler: (request, h) => {
      let response;
      try {
        const {accountId} = request.params
        response = SyncActivity.getLastSyncActivityForAccount(accountId)
        response = JSON.stringify(response)
        return h.response(response)
      } catch (err) {
        const context = response ? "" : "Could not retrieve last sync activity"
        request.logger.error(err, context)
        throw err
      }
    },
  })
};
