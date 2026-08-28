import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const win = {
		close: vi.fn(), getSize: vi.fn(() => [800, 600]), setSize: vi.fn(),
		getPosition: vi.fn(() => [12, 34]), isVisible: vi.fn(() => true),
		isMaximized: vi.fn(() => false), isFullScreen: vi.fn(() => false),
		getBounds: vi.fn(() => ({ x: 1, y: 2, width: 800, height: 600 })),
		setBounds: vi.fn(), webContents: { isDevToolsOpened: vi.fn(() => false) },
		loadSettings: { windowState: "saved-in-window" },
	};
	const application = { getAllWindowDimensions: vi.fn(() => [{ width: 800 }]), fileListCache: {} };
	return {
		win, application, send: vi.fn(), beep: vi.fn(), quit: vi.fn(),
		display: { workAreaSize: { width: 1920, height: 1080 }, workArea: { width: 1920, height: 1080 } },
		existsSync: vi.fn(), readFileSync: vi.fn(), writeFileSync: vi.fn(),
		showMessageBox: vi.fn(() => 0), deepClone: vi.fn((value) => structuredClone(value)),
	};
});

vi.mock("node:module", () => {
	const createRequire = () => vi.fn(() => () => ({}));
	return { default: { createRequire, globalPaths: [] }, createRequire, globalPaths: [] };
});
vi.mock("node:path", () => ({ default: { join: (...parts) => parts.join("/") }, join: (...parts) => parts.join("/") }));
vi.mock("electron", () => ({
	default: {
		ipcRenderer: { send: m.send }, shell: { beep: m.beep },
		remote: {
			app: { quit: m.quit, getVersion: () => "0.0.0", getPath: () => "/tmp" },
			screen: { getPrimaryDisplay: () => m.display },
			dialog: { showMessageBox: m.showMessageBox },
			getCurrentWindow: () => m.win, getGlobal: () => m.application,
		},
	},
	ipcRenderer: { send: m.send }, shell: { beep: m.beep },
	remote: {
		app: { quit: m.quit, getVersion: () => "0.0.0", getPath: () => "/tmp" },
		screen: { getPrimaryDisplay: () => m.display },
		dialog: { showMessageBox: m.showMessageBox },
		getCurrentWindow: () => m.win, getGlobal: () => m.application,
	},
}));
vi.mock("@electron/remote", () => ({
	default: { ipcRenderer: { send: m.send }, shell: { beep: m.beep } },
	ipcRenderer: { send: m.send }, shell: { beep: m.beep },
	screen: { getPrimaryDisplay: () => m.display },
	dialog: { showMessageBox: m.showMessageBox },
	getCurrentWindow: () => m.win, getGlobal: () => m.application,
	app: { quit: m.quit, getVersion: () => "0.0.0", getPath: () => "/tmp" },
	remote: {
		app: { quit: m.quit, getVersion: () => "0.0.0", getPath: () => "/tmp" },
		screen: { getPrimaryDisplay: () => m.display },
		dialog: { showMessageBox: m.showMessageBox },
		getCurrentWindow: () => m.win, getGlobal: () => m.application,
		require: () => ({}),
		app: { quit: m.quit }, dialog: { showMessageBox: m.showMessageBox },
		screen: { getPrimaryDisplay: () => m.display },
	},
}));
vi.mock("underscore", () => {
	const underscore = {
		values: (o) => Object.values(o || {}), uniq: (a) => [...new Set(a || [])],
		extend: (target, ...sources) => Object.assign(target, ...sources),
		debounce: (fn) => fn, defer: (fn) => fn(), flatten: (a) => a.flat(),
		intersection: (a, b) => a.filter((x) => b.includes(x)), clone: (o) => ({ ...o }),
		isArray: Array.isArray, isString: (v) => typeof v === "string",
		isNumber: (v) => typeof v === "number", isObject: (v) => v !== null && typeof v === "object",
	};
	return { default: underscore, ...underscore };
});
vi.mock("event-kit", () => ({
	default: {}, Emitter: class Emitter {
		constructor() { this.handlers = new Map(); }
		on(name, fn) { const list = this.handlers.get(name) || []; list.push(fn); this.handlers.set(name, list); return { dispose: () => this.handlers.set(name, list.filter((x) => x !== fn)) }; }
		emit(name, value) { for (const fn of this.handlers.get(name) || []) fn(value); }
	},
}));
vi.mock("fs-plus", () => ({ default: { existsSync: m.existsSync, readFileSync: m.readFileSync, writeFileSync: m.writeFileSync, resolve: vi.fn(), isFileSync: vi.fn() } }));
vi.mock("coffeestack", () => ({ default: {}, convertStackTrace: vi.fn((s) => s) }));
vi.mock("source-map-support", () => ({ default: {}, mapSourcePosition: vi.fn((p) => p) }));
vi.mock("../src/window-event-handler.js", () => ({ default: class WindowEventHandler {} }));
vi.mock("../src/styles-element.js", () => ({ default: class StylesElement {} }));
vi.mock("../src/registries/store-registry.js", () => ({ default: {} }));
vi.mock("../src/flux/models/utils.js", () => ({ default: { deepClone: m.deepClone } }));
vi.mock("../src/config.js", () => ({ default: class Config {} }));
vi.mock("../src/theme-manager.js", () => ({ default: class ThemeManager {} }));
vi.mock("../src/style-manager.js", () => ({ default: class StyleManager {} }));
vi.mock("../src/error-logger.js", () => ({ default: class ErrorLogger {} }));
vi.mock("../src/flux/stores/workspace-store.js", () => ({ default: {} }));
vi.mock("react", () => ({ default: { createElement: vi.fn() }, createElement: vi.fn() }));
vi.mock("react-dom", () => ({ default: { render: vi.fn() }, render: vi.fn() }));
vi.mock("../src/sheet-container.jsx", () => ({ default: () => null }));
vi.mock("nylas-exports", () => ({ default: {}, Actions: { openModal: vi.fn() } }));
vi.mock("nylas-component-kit", () => ({ default: {}, CodeSnippet: vi.fn() }));

