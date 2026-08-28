import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	raw: { core: { existing: true } },
	reportError: vi.fn(),
	setRawValue: vi.fn(),
	setSettings: vi.fn(),
	send: vi.fn(),
	quit: vi.fn(),
	showMessageBox: vi.fn(),
}));

vi.mock("node:module", () => {
	const createRequire = () => vi.fn(() => () => ({}));
	return { default: { createRequire }, createRequire };
});
vi.mock("underscore", () => {
	const split = (path) => path == null ? [] : path.split(/(?<!\\)\./);
	const underscore = {
		extend: (target, ...sources) => Object.assign(target, ...sources),
		defaults: (target, source) => { for (const key of Object.keys(source || {})) if (target[key] === undefined) target[key] = source[key]; return target; },
		isArray: Array.isArray,
		isEmpty: (value) => value == null || Object.keys(value).length === 0,
		isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
		isFunction: (value) => typeof value === "function",
		isObject: (value) => value !== null && typeof value === "object",
		isString: (value) => typeof value === "string",
		mapObject: (object, fn) => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, fn(value)])),
		remove: (array, value) => { const index = array.indexOf(value); if (index >= 0) array.splice(index, 1); return array; },
		valueForKeyPath: (object, path) => split(path).reduce((value, key) => value == null ? undefined : value[key], object),
		setValueForKeyPath: (object, path, value) => { const keys = split(path); const leaf = keys.pop(); const parent = keys.reduce((cursor, key) => cursor[key] ??= {}, object); if (value == null) delete parent[leaf]; else parent[leaf] = value; },
	};
	return { default: underscore, ...underscore };
});
vi.mock("../src/config-utils.js", () => ({ default: {} }));
vi.mock("fs-plus", () => ({ default: {} }));
vi.mock("emissary", () => ({
	default: {},
	Emitter: { includeInto: vi.fn() },
}));
vi.mock("event-kit", () => {
	class Emitter {
		constructor() { this.handlers = new Map(); }
		on(name, callback) { const handlers = this.handlers.get(name) || []; handlers.push(callback); this.handlers.set(name, handlers); return { dispose: () => this.handlers.set(name, handlers.filter((handler) => handler !== callback)) }; }
		emit(name, value) { for (const callback of this.handlers.get(name) || []) callback(value); }
	}
	return { default: {}, CompositeDisposable: class {}, Disposable: class {}, Emitter };
});
vi.mock("../src/color.js", () => {
	class Color {
		constructor(value) { this.value = value; }
		clone() { return new Color(this.value); }
		static parse(value) { return typeof value === "string" && value.startsWith("#") ? new Color(value) : null; }
	}
	return { default: Color };
});
vi.mock("electron", () => ({
	default: { ipcRenderer: { send: m.send }, shell: {}, remote: { app: { quit: m.quit, getVersion: () => "0.0.0", getPath: () => "/tmp" } } },
	ipcRenderer: { send: m.send, on: vi.fn(), removeAllListeners: vi.fn() }, shell: {},
	remote: { app: { quit: m.quit, getVersion: () => "0.0.0", getPath: () => "/tmp" } },
}));
vi.mock("@electron/remote", () => ({
	default: { remote: {}, ipcRenderer: { send: m.send }, shell: {} }, ipcRenderer: { send: m.send }, shell: {},
	app: { quit: m.quit, getVersion: () => "0.0.0", getPath: () => "/tmp" },
	screen: { getPrimaryDisplay: () => ({ workArea: { width: 1440, height: 900 } }) },
	dialog: { showMessageBox: m.showMessageBox }, getCurrentWindow: vi.fn(),
	remote: { app: { quit: m.quit, getVersion: () => "0.0.0", getPath: () => "/tmp" }, screen: { getPrimaryDisplay: () => ({ workArea: {} }) }, dialog: { showMessageBox: m.showMessageBox }, getCurrentWindow: vi.fn() },
}));

let Config;
const persistence = {
	getRawValuesString: vi.fn(() => JSON.stringify(m.raw)),
	setRawValue: m.setRawValue,
	setSettings: m.setSettings,
};

beforeAll(async () => {
	globalThis.application = { configPersistenceManager: persistence };
	globalThis.errorLogger = { reportError: m.reportError };
	Config = (await import("../src/config.js")).default;
});

