import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	class Emitter {
		constructor() { this.handlers = new Map(); }
		on(name, callback) {
			const callbacks = this.handlers.get(name) || [];
			callbacks.push(callback);
			this.handlers.set(name, callbacks);
			return { dispose: () => this.handlers.set(name, callbacks.filter((item) => item !== callback)) };
		}
		emit(name, value) {
			for (const callback of this.handlers.get(name) || []) callback(value);
		}
	}
	const win = {
		loadSettings: {},
		webContents: { isDevToolsOpened: vi.fn(() => false) },
		isVisible: vi.fn(() => true),
	};
	const application = { getMainWindow: vi.fn(), fileListCache: {}, timer: {} };
	return {
		Emitter, win, application,
		ipcSend: vi.fn(), shellBeep: vi.fn(), windowFocus: vi.fn(),
		quit: vi.fn(), appEmit: vi.fn(), remoteExit: vi.fn(), remoteCrash: vi.fn(),
		writeFileSync: vi.fn(), deepClone: vi.fn((value) => structuredClone(value)),
	};
});

vi.mock("node:module", () => {
	const moduleApi = { createRequire: () => vi.fn(() => ({})), globalPaths: [] };
	return { default: moduleApi, ...moduleApi };
});
vi.mock("node:path", () => {
	const path = { join: (...parts) => parts.join("/") };
	return { default: path, ...path };
});
vi.mock("electron", () => {
	const remote = {
		getCurrentWindow: () => m.win,
		getGlobal: () => m.application,
		app: { quit: m.quit, emit: m.appEmit },
		process: { exit: m.remoteExit, crash: m.remoteCrash },
		screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1200, height: 800 } }) },
		dialog: { showMessageBox: vi.fn(), showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
	};
	const electron = { ipcRenderer: { send: m.ipcSend, on: vi.fn() }, shell: { beep: m.shellBeep }, remote };
	return { default: electron, ...electron };
});
vi.mock("@electron/remote", () => {
	const remote = {
		getCurrentWindow: () => m.win,
		getGlobal: () => m.application,
		app: { quit: m.quit, emit: m.appEmit },
		process: { exit: m.remoteExit, crash: m.remoteCrash },
		screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1200, height: 800 } }) },
		dialog: { showMessageBox: vi.fn(), showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
	};
	return { default: remote, ...remote, remote };
});
vi.mock("underscore", () => {
	const underscore = {
		extend: (target, ...sources) => Object.assign(target, ...sources),
		uniq: (values) => [...new Set(values)],
		flatten: (values) => values.flat(Infinity),
		intersection: (left, right) => left.filter((value) => right.includes(value)),
		clone: (value) => ({ ...value }),
		defer: (callback) => callback(),
		isArray: Array.isArray,
		isString: (value) => typeof value === "string",
		isNumber: (value) => typeof value === "number",
		isObject: (value) => value !== null && typeof value === "object",
	};
	return { default: underscore, ...underscore };
});
vi.mock("event-kit", () => ({ default: { Emitter: m.Emitter }, Emitter: m.Emitter }));
vi.mock("fs-plus", () => {
	const fs = { existsSync: vi.fn(), readFileSync: vi.fn(), writeFileSync: m.writeFileSync, resolve: vi.fn(), isFileSync: vi.fn() };
	return { default: fs, ...fs };
});
vi.mock("coffeestack", () => {
	const api = { convertStackTrace: vi.fn((stack) => stack) };
	return { default: api, ...api };
});
vi.mock("source-map-support", () => {
	const api = { mapSourcePosition: vi.fn((position) => position) };
	return { default: api, ...api };
});
vi.mock("../src/window-event-handler.js", () => ({ default: class WindowEventHandler {} }));
vi.mock("../src/styles-element.js", () => ({ default: class StylesElement {} }));
vi.mock("../src/registries/store-registry.js", () => ({ default: { activateAllStores: vi.fn() } }));
vi.mock("../src/flux/models/utils.js", () => ({ default: { deepClone: m.deepClone } }));
vi.mock("../src/config.js", () => ({ default: class Config {} }));
vi.mock("../src/theme-manager.js", () => ({ default: class ThemeManager {} }));
vi.mock("../src/style-manager.js", () => ({ default: class StyleManager {} }));
vi.mock("../src/error-logger.js", () => ({ default: class ErrorLogger {} }));
vi.mock("../src/flux/stores/workspace-store.js", () => ({ default: {} }));
vi.mock("react", () => {
	const React = { createElement: vi.fn() };
	return { default: React, ...React };
});
vi.mock("react-dom", () => {
	const ReactDOM = { render: vi.fn() };
	return { default: ReactDOM, ...ReactDOM };
});
vi.mock("../src/sheet-container.jsx", () => ({ default: vi.fn() }));
vi.mock("nylas-exports", () => {
	const exports = { Actions: { openModal: vi.fn() } };
	return { default: exports, ...exports };
});
vi.mock("nylas-component-kit", () => {
	const kit = { CodeSnippet: vi.fn() };
	return { default: kit, ...kit };
});