import NylasEnv from "../src/nylas-env.js";

const settings = (overrides = {}) => ({
	windowType: "work", mainWindow: true, devMode: false, benchmarkMode: false,
	safeMode: false, isSpec: false, appVersion: "2.0.0", configDirPath: "/config",
	windowProps: { accountId: "a1" }, ...overrides,
});

describe("NylasEnv load settings and saved state", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		NylasEnv.loadSettings = settings();
		m.win.loadSettings = { windowState: "saved-in-window" };
	});

	it("returns a clone of load settings", () => {
		const result = NylasEnv.getLoadSettings(); result.windowType = "composer";
		expect(NylasEnv.loadSettings.windowType).toBe("work");
	});

	it("reads the lazy window state from the current native window", () => {
		expect(NylasEnv.getLoadSettings().windowState).toBe("saved-in-window");
	});

	it("writes the lazy window state to the current native window", () => {
		NylasEnv.getLoadSettings().windowState = "new-state";
		expect(m.win.loadSettings.windowState).toBe("new-state");
	});

	it("uses the spec state filename in spec mode", () => {
		NylasEnv.loadSettings = settings({ isSpec: true });
		expect(NylasEnv.getStatePath()).toBe("spec-saved-state.json");
	});

	it("uses the config directory for the main-window state", () => {
		expect(NylasEnv.getStatePath()).toBe("/config/main-window-state.json");
	});

	it("has no filesystem state path for secondary windows", () => {
		NylasEnv.loadSettings = settings({ mainWindow: false });
		expect(NylasEnv.getStatePath()).toBeNull();
	});

	it("loads saved state from disk when present", () => {
		m.existsSync.mockReturnValue(true); m.readFileSync.mockReturnValue('{"version":1,"ok":true}');
		expect(NylasEnv._loadSavedState()).toEqual({ version: 1, ok: true });
	});

	it("returns null for malformed saved state", () => {
		m.existsSync.mockReturnValue(true); m.readFileSync.mockReturnValue("not json");
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		expect(NylasEnv._loadSavedState()).toBeNull(); warn.mockRestore();
	});

	it("restores state only when its serialization version matches", () => {
		vi.spyOn(NylasEnv, "_loadSavedState").mockReturnValue({ version: 99, old: true });
		expect(NylasEnv.loadOrCreate().savedState).toEqual({ version: 1 });
	});
});

