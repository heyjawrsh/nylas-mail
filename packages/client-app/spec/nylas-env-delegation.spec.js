import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const win = {
		loadSettings: { windowState: "window-state" },
		webContents: { isDevToolsOpened: vi.fn(() => false) },
	};
	return {
		win,
		display: { workAreaSize: { width: 1200, height: 800 } },
		application: { fileListCache: { draft: ["a.txt"] }, getMainWindow: vi.fn(() => "main-window") },
		send: vi.fn(), on: vi.fn(), beep: vi.fn(),
		existsSync: vi.fn(), readFileSync: vi.fn(), writeFileSync: vi.fn(),
		resolve: vi.fn(), isFileSync: vi.fn(), showMessageBox: vi.fn(),
		showOpenDialog: vi.fn(), showSaveDialog: vi.fn(),
		deepClone: vi.fn((value) => structuredClone(value)),
		openModal: vi.fn(), codeSnippet: vi.fn((props) => ({ type: "snippet", props })),
		defineSheet: vi.fn(), activateAllStores: vi.fn(() => Promise.resolve()),
		workspace: { Sheet: {} }, render: vi.fn(), createElement: vi.fn(() => "sheet-view"),
	};
});

vi.mock("node:module", () => {
	const required = vi.fn(() => ({}));
	const createRequire = () => required;
	return { default: { createRequire, globalPaths: [] }, createRequire, globalPaths: [] };
});
vi.mock("node:path", () => ({ default: { join: (...parts) => parts.join("/") }, join: (...parts) => parts.join("/") }));
vi.mock("electron", () => ({
	default: {
		ipcRenderer: { on: m.on, send: m.send }, shell: { beep: m.beep },
		remote: {
			getCurrentWindow: () => m.win, getGlobal: () => m.application,
			app: { quit: vi.fn() }, screen: { getPrimaryDisplay: () => m.display },
			dialog: { showMessageBox: m.showMessageBox, showOpenDialog: m.showOpenDialog, showSaveDialog: m.showSaveDialog },
		},
	},
	ipcRenderer: { on: m.on, send: m.send }, shell: { beep: m.beep },
}));
vi.mock("@electron/remote", () => ({
	default: {
		getCurrentWindow: () => m.win, getGlobal: () => m.application,
		app: { quit: vi.fn() }, screen: { getPrimaryDisplay: () => m.display },
		dialog: { showMessageBox: m.showMessageBox, showOpenDialog: m.showOpenDialog, showSaveDialog: m.showSaveDialog },
	},
	getCurrentWindow: () => m.win, getGlobal: () => m.application,
	app: { quit: vi.fn() }, screen: { getPrimaryDisplay: () => m.display },
	dialog: { showMessageBox: m.showMessageBox, showOpenDialog: m.showOpenDialog, showSaveDialog: m.showSaveDialog },
	remote: {
		getCurrentWindow: () => m.win, getGlobal: () => m.application,
		app: { quit: vi.fn() }, screen: { getPrimaryDisplay: () => m.display },
		dialog: { showMessageBox: m.showMessageBox, showOpenDialog: m.showOpenDialog, showSaveDialog: m.showSaveDialog },
	},
}));
vi.mock("underscore", () => {
	const underscore = {
		extend: (target, ...sources) => Object.assign(target, ...sources),
		uniq: (values) => [...new Set(values)], flatten: (values) => values.flat(),
		intersection: (left, right) => left.filter((value) => right.includes(value)),
		clone: (value) => ({ ...value }), defer: (fn) => fn(),
		isArray: Array.isArray, isString: (value) => typeof value === "string",
		isNumber: (value) => typeof value === "number",
		isObject: (value) => value !== null && typeof value === "object",
	};
	return { default: underscore, ...underscore };
});
vi.mock("event-kit", () => ({
	default: {}, Emitter: class Emitter {
		constructor() { this.handlers = new Map(); }
		on(name, callback) { const handlers = this.handlers.get(name) || []; handlers.push(callback); this.handlers.set(name, handlers); return { dispose: () => this.handlers.set(name, handlers.filter((handler) => handler !== callback)) }; }
		emit(name, value) { for (const callback of this.handlers.get(name) || []) callback(value); }
	},
}));
vi.mock("fs-plus", () => ({ default: {
	existsSync: m.existsSync, readFileSync: m.readFileSync, writeFileSync: m.writeFileSync,
	resolve: m.resolve, isFileSync: m.isFileSync,
} }));
vi.mock("coffeestack", () => ({ default: {}, convertStackTrace: vi.fn((stack) => stack) }));
vi.mock("source-map-support", () => ({ default: {}, mapSourcePosition: vi.fn((position) => position) }));
vi.mock("../src/window-event-handler.js", () => ({ default: class WindowEventHandler {} }));
vi.mock("../src/styles-element.js", () => ({ default: class StylesElement {} }));
vi.mock("../src/registries/store-registry.js", () => ({ default: { activateAllStores: m.activateAllStores } }));
vi.mock("../src/flux/models/utils.js", () => ({ default: { deepClone: m.deepClone } }));
vi.mock("../src/config.js", () => ({ default: class Config {} }));
vi.mock("../src/theme-manager.js", () => ({ default: class ThemeManager {} }));
vi.mock("../src/style-manager.js", () => ({ default: class StyleManager {} }));
vi.mock("../src/error-logger.js", () => ({ default: class ErrorLogger {} }));
vi.mock("../src/flux/stores/workspace-store.js", () => ({
	default: { Sheet: m.workspace.Sheet, defineSheet: m.defineSheet },
}));
vi.mock("react", () => ({ default: { createElement: m.createElement }, createElement: m.createElement }));
vi.mock("react-dom", () => ({ default: { render: m.render }, render: m.render }));
vi.mock("../src/sheet-container.jsx", () => ({ default: function SheetContainer() {} }));
vi.mock("nylas-exports", () => ({ default: {}, Actions: { openModal: m.openModal } }));
vi.mock("nylas-component-kit", () => ({ default: {}, CodeSnippet: m.codeSnippet }));

