export default (server) => {
  server.route({
    method: 'GET',
    path: '/ping',
    options: {
      auth: false,
    },
    handler: (request, h) => {
      request.logger.info('----> Pong!')
      return h.response("Pong")
    },
  });
};
