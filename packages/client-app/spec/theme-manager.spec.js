import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	resolveOnLoadPath: vi.fn(), readFileSync: vi.fn(), isDirectorySync: vi.fn(), listTreeSync: vi.fn(() => []),
}));

vi.mock("node:module", () => { const createRequire = () => vi.fn(() => () => ({})); return { default: { createRequire }, createRequire }; });
vi.mock("node:path", () => { const path = { extname: (value) => { const match = /\.[^/.]+$/.exec(value); return match?.[0] || ""; }, join: (...parts) => parts.join("/") }; return { default: path, ...path }; });
vi.mock("electron", () => { const remote = { app: { quit: vi.fn(), getVersion: vi.fn(), getPath: vi.fn() }, screen: { getPrimaryDisplay: vi.fn() }, dialog: { showMessageBox: vi.fn() }, getCurrentWindow: vi.fn() }; const electron = { remote, ipcRenderer: { send: vi.fn() }, shell: {} }; return { default: electron, ...electron }; });
vi.mock("@electron/remote", () => { const remote = { app: { quit: vi.fn(), getVersion: vi.fn(), getPath: vi.fn() }, screen: { getPrimaryDisplay: vi.fn() }, dialog: { showMessageBox: vi.fn() }, getCurrentWindow: vi.fn() }; const electron = { remote, ipcRenderer: { send: vi.fn() }, shell: {} }; return { default: electron, ...electron }; });
vi.mock("underscore", () => { const underscore = { isArray: Array.isArray, intersection: (a, b) => a.filter((x) => b.includes(x)), uniq: (a) => [...new Set(a)] }; return { default: underscore, ...underscore }; });
vi.mock("emissary", () => ({ default: { Emitter: { includeInto: vi.fn() } }, Emitter: { includeInto: vi.fn() } }));
vi.mock("event-kit", () => { class Emitter { constructor() { this.emit = vi.fn(); this.on = vi.fn(() => ({ dispose: vi.fn() })); } } class Disposable {} class CompositeDisposable {} return { default: { Emitter, Disposable, CompositeDisposable }, Emitter, Disposable, CompositeDisposable }; });
vi.mock("pathwatcher", () => ({ default: {}, File: class File {}, watch: vi.fn() }));
vi.mock("fs-plus", () => ({ default: { resolveOnLoadPath: m.resolveOnLoadPath, readFileSync: m.readFileSync, isDirectorySync: m.isDirectorySync, listTreeSync: m.listTreeSync } }));
vi.mock("q", () => ({ default: { defer: vi.fn(), all: (values) => Promise.all(values) }, defer: vi.fn(), all: (values) => Promise.all(values) }));
vi.mock("../src/package.js", () => ({ default: class Package {} }));

import ThemeManager from "../src/theme-manager.js";

const theme = (name, active = true) => ({ name, isTheme: vi.fn(() => active), getStylesheetsPath: vi.fn(() => `/themes/${name}/styles`) });

