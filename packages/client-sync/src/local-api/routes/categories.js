import Joi from 'joi';
import Serialization from '../serialization.js';
import {createAndReplyWithSyncbackRequest} from '../route-helpers.js';

export default (server) => {
  ['Folder', 'Label'].forEach((klass) => {
    const term = `${klass.toLowerCase()}s`;

    server.route({
      method: 'GET',
      path: `/${term}`,
      options: {
        description: `${term}`,
        notes: 'Notes go here',
        tags: [term],
        validate: {
          query: {
            limit: Joi.number().integer().min(1).max(2000).default(100),
            offset: Joi.number().integer().min(0).default(0),
          },
        },
        response: {
          sample: 0,
          schema: Joi.array().items(
            Serialization.jsonSchema(klass)
          ),
        },
      },
      async handler(request, h) {
        const db = await request.getAccountDatabase()
        const Klass = db[klass];
        const items = await Klass.findAll({
          limit: request.query.limit,
          offset: request.query.offset,
        })
        return h.response(Serialization.jsonStringify(items));
      },
    });

    // TODO: consider adding some processing on routes that require display_name,
    // so that we smartly add prefixes or proper separators and things like that.

    server.route({
      method: 'POST',
      path: `/${term}`,
      options: {
        description: `Create ${term}`,
        tags: [term],
        validate: {
          payload: {
            display_name: Joi.string().required(),
          },
        },
        response: {
          sample: 0,
          schema: Serialization.jsonSchema('SyncbackRequest'),
        },
      },
      async handler(request, h) {
        const {payload} = request
        if (payload.display_name) {
          return createAndReplyWithSyncbackRequest(request, h, {
            type: "CreateCategory",
            props: {
              objectClass: klass,
              displayName: payload.display_name,
            },
          })
        }
      },
    })

    server.route({
      method: 'PUT',
      path: `/${term}/{id}`,
      options: {
        description: `Update ${term}`,
        tags: [term],
        validate: {
          params: {
            id: Joi.string().required(),
          },
          payload: Joi.object().keys({
            display_name: Joi.string(),
            role: Joi.string(),
          }).or('display_name', 'role'), // Require at least one of these fields
        },
        response: {
          sample: 0,
          schema: Serialization.jsonSchema('SyncbackRequest'),
        },
      },
      async handler(request, h) {
        const {display_name: displayName, role} = request.payload
        if (role) {
          const db = await request.getAccountDatabase()
          const Klass = db[klass];

          // Only one folder/label should have any given role
          // Remove this role from any items that it currently belongs to
          const labelsWithRole = await db.Label.findAll({
            where: {role: role},
          })
          const foldersWithRole = await db.Folder.findAll({
            where: {role: role},
          })
          const itemsWithRole = labelsWithRole.concat(foldersWithRole)
          await Promise.all(itemsWithRole.map((item) => {
            item.role = null;
            return item.save();
          }))

          // Add the role to the target item
          const targetItem = await Klass.findByPk(request.params.id)
          targetItem.role = role;
          await targetItem.save()

          if (!displayName) {
            return h.response(Serialization.jsonStringify(targetItem));
          }
        }
        if (displayName) {
          if (klass === 'Label') {
            return createAndReplyWithSyncbackRequest(request, h, {
              type: "RenameLabel",
              props: {
                labelId: request.params.id,
                newLabelName: displayName,
              },
            })
          } else {
            return createAndReplyWithSyncbackRequest(request, h, {
              type: "RenameFolder",
              props: {
                folderId: request.params.id,
                newFolderName: displayName,
              },
            })
          }
        }
      },
    })

    server.route({
      method: 'DELETE',
      path: `/${term}/{id}`,
      options: {
        description: `Delete ${term}`,
        tags: [term],
        validate: {
          params: {
            id: Joi.string().required(),
          },
        },
        response: {
          sample: 0,
          schema: Serialization.jsonSchema('SyncbackRequest'),
        },
      },
      handler: (request, h) => {
        if (klass === 'Label') {
          return createAndReplyWithSyncbackRequest(request, h, {
            type: "DeleteLabel",
            props: {
              labelId: request.params.id,
            },
          })
        } else {
          return createAndReplyWithSyncbackRequest(request, h, {
            type: "DeleteFolder",
            props: {
              folderId: request.params.id,
            },
          })
        }
      },
    })
  });
};
