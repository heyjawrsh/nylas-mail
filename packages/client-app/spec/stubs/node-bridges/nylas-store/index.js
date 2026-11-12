// Node-resolution bridge for the app-internal "nylas-store" module.
const mod = require("../../../../src/global/nylas-store.js");
// Never assign onto an ESM namespace (getter-only `default` throws).
if (mod.default) {
	module.exports = mod.default;
} else {
	const shim = { ...mod, default: mod };
	module.exports = shim;
}