describe("Config values and defaults", () => {
	let config;
	beforeEach(() => {
		m.raw = { core: { existing: true } };
		vi.clearAllMocks();
		persistence.getRawValuesString.mockImplementation(() => JSON.stringify(m.raw));
		m.setRawValue.mockImplementation((keyPath, value) => {
			const keys = keyPath.split("."); const leaf = keys.pop(); const parent = keys.reduce((cursor, key) => cursor[key] ??= {}, m.raw);
			if (value == null) delete parent[leaf]; else parent[leaf] = value;
		});
		config = new Config();
	});

	it("loads persisted settings", () => { config.load(); expect(config.get("core.existing")).toBe(true); });
	it("returns a schema default when no user value exists", () => { config.setSchema("pkg.answer", { type: "integer", default: 42 }); expect(config.get("pkg.answer")).toBe(42); });
	it("prefers a persisted user value to its default", () => { m.raw.pkg = { answer: 7 }; config.load(); config.setSchema("pkg.answer", { type: "integer", default: 42 }); expect(config.get("pkg.answer")).toBe(7); });
	it("fills missing object properties from defaults", () => { m.raw.pkg = { options: { enabled: false } }; config.load(); config.setSchema("pkg.options", { type: "object", default: { enabled: true, label: "Inbox" } }); expect(config.get("pkg.options")).toEqual({ enabled: false, label: "Inbox" }); });
	it("does not let callers mutate stored objects through get", () => { m.raw.pkg = { options: { enabled: true } }; config.load(); const value = config.get("pkg.options"); value.enabled = false; expect(config.get("pkg.options.enabled")).toBe(true); });
	it("does not let callers mutate stored arrays through get", () => { m.raw.pkg = { items: [1] }; config.load(); config.get("pkg.items").push(2); expect(config.get("pkg.items")).toEqual([1]); });
	it("returns undefined for an unknown key path", () => { expect(config.get("missing.value")).toBeUndefined(); });
	it("returns the schema at a nested key path", () => { const schema = { type: "string", default: "x" }; config.setSchema("pkg.name", schema); expect(config.getSchema("pkg.name")).toMatchObject(schema); });
	it("returns undefined for an unknown schema", () => { expect(config.getSchema("pkg.missing")).toBeUndefined(); });
	it("extracts defaults recursively from object schemas", () => { expect(config.extractDefaultsFromSchema({ type: "object", properties: { count: { type: "integer", default: 2 }, nested: { type: "object", properties: { ok: { type: "boolean", default: true } } } } })).toEqual({ count: 2, nested: { ok: true } }); });
	it("rejects non-object schemas", () => { expect(() => config.setSchema("pkg.bad", "string")).toThrow("schemas can only be objects"); });
	it("rejects empty settings updates", () => { expect(() => config.updateSettings({})).toThrow("false-y value"); });
	it("loads settings from the loadSettings persistence section", () => { m.raw = { loadSettings: { windowType: "composer" } }; config.load(); expect(config.get("loadSettings.windowType")).toBe("composer"); });
	it("loads independent sections from persistence", () => { m.raw = { loadSettings: { windowType: "work" }, core: { themes: ["ui-dark"] } }; config.load(); expect(config.get("core.themes")).toEqual(["ui-dark"]); });
});