import NylasEnv from "../src/nylas-env.js";

const settings = (overrides = {}) => ({
	windowType: "work", mainWindow: true, isSpec: false, devMode: false,
	benchmarkMode: false, safeMode: false, configDirPath: "/config", ...overrides,
});

describe("NylasEnv saved-state paths and package pieces", () => {
	let env;
	beforeEach(() => {
		vi.clearAllMocks();
		NylasEnv.loadSettings = settings();
		m.win.loadSettings = { windowState: "window-state" };
		env = new NylasEnv({ version: 1 });
	});

	it("falls back to window state when the state file is absent", () => {
		m.existsSync.mockReturnValue(false);
		m.win.loadSettings.windowState = '{"version":1,"from":"window"}';
		expect(NylasEnv._loadSavedState()).toEqual({ version: 1, from: "window" });
	});

	it("returns null when reading the state file throws", () => {
		m.existsSync.mockReturnValue(true);
		m.readFileSync.mockImplementation(() => { throw new Error("denied"); });
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		expect(NylasEnv._loadSavedState()).toBeNull();
		warn.mockRestore();
	});

	it("constructs an environment from matching saved state", () => {
		vi.spyOn(NylasEnv, "_loadSavedState").mockReturnValue({ version: 1, marker: true });
		expect(NylasEnv.loadOrCreate().savedState.marker).toBe(true);
	});

	it("serializes secondary-window state into native load settings", () => {
		NylasEnv.loadSettings = settings({ mainWindow: false });
		env.savedState.marker = 7;
		expect(env.saveSync()).toBe('{"version":1,"marker":7}');
		expect(m.win.loadSettings.windowState).toBe('{"version":1,"marker":7}');
	});

	it("restores package states and removes their serialized copy", () => {
		env.savedState.packageStates = { inbox: { selected: true } };
		env.packages = {};
		env.deserializePackageStates();
		expect(env.packages.packageStates).toEqual({ inbox: { selected: true } });
		expect(env.savedState).not.toHaveProperty("packageStates");
	});

	it("restores an empty package-state object when none was saved", () => {
		env.packages = {};
		env.deserializePackageStates();
		expect(env.packages.packageStates).toEqual({});
	});

	it("saves live package states before unloading", () => {
		env.packages = { deactivatePackages: vi.fn(), packageStates: { composer: 2 } };
		vi.spyOn(env, "saveSync").mockImplementation(() => {});
		env.saveStateAndUnloadWindow();
		expect(env.savedState.packageStates).toEqual({ composer: 2 });
	});
});

