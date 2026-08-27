// Node-resolution bridge for the app-internal "nylas-store" module.
const mod = require("/Users/jawrsh/Work/Repositories/nylas_mail/packages/client-app/src/global/nylas-store.js");
module.exports = mod.default || mod;
module.exports.default = module.exports;