describe("Config writes and typed accessors", () => {
	let config;
	beforeEach(() => { m.raw = { core: { existing: true } }; vi.clearAllMocks(); persistence.getRawValuesString.mockImplementation(() => JSON.stringify(m.raw)); m.setRawValue.mockImplementation((path, value) => { const keys = path.split("."); const leaf = keys.pop(); const parent = keys.reduce((cursor, key) => cursor[key] ??= {}, m.raw); parent[leaf] = value; }); config = new Config(); config.load(); });

	it("persists a set value with its key path", () => { config.set("core.name", "Mail"); expect(m.setRawValue).toHaveBeenCalledWith("core.name", "Mail", null); });
	it("reloads persisted settings after a write", () => { config.set("core.name", "Mail"); expect(config.get("core.name")).toBe("Mail"); });
	it("coerces integer strings", () => { config.setSchema("pkg.count", { type: "integer", default: 1 }); config.set("pkg.count", "12"); expect(config.get("pkg.count")).toBe(12); });
	it("clamps integers to a schema maximum", () => { config.setSchema("pkg.count", { type: "integer", default: 1, maximum: 10 }); config.set("pkg.count", 99); expect(config.get("pkg.count")).toBe(10); });
	it("coerces decimal strings to numbers", () => { config.setSchema("pkg.ratio", { type: "number", default: 1 }); config.set("pkg.ratio", "2.5"); expect(config.get("pkg.ratio")).toBe(2.5); });
	it("coerces the string false to a boolean", () => { config.setSchema("pkg.enabled", { type: "boolean", default: true }); config.set("pkg.enabled", "false"); expect(config.get("pkg.enabled")).toBe(false); });
	it("rejects invalid boolean values", () => { config.setSchema("pkg.enabled", { type: "boolean", default: true }); expect(config.set("pkg.enabled", "sometimes")).toBe(false); });
	it("rejects non-string values for string schemas", () => { config.setSchema("pkg.name", { type: "string", default: "Mail" }); expect(config.set("pkg.name", 3)).toBe(false); });
	it("rejects values outside an enum", () => { config.setSchema("pkg.mode", { type: "string", default: "a", enum: ["a", "b"] }); expect(config.set("pkg.mode", "c")).toBe(false); });
	it("filters invalid typed array items", () => { const warn = vi.spyOn(console, "warn").mockImplementation(() => {}); config.setSchema("pkg.counts", { type: "array", default: [], items: { type: "integer" } }); config.set("pkg.counts", ["1", "bad", "3"]); expect(config.get("pkg.counts")).toEqual([1, 3]); warn.mockRestore(); });
	it("removes invalid typed object properties", () => { const warn = vi.spyOn(console, "warn").mockImplementation(() => {}); config.setSchema("pkg.options", { type: "object", default: {}, properties: { count: { type: "integer" } } }); config.set("pkg.options", { count: "bad", extra: true }); expect(config.get("pkg.options")).toEqual({ extra: true }); warn.mockRestore(); });
	it("serializes objects before persistence", () => { const value = { keep: 1, drop: () => 2 }; config.set("pkg.value", value); expect(m.setRawValue).toHaveBeenCalledWith("pkg.value", { keep: 1 }, null); });
	it("unset restores the schema default", () => { config.setSchema("pkg.count", { type: "integer", default: 4 }); config.set("pkg.count", 8); config.unset("pkg.count"); expect(config.get("pkg.count")).toBe(4); });
	it("pushAtKeyPath appends and returns the new length", () => { m.raw.pkg = { items: [1] }; config.load(); expect(config.pushAtKeyPath("pkg.items", 2)).toBe(2); });
	it("unshiftAtKeyPath prepends a value", () => { m.raw.pkg = { items: [2] }; config.load(); config.unshiftAtKeyPath("pkg.items", 1); expect(config.get("pkg.items")).toEqual([1, 2]); });
	it("removeAtKeyPath removes the first matching value", () => { m.raw.pkg = { items: [1, 2, 1] }; config.load(); config.removeAtKeyPath("pkg.items", 1); expect(config.get("pkg.items")).toEqual([2, 1]); });
	it("rejects array helpers on scalar values", () => { m.raw.pkg = { items: "nope" }; config.load(); expect(() => config.pushAtKeyPath("pkg.items", 1)).toThrow("not an array"); });
});

describe("Config observers", () => {
	let config;
	beforeEach(() => { m.raw = { core: { count: 1 } }; vi.clearAllMocks(); persistence.getRawValuesString.mockImplementation(() => JSON.stringify(m.raw)); m.setRawValue.mockImplementation((path, value) => { m.raw.core.count = value; }); config = new Config(); config.load(); });

	it("observe immediately receives the current value", () => { const callback = vi.fn(); config.observe("core.count", callback); expect(callback).toHaveBeenCalledWith(1); });
	it("onDidChange does not call its listener immediately", () => { const callback = vi.fn(); config.onDidChange("core.count", callback); expect(callback).not.toHaveBeenCalled(); });
	it("onDidChange reports old and new values", () => { const callback = vi.fn(); config.onDidChange("core.count", callback); config.set("core.count", 2); expect(callback).toHaveBeenCalledWith({ oldValue: 1, newValue: 2 }); });
	it("does not notify a key-path listener when its value is unchanged", () => { const callback = vi.fn(); config.onDidChange("core.count", callback); config.updateSettings({ core: { count: 1 }, other: true }); expect(callback).not.toHaveBeenCalled(); });
	it("supports observing all settings by omitting a key path", () => { const callback = vi.fn(); config.onDidChange(callback); config.set("core.count", 2); expect(callback).toHaveBeenCalledOnce(); });
	it("disposal stops subsequent notifications", () => { const callback = vi.fn(); const disposable = config.onDidChange("core.count", callback); disposable.dispose(); config.set("core.count", 2); expect(callback).not.toHaveBeenCalled(); });
	it("a transaction coalesces multiple observer notifications", () => { const callback = vi.fn(); config.onDidChange("core.count", callback); config.transact(() => { config.updateSettings({ core: { count: 2 } }); config.updateSettings({ core: { count: 3 } }); }); expect(callback).toHaveBeenCalledOnce(); });
	it("a transaction observer sees the final value", () => { const callback = vi.fn(); config.onDidChange("core.count", callback); config.transact(() => { config.updateSettings({ core: { count: 2 } }); config.updateSettings({ core: { count: 3 } }); }); expect(callback).toHaveBeenCalledWith({ oldValue: 1, newValue: 3 }); });
	it("identifies descendant key paths", () => { expect(config.isSubKeyPath("core.editor.font", "core.editor")).toBe(true); });
	it("does not identify sibling key paths as descendants", () => { expect(config.isSubKeyPath("core.theme", "core.editor")).toBe(false); });
});
