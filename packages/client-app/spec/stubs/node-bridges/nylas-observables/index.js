// Node-resolution bridge for the app-internal module name "nylas-observables".
// The bundler and vitest use aliases; externalized CJS/ESM consumers
// resolve through node_modules. Explicit named re-exports keep
// cjs-module-lexer happy; each read is guarded against the app's
// intentional model<->store load cycles.
const bridge = require("/Users/jawrsh/Work/Repositories/nylas_mail/packages/client-app/src/global/nylas-observables.js");
module.exports = bridge;
try { module.exports.Categories = bridge.Categories; } catch (_e) { /* mid-cycle */ }
