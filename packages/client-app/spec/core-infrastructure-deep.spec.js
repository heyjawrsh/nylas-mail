import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nodeRequire = createRequire(import.meta.url);
const originalJsLoader = nodeRequire.extensions[".js"];

const m = vi.hoisted(() => {
	const path = {
		join: (...parts) => parts.join("/").replace(/\/+/g, "/"),
		extname: (value) => value.match(/(\.[^./]+)$/)?.[1] || "",
		dirname: (value) => value.slice(0, value.lastIndexOf("/")) || ".",
		resolve: (...parts) => parts.join("/").replace(/\/+/g, "/"),
	};
	const files = new Map();
	const fs = {
		isFileSync: vi.fn((path) => files.has(path)),
		readFileSync: vi.fn((path) => {
			if (!files.has(path)) throw new Error(`missing ${path}`);
			return files.get(path);
		}),
		writeFileSync: vi.fn((path, code) => files.set(path, code)),
		renameSync: vi.fn((from, to) => { files.set(to, files.get(from)); files.delete(from); }),
		resolve: vi.fn(),
	};
	const makeCompiler = (name) => ({
		shouldCompile: vi.fn(() => true),
		getCachePath: vi.fn((source, path) => `${name}-${path}-${source.length}.js`),
		compile: vi.fn((source) => `compiled:${name}:${source}`),
	});
	const babel = makeCompiler("babel");
	const coffee = makeCompiler("coffee");
	const typescript = makeCompiler("typescript");
	const sourceMapSupport = { install: vi.fn() };
	const makeAction = () => Object.assign(vi.fn(), { listen: vi.fn() });
	const Actions = {
		globalActions: ["globalAction"], workWindowActions: ["workAction"],
		globalAction: makeAction(), workAction: makeAction(), localAction: makeAction(),
	};
	const databaseStore = { listen: vi.fn(), trigger: vi.fn(), triggeringFromActionBridge: false };
	class DatabaseChangeRecord { constructor(value) { this.value = value; } }
	const Utils = {
		registeredObjectReplacer: vi.fn((_key, value) => value),
		registeredObjectReviver: vi.fn((_key, value) => value),
		deepClone: vi.fn((value) => structuredClone(value)),
	};
	const ipcRenderer = { send: vi.fn() };
	const remote = { app: { quit: vi.fn() } };
	const electron = { ipcRenderer, remote };
	class Disposable { constructor(fn) { this.fn = fn; } dispose() { return this.fn(); } }
	const underscore = {
		each: (object, fn) => Object.entries(object).forEach(([key, value]) => fn(value, key)),
		findWhere: (items, attrs) => items.find((item) => Object.entries(attrs).every(([key, value]) => item[key] === value)),
		last: (items) => items[items.length - 1],
		isNumber: (value) => typeof value === "number",
	};
	return { path, files, fs, babel, coffee, typescript, sourceMapSupport, Actions, databaseStore, DatabaseChangeRecord, Utils, ipcRenderer, remote, electron, Disposable, underscore };
});

vi.mock("node:path", () => ({ default: m.path, ...m.path }));
vi.mock("fs-plus", () => ({ default: m.fs, ...m.fs }));
vi.mock("source-map-support", () => ({ default: m.sourceMapSupport, ...m.sourceMapSupport }));
vi.mock("../src/compile-support/babel.js", () => ({ default: m.babel, ...m.babel }));
vi.mock("../src/compile-support/coffee-script.js", () => ({ default: m.coffee, ...m.coffee }));
vi.mock("../src/compile-support/typescript.js", () => ({ default: m.typescript, ...m.typescript }));
vi.mock("underscore", () => ({ default: m.underscore, ...m.underscore }));
vi.mock("../src/flux/actions.js", () => ({ default: m.Actions, ...m.Actions }));
vi.mock("../src/flux/models/utils.js", () => ({ default: m.Utils, ...m.Utils }));
vi.mock("electron", () => ({ default: m.electron, ...m.electron }));
vi.mock("@electron/remote", () => ({ default: m.remote, ...m.remote, remote: m.remote }));
vi.mock("event-kit", () => ({ default: { Disposable: m.Disposable }, Disposable: m.Disposable }));

