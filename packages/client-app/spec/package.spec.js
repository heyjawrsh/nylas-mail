import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	existsSync: vi.fn(), readFileSync: vi.fn(), resolve: vi.fn((...parts) => parts.filter(Boolean).join("/")),
	listSync: vi.fn(() => []), isDirectorySync: vi.fn(() => false),
	isFileSync: vi.fn(() => false), resolveExtension: vi.fn((value) => value),
	modelRegister: vi.fn(), taskRegister: vi.fn(), includeInto: vi.fn(),
}));

vi.mock("node:path", async (importOriginal) => {
	const path = await importOriginal();
	return { default: path, ...path };
});
vi.mock("underscore", () => {
	const underscore = {
		values: (object) => Object.values(object || {}), uniq: (array) => [...new Set(array || [])],
		extend: (target, ...sources) => Object.assign(target, ...sources), debounce: (fn) => fn,
		defer: (fn) => fn(), pluck: (array, key) => array.map((value) => value[key]),
		isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b), each: (array, fn) => array.forEach(fn),
		filter: (array, fn) => array.filter(fn), clone: (object) => ({ ...object }),
	};
	return { default: underscore, ...underscore };
});
vi.mock("async", () => ({ default: {}, each: vi.fn() }));
vi.mock("fs-plus", () => ({ default: {
	existsSync: m.existsSync, readFileSync: m.readFileSync, resolve: m.resolve,
	listSync: m.listSync, isDirectorySync: m.isDirectorySync, isFileSync: m.isFileSync,
	resolveExtension: m.resolveExtension,
} }));
vi.mock("emissary", () => ({
	default: { Emitter: { includeInto: (cls) => { cls.prototype.emit = function (name, ...args) { return this.emitter?.emit(name, ...args); }; } } },
	Emitter: { includeInto: (cls) => { cls.prototype.emit = function (name, ...args) { return this.emitter?.emit(name, ...args); }; } },
}));
vi.mock("event-kit", () => {
	class Emitter {
		constructor() { this.handlers = new Map(); }
		on(name, fn) { const list = this.handlers.get(name) || []; list.push(fn); this.handlers.set(name, list); return { dispose: vi.fn() }; }
		emit(name, value) { for (const fn of this.handlers.get(name) || []) fn(value); }
	}
	class CompositeDisposable {
		constructor() { this.items = []; this.dispose = vi.fn(() => this.items.forEach((item) => item?.dispose?.())); }
		add(item) { this.items.push(item); return item; }
	}
	return { default: { Emitter, CompositeDisposable }, Emitter, CompositeDisposable };
});
vi.mock("q", () => ({
	default: {
		defer: () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); promise.catch(() => {}); return { promise, resolve, reject }; },
		all: (values) => Promise.all(values),
	},
}));
vi.mock("../src/registries/task-registry.js", () => ({ default: { register: m.taskRegister } }));
vi.mock("../src/registries/database-object-registry.js", () => ({ default: { register: m.modelRegister } }));

let Package;

const env = () => ({
	packages: { devMode: false, resourcePath: "/app", getPackageState: vi.fn(() => ({ saved: true })) },
	config: { removeAtKeyPath: vi.fn(), pushAtKeyPath: vi.fn(), setSchema: vi.fn(), setDefaults: vi.fn() },
	styles: { addStyleSheet: vi.fn(() => ({ dispose: vi.fn() })) },
	themes: { loadStylesheet: vi.fn((path) => `source:${path}`) },
	keymaps: { loadKeymap: vi.fn(() => ({ dispose: vi.fn() })) },
	menu: { add: vi.fn(() => ({ dispose: vi.fn() })) },
	inDevMode: vi.fn(() => true),
});

beforeAll(async () => {
	globalThis.NylasEnv = env();
	const imported = await import("../src/package.js");
	Package = imported.default;
});

beforeEach(() => {
	vi.clearAllMocks();
	globalThis.NylasEnv = env();
	Package.resourcePathWithTrailingSlash = null;
	m.resolve.mockImplementation((...parts) => parts.filter((p) => typeof p === "string" && p).join("/"));
	m.resolveExtension.mockImplementation((value) => value);
	m.listSync.mockReturnValue([]);
	m.isDirectorySync.mockReturnValue(false);
	m.isFileSync.mockReturnValue(false);
});

