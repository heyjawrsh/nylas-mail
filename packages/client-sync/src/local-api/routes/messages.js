import * as IsomorphicCore from 'isomorphic-core'
import Joi from 'joi';
import Boom from '@hapi/boom';
const {Provider} = IsomorphicCore
import Serialization from '../serialization.js';
import {createAndReplyWithSyncbackRequest} from '../route-helpers.js';


export default (server) => {
  server.route({
    method: 'GET',
    path: '/messages/{id}',
    options: {
      description: 'Returns message for specified id.',
      notes: 'Notes go here',
      tags: ['messages'],
      validate: {
        params: {
          id: Joi.string(),
        },
      },
      response: {
        sample: 0,
        schema: Joi.alternatives().try(
          Serialization.jsonSchema('Message'),
          Joi.string()
        ),
      },
    },
    handler: async (request, h) => {
      const db = await request.getAccountDatabase();
      const {Message, Folder, Label, File} = db;
      const {headers: {accept}} = request;
      const {params: {id}} = request;
      const account = request.auth.credentials;
      try {
        const message = await Message.findOne({where: {id},
          include: [{model: Folder}, {model: Label}, {model: File}]});
        if (!message) {
          throw Boom.notFound(`Message ${id} not found`);
        }
        if (accept === 'message/rfc822') {
          return h.response(await message.fetchRaw({account, logger: request.logger}));
        }
        return h.response(Serialization.jsonStringify(message));
      } catch (err) {
        request.logger.error(err, 'Error fetching message');
        throw err;
      }
    },
  })
};