globalThis.NylasEnv = {
	isWorkWindow: vi.fn(() => true),
	inSpecMode: vi.fn(() => true),
	inDevMode: vi.fn(() => false),
	reportError: vi.fn(),
	config: { get: vi.fn(() => null), onDidChange: vi.fn(() => ({ dispose: vi.fn() })) },
	getConfigDirPath: vi.fn(() => "/config"),
	getPath: vi.fn(() => "/tmp"),
	getVersion: vi.fn(() => "0.0.0"),
};

const { default: NylasEnv } = await import("../src/nylas-env.js");

const settings = (overrides = {}) => ({
	windowType: "work", mainWindow: true, isSpec: false, devMode: false,
	benchmarkMode: false, safeMode: false, configDirPath: "/config",
	appVersion: "3.0.0", ...overrides,
});

describe("NylasEnv focus, beep, and developer-tool events", () => {
	let env;
	beforeEach(() => {
		vi.clearAllMocks();
		NylasEnv.loadSettings = settings();
		m.win.webContents.isDevToolsOpened.mockReturnValue(false);
		env = new NylasEnv({ version: 1 });
		vi.spyOn(window, "focus").mockImplementation(m.windowFocus);
	});



	it("emits a beep notification when sound is disabled", () => {
		env.config = { get: vi.fn(() => false) };
		const notified = vi.fn();
		env.onDidBeep(notified);
		env.beep();
		expect(notified).toHaveBeenCalledOnce();
	});

	it("does not call the shell when beep sound is disabled", () => {
		env.config = { get: vi.fn(() => false) };
		env.beep();
		expect(m.shellBeep).not.toHaveBeenCalled();
	});

	it("stops beep notifications after disposal", () => {
		env.config = { get: vi.fn(() => false) };
		const notified = vi.fn();
		const subscription = env.onDidBeep(notified);
		subscription.dispose();
		env.beep();
		expect(notified).not.toHaveBeenCalled();
	});



	it("reports whether native developer tools are open", () => {
		m.win.webContents.isDevToolsOpened.mockReturnValue(true);
		expect(env.isDevToolsOpened()).toBe(true);
	});

});

