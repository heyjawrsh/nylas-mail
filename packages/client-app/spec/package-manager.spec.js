import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	fs: {
		resolve: vi.fn(), isDirectorySync: vi.fn(), listSync: vi.fn(() => []),
		isFileSync: vi.fn(), readFileSync: vi.fn(), existsSync: vi.fn(),
	},
	loadMetadata: vi.fn(), packageInstances: [], themeInstances: [], ipcOn: vi.fn(),
	notifyPluginsChanged: vi.fn(), showMessageBox: vi.fn(),
}));

vi.mock("node:path", () => {
	const path = { join: (...parts) => parts.join("/"), basename: (value) => value.split("/").filter(Boolean).at(-1) || "" };
	return { default: path, ...path };
});
vi.mock("node:url", () => {
	const parse = (value) => ({ query: Object.fromEntries(new URL(value || "https://local/").searchParams) });
	return { default: { parse }, parse };
});
vi.mock("underscore", () => {
	const uniq = (values, iteratee = (value) => value) => { const seen = new Set(); return values.filter((value) => { const key = iteratee(value); if (seen.has(key)) return false; seen.add(key); return true; }); };
	const underscore = {
		values: Object.values, uniq, extend: (target, ...sources) => Object.assign(target, ...sources),
		debounce: (fn) => fn, defer: (fn, ...args) => fn(...args), pluck: (values, key) => values.map((value) => value[key]),
		isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b), clone: (value) => Array.isArray(value) ? [...value] : { ...value },
		include: (values, value) => values.includes(value), filter: (values, fn) => values.filter(fn), map: (values, fn) => values.map(fn),
		last: (values) => values.at(-1), without: (values, ...removed) => values.filter((value) => !removed.includes(value)),
		difference: (values, removed) => values.filter((value) => !removed.includes(value)), intersection: (a, b) => a.filter((value) => b.includes(value)),
	};
	return { default: underscore, ...underscore };
});
vi.mock("electron", () => {
	const remote = { app: {}, screen: {}, dialog: { showMessageBox: m.showMessageBox }, getCurrentWindow: vi.fn(() => ({})) };
	const electron = { ipcRenderer: { on: m.ipcOn, send: vi.fn() }, shell: {}, remote };
	return { default: electron, ...electron };
});
vi.mock("@electron/remote", () => {
	const remote = { app: {}, screen: {}, dialog: { showMessageBox: m.showMessageBox }, getCurrentWindow: vi.fn(() => ({})) };
	const electron = { ipcRenderer: { on: m.ipcOn, send: vi.fn() }, shell: {}, remote, ...remote };
	return { default: electron, ...electron };
});
vi.mock("emissary", () => {
	const Emitter = { includeInto: (Class) => { Class.prototype.emit = function emit(name, value) { return this.__legacyEvents?.push([name, value]); }; } };
	return { default: { Emitter }, Emitter };
});
vi.mock("event-kit", () => {
	class Emitter { constructor() { this.handlers = new Map(); } on(name, callback) { const list = this.handlers.get(name) || []; list.push(callback); this.handlers.set(name, list); return { dispose: () => this.handlers.set(name, list.filter((item) => item !== callback)) }; } emit(name, value) { for (const callback of this.handlers.get(name) || []) callback(value); } }
	return { default: { Emitter }, Emitter };
});
vi.mock("fs-plus", () => ({ default: m.fs, ...m.fs }));
vi.mock("q", () => { const Q = (value) => Promise.resolve(value); Q.all = Promise.all.bind(Promise); Q.reject = Promise.reject.bind(Promise); return { default: Q, ...Q }; });
vi.mock("../src/flux/actions.js", () => ({ default: { notifyPluginsChanged: m.notifyPluginsChanged } }));
vi.mock("../src/package.js", () => {
	class Package { constructor(path, metadata) { this.path = path; this.metadata = metadata; this.name = metadata.name; this.declaresNewDatabaseObjects = metadata.declaresNewDatabaseObjects; this.load = vi.fn(); this.activate = vi.fn(() => Promise.resolve()); this.deactivate = vi.fn(); this.enable = vi.fn(); this.disable = vi.fn(); this.getType = vi.fn(() => metadata.type || "nylas"); m.packageInstances.push(this); } static loadMetadata(...args) { return m.loadMetadata(...args); } }
	return { default: Package };
});
vi.mock("../src/theme-package.js", () => {
	class ThemePackage { constructor(path, metadata) { this.path = path; this.metadata = metadata; this.name = metadata.name; this.load = vi.fn(); this.activate = vi.fn(() => Promise.resolve()); this.deactivate = vi.fn(); this.getType = vi.fn(() => "theme"); m.themeInstances.push(this); } }
	return { default: ThemePackage };
});

let PackageManager;

const options = (overrides = {}) => ({ configDirPath: "/config", devMode: false, safeMode: false, resourcePath: "/app", specMode: false, ...overrides });
const makeManager = (overrides) => { const manager = new PackageManager(options(overrides)); manager.__legacyEvents = []; return manager; };

describe("PackageManager paths and package listing", () => {
	beforeEach(async () => {
		vi.resetModules(); PackageManager = (await import("../src/package-manager.js")).default;
		vi.clearAllMocks(); m.packageInstances.length = 0; m.themeInstances.length = 0;
		m.fs.listSync.mockReturnValue([]); m.fs.isDirectorySync.mockReturnValue(false); m.fs.resolve.mockImplementation((...parts) => `${parts.slice(0, -1).join("|")}/${parts.at(-1)}`);
		m.loadMetadata.mockReturnValue({ name: "pkg", engines: { nylas: "*" } });
		globalThis.NylasEnv = { config: { get: vi.fn((key) => key === "env" ? "production" : []), set: vi.fn(), transact: (fn) => fn(), onDidChange: vi.fn(() => ({ dispose: vi.fn() })) }, fileListCache: vi.fn(() => ({})), isMainWindow: vi.fn(() => true), focus: vi.fn() };
	});

	it("uses only the fixture package directory in spec mode", () => { expect(makeManager({ specMode: true }).getPackageDirPaths()).toEqual(["/app/spec/fixtures/packages"]); });
	it("includes internal and user package directories normally", () => { expect(makeManager().getPackageDirPaths()).toEqual(["/app/internal_packages", "/config/packages"]); });
	it("includes the development package directory in dev mode", () => { expect(makeManager({ devMode: true }).getPackageDirPaths()).toContain("/config/dev/packages"); });
	it("safe mode excludes user package directories", () => { expect(makeManager({ safeMode: true }).getPackageDirPaths()).toEqual(["/app/internal_packages"]); });
	it("returns a copy of package directory paths", () => { const manager = makeManager(); manager.getPackageDirPaths().push("/changed"); expect(manager.getPackageDirPaths()).not.toContain("/changed"); });

});