describe("NylasEnv public surface", () => {
	let env;
	beforeEach(() => { vi.clearAllMocks(); NylasEnv.loadSettings = settings(); env = new NylasEnv({ version: 1 }); });

	it("throws assertion failures with the supplied message", () => {
		expect(() => env.assert(false, "broken")).toThrow("Assertion error: broken");
	});

	it("identifies the main window", () => { expect(env.isMainWindow()).toBe(true); });
	it("identifies empty windows", () => { NylasEnv.loadSettings.windowType = "emptyWindow"; expect(env.isEmptyWindow()).toBe(true); });
	it("identifies work windows", () => { expect(env.isWorkWindow()).toBe(true); });
	it("identifies regular composer windows", () => { NylasEnv.loadSettings.windowType = "composer"; expect(env.isComposerWindow()).toBe(true); });
	it("identifies preloaded composer windows", () => { NylasEnv.loadSettings.windowType = "composer-preload"; expect(env.isComposerWindow()).toBe(true); });
	it("identifies thread popout windows", () => { NylasEnv.loadSettings.windowType = "thread-popout"; expect(env.isThreadWindow()).toBe(true); });
	it("exposes mode flags", () => { NylasEnv.loadSettings = settings({ devMode: true, benchmarkMode: true, safeMode: true, isSpec: true }); expect([env.inDevMode(), env.inBenchmarkMode(), env.inSafeMode(), env.inSpecMode()]).toEqual([true, true, true, true]); });
	it("caches the application version", () => { expect(env.getVersion()).toBe("2.0.0"); NylasEnv.loadSettings.appVersion = "3.0.0"; expect(env.getVersion()).toBe("2.0.0"); });
	it("treats a seven-character hash as unreleased", () => { NylasEnv.loadSettings.appVersion = "abcdef1"; expect(env.isReleasedVersion()).toBe(false); });
	it("returns config and window properties", () => { expect([env.getConfigDirPath(), env.getWindowProps()]).toEqual(["/config", { accountId: "a1" }]); });
	it("delegates close to the native window", () => { env.close(); expect(m.win.close).toHaveBeenCalledOnce(); });
	it("delegates quit to Electron", () => { env.quit(); expect(m.quit).toHaveBeenCalledOnce(); });
	it("returns native window size as a named object", () => { expect(env.getSize()).toEqual({ width: 800, height: 600 }); });
	it("rounds sizes before sending them to Electron", () => { env.setSize(100.6, 200.2); expect(m.win.setSize).toHaveBeenCalledWith(101, 200); });
	it("uses safe defaults for invalid sizes", () => { env.setSize(undefined, Number.NaN); expect(m.win.setSize).toHaveBeenCalledWith(100, 100); });
	it("returns native window position as a named object", () => { expect(env.getPosition()).toEqual({ x: 12, y: 34 }); });
	it("sends rounded positions through IPC", () => { env.setPosition(4.7, 8.2); expect(m.send).toHaveBeenCalledWith("call-window-method", "setPosition", 5, 8); });
	it("centers the window through IPC", () => { env.center(); expect(m.send).toHaveBeenCalledWith("call-window-method", "center"); });
	it("marks the environment as reloading", () => { env.reload(); expect(env.isReloading).toBe(true); });
	it("adds and removes the fullscreen body class", () => {
		env.setFullScreen(true);
		expect(document.body.classList.contains("fullscreen")).toBe(true);
		env.setFullScreen(false);
		expect(document.body.classList.contains("fullscreen")).toBe(false);
	});
	it("returns complete window dimensions", () => { expect(env.getWindowDimensions()).toEqual({ x: 1, y: 2, width: 800, height: 600, maximized: false, fullScreen: false }); });
	it("rejects dimensions that are wholly offscreen", () => { expect(env.isValidDimensions({ x: -500, y: 0, width: 100, height: 100 })).toBe(false); });
	it("caps default dimensions and centers the result", () => {
		expect(env.getDefaultWindowDimensions()).toEqual({ x: 240, y: 90, width: 1440, height: 900 });
	});
	it("stores and retrieves column widths", () => { env.storeColumnWidth({ id: "message", width: 320 }); expect(env.getColumnWidth("message")).toBe(320); });
	it("delegates new windows over IPC", () => { env.newWindow({ windowType: "composer" }); expect(m.send).toHaveBeenCalledWith("new-window", { windowType: "composer" }); });
	it("emits beep events even when audio is disabled", () => { env.config = { get: vi.fn(() => false) }; const callback = vi.fn(); env.onDidBeep(callback); env.beep(); expect(callback).toHaveBeenCalledOnce(); });
	it("uses the shell beep when configuration enables audio", () => { env.config = { get: vi.fn(() => true) }; env.beep(); expect(m.beep).toHaveBeenCalledOnce(); });
	it("returns the selected index for array-button confirmations", () => { m.showMessageBox.mockReturnValue(1); expect(env.confirm({ message: "Choose", buttons: ["No", "Yes"] })).toBe(1); });
	it("invokes the selected callback for object-button confirmations", () => { const yes = vi.fn(() => "yes"); m.showMessageBox.mockReturnValue(0); expect(env.confirm({ buttons: { Yes: yes } })).toBe("yes"); });
	it("writes serialized state to the main-window state file", () => { env.savedState.answer = 42; env.saveSync(); expect(m.writeFileSync).toHaveBeenCalledWith("/config/main-window-state.json", '{"version":1,"answer":42}', "utf8"); });
	it("exposes command and menu stubs before initialization", () => { expect(env.commands).toBeNull(); expect(env.menu).toBeNull(); });
});
