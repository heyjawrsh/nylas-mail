import Joi from 'joi';
import {DatabaseConnector, PubsubConnector} from 'cloud-core';
import {DeltaStreamBuilder} from 'isomorphic-core'

export default function registerDeltaRoutes(server) {
  server.route({
    method: 'GET',
    path: '/delta/streaming',
    options: {
      validate: {
        query: {
          cursor: Joi.string().required(),
        },
      },
    },
    handler: async (request, h) => {
      const {account} = request.auth.credentials;

      request.logger.info("Starting /delta/streaming")

      const stream = await DeltaStreamBuilder.buildAPIStream(request, {
        accountId: account.id,
        cursor: request.query.cursor,
        databasePromise: DatabaseConnector.forShared(),
        deltasSource: PubsubConnector.observeDeltas(account.id),
      })
      const streamTimeout = setTimeout(() => {
          const response = request.raw.res; // request is the hapijs handler request object
          request.logger.info('Delta stream connection timeout.')
          response.end();
      }, DeltaStreamBuilder.DELTA_CONNECTION_TIMEOUT_MS);

      stream.once('end', () => {
          clearTimeout(streamTimeout);
          return stream.close();
      });
      return h.response(stream)
    },
  });
}
