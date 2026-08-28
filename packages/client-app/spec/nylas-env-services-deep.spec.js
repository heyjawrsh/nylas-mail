import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	class KeymapManager {
		constructor(options) { this.options = options; }
		add(...args) { return m.keymapAdd(...args); }
		removeBindingsFromSource(...args) { return m.keymapRemove(...args); }
		findKeyBindings(...args) { return m.findKeyBindings(...args); }
	}
	class CommandRegistry {
		add(...args) { return m.commandAdd(...args); }
		dispatch(...args) { return m.commandDispatch(...args); }
		findCommands(...args) { return m.findCommands(...args); }
	}
	class MenuManager {
		constructor(options) { this.options = options; }
		getMenuItem(...args) { return m.getMenuItem(...args); }
		getMenuItemForCommand(...args) { return m.getMenuItemForCommand(...args); }
		update(...args) { return m.menuUpdate(...args); }
	}
	class PackageManager {
		constructor(options) { this.options = options; }
		onDidActivateInitialPackages(callback) { m.onInitialPackages(callback); return m.packageSubscription; }
		getActivePackages(...args) { return m.getActivePackages(...args); }
		getLoadedPackage(...args) { return m.getLoadedPackage(...args); }
	}
	class ThemeManager {
		constructor(options) { this.options = options; }
		getActiveThemes(...args) { return m.getActiveThemes(...args); }
		activateThemes(...args) { return m.activateThemes(...args); }
	}
	class StyleManager {
		addStyleSheet(...args) { return m.addStyleSheet(...args); }
		removeStyleSheet(...args) { return m.removeStyleSheet(...args); }
	}
	const win = { loadSettings: {}, setMenuBarVisibility: vi.fn() };
	const application = { timer: { start: vi.fn() } };
	return {
		KeymapManager, CommandRegistry, MenuManager, PackageManager, ThemeManager, StyleManager,
		win, application, packageSubscription: { dispose: vi.fn() },
		keymapAdd: vi.fn(() => "keymap-disposable"), keymapRemove: vi.fn(() => 2),
		findKeyBindings: vi.fn(() => ["binding"]), commandAdd: vi.fn(() => "command-disposable"),
		commandDispatch: vi.fn(() => true), findCommands: vi.fn(() => ["archive"]),
		getMenuItem: vi.fn(() => ({ label: "Archive" })),
		getMenuItemForCommand: vi.fn(() => ({ command: "message:archive" })),
		menuUpdate: vi.fn(() => "updated"), onInitialPackages: vi.fn(),
		getActivePackages: vi.fn(() => ["mail-view"]), getLoadedPackage: vi.fn(() => ({ name: "composer" })),
		getActiveThemes: vi.fn(() => ["ui-light"]), activateThemes: vi.fn(() => "theme-result"),
		addStyleSheet: vi.fn(() => "style-disposable"), removeStyleSheet: vi.fn(() => true),
		ipcSend: vi.fn(), shellBeep: vi.fn(), deepClone: vi.fn((value) => structuredClone(value)),
	};
});

