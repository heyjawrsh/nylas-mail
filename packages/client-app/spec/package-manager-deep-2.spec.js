import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NativePackage = createRequire(import.meta.url)("../src/package.js");

const m = vi.hoisted(() => ({
	fs: {
		resolve: vi.fn(), isDirectorySync: vi.fn(), listSync: vi.fn(),
		isFileSync: vi.fn(), readFileSync: vi.fn(), existsSync: vi.fn(),
	},
	loadMetadata: vi.fn(), packageInstances: [], themeInstances: [],
	ipcOn: vi.fn(), ipcSend: vi.fn(), notifyPluginsChanged: vi.fn(),
	showMessageBox: vi.fn(), legacyEmit: vi.fn(), apmInstall: vi.fn(),
}));

vi.mock("node:path", () => {
	const path = {
		join: (...parts) => parts.join("/"),
		basename: (value) => value.split("/").filter(Boolean).at(-1) || "",
	};
	return { default: path, ...path };
});
vi.mock("node:url", () => {
	const parse = (value) => ({ query: Object.fromEntries(new URL(value || "https://local/").searchParams) });
	return { default: { parse }, parse };
});
vi.mock("underscore", () => {
	const uniq = (values, iteratee = (value) => value) => {
		const seen = new Set();
		return values.filter((value) => {
			const key = iteratee(value);
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	};
	const underscore = {
		values: Object.values, uniq, extend: (target, ...sources) => Object.assign(target, ...sources),
		debounce: (fn) => fn, defer: (fn, ...args) => fn(...args),
		pluck: (values, key) => values.map((value) => value[key]),
		isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
		clone: (value) => Array.isArray(value) ? [...value] : { ...value },
		include: (values, value) => values.includes(value), filter: (values, fn) => values.filter(fn),
		map: (values, fn) => values.map(fn), last: (values) => values.at(-1),
		without: (values, ...removed) => values.filter((value) => !removed.includes(value)),
		difference: (values, removed) => values.filter((value) => !removed.includes(value)),
		intersection: (a, b) => a.filter((value) => b.includes(value)),
	};
	return { default: underscore, ...underscore };
});
vi.mock("electron", () => {
	const remote = { app: {}, screen: {}, dialog: { showMessageBox: m.showMessageBox }, getCurrentWindow: vi.fn(() => ({})) };
	const electron = { ipcRenderer: { on: m.ipcOn, send: m.ipcSend }, shell: {}, remote };
	return { default: electron, ...electron };
});
vi.mock("@electron/remote", () => {
	const remote = { app: {}, screen: {}, dialog: { showMessageBox: m.showMessageBox }, getCurrentWindow: vi.fn(() => ({})) };
	return { default: remote, remote, ...remote };
});
vi.mock("emissary", () => {
	const Emitter = { includeInto: (Class) => { Class.prototype.emit = (...args) => m.legacyEmit(...args); } };
	return { default: { Emitter }, Emitter };
});
vi.mock("event-kit", () => {
	class Emitter {
		constructor() { this.handlers = new Map(); }
		on(name, callback) { const values = this.handlers.get(name) || []; values.push(callback); this.handlers.set(name, values); return { dispose: () => this.handlers.set(name, values.filter((item) => item !== callback)) }; }
		emit(name, value) { for (const callback of this.handlers.get(name) || []) callback(value); }
	}
	return { default: { Emitter }, Emitter };
});
vi.mock("fs-plus", () => ({ default: m.fs, ...m.fs }));
vi.mock("q", () => {
	const Q = (value) => Promise.resolve(value);
	Q.all = (values) => Promise.all(values);
	Q.reject = (error) => Promise.reject(error);
	return { default: Q, ...Q };
});
vi.mock("../src/flux/actions.js", () => ({ default: { notifyPluginsChanged: m.notifyPluginsChanged } }));
vi.mock("../src/package.js", () => {
	class Package {
		constructor(path, metadata) {
			this.path = path; this.metadata = metadata; this.name = metadata.name;
			this.declaresNewDatabaseObjects = metadata.declaresNewDatabaseObjects;
			this.load = vi.fn(); this.activate = vi.fn(() => Promise.resolve());
			this.deactivate = vi.fn(); this.enable = vi.fn(); this.disable = vi.fn();
			this.serialize = vi.fn(() => metadata.state); this.getType = vi.fn(() => metadata.type || "nylas");
			m.packageInstances.push(this);
		}
		static loadMetadata(...args) { return m.loadMetadata(...args); }
	}
	return { default: Package };
});
vi.mock("../src/theme-package.js", () => {
	class ThemePackage {
		constructor(path, metadata) {
			this.path = path; this.metadata = metadata; this.name = metadata.name;
			this.load = vi.fn(); this.activate = vi.fn(() => Promise.resolve());
			this.deactivate = vi.fn(); this.getType = vi.fn(() => "theme");
			m.themeInstances.push(this);
		}
	}
	return { default: ThemePackage };
});
vi.mock("../src/apm-wrapper.js", () => ({
	default: class APMWrapper { installDependenciesInPackageDirectory(...args) { return m.apmInstall(...args); } },
}));

let PackageManager;

const options = { configDirPath: "/config", devMode: false, safeMode: false, resourcePath: "/app", specMode: false };
const makeManager = () => new PackageManager(options);
const metadataForPath = (entries) => m.loadMetadata.mockImplementation((packagePath) => entries[packagePath]);
const exposePath = (path) => m.fs.isDirectorySync.mockImplementation((value) => value === path);

describe("PackageManager deep package discovery and lifecycle", () => {
	beforeEach(async () => {
		vi.resetModules();
		PackageManager = (await import("../src/package-manager.js")).default;
		vi.clearAllMocks();
		m.packageInstances.length = 0; m.themeInstances.length = 0;
		m.fs.listSync.mockReturnValue([]);
		m.fs.isDirectorySync.mockReturnValue(false);
		m.fs.resolve.mockImplementation((...parts) => `${parts.slice(0, -1).join("|")}/${parts.at(-1)}`);
		m.fs.readFileSync.mockReturnValue(JSON.stringify({ packageDependencies: {} }));
		m.loadMetadata.mockReturnValue({ name: "pkg", engines: { nylas: "*" } });
		const cache = {};
		globalThis.NylasEnv = {
			isWorkWindow: vi.fn(() => false), inSpecMode: vi.fn(() => true), inDevMode: vi.fn(() => false),
			reportError: vi.fn(), getConfigDirPath: vi.fn(() => "/config"), getPath: vi.fn(() => "/app"),
			getVersion: vi.fn(() => "1.0.0"), fileListCache: vi.fn(() => cache),
			isMainWindow: vi.fn(() => true), focus: vi.fn(),
			config: {
				get: vi.fn((key) => key === "env" ? "production" : []), set: vi.fn(),
				onDidChange: vi.fn(() => ({ dispose: vi.fn() })), transact: vi.fn((fn) => fn()),
			},
		};
	});



	it("ignores files found in package directories", () => {
		m.fs.listSync.mockReturnValue(["/config/packages/readme.txt"]);
		expect(makeManager().getAvailablePackagePaths()).toEqual([]);
	});

	it("ignores hidden package directories", () => {
		m.fs.listSync.mockReturnValue(["/config/packages/.git"]);
		exposePath("/config/packages/.git");
		expect(makeManager().getAvailablePackagePaths()).toEqual([]);
	});

	it("reuses package paths from the environment cache", () => {
		NylasEnv.fileListCache().basePackagePaths = ["/cached/mail"];
		expect(makeManager().getAvailablePackagePaths()).toContain("/cached/mail");
		expect(m.fs.listSync).not.toHaveBeenCalled();
	});





	it("excludes untyped packages for a specialized window", () => {
		NylasEnv.fileListCache().basePackagePaths = ["/plugins/classic"];
		metadataForPath({ "/plugins/classic": { engines: { nylas: "*" } } });
		expect(makeManager().getAvailablePackagePaths("worker")).toEqual([]);
	});

	it("excludes packages whose metadata cannot be loaded while filtering", () => {
		NylasEnv.fileListCache().basePackagePaths = ["/plugins/broken"];
		m.loadMetadata.mockImplementation(() => { throw new Error("invalid json"); });
		expect(makeManager().getAvailablePackagePaths("default")).toEqual([]);
	});


	it("does not add a missing package dependency", () => {
		const manager = makeManager(); manager.packageDependencies = { missing: "1.0.0" };
		expect(manager.getAvailablePackagePaths()).not.toContain("/app/node_modules/missing");
	});

	it("deduplicates paths found both by scanning and dependencies", () => {
		NylasEnv.fileListCache().basePackagePaths = ["/app/node_modules/shared"];
		const manager = makeManager(); manager.packageDependencies = { shared: "1.0.0" }; exposePath("/app/node_modules/shared");
		expect(manager.getAvailablePackagePaths()).toEqual(["/app/node_modules/shared"]);
	});

	it("lists available packages by basename", () => {
		const manager = makeManager(); manager.getAvailablePackagePaths = vi.fn(() => ["/one/mail", "/two/calendar"]);
		expect(manager.getAvailablePackageNames()).toEqual(["mail", "calendar"]);
	});

	it("uses loaded metadata in the available package listing", () => {
		const manager = makeManager(); manager.getAvailablePackagePaths = vi.fn(() => ["/plugins/theme"]);
		manager.loadedPackages.theme = { metadata: { name: "theme", theme: true } };
		expect(manager.getAvailablePackageMetadata()).toEqual([{ name: "theme", theme: true }]);
		expect(m.loadMetadata).not.toHaveBeenCalled();
	});



	it("lists loaded theme packages by their theme type", () => {
		const manager = makeManager();
		const theme = { getType: vi.fn(() => "theme") };
		const regular = { getType: vi.fn(() => "nylas") };
		manager.loadedPackages = { theme, regular };
		expect(manager.getLoadedPackagesForTypes(["theme"])).toEqual([theme]);
	});




	it("returns an already loaded package without constructing another", () => {
		const manager = makeManager(); const pack = { name: "mail" }; manager.loadedPackages.mail = pack;
		expect(manager.loadPackage("mail")).toBe(pack);
		expect(m.packageInstances).toHaveLength(0);
	});

	it("warns and skips packages that do not support the current environment", () => {
		const manager = makeManager();
		manager.resolvePackagePath = vi.fn(() => "/pkgs/composer-scheduler");
		const loadMetadata = vi.spyOn(NativePackage, "loadMetadata").mockReturnValue({
			name: "composer-scheduler", supportedEnvs: ["staging"],
		});
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			expect(manager.loadPackage("composer-scheduler")).toBeNull();
			expect(warn).toHaveBeenCalledOnce();
			expect(warn).toHaveBeenCalledWith(expect.stringContaining("composer-scheduler"));
			expect(warn).toHaveBeenCalledWith(expect.stringContaining("staging"));
			expect(warn).toHaveBeenCalledWith(expect.stringContaining("production"));
		} finally {
			loadMetadata.mockRestore();
			warn.mockRestore();
		}
	});

	it("activates a loaded package after setup completes", async () => {
		const manager = makeManager(); const pack = { name: "mail", activate: vi.fn().mockResolvedValue(undefined) };
		manager.loadedPackages.mail = pack;
		await expect(manager.activatePackage("mail", Promise.resolve())).resolves.toBe(pack);
		expect(pack.activate).toHaveBeenCalledOnce();
	});

	it("records a package as active after activation", async () => {
		const manager = makeManager(); const pack = { name: "mail", activate: vi.fn().mockResolvedValue(undefined) };
		manager.loadedPackages.mail = pack; await manager.activatePackage("mail");
		expect(manager.getActivePackage("mail")).toBe(pack);
	});

	it("returns an active package without activating it again", async () => {
		const manager = makeManager(); const pack = { name: "mail", activate: vi.fn() }; manager.activePackages.mail = pack;
		await expect(manager.activatePackage("mail")).resolves.toBe(pack);
		expect(pack.activate).not.toHaveBeenCalled();
	});

	it("rejects activation when a package cannot be loaded", async () => {
		const manager = makeManager(); manager.loadPackage = vi.fn(() => null);
		await expect(manager.activatePackage("missing")).rejects.toThrow("Failed to load package 'missing'");
	});

	it("serializes active package state before deactivation", () => {
		const manager = makeManager(); const pack = { name: "mail", serialize: vi.fn(() => ({ draft: 1 })), deactivate: vi.fn() };
		manager.loadedPackages.mail = pack; manager.activePackages.mail = pack; manager.deactivatePackage("mail");
		expect(manager.getPackageState("mail")).toEqual({ draft: 1 });
	});

	it("deactivates the loaded package", () => {
		const manager = makeManager(); const pack = { name: "mail", deactivate: vi.fn() };
		manager.loadedPackages.mail = pack; manager.deactivatePackage("mail");
		expect(pack.deactivate).toHaveBeenCalledOnce();
	});

	it("removes a package from the active package map during deactivation", () => {
		const manager = makeManager(); const pack = { name: "mail", deactivate: vi.fn() };
		manager.loadedPackages.mail = pack; manager.activePackages.mail = pack; manager.deactivatePackage("mail");
		expect(manager.isPackageActive("mail")).toBe(false);
	});

	it("deactivates all loaded packages in a config transaction", () => {
		const manager = makeManager(); manager.loadedPackages = { mail: { name: "mail" }, theme: { name: "theme" } };
		manager.deactivatePackage = vi.fn(); manager.deactivatePackages();
		expect(manager.deactivatePackage.mock.calls.map(([name]) => name)).toEqual(["mail", "theme"]);
		expect(NylasEnv.config.transact).toHaveBeenCalledOnce();
	});
});
