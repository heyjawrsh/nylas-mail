const pino = require('pino')
const {getLogDestination} = require('./log-streams')
const NODE_ENV = process.env.NODE_ENV || 'unknown'

/**
 * Logging is powered by pino (structured JSON lines). In development, output
 * is prettified by pino-pretty; tests capture into an in-memory string
 * stream (`testStream`); everywhere else we write JSON to stdout.
 *
 * Usage mirrors the old bunyan API surface we relied on:
 *   log.info({account_id: id}, 'msg')
 *   log.child({fields})
 *   log.forAccount(account[, parentLogger])
 */
function createLogger(name, env = NODE_ENV) {
  const {stream, level, transport} = getLogDestination(name, env)
  const options = {
    name,
    level,
    base: {env},
    sync: true,
  }
  const logger = transport ? pino({...options, transport}) : pino(options, stream)

  return Object.assign(logger, {
    forAccount(account = {}, parentLogger = logger) {
      return parentLogger.child({
        account_id: account.id,
        account_email: account.emailAddress,
        account_provider: account.provider,
        n1_id: account.n1IdentityToken || 'Not available',
      });
    },
  });
}

module.exports = {
  createLogger,
}
