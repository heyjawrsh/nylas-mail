import {decodeRecipient} from '../tracking-utils'
import Joi from 'joi'
import Path from 'node:path'
import {fileURLToPath} from 'node:url'
import {DatabaseConnector} from 'cloud-core'
const dirname = Path.dirname(fileURLToPath(import.meta.url))

const PLUGIN_NAME = 'open-tracking'

function updateMetadata({metadata, recipient}) {
  if (!metadata) {
    throw new Error("No metadata found, unable to update.")
  }

  const FIVE_MINUTES = 60 * 5 // in seconds
  const timestamp = Date.now() / 1000

  if (!metadata.value || !metadata.value.open_data) {
    metadata.value = {
      open_count: 0,
      open_data: [],
    }
  }

  // Iterate backwards until you reach older timestamps or find the same
  // recipient with a timestamp newer than five minutes
  for (const open of metadata.value.open_data.slice().reverse()) {
    if (timestamp - open.timestamp > FIVE_MINUTES) {
      break
    }
    if (open.recipient === recipient) {
      return Promise.resolve()
    }
  }

  return metadata.updateValue({
    open_count: metadata.value.open_count + 1,
    open_data: metadata.value.open_data.concat({
      timestamp: timestamp,
      recipient: recipient,
    }),
  })
}

export default function registerOpenTrackingRoutes(server) {
  server.route({
    method: 'GET',
    path: `/open/{messageId}`,
    options: {
      description: `open-tracking`,
      notes: 'Notes go here',
      tags: ['open-tracking'],
      auth: false,
      validate: {
        params: {
          messageId: Joi.string().required(),
        },
        query: {
          recipient: Joi.string(),
          r: Joi.string(), // The deprecated recipient param
        },
      },
    },
    async handler(request, h) {
      const {messageId} = request.params
      const recipient = decodeRecipient(request.query)

      const {Metadata} = await DatabaseConnector.forShared()
      const metadata = await Metadata.find({
        where: {
          pluginId: PLUGIN_NAME,
          objectId: messageId,
          objectType: 'message',
        },
      })
      try {
        await updateMetadata({metadata, recipient})
      } catch (err) {
        request.logger.error(err, 'Error tracking open')
      } finally {
        return h.file(Path.join(dirname, '../../static/images/transparent.gif'), {
          confine: false,
        })
        .header('Cache-Control', 'no-cache max-age=0')
      }
    },
  })
}
