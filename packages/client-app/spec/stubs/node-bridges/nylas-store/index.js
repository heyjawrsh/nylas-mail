// Node-resolution bridge for the app-internal module names. The bundler and
// vitest use aliases; externalized CJS consumers resolve through node_modules.
module.exports = require("/Users/jawrsh/Work/Repositories/nylas_mail/packages/client-app/src/global/nylas-store.js");