describe("NylasEnv config, themes, workspace, and menu delegation", () => {
	let env;
	beforeEach(() => {
		vi.clearAllMocks();
		NylasEnv.loadSettings = settings();
		env = new NylasEnv({ version: 1 });
	});

	it("sets the root config schema before loading configuration", () => {
		env.config = { setSchema: vi.fn(), load: vi.fn(() => "loaded") };
		expect(env.loadConfig()).toBe("loaded");
		expect(env.config.setSchema).toHaveBeenCalledWith(null, expect.objectContaining({ type: "object" }));
	});

	it("subscribes to active-theme changes", () => {
		env.themes = { onDidChangeActiveThemes: vi.fn(() => "subscription") };
		env.packages = { getActivePackages: vi.fn(() => []) };
		expect(env.watchThemes()).toBe("subscription");
	});

	it("reloads stylesheets belonging to non-theme packages", () => {
		const pack = { getType: vi.fn(() => "mail-view"), reloadStylesheets: vi.fn() };
		let changed;
		env.themes = { onDidChangeActiveThemes: vi.fn((callback) => { changed = callback; }) };
		env.packages = { getActivePackages: vi.fn(() => [pack]) };
		env.watchThemes(); changed();
		expect(pack.reloadStylesheets).toHaveBeenCalledOnce();
	});

	it("does not reload stylesheets belonging to theme packages", () => {
		const pack = { getType: vi.fn(() => "theme"), reloadStylesheets: vi.fn() };
		let changed;
		env.themes = { onDidChangeActiveThemes: vi.fn((callback) => { changed = callback; }) };
		env.packages = { getActivePackages: vi.fn(() => [pack]) };
		env.watchThemes(); changed();
		expect(pack.reloadStylesheets).not.toHaveBeenCalled();
	});

	it("ignores non-theme packages without a stylesheet reloader", () => {
		let changed;
		env.themes = { onDidChangeActiveThemes: vi.fn((callback) => { changed = callback; }) };
		env.packages = { getActivePackages: vi.fn(() => [{ getType: () => "service" }]) };
		env.watchThemes();
		expect(changed()).toBeNull();
	});

	it("creates the default workspace sheet when it is missing", () => {
		m.workspace.Sheet.Main = undefined;
		env.initializeBasicSheet();
		expect(m.defineSheet).toHaveBeenCalledWith("Main", { root: true }, { popout: ["Center"] });
	});

	it("keeps an existing default workspace sheet", () => {
		m.workspace.Sheet.Main = { existing: true };
		env.initializeBasicSheet();
		expect(m.defineSheet).not.toHaveBeenCalled();
	});

	it("renders and appends the workspace item to the configured parent", () => {
		const parent = document.createElement("section");
		parent.id = "workspace-host";
		document.body.appendChild(parent);
		env.workspaceViewParentSelector = "#workspace-host";
		const item = env.initializeReactRoot();
		expect(item.id).toBe("sheet-container");
		expect(parent.lastChild).toBe(item);
		expect(m.render).toHaveBeenCalledWith("sheet-view", item);
		parent.remove();
	});

	it("updates the menu after stores and window services start", async () => {
		env.loadConfig = vi.fn();
		env.keymaps = { loadKeymaps: vi.fn() };
		env.themes = { loadBaseStylesheets: vi.fn() };
		env.packages = { loadPackages: vi.fn(), activate: vi.fn(), packageStates: {} };
		env.initializeReactRoot = vi.fn();
		env.menu = { update: vi.fn(() => "menu-updated") };
		expect(await env.startWindow()).toBe("menu-updated");
	});

	it("skips package pieces when package loading is deferred", async () => {
		NylasEnv.loadSettings = settings({ packageLoadingDeferred: true });
		env.loadConfig = vi.fn();
		env.keymaps = { loadKeymaps: vi.fn() };
		env.themes = { loadBaseStylesheets: vi.fn() };
		env.packages = { loadPackages: vi.fn(), activate: vi.fn() };
		env.initializeReactRoot = vi.fn();
		env.menu = { update: vi.fn() };
		await env.startWindow();
		expect(env.packages.loadPackages).not.toHaveBeenCalled();
		expect(env.packages.activate).not.toHaveBeenCalled();
	});
});

