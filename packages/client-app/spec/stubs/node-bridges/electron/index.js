// Node-resolution bridge for `electron` inside vitest's native (externalized)
// ESM chains. The real npm `electron` package exports only the binary path
// string, so named imports (ipcRenderer, remote, ...) fail at link time.
// This bridge preserves the default export (the binary path — smoke.js relies
// on it) and adds inert named-export stubs for the renderer surface. The
// literal `module.exports.X =` form at the end is what cjs-module-lexer
// detects for named imports.
// The real package resolves (and may download) the binary on require; tests
// never launch it, so the path string is a placeholder.
const real = "electron";

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
		getCurrentWindow: () => ({ setSheetOffset: () => {}, close: () => {}, focus: () => {} }),
	getCurrentWebContents: () => ({ getId: () => -1, id: -1 }),
	app: { getVersion: () => "0.0.0-test", getPath: () => "/tmp" },
	process: { env: {} },
	shell: { openExternal: () => {} },
};

module.exports.shell = { openExternal: () => {}, showItemInFolder: () => {} };
module.exports.app = {
	getVersion: () => "0.0.0-test",
	getPath: () => "/tmp",
	quit: () => {},
};
module.exports.BrowserWindow = class {};
module.exports.BrowserWindow.getFocusedWindow = () => null;
module.exports.clipboard = { readText: () => "", writeText: () => {} };
module.exports.dialog = { showMessage: () => {} };
module.exports.crashReporter = { start: () => {} };
module.exports.Menu = class {
	static buildFromTemplate() {
		return new module.exports.Menu();
	}
	static setApplicationMenu() {}
	append() {}
	popup() {}
};
module.exports.nativeImage = {
	createFromPath: () => ({ toDataURL: () => "" }),
};
module.exports.webFrame = {
	setZoomLevelLimits: () => {},
	setZoomFactor: () => {},
	getZoomFactor: () => 1,
};
module.exports.screen = {
	getPrimaryDisplay: () => ({ workAreaSize: { width: 1440, height: 900 } }),
};
