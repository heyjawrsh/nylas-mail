// Node-resolution bridge for `electron` inside vitest's native (externalized)
// ESM chains. The real npm `electron` package exports only the binary path
// string, so named imports (ipcRenderer, remote, ...) fail at link time.
// This bridge preserves the default export (the binary path — smoke.js relies
// on it) and adds inert named-export stubs for the renderer surface. The
// literal `module.exports.X =` form at the end is what cjs-module-lexer
// detects for named imports.
const real = require("/Users/jawrsh/Work/Repositories/nylas_mail/node_modules/.pnpm/electron@44.0.0_supports-color@7.2.0/node_modules/electron");

module.exports = new String(String(real));

module.exports.default = module.exports;

module.exports.ipcRenderer = {
	on: () => {},
	send: () => {},
	sendSync: () => ({}),
	removeListener: () => {},
	listeners: () => [],
};

module.exports.remote = {
	getGlobal: () => ({}),
	getCurrentWebContents: () => ({ getId: () => -1, id: -1 }),
	app: { getVersion: () => "0.0.0-test", getPath: () => "/tmp" },
	process: { env: {} },
	shell: { openExternal: () => {} },
};

module.exports.shell = { openExternal: () => {}, showItemInFolder: () => {} };
module.exports.app = { getVersion: () => "0.0.0-test", getPath: () => "/tmp" };
module.exports.BrowserWindow = class {};
module.exports.clipboard = { readText: () => "", writeText: () => {} };
module.exports.dialog = { showMessage: () => {} };
module.exports.crashReporter = { start: () => {} };
module.exports.Menu = class {
	static buildFromTemplate() {
		return new module.exports.Menu();
	}
	append() {}
	popup() {}
};
module.exports.nativeImage = {
	createFromPath: () => ({ toDataURL: () => "" }),
};
module.exports.screen = {
	getPrimaryDisplay: () => ({ workAreaSize: { width: 1440, height: 900 } }),
};