describe("NylasEnv error, feedback, and dialog channels", () => {
	let env;
	beforeEach(() => {
		vi.clearAllMocks();
		NylasEnv.loadSettings = settings();
		env = new NylasEnv({ version: 1 });
		env.errorLogger = { reportError: vi.fn() };
		env.packages = { getPluginIdsByPathBase: vi.fn(() => ({})) };
	});

	it("lets the will-throw channel suppress error reporting", () => {
		env.onWillThrowError((event) => event.preventDefault());
		env.reportError(new Error("handled"));
		expect(env.errorLogger.reportError).not.toHaveBeenCalled();
	});

	it("reports errors and records the last uncaught error", () => {
		const error = new Error("boom");
		env.reportError(error);
		expect(env.lastUncaughtError).toBe(error);
		expect(env.errorLogger.reportError).toHaveBeenCalledWith(error, { pluginIds: [] });
	});

	it("emits the did-throw channel after logging", () => {
		const didThrow = vi.fn();
		env.onDidThrowError(didThrow);
		env.reportError(new Error("boom"), { line: 12 });
		expect(didThrow).toHaveBeenCalledWith(expect.objectContaining({ message: "boom", line: 12 }));
	});

	it("attributes errors to packages found in stack paths", () => {
		env.packages.getPluginIdsByPathBase.mockReturnValue({ plugin_alpha: "alpha-id" });
		const extra = {};
		env.reportError({ message: "broken", stack: "/plugins/plugin_alpha/index.js:4" }, extra);
		expect(extra.pluginIds).toEqual(["alpha-id"]);
	});

	it("returns no package attribution for errors without stacks", () => {
		expect(env._findPluginsFromError({ message: "plain" })).toEqual([]);
	});

	it("opens devtools for development errors", () => {
		NylasEnv.loadSettings = settings({ devMode: true });
		env.openDevTools = vi.fn();
		env.executeJavaScriptInDevTools = vi.fn();
		env.reportError(new Error("dev"));
		expect(env.openDevTools).toHaveBeenCalledOnce();
	});

	it("honors noWindows for development errors", () => {
		NylasEnv.loadSettings = settings({ devMode: true });
		env.openDevTools = vi.fn();
		env.reportError(new Error("quiet"), {}, { noWindows: true });
		expect(env.openDevTools).not.toHaveBeenCalled();
	});

	it("delegates open-dialog results to the feedback callback", () => {
		m.showOpenDialog.mockReturnValue(["/tmp/a.txt"]);
		const callback = vi.fn(() => "accepted");
		expect(env.showOpenDialog({ properties: ["openFile"] }, callback)).toBe("accepted");
		expect(callback).toHaveBeenCalledWith(["/tmp/a.txt"]);
	});

	it("supplies a default title to save dialogs", () => {
		const options = {};
		m.showSaveDialog.mockReturnValue("/tmp/a.txt");
		const callback = vi.fn();
		env.showSaveDialog(options, callback);
		expect(m.showSaveDialog).toHaveBeenCalledWith(m.win, { title: "Save File" });
	});

	it("shows simple errors as warning dialogs", () => {
		env.showErrorDialog("Could not sync");
		expect(m.showMessageBox).toHaveBeenCalledWith(null, {
			type: "warning", buttons: ["Okay"], message: "Error", detail: "Could not sync",
		});
	});

	it("targets the main window when requested", () => {
		env.showErrorDialog({ title: "Sync", message: "Failed" }, { showInMainWindow: true });
		expect(m.showMessageBox).toHaveBeenCalledWith("main-window", expect.objectContaining({ message: "Sync" }));
	});

	it("opens detailed error feedback from the dialog menu item", () => {
		m.showMessageBox.mockImplementation((_win, _options, callback) => callback(1));
		env.showErrorDialog("Failed", { detail: "stack trace" });
		expect(m.openModal).toHaveBeenCalledWith(expect.objectContaining({ height: 600, width: 800 }));
		expect(m.codeSnippet).toHaveBeenCalledWith(expect.objectContaining({ intro: "Failed", code: "stack trace" }));
	});

	it("does not open details when the primary dialog item is chosen", () => {
		m.showMessageBox.mockImplementation((_win, _options, callback) => callback(0));
		env.showErrorDialog("Failed", { detail: "stack trace" });
		expect(m.openModal).not.toHaveBeenCalled();
	});
});
