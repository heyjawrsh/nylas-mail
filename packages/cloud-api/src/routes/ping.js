import Boom from '@hapi/boom'
import {DatabaseConnector} from 'cloud-core';

export default function registerPingRoutes(server) {
  server.route({
    method: 'GET',
    path: '/ping/basic',
    options: { auth: false },
    handler: (request) => {
      request.logger.info('---> Pong 200')
      return "Pong"
    },
  });

  server.route({
    method: 'GET',
    path: '/ping',
    options: { auth: false },
    handler: async (request) => {
      request.logger.debug('---> Ping DB');
      try {
        const db = await DatabaseConnector.forShared();
        await db.sequelize.query('SELECT 1');
        return "DB Okay"
      } catch (err) {
        return Boom.boomify(err, {statusCode: 500});
      }
    },
  });

  server.route({
    method: 'GET',
    path: '/ping/400',
    options: { auth: false },
    handler: (request) => {
      request.logger.debug('---> Pong 400');
      return Boom.badRequest("Pong bad request", {foo: 'bar'})
    },
  });

  server.route({
    method: 'GET',
    path: '/ping/401',
    options: { auth: false },
    handler: (request) => {
      request.logger.info('---> Pong 401');
      return Boom.unauthorized('invalid password', 'sample', { ttl: 0, cache: null, foo: 'bar' })
    },
  });

  server.route({
    method: 'GET',
    path: '/ping/500',
    options: { auth: false },
    handler: (request) => {
      request.logger.info('---> Pong 500');
      return Boom.badImplementation("Broken borked", {bad: "news"})
    },
  });

  server.route({
    method: 'GET',
    path: '/ping/broken',
    options: { auth: false },
    handler: (request) => {
      request.logger.info('---> Pong broken');
      throw new Error("Broken Code")
    },
  });

  server.route({
    method: 'GET',
    path: '/ping/downstream_error',
    options: { auth: false },
    handler: (request) => {
      request.logger.debug('---> Pong downstream error');
      const downstream = new Error("Downstream badness");
      return Boom.boomify(downstream, {statusCode: 400, message: "Extra info here"});
    },
  });
}