globalThis.NylasEnv = {
	isWorkWindow: vi.fn(() => true), isEmptyWindow: vi.fn(() => false), inSpecMode: vi.fn(() => true), inDevMode: vi.fn(() => false),
	reportError: vi.fn(), getWindowType: vi.fn(() => "work-1"), onBeforeUnload: vi.fn(), onWindowPropsReceived: vi.fn(),
	config: { get: vi.fn(() => null), onDidChange: vi.fn(() => ({ dispose: vi.fn() })) },
	keymaps: { onDidReloadKeymap: vi.fn(), getBindingsForAllCommands: vi.fn(() => ({})) },
	commands: { onRegistedCommandsChanged: vi.fn(), listenerCountForCommand: vi.fn(() => 1) },
	getConfigDirPath: vi.fn(() => "/config"), getPath: vi.fn(() => "/tmp"), getVersion: vi.fn(() => "0.0.0"),
};
globalThis.$n = { DatabaseStore: m.databaseStore, DatabaseChangeRecord: m.DatabaseChangeRecord, Utils: m.Utils };
globalThis._ = m.underscore;

m.fs.resolve.mockImplementation((_dir, platform) => `${process.cwd()}/menus/${platform}.json`);
const compileImport = await import("../src/compile-cache.js");
const CompileCache = compileImport.default || compileImport;
// compile-cache claims `.js` for app sources, and the compilers here are
// mocks, so give Node its own loader back for the rest of the worker.
nodeRequire.extensions[".js"] = originalJsLoader;
const helpersImport = await import("../src/menu-helpers.js");
const MenuHelpers = helpersImport.default || helpersImport;
const managerImport = await import("../src/menu-manager.js");
const MenuManager = managerImport.default || managerImport;
const bridgeImport = await import("../src/flux/action-bridge.js");
const ActionBridge = bridgeImport.default || bridgeImport;
// chaos-monkey.js loads nylas-api.js with a native require(), which vi.mock
// can't reach. Left alone, that pulls the real API stack into the worker,
// and it rejects with a jsdom NetworkError after the tests finish. Seed the
// require cache with the one field chaos-monkey reads instead.
{
	const Module = nodeRequire("node:module");
	const file = nodeRequire.resolve("../src/flux/nylas-api.js");
	const stub = new Module(file);
	stub.filename = file;
	stub.loaded = true;
	stub.exports = { default: { APIRoot: "https://api.test" } };
	Module._cache[file] = stub;
}
const chaosImport = await import("../src/chaos-monkey.js");
const ChaosMonkey = chaosImport.default || chaosImport;

describe("compile cache keying and compilation", () => {
	beforeEach(() => { m.files.clear(); vi.clearAllMocks(); CompileCache.setCacheDirectory("/cache"); CompileCache.resetCacheStats(); });

	it("stores the configured cache directory", () => { CompileCache.setCacheDirectory("/chosen"); expect(CompileCache.getCacheDirectory()).toBe("/chosen"); });
	it("initializes counters for every compiler extension", () => { expect(Object.keys(CompileCache.getCacheStats())).toEqual([".jsx", ".es6", ".ts", ".coffee", ".cjsx", ".js"]); });
});

describe("menu template helpers", () => {
	it("clones nested menu items without sharing submenu arrays", () => { const source = { label: "File", submenu: [{ label: "Open" }] }; const clone = MenuHelpers.cloneMenuItem(source); expect(clone.submenu).not.toBe(source.submenu); });
	it("normalizes accelerator ampersands off macOS", () => { expect(MenuHelpers.normalizeLabel("&File")).toBe(process.platform === "darwin" ? "&File" : "File"); });
	it("appends a new menu item", () => { const menu = []; MenuHelpers.merge(menu, { label: "File" }); expect(menu).toEqual([{ label: "File" }]); });
	it("does not append consecutive separators", () => { const menu = [{ type: "separator" }]; MenuHelpers.merge(menu, { type: "separator" }); expect(menu).toHaveLength(1); });
	it("merges children into a matching submenu", () => { const menu = [{ label: "File", submenu: [] }]; MenuHelpers.merge(menu, { label: "File", submenu: [{ label: "Open" }] }); expect(menu[0].submenu).toEqual([{ label: "Open" }]); });
	it("removes a merged leaf", () => { const menu = [{ label: "Open" }]; MenuHelpers.unmerge(menu, { label: "Open" }); expect(menu).toEqual([]); });
	it("removes a parent after its last child", () => { const menu = [{ label: "File", submenu: [{ label: "Open" }] }]; MenuHelpers.unmerge(menu, { label: "File", submenu: [{ label: "Open" }] }); expect(menu).toEqual([]); });
	it("visits descendants before their parent", () => { const seen = []; MenuHelpers.forEachMenuItem([{ label: "File", submenu: [{ label: "Open" }] }], (item) => seen.push(item.label)); expect(seen).toEqual(["Open", "File"]); });
});