vi.mock("node:module", () => {
	const required = (id) => {
		if (id === "./keymap-manager.js") return { default: m.KeymapManager };
		if (id === "./registries/command-registry.js") return { default: m.CommandRegistry };
		if (id === "./flux/action-bridge.js") return { default: class ActionBridge {} };
		if (id === "./menu-manager.js") return { default: m.MenuManager };
		return { default: {} };
	};
	const moduleApi = { createRequire: () => required, globalPaths: [] };
	return { default: moduleApi, ...moduleApi };
});
vi.mock("node:path", () => { const path = { join: (...parts) => parts.join("/") }; return { default: path, ...path }; });
vi.mock("electron", () => {
	const remote = { getCurrentWindow: () => m.win, getGlobal: () => m.application, app: { quit: vi.fn() } };
	const electron = { ipcRenderer: { send: m.ipcSend }, shell: { beep: m.shellBeep }, remote };
	return { default: electron, ...electron };
});
vi.mock("@electron/remote", () => {
	const remote = { getCurrentWindow: () => m.win, getGlobal: () => m.application, app: { quit: vi.fn() } };
	return { default: remote, ...remote, remote };
});
vi.mock("underscore", () => {
	const underscore = {
		extend: (target, ...sources) => Object.assign(target, ...sources),
		uniq: (values) => [...new Set(values)], flatten: (values) => values.flat(Infinity),
		intersection: (left, right) => left.filter((value) => right.includes(value)),
		clone: (value) => ({ ...value }), defer: (callback) => callback(), values: (value) => Object.values(value || {}),
		isArray: Array.isArray, isString: (value) => typeof value === "string",
		isNumber: (value) => typeof value === "number", isObject: (value) => value !== null && typeof value === "object",
	};
	return { default: underscore, ...underscore };
});
vi.mock("event-kit", () => {
	class Emitter { on() { return { dispose: vi.fn() }; } emit() {} }
	return { default: { Emitter }, Emitter };
});
vi.mock("fs-plus", () => ({ default: { existsSync: vi.fn(), readFileSync: vi.fn(), writeFileSync: vi.fn() } }));
vi.mock("coffeestack", () => ({ default: { convertStackTrace: vi.fn() }, convertStackTrace: vi.fn() }));
vi.mock("source-map-support", () => ({ default: { mapSourcePosition: vi.fn((value) => value) }, mapSourcePosition: vi.fn((value) => value) }));
vi.mock("../src/window-event-handler.js", () => ({ default: class WindowEventHandler {} }));
vi.mock("../src/styles-element.js", () => ({ default: class StylesElement { constructor() { return document.createElement("style"); } } }));
vi.mock("../src/registries/store-registry.js", () => ({ default: {} }));
vi.mock("../src/flux/models/utils.js", () => ({ default: { deepClone: m.deepClone } }));
vi.mock("../src/config.js", () => ({ default: class Config { constructor(options) { this.options = options; } } }));
vi.mock("../src/theme-manager.js", () => ({ default: m.ThemeManager }));
vi.mock("../src/style-manager.js", () => ({ default: m.StyleManager }));
vi.mock("../src/error-logger.js", () => ({ default: class ErrorLogger {} }));
vi.mock("../src/flux/stores/workspace-store.js", () => ({ default: {} }));
vi.mock("react", () => { const React = { createElement: vi.fn() }; return { default: React, ...React }; });
vi.mock("react-dom", () => { const ReactDOM = { render: vi.fn() }; return { default: ReactDOM, ...ReactDOM }; });
vi.mock("../src/sheet-container.jsx", () => ({ default: vi.fn() }));
vi.mock("nylas-exports", () => ({ default: { Actions: {} }, Actions: {} }));
vi.mock("nylas-component-kit", () => ({ default: { CodeSnippet: vi.fn() }, CodeSnippet: vi.fn() }));

globalThis.NylasEnv = {
	isWorkWindow: vi.fn(() => true), inSpecMode: vi.fn(() => true), inDevMode: vi.fn(() => false),
	reportError: vi.fn(), config: { get: vi.fn(), onDidChange: vi.fn() },
	getConfigDirPath: vi.fn(() => "/config"), getPath: vi.fn(() => "/tmp"), getVersion: vi.fn(() => "0.0.0"),
};
globalThis.$n = { PackageManager: { default: m.PackageManager }, Spellchecker: { default: { check: vi.fn() } } };

const { default: NylasEnv } = await import("../src/nylas-env.js");

const loadSettings = (overrides = {}) => ({
	windowType: "work", mainWindow: true, devMode: false, benchmarkMode: false, safeMode: false,
	isSpec: true, appVersion: "3.1.0", configDirPath: "/config", resourcePath: "/app", ...overrides,
});

