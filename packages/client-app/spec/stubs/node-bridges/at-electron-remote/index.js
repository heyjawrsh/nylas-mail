// Node-resolution stub for @electron/remote in tests (the real package
// requires an Electron runtime and process.type routing).
const stub = {
	getGlobal: () => ({}),
	getCurrentWebContents: () => ({ getId: () => -1, id: -1 }),
	app: { getVersion: () => "0.0.0-test", getPath: () => "/tmp" },
	process: { env: {} },
	shell: { openExternal: () => {} },
	BrowserWindow: class {},
	enable: () => {},
	disable: () => {},
	initialize: () => {},
};
module.exports = stub;
module.exports.remote = stub;
module.exports.default = stub;
