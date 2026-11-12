// jsdom test stub for @electron/remote: the module itself is the remote
// surface (namespace import or require), as in the real package. Kept
// standalone so specs that vi.mock("electron") don't reshape it.
const noop = () => {};

export const getGlobal = () => ({});
export const getCurrentWindow = () => ({
	setSheetOffset: noop,
	focus: noop,
	close: noop,
	loadSettings: { windowState: undefined },
});
export const getCurrentWebContents = () => ({ getId: () => -1, id: -1 });
export const app = {
	getVersion: () => "0.0.0-test",
	getPath: () => "/tmp",
	quit: noop,
	relaunch: noop,
};
export const process = { env: {} };
export const shell = { openExternal: noop, showItemInFolder: noop };
export const clipboard = { readText: () => "", writeText: noop };
export const dialog = { showMessageBox: noop, showOpenDialog: noop };
export const screen = {
	getPrimaryDisplay: () => ({ workAreaSize: { width: 1440, height: 900 } }),
};
export class BrowserWindow {
	static getFocusedWindow() {
		return null;
	}
}
export class Menu {
	static buildFromTemplate() {
		return new Menu();
	}
	static setApplicationMenu() {}
	append() {}
	popup() {}
}
export class MenuItem {}
export const require = (m) => globalThis.require?.(m);

const remote = {
	getGlobal,
	getCurrentWindow,
	getCurrentWebContents,
	app,
	process,
	shell,
	clipboard,
	dialog,
	screen,
	BrowserWindow,
	Menu,
	MenuItem,
	require,
};
// Old call sites read `.remote` off the module; keep it for any stragglers.
export { remote };
export default remote;
