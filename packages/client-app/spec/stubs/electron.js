// jsdom test stub for the electron module (main + renderer surfaces the app
// touches at import time).
export const ipcRenderer = {
	on: () => {},
	send: () => {},
	sendSync: () => ({}),
	removeListener: () => {},
	listeners: () => [],
};
export const remote = {
	getGlobal: () => ({}),
	getCurrentWebContents: () => ({ getId: () => -1, id: -1 }),
	app: { getVersion: () => "0.0.0-test", getPath: () => "/tmp" },
	process: { env: {} },
	shell: { openExternal: () => {} },
	require: (m) => require(m),
};
export const shell = { openExternal: () => {}, showItemInFolder: () => {} };
export const app = { getVersion: () => "0.0.0-test", getPath: () => "/tmp" };
export const BrowserWindow = class {};
export const clipboard = { readText: () => "", writeText: () => {} };
export const dialog = { showMessage: () => {} };
export const crashReporter = { start: () => {} };
export const Menu = class {
	static buildFromTemplate() {
		return new Menu();
	}
	append() {}
	popup() {}
};
export const nativeImage = { createFromPath: () => ({ toDataURL: () => "" }) };
export const screen = {
	getPrimaryDisplay: () => ({ workAreaSize: { width: 1440, height: 900 } }),
};
export default {
	ipcRenderer,
	remote,
	shell,
	app,
	BrowserWindow,
	clipboard,
	dialog,
	crashReporter,
	Menu,
	nativeImage,
	screen,
};