describe("NylasEnv initialized service surfaces", () => {
	let env;
	let initializationResult;
	beforeEach(() => {
		vi.clearAllMocks();
		NylasEnv.loadSettings = loadSettings();
		env = new NylasEnv({ version: 1 });
		vi.spyOn(env, "enhanceEventObject").mockImplementation(() => {});
		vi.spyOn(env, "setupErrorLogger").mockImplementation(() => {});
		vi.spyOn(env, "extendRxObservables").mockImplementation(() => {});
		vi.spyOn(env, "onWindowPropsReceived").mockImplementation(() => "window-props-subscription");
		initializationResult = env.initialize();
	});

	it("constructs the commands surface", () => { expect(env.commands).toBeInstanceOf(m.CommandRegistry); });
	it("adds commands through the public commands surface", () => { expect(env.commands.add("body", { "mail:archive": vi.fn() })).toBe("command-disposable"); });
	it("dispatches commands through the public commands surface", () => { expect(env.commands.dispatch(document.body, "mail:archive")).toBe(true); });
	it("finds commands through the public commands surface", () => { expect(env.commands.findCommands({ target: document.body })).toEqual(["archive"]); });
	it("constructs keymaps with application paths", () => { expect(env.keymaps.options).toEqual({ configDirPath: "/config", resourcePath: "/app" }); });
	it("adds bindings through the keymaps surface", () => { expect(env.keymaps.add("spec", { "body": { "ctrl-a": "select-all" } })).toBe("keymap-disposable"); });
	it("removes bindings through the keymaps surface", () => { expect(env.keymaps.removeBindingsFromSource("spec")).toBe(2); });
	it("finds delegated key bindings", () => { expect(env.keymaps.findKeyBindings({ keystrokes: "ctrl-a" })).toEqual(["binding"]); });
	it("constructs the menu with the resource path", () => { expect(env.menu.options).toEqual({ resourcePath: "/app" }); });
	it("gets a menu item by label", () => { expect(env.menu.getMenuItem("Archive")).toEqual({ label: "Archive" }); });
	it("gets a menu item by command", () => { expect(env.menu.getMenuItemForCommand("message:archive")).toEqual({ command: "message:archive" }); });
	it("updates the initialized menu", () => { expect(env.menu.update()).toBe("updated"); });
	it("constructs the style manager", () => { expect(env.styles).toBeInstanceOf(m.StyleManager); });
	it("adds a stylesheet through the styles surface", () => { expect(env.styles.addStyleSheet("body {}", { sourcePath: "spec" })).toBe("style-disposable"); });
	it("removes a stylesheet through the styles surface", () => { expect(env.styles.removeStyleSheet("spec")).toBe(true); });
	it("appends the shared styles element", () => { expect(document.head.querySelector("style")).not.toBeNull(); });
	it("constructs themes with the package manager", () => { expect(env.themes.options.packageManager).toBe(env.packages); });
	it("passes paths and safe mode to themes", () => { expect(env.themes.options).toMatchObject({ configDirPath: "/config", resourcePath: "/app", safeMode: false }); });
	it("reads active themes through the themes surface", () => { expect(env.themes.getActiveThemes()).toEqual(["ui-light"]); });
	it("activates themes through the themes surface", () => { expect(env.themes.activateThemes(["ui-dark"])).toBe("theme-result"); });
	it("constructs packages with all mode flags", () => { expect(env.packages.options).toEqual({ devMode: false, benchmarkMode: false, configDirPath: "/config", resourcePath: "/app", safeMode: false, specMode: true }); });
	it("registers theme watching after initial package activation", () => { expect(m.onInitialPackages).toHaveBeenCalledWith(expect.any(Function)); });
	it("reads active packages through the packages surface", () => { expect(env.packages.getActivePackages()).toEqual(["mail-view"]); });
	it("gets a loaded package through the packages surface", () => { expect(env.packages.getLoadedPackage("composer")).toEqual({ name: "composer" }); });
	it("exposes the configured spellchecker", () => { expect(env.spellchecker).toBe(globalThis.$n.Spellchecker.default); });
	it("uses the application timer", () => { expect(env.timer).toBe(m.application.timer); });
	it("returns the window-props subscription from initialization", () => { expect(initializationResult).toBe("window-props-subscription"); });
});

describe("NylasEnv cross-window classifications", () => {
	let env;
	beforeEach(() => { NylasEnv.loadSettings = loadSettings(); env = new NylasEnv({ version: 1 }); });

	it("does not classify work as an empty window", () => { expect(env.isEmptyWindow()).toBe(false); });
	it("does not classify a composer as a work window", () => { NylasEnv.loadSettings.windowType = "composer"; expect(env.isWorkWindow()).toBe(false); });
	it("does not classify a thread popout as a composer", () => { NylasEnv.loadSettings.windowType = "thread-popout"; expect(env.isComposerWindow()).toBe(false); });
	it("does not classify composer preload as a thread window", () => { NylasEnv.loadSettings.windowType = "composer-preload"; expect(env.isThreadWindow()).toBe(false); });
	it("reports a secondary work window as non-main", () => { NylasEnv.loadSettings.mainWindow = false; expect(env.isMainWindow()).toBe(false); });
	it("returns an unknown window type unchanged", () => { NylasEnv.loadSettings.windowType = "calendar-popout"; expect(env.getWindowType()).toBe("calendar-popout"); });
});
