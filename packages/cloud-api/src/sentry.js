import * as Sentry from '@sentry/node'

let initialized = false

const sentryPlugin = {
  name: 'sentry-plugin', version: '1.0.0',
  register(server, options) {
    if (!initialized) { Sentry.init({dsn: options.dsn, ...options.client}); initialized = true }
    server.expose('client', Sentry)
    server.events.on('request', (request, event, tags) => {
      if (!tags.error || !event.error) return
      Sentry.captureException(event.error, {extra: {
        timestamp: request.info.received, id: request.info.id,
        remoteAddress: request.info.remoteAddress, method: request.method, path: request.path,
      }, tags: options.tags})
    })
  },
}

export const captureException = (...args) => Sentry.captureException(...args)
export default sentryPlugin