describe("menu manager filtering and updates", () => {
	const bareManager = () => Object.assign(Object.create(MenuManager.prototype), { template: [] });
	it("returns no bindings when none are supplied", () => { expect(bareManager().filterMultipleKeystroke()).toEqual({}); });
	it("keeps modified single keystrokes", () => { expect(bareManager().filterMultipleKeystroke({ save: ["ctrl-s"] })).toEqual({ save: ["ctrl-s"] }); });
	it("keeps function keys", () => { expect(bareManager().filterMultipleKeystroke({ help: ["f1"] })).toEqual({ help: ["f1"] }); });
	it("drops multi-keystroke chords", () => { expect(bareManager().filterMultipleKeystroke({ x: ["ctrl-k ctrl-x"] })).toEqual({}); });
	it("drops unmodified character bindings", () => { expect(bareManager().filterMultipleKeystroke({ x: ["x"] })).toEqual({}); });
	it("delegates merge operations to menu helpers", () => { const manager = bareManager(); manager.merge(manager.template, { label: "File" }); expect(manager.template[0].label).toBe("File"); });
});

describe("action bridge broadcasts", () => {
	const makeBridge = (role = true) => { NylasEnv.isWorkWindow.mockReturnValue(role); return new ActionBridge({ on: vi.fn(), send: vi.fn() }); };
	beforeEach(() => { vi.clearAllMocks(); NylasEnv.isEmptyWindow.mockReturnValue(false); NylasEnv.isWorkWindow.mockReturnValue(true); });
	it("registers the IPC listener in a populated window", () => { const ipc = { on: vi.fn(), send: vi.fn() }; new ActionBridge(ipc); expect(ipc.on).toHaveBeenCalledWith("action-bridge-message", expect.any(Function)); });
	it("registers namespaced extension actions", () => { const bridge = makeBridge(); const fn = Object.assign(vi.fn(), { listen: vi.fn() }); bridge.registerGlobalActions({ pluginName: "calendar", actions: { refresh: fn } }); expect(bridge._globalExtensionAction("calendar::refresh")).toBe(fn); });
	it("identifies an extension broadcast name", () => { expect(makeBridge()._isExtensionAction("calendar::refresh")).toBe(true); });
	it("serializes and broadcasts action arguments", () => { const bridge = makeBridge(); bridge.onRebroadcast("all", "localAction", [{ id: 7 }]); expect(bridge.ipc.send).toHaveBeenCalledWith("action-bridge-rebroadcast-to-all", "work-1", "localAction", '[{"id":7}]'); });
	it("rejects function arguments", () => { expect(() => makeBridge().onRebroadcast("work", "localAction", [vi.fn()])).toThrow("cannot forward action argument"); });
	it("allows immediate unload before any send", () => { expect(makeBridge().onBeforeUnload(vi.fn())).toBe(true); });
	it("delays unload immediately after a send", () => { vi.useFakeTimers(); const bridge = makeBridge(); bridge.onRebroadcast("all", "localAction", []); const ready = vi.fn(); expect(bridge.onBeforeUnload(ready)).toBe(false); vi.runAllTimers(); expect(ready).toHaveBeenCalled(); vi.useRealTimers(); });
});

describe("chaos monkey API failures", () => {
	// chaos-monkey.js loads nock with require(), which vi.mock can't reach, so
	// these tests drive the real nock and must clear its interceptors after.
	const nock = nodeRequire("nock");
	beforeEach(() => { vi.clearAllMocks(); if (!nock.isActive()) nock.activate(); });
	afterEach(() => { ChaosMonkey.goHome(); expect(nock.pendingMocks()).toEqual([]); });
	it("persists all interceptors by default", () => {
		ChaosMonkey.unleashOnAPI();
		const pending = nock.pendingMocks();
		expect(pending).toHaveLength(3);
		for (const method of ["GET", "PUT", "POST"]) expect(pending.some((mock) => mock.startsWith(`${method} https://api.test`))).toBe(true);
	});
});
