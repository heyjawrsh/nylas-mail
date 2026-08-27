import Joi from 'joi';
import stream from 'stream';
import _ from 'underscore';
import Serialization from '../serialization.js';
import Boom from '@hapi/boom';
import {createAndReplyWithSyncbackRequest} from '../route-helpers.js';
import {searchClientForAccount} from '../search.js';

export default (server) => {
  server.route({
    method: 'GET',
    path: '/threads',
    options: {
      description: 'Returns threads',
      notes: 'Notes go here',
      tags: ['threads'],
      validate: {
        query: {
          limit: Joi.number().integer().min(1).max(2000).default(100),
          offset: Joi.number().integer().min(0).default(0),
        },
      },
      response: {
        sample: 0,
        schema: Joi.alternatives().try(
          Joi.array().items(
            Serialization.jsonSchema('Thread')
          ),
          Joi.object().keys({
            count: Joi.number().integer().min(0),
          }),
        ),
      },
    },
    handler: async (request, h) => {
      const db = await request.getAccountDatabase();
      const {Thread, Folder, Label, Message} = db;
      const threads = await Thread.findAll({
        limit: request.query.limit,
        offset: request.query.offset,
        include: [
          {model: Folder},
          {model: Label},
          {
            model: Message,
            as: 'messages',
            attributes: _.without(Object.keys(Message.rawAttributes), 'body'),
          },
        ],
      });
      return h.response(Serialization.jsonStringify(threads));
    },
  });

  server.route({
    method: 'GET',
    path: '/threads/search/streaming',
    options: {
      description: 'Returns threads',
      notes: 'Notes go here',
      tags: ['threads'],
      validate: {
        query: {
          limit: Joi.number().integer().min(1).max(2000).default(100),
          q: Joi.string(),
        },
      },
    },
    handler: async (request, h) => {
      const account = request.auth.credentials;
      const db = await request.getAccountDatabase();
      const client = searchClientForAccount(account);
      const source = await client.searchThreads(db, request.query.q, request.query.limit);

      const outputStream = stream.Readable();
      outputStream._read = () => { return };
      const disposable = source.subscribe((str) => outputStream.push(str));
      request.on("disconnect", () => {
        client.cancelSearchRequest();
        disposable.unsubscribe();
      });
      return h.response(outputStream);
    },
  });

  server.route({
    method: 'GET',
    path: '/threads/{id}',
    options: {
      description: 'Returns a thread with the specified id',
      tags: ['threads'],
      validate: {
        params: {
          id: Joi.string().required(),
        },
      },
      response: {
        sample: 0,
        schema: Serialization.jsonSchema('Thread'),
      },
    },
    handler: async (request, h) => {
      const db = await request.getAccountDatabase();
      const {Thread, Folder, Label, Message} = db;
      const thread = await Thread.findOne({
        where: {id: request.params.id},
        include: [
          {model: Folder},
          {model: Label},
          {model: Message, as: 'messages'},
        ],
      });
      if (!thread) {
        throw Boom.notFound(`Thread ${request.params.id} not found`);
      }
      return h.response(Serialization.jsonStringify(thread));
    },
  });

  server.route({
    method: 'PUT',
    path: '/threads/{id}',
    options: {
      description: 'Update a thread',
      notes: 'Can move between folders',
      tags: ['threads'],
      validate: {
        params: {
          id: Joi.string(),
          payload: {
            unread: Joi.boolean(),
            starred: Joi.boolean(),
            labels: Joi.array(),
            label_ids: Joi.array(),
            folder: Joi.string(),
            folder_id: Joi.string(),
          },
        },
      },
      response: {
        sample: 0,
        schema: Serialization.jsonSchema('SyncbackRequest'),
      },
    },
    handler: (request, h) => {
      const payload = request.payload
      if ((payload.folder_id || payload.folder) && (payload.label_ids || payload.labels)) {
        return createAndReplyWithSyncbackRequest(request, h, {
          type: "SetThreadFolderAndLabels",
          props: {
            folderId: payload.folder_id || payload.folder,
            labelIds: payload.label_ids || payload.labels,
            threadId: request.params.id,
          },
        })
      } else if (payload.folder_id || payload.folder) {
        return createAndReplyWithSyncbackRequest(request, h, {
          type: "MoveThreadToFolder",
          props: {
            folderId: payload.folder_id || payload.folder,
            threadId: request.params.id,
          },
        })
      } else if (payload.label_ids || payload.labels) {
        return createAndReplyWithSyncbackRequest(request, h, {
          type: "SetThreadLabels",
          props: {
            labelIds: payload.label_ids || payload.labels,
            threadId: request.params.id,
          },
        })
      } else if (payload.unread === false) {
        return createAndReplyWithSyncbackRequest(request, h, {
          type: "MarkThreadAsRead",
          props: {
            threadId: request.params.id,
          },
        })
      } else if (payload.unread === true) {
        return createAndReplyWithSyncbackRequest(request, h, {
          type: "MarkThreadAsUnread",
          props: {
            threadId: request.params.id,
          },
        })
      } else if (payload.starred === false) {
        return createAndReplyWithSyncbackRequest(request, h, {
          type: "UnstarThread",
          props: {
            threadId: request.params.id,
          },
        })
      } else if (payload.starred === true) {
        return createAndReplyWithSyncbackRequest(request, h, {
          type: "StarThread",
          props: {
            threadId: request.params.id,
          },
        })
      } else {
        throw Boom.badRequest("Invalid thread update")
      }
    },
  });
};