describe("Package metadata and identity", () => {
	it("sets metadata name from the containing directory", () => { m.existsSync.mockReturnValue(true); m.readFileSync.mockReturnValue("{}"); expect(Package.loadMetadata("/plugins/calendar").name).toBe("calendar"); });
	it("returns minimal metadata when package.json is absent", () => { m.existsSync.mockReturnValue(false); expect(Package.loadMetadata("/plugins/calendar")).toEqual({ name: "calendar" }); });
	it("ignores malformed metadata when requested", () => { m.existsSync.mockReturnValue(true); m.readFileSync.mockReturnValue("{"); expect(Package.loadMetadata("/plugins/broken", true)).toEqual({ name: "broken" }); });
	it("identifies paths beneath the application resource path as bundled", () => { expect(Package.isBundledPackagePath("/app/packages/calendar")).toBe(true); });
	it("does not identify sibling resource paths as bundled", () => { expect(Package.isBundledPackagePath("/application/calendar")).toBe(false); });
	it("uses metadata displayName when supplied", () => { expect(new Package("/plugins/calendar", { name: "calendar", displayName: "My Calendar" }).displayName).toBe("My Calendar"); });
	it("falls back to the package name for displayName", () => { expect(new Package("/plugins/calendar", { name: "calendar" }).displayName).toBe("calendar"); });
	it("uses pluginAppId as the plugin id", () => { const pkg = new Package("/plugins/calendar", { name: "calendar" }); pkg.pluginAppId = "app-1"; expect(pkg.pluginId()).toBe("app-1"); });
	it("detects themes by presence of the theme metadata key", () => { expect(new Package("/themes/dark", { name: "dark", theme: {} }).isTheme()).toBe(true); });
	// Theme detection is presence-based, so even an explicitly false manifest value counts.
	it("treats a false theme metadata value as a theme declaration", () => { expect(new Package("/themes/dark", { name: "dark", theme: false }).isTheme()).toBe(true); });
	it("does not treat ordinary packages as themes", () => { expect(new Package("/plugins/calendar", { name: "calendar" }).isTheme()).toBe(false); });
	it("reports the legacy package type", () => { expect(new Package("/plugins/calendar", { name: "calendar" }).getType()).toBe("nylas"); });
});

describe("Package resource discovery and registration", () => {
	it("falls back to the styles directory", () => { expect(new Package("/plugins/p", { name: "p" }).getStylesheetsPath()).toBe("/plugins/p/styles"); });
	it("marks packages that declare database objects", () => { class Message {}; const pkg = new Package("/p", { name: "p" }); pkg.registerModelConstructors([Message]); expect(pkg.declaresNewDatabaseObjects).toBe(true); });
});

describe("Package activation surfaces", () => {
	it("enables a package by removing it from disabled packages", () => { const pkg = new Package("/p", { name: "p" }); pkg.enable(); expect(NylasEnv.config.removeAtKeyPath).toHaveBeenCalledWith("core.disabledPackages", "p"); });
	it("disables a package by adding it to disabled packages", () => { const pkg = new Package("/p", { name: "p" }); pkg.disable(); expect(NylasEnv.config.pushAtKeyPath).toHaveBeenCalledWith("core.disabledPackages", "p"); });
	it("registers schema-style package config", () => { const pkg = new Package("/p", { name: "p" }); pkg.mainModule = { config: { enabled: { type: "boolean" } } }; pkg.activateConfig(); expect(NylasEnv.config.setSchema).toHaveBeenCalledWith("p", { type: "object", properties: pkg.mainModule.config }); });
	it("registers legacy config defaults", () => { const pkg = new Package("/p", { name: "p" }); pkg.mainModule = { configDefaults: { enabled: true } }; pkg.activateConfig(); expect(NylasEnv.config.setDefaults).toHaveBeenCalledWith("p", { enabled: true }); });
	it("calls the package config activation hook", () => { const activateConfig = vi.fn(); const pkg = new Package("/p", { name: "p" }); pkg.mainModule = { activateConfig }; pkg.activateConfig(); expect(activateConfig).toHaveBeenCalledOnce(); });
	it("loads keymaps into the keymap manager", () => { const pkg = new Package("/p", { name: "p" }); pkg.keymaps = [["/p/key.json", { body: {} }]]; pkg.activateResources(); expect(NylasEnv.keymaps.loadKeymap).toHaveBeenCalledWith("/p/key.json", { body: {} }); });
	it("adds menu manifests to the menu manager", () => { const pkg = new Package("/p", { name: "p" }); pkg.menus = [["/p/menu.json", { menu: [{ label: "Mail" }] }]]; pkg.activateResources(); expect(NylasEnv.menu.add).toHaveBeenCalledWith([{ label: "Mail" }]); });
	it("ignores menu files without a menu property", () => { const pkg = new Package("/p", { name: "p" }); pkg.menus = [["/p/menu.json", {}]]; pkg.activateResources(); expect(NylasEnv.menu.add).not.toHaveBeenCalled(); });
	it("adds stylesheets with source path and priority", () => { const pkg = new Package("/p", { name: "p" }); pkg.stylesheets = [["/p/mail.less", "css"]]; pkg.activateStylesheets(); expect(NylasEnv.styles.addStyleSheet).toHaveBeenCalledWith("css", { sourcePath: "/p/mail.less", priority: 0, context: undefined }); });
	it("extracts a stylesheet context from dotted filenames", () => { const pkg = new Package("/p", { name: "p" }); pkg.stylesheets = [["/p/mail.composer.less", "css"]]; pkg.activateStylesheets(); expect(NylasEnv.styles.addStyleSheet).toHaveBeenCalledWith("css", expect.objectContaining({ context: "composer" })); });
	it("emits did-deactivate to subscribers", () => { const callback = vi.fn(); const pkg = new Package("/p", { name: "p" }); pkg.onDidDeactivate(callback); pkg.deactivate(); expect(callback).toHaveBeenCalledOnce(); });
	it("serializes only after the main module activates", () => { const pkg = new Package("/p", { name: "p" }); pkg.mainModule = { serialize: vi.fn(() => ({ saved: true })) }; expect(pkg.serialize()).toBeUndefined(); pkg.mainActivated = true; expect(pkg.serialize()).toEqual({ saved: true }); });
});
