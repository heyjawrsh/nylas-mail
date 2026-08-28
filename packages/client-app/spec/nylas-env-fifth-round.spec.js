import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	class Emitter { constructor() { this.events = new Map(); } on(n, f) { this.events.set(n, f); return { dispose: vi.fn() }; } emit(n, v) { return this.events.get(n)?.(v); } }
	const win = { close: vi.fn(), getSize: vi.fn(() => [640, 480]), setSize: vi.fn(), getMinimumSize: vi.fn(() => [10, 20]), setMinimumSize: vi.fn(), webContents: { isDevToolsOpened: vi.fn() }, loadSettings: {} };
	return { Emitter, win, deepClone: vi.fn((v) => structuredClone(v)), beep: vi.fn(), ipcSend: vi.fn() };
});

vi.mock("node:module", () => { const api = { createRequire: () => vi.fn(() => ({ default: {} })), globalPaths: [] }; return { default: api, ...api }; });
vi.mock("node:path", () => { const api = { join: (...p) => p.join("/") }; return { default: api, ...api }; });
vi.mock("electron", () => { const remote = { getCurrentWindow: () => m.win, getGlobal: () => ({ fileListCache: {} }), app: { quit: vi.fn() }, dialog: {} }; const api = { ipcRenderer: { send: m.ipcSend }, shell: { beep: m.beep }, remote }; return { default: api, ...api }; });
vi.mock("@electron/remote", () => { const remote = { getCurrentWindow: () => m.win, getGlobal: () => ({ fileListCache: {} }), app: { quit: vi.fn() }, dialog: {} }; return { default: remote, ...remote, remote }; });
vi.mock("underscore", () => { const api = { extend: Object.assign, uniq: (v) => [...new Set(v)], flatten: (v) => v.flat(), intersection: (a, b) => a.filter((v) => b.includes(v)), clone: (v) => ({ ...v }), defer: (f) => f(), isArray: Array.isArray, isString: (v) => typeof v === "string", isNumber: (v) => typeof v === "number", isObject: (v) => v && typeof v === "object" }; return { default: api, ...api }; });
vi.mock("event-kit", () => ({ default: { Emitter: m.Emitter }, Emitter: m.Emitter }));
vi.mock("fs-plus", () => ({ default: { existsSync: vi.fn(), readFileSync: vi.fn(), writeFileSync: vi.fn(), resolve: vi.fn(), isFileSync: vi.fn() } }));
vi.mock("coffeestack", () => ({ default: { convertStackTrace: vi.fn() }, convertStackTrace: vi.fn() }));
vi.mock("source-map-support", () => ({ default: { mapSourcePosition: vi.fn() }, mapSourcePosition: vi.fn() }));
vi.mock("../src/window-event-handler.js", () => ({ default: class {} }));
vi.mock("../src/styles-element.js", () => ({ default: class {} }));
vi.mock("../src/registries/store-registry.js", () => ({ default: {} }));
vi.mock("../src/flux/models/utils.js", () => ({ default: { deepClone: m.deepClone } }));
vi.mock("../src/config.js", () => ({ default: class {} }));
vi.mock("../src/theme-manager.js", () => ({ default: class {} }));
vi.mock("../src/style-manager.js", () => ({ default: class {} }));
vi.mock("../src/error-logger.js", () => ({ default: class {} }));
vi.mock("../src/flux/stores/workspace-store.js", () => ({ default: {} }));
vi.mock("react", () => ({ default: { createElement: vi.fn() }, createElement: vi.fn() }));
vi.mock("react-dom", () => ({ default: { render: vi.fn() }, render: vi.fn() }));
vi.mock("../src/sheet-container.jsx", () => ({ default: vi.fn() }));
vi.mock("nylas-exports", () => ({ default: { Actions: {} }, Actions: {} }));
vi.mock("nylas-component-kit", () => ({ default: { CodeSnippet: vi.fn() }, CodeSnippet: vi.fn() }));

globalThis.NylasEnv = { isWorkWindow: vi.fn(() => true), inSpecMode: vi.fn(() => true), inDevMode: vi.fn(() => false), reportError: vi.fn(), config: { get: vi.fn(), onDidChange: vi.fn() }, getConfigDirPath: vi.fn(() => "/config"), getPath: vi.fn(() => "/tmp"), getVersion: vi.fn(() => "1") };
const { default: NylasEnv } = await import("../src/nylas-env.js");

describe("NylasEnv fifth-round window value edges", () => {
	let env;
	beforeEach(() => { vi.clearAllMocks(); NylasEnv.loadSettings = { windowType: "work", mainWindow: true, appVersion: "abc1234", configDirPath: "/cfg", devMode: false, benchmarkMode: true, safeMode: true, isSpec: false }; env = new NylasEnv({ version: 1 }); });
	it("throws an assertion error carrying the supplied message", () => { expect(() => env.assert(false, "broken")).toThrow("Assertion error: broken"); });
	it("returns the native window size as named dimensions", () => { expect(env.getSize()).toEqual({ width: 640, height: 480 }); });
	it("rounds fractional dimensions before resizing", () => { env.setSize(101.6, 202.4); expect(m.win.setSize).toHaveBeenCalledWith(102, 202); });
	it("uses the resize fallback for a missing width", () => { env.setSize(undefined, 90); expect(m.win.setSize).toHaveBeenCalledWith(100, 90); });
	it("preserves native minimum height when changing minimum width", () => { env.setMinimumWidth(30); expect(m.win.setMinimumSize).toHaveBeenCalledWith(30, 20); });
	it("identifies seven-character build versions as unreleased", () => { expect(env.isReleasedVersion()).toBe(false); });
});