describe("ThemeManager theme listing and activation state", () => {
	let manager; let packageManager; let stylesElement;
	beforeEach(() => {
		vi.clearAllMocks(); document.head.innerHTML = ""; document.body.className = "";
		stylesElement = document.createElement("nylas-styles");
		stylesElement.onDidAddStyleElement = vi.fn(); stylesElement.onDidRemoveStyleElement = vi.fn(); stylesElement.onDidUpdateStyleElement = vi.fn(); document.head.appendChild(stylesElement);
		packageManager = { registerPackageActivator: vi.fn(), getLoadedPackages: vi.fn(() => []), getActivePackages: vi.fn(() => []), resolvePackagePath: vi.fn(), activatePackage: vi.fn(() => Promise.resolve()), deactivatePackage: vi.fn() };
		globalThis.NylasEnv = { config: { get: vi.fn(() => []), set: vi.fn(), observe: vi.fn() }, packages: { resolvePackagePath: vi.fn() }, styles: { addStyleSheet: vi.fn() } };
		manager = new ThemeManager({ packageManager, resourcePath: "/app", configDirPath: "/config", safeMode: false });
	});

	it("registers itself as the theme package activator", () => { expect(packageManager.registerPackageActivator).toHaveBeenCalledWith(manager, ["theme"]); });
	it("subscribes to styles element lifecycle events", () => { expect(stylesElement.onDidAddStyleElement).toHaveBeenCalledWith(expect.any(Function)); expect(stylesElement.onDidRemoveStyleElement).toHaveBeenCalledWith(expect.any(Function)); expect(stylesElement.onDidUpdateStyleElement).toHaveBeenCalledWith(expect.any(Function)); });
	it("lists only loaded packages that identify as themes", () => { const mail = theme("mail", false); const dark = theme("dark"); packageManager.getLoadedPackages.mockReturnValue([mail, dark]); expect(manager.getLoadedThemes()).toEqual([dark]); });
	it("returns loaded theme names", () => { packageManager.getLoadedPackages.mockReturnValue([theme("ui-light"), theme("solarized")]); expect(manager.getLoadedThemeNames()).toEqual(["ui-light", "solarized"]); });
	it("lists only active theme packages", () => { const plugin = theme("plugin", false); const dark = theme("ui-dark"); packageManager.getActivePackages.mockReturnValue([plugin, dark]); expect(manager.getActiveThemes()).toEqual([dark]); });
	it("returns the first active theme", () => { const first = theme("first"); packageManager.getActivePackages.mockReturnValue([first, theme("second")]); expect(manager.getActiveTheme()).toBe(first); });
	it("reverses configured themes so the preferred theme activates last", () => { globalThis.NylasEnv.config.get.mockReturnValue(["solarized", "ui-light"]); globalThis.NylasEnv.packages.resolvePackagePath.mockReturnValue("/installed"); expect(manager.getEnabledThemeNames()).toEqual(["ui-light", "solarized"]); });
	it("accepts a single configured theme string", () => { globalThis.NylasEnv.config.get.mockReturnValue("ui-dark"); globalThis.NylasEnv.packages.resolvePackagePath.mockReturnValue("/installed/ui-dark"); expect(manager.getEnabledThemeNames()).toEqual(["ui-dark"]); });
	it("falls back to ui-light when configured themes are unavailable", () => { globalThis.NylasEnv.config.get.mockReturnValue(["missing"]); globalThis.NylasEnv.packages.resolvePackagePath.mockReturnValue(null); vi.spyOn(console, "warn").mockImplementation(() => {}); expect(manager.getEnabledThemeNames()).toEqual(["ui-light"]); });
	it("warns when a configured theme is not installed", () => { globalThis.NylasEnv.config.get.mockReturnValue(["missing"]); const warn = vi.spyOn(console, "warn").mockImplementation(() => {}); manager.getEnabledThemeNames(); expect(warn).toHaveBeenCalledWith("Enabled theme 'missing' is not installed."); });
	it("stores the base theme before the selected theme", () => { manager.setActiveTheme("ui-dark"); expect(globalThis.NylasEnv.config.set).toHaveBeenCalledWith("core.themes", ["ui-light", "ui-dark"]); });
	it("does not duplicate ui-light when it is selected", () => { manager.setActiveTheme("ui-light"); expect(globalThis.NylasEnv.config.set).toHaveBeenCalledWith("core.themes", ["ui-light"]); });
	it("resolves extensionless stylesheets against css and less", () => { m.resolveOnLoadPath.mockReturnValue("/app/theme.less"); expect(manager.resolveStylesheet("theme")).toBe("/app/theme.less"); expect(m.resolveOnLoadPath).toHaveBeenCalledWith("theme", ["css", "less"]); });
	it("resolves stylesheets with an explicit extension directly", () => { manager.resolveStylesheet("theme.css"); expect(m.resolveOnLoadPath).toHaveBeenCalledWith("theme.css"); });
	it("reads css stylesheets as utf8", () => { m.readFileSync.mockReturnValue("body {}"); expect(manager.loadStylesheet("/theme.css")).toBe("body {}"); expect(m.readFileSync).toHaveBeenCalledWith("/theme.css", "utf8"); });
	it("throws when a required stylesheet cannot be found", () => { m.resolveOnLoadPath.mockReturnValue(null); expect(() => manager.requireStylesheet("missing")).toThrow("Could not find a file at path 'missing'"); });
	it("adds resolved stylesheet content to the style manager", () => { m.resolveOnLoadPath.mockReturnValue("/theme.css"); m.readFileSync.mockReturnValue("body {}"); const disposable = { dispose: vi.fn() }; globalThis.NylasEnv.styles.addStyleSheet.mockReturnValue(disposable); expect(manager.requireStylesheet("theme")).toBe(disposable); expect(globalThis.NylasEnv.styles.addStyleSheet).toHaveBeenCalledWith("body {}", { sourcePath: "/theme.css" }); });
	it("disposes a previously applied stylesheet", () => { const disposable = { dispose: vi.fn() }; manager.styleSheetDisposablesBySourcePath["/theme.css"] = disposable; manager.removeStylesheet("/theme.css"); expect(disposable.dispose).toHaveBeenCalledOnce(); });
	it("adds a body class for each active theme", () => { packageManager.getActivePackages.mockReturnValue([theme("ui-light"), theme("solarized")]); manager.addActiveThemeClasses(); expect(document.body.classList.contains("theme-ui-light")).toBe(true); expect(document.body.classList.contains("theme-solarized")).toBe(true); });
	it("removes body classes for active themes", () => { document.body.classList.add("theme-ui-dark"); packageManager.getActivePackages.mockReturnValue([theme("ui-dark")]); manager.removeActiveThemeClasses(); expect(document.body.classList.contains("theme-ui-dark")).toBe(false); });
	it("deactivates every active theme", () => { packageManager.getActivePackages.mockReturnValue([theme("one"), theme("two")]); manager.deactivateThemes(); expect(packageManager.deactivatePackage.mock.calls.map(([name]) => name)).toEqual(["one", "two"]); });
	it("uses active theme stylesheet directories as import paths", () => { packageManager.getActivePackages.mockReturnValue([theme("ui-dark")]); m.isDirectorySync.mockReturnValue(true); expect(manager.getImportPaths()).toEqual(["/themes/ui-dark/styles"]); });
	it("supports the deprecated stylesheets directory for inactive themes", () => { manager.getEnabledThemeNames = vi.fn(() => ["classic"]); packageManager.resolvePackagePath.mockReturnValue("/themes/classic"); m.isDirectorySync.mockImplementation((value) => value.endsWith("stylesheets")); expect(manager.getImportPaths()).toEqual(["/themes/classic/stylesheets"]); });
	it("drops theme import paths that are not directories", () => { packageManager.getActivePackages.mockReturnValue([theme("broken")]); m.isDirectorySync.mockReturnValue(false); expect(manager.getImportPaths()).toEqual([]); });
	it("refreshes an existing less cache with current import paths", () => { manager.lessCache = { setImportPaths: vi.fn() }; manager.getImportPaths = vi.fn(() => ["/themes/current/styles"]); manager.refreshLessCache(); expect(manager.lessCache.setImportPaths).toHaveBeenCalledWith(["/themes/current/styles"]); });
	it("reports initial loading as incomplete before activation", () => { expect(manager.isInitialLoadComplete()).toBe(false); });
});