describe("NylasEnv reportError notification channels", () => {
	let env;
	beforeEach(() => {
		vi.clearAllMocks();
		NylasEnv.loadSettings = settings();
		env = new NylasEnv({ version: 1 });
		env.errorLogger = { reportError: vi.fn() };
		env.packages = { getPluginIdsByPathBase: vi.fn(() => ({})) };
	});

	it("notifies will-throw subscribers before logging", () => {
		const order = [];
		env.onWillThrowError(() => order.push("will"));
		env.errorLogger.reportError.mockImplementation(() => order.push("log"));
		env.reportError(new Error("boom"));
		expect(order.slice(0, 2)).toEqual(["will", "log"]);
	});

	it("includes extra fields in the will-throw event", () => {
		const notified = vi.fn();
		env.onWillThrowError(notified);
		env.reportError(new Error("boom"), { line: 19 });
		expect(notified).toHaveBeenCalledWith(expect.objectContaining({ message: "boom", line: 19 }));
	});

	it("does not update the last error when reporting is prevented", () => {
		env.lastUncaughtError = null;
		env.onWillThrowError((event) => event.preventDefault());
		env.reportError(new Error("ignored"));
		expect(env.lastUncaughtError).toBeNull();
	});

	it("stops will-throw notifications after disposal", () => {
		const notified = vi.fn();
		const subscription = env.onWillThrowError(notified);
		subscription.dispose();
		env.reportError(new Error("boom"));
		expect(notified).not.toHaveBeenCalled();
	});

	it("notifies did-throw subscribers after logging", () => {
		const order = [];
		env.errorLogger.reportError.mockImplementation(() => order.push("log"));
		env.onDidThrowError(() => order.push("did"));
		env.reportError(new Error("boom"));
		expect(order).toEqual(["log", "did"]);
	});

	it("does not reopen developer tools that are already visible", () => {
		NylasEnv.loadSettings = settings({ devMode: true });
		m.win.webContents.isDevToolsOpened.mockReturnValue(true);
		env.reportError(new Error("boom"));
		expect(m.ipcSend).not.toHaveBeenCalledWith("call-webcontents-method", "openDevTools");
	});


	it("still logs development errors when windows are suppressed", () => {
		NylasEnv.loadSettings = settings({ devMode: true });
		const error = new Error("headless");
		env.reportError(error, {}, { noWindows: true });
		expect(env.errorLogger.reportError).toHaveBeenCalledWith(error, { pluginIds: [] });
	});

	it("fails the current spec through the spec reporting channel", () => {
		NylasEnv.loadSettings = settings({ isSpec: true });
		const fail = vi.fn();
		globalThis.jasmine = { getEnv: () => ({ currentSpec: { fail } }) };
		const error = new Error("spec failure");
		env.reportError(error);
		expect(fail).toHaveBeenCalledWith(error);
		delete globalThis.jasmine;
	});
});

describe("NylasEnv restart and synchronous state paths", () => {
	let env;
	beforeEach(() => {
		vi.clearAllMocks();
		NylasEnv.loadSettings = settings();
		m.win.loadSettings = {};
		env = new NylasEnv({ version: 1, marker: "kept" });
	});



	it("delegates application quit", () => {
		env.quit();
		expect(m.quit).toHaveBeenCalledOnce();
	});

	it("emits will-exit before terminating the remote process", () => {
		const order = [];
		m.appEmit.mockImplementation(() => order.push("emit"));
		m.remoteExit.mockImplementation(() => order.push("exit"));
		env.exit(12);
		expect(order).toEqual(["emit", "exit"]);
	});

	it("passes the requested status to remote process exit", () => {
		env.exit(7);
		expect(m.remoteExit).toHaveBeenCalledWith(7);
	});

	it("delegates main-process crashes to the remote process", () => {
		env.crashMainProcess();
		expect(m.remoteCrash).toHaveBeenCalledOnce();
	});

	it("writes one serialized snapshot for a main-window save", () => {
		env.saveSync();
		expect(m.writeFileSync).toHaveBeenCalledTimes(1);
	});

	it("returns the serialized snapshot for a secondary-window save", () => {
		NylasEnv.loadSettings = settings({ mainWindow: false });
		expect(env.saveSync()).toBe('{"version":1,"marker":"kept"}');
	});

	it("stores secondary-window state without writing a file", () => {
		NylasEnv.loadSettings = settings({ mainWindow: false });
		env.saveSync();
		expect(m.writeFileSync).not.toHaveBeenCalled();
	});

	it("clears the live window state after unload saving", () => {
		env.packages = { deactivatePackages: vi.fn(), packageStates: { inbox: true } };
		vi.spyOn(env, "saveSync").mockImplementation(() => {});
		env.windowState = { transient: true };
		env.saveStateAndUnloadWindow();
		expect(env.windowState).toBeNull();
	});

	it("deactivates packages before taking the unload snapshot", () => {
		const order = [];
		env.packages = { deactivatePackages: vi.fn(() => order.push("deactivate")), packageStates: {} };
		vi.spyOn(env, "saveSync").mockImplementation(() => order.push("save"));
		env.saveStateAndUnloadWindow();
		expect(order).toEqual(["deactivate", "save"]);
	});
});
