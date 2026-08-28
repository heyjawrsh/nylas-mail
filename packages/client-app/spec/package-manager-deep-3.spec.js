import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const fs = {
		resolve: vi.fn(), isDirectorySync: vi.fn(), listSync: vi.fn(() => []),
		isFileSync: vi.fn(), readFileSync: vi.fn(), existsSync: vi.fn(),
	};
	const remote = {
		app: {}, screen: {}, dialog: { showMessageBox: vi.fn() },
		getCurrentWindow: vi.fn(() => ({})),
	};
	const electron = { ipcRenderer: { on: vi.fn(), send: vi.fn() }, shell: {}, remote };
	return {
		fs, remote, electron, loadMetadata: vi.fn(), packageInstances: [], themeInstances: [],
		notifyPluginsChanged: vi.fn(), legacyEmit: vi.fn(), apmInstall: vi.fn(),
	};
});

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
vi.mock("electron", () => ({ default: m.electron, ...m.electron, remote: m.remote }));
vi.mock("@electron/remote", () => ({ default: m.remote, ...m.remote, remote: m.remote }));
vi.mock("emissary", () => {
	const Emitter = { includeInto: (Class) => { Class.prototype.emit = (...args) => m.legacyEmit(...args); } };
	return { default: { Emitter }, Emitter };
});
vi.mock("event-kit", () => {
	class Emitter {
		constructor() { this.handlers = new Map(); }
		on(name, callback) {
			const handlers = this.handlers.get(name) || [];
			handlers.push(callback); this.handlers.set(name, handlers);
			return { dispose: () => this.handlers.set(name, handlers.filter((handler) => handler !== callback)) };
		}
		emit(name, value) { for (const handler of this.handlers.get(name) || []) handler(value); }
	}
	return { default: { Emitter }, Emitter };
});
vi.mock("fs-plus", () => ({ default: m.fs, ...m.fs }));
vi.mock("q", () => {
	const Q = (value) => Promise.resolve(value);
	Q.all = (values) => Promise.all(values); Q.reject = (error) => Promise.reject(error);
	return { default: Q, ...Q };
});
vi.mock("../src/flux/actions.js", () => ({ default: { notifyPluginsChanged: m.notifyPluginsChanged } }));
vi.mock("../src/package.js", () => {
	class Package {
		constructor(path, metadata) {
			this.path = path; this.metadata = metadata; this.name = metadata.name;
			this.declaresNewDatabaseObjects = metadata.declaresNewDatabaseObjects;
			this.load = vi.fn(); this.activate = vi.fn(() => Promise.resolve()); this.deactivate = vi.fn();
			this.enable = vi.fn(); this.disable = vi.fn(); this.serialize = vi.fn(() => metadata.state);
			this.getType = vi.fn(() => metadata.type || "nylas"); m.packageInstances.push(this);
		}
		static loadMetadata(...args) { return m.loadMetadata(...args); }
	}
	return { default: Package };
});
vi.mock("../src/theme-package.js", () => {
	class ThemePackage {
		constructor(path, metadata) {
			this.path = path; this.metadata = metadata; this.name = metadata.name;
			this.declaresNewDatabaseObjects = metadata.declaresNewDatabaseObjects;
			this.load = vi.fn(); this.activate = vi.fn(() => Promise.resolve()); this.deactivate = vi.fn();
			this.serialize = vi.fn(() => metadata.state); this.getType = vi.fn(() => "theme");
			m.themeInstances.push(this);
		}
	}
	return { default: ThemePackage };
});
vi.mock("../src/apm-wrapper.js", () => ({
	default: class APMWrapper { installDependenciesInPackageDirectory(...args) { return m.apmInstall(...args); } },
}));

globalThis.NylasEnv = {
	isWorkWindow: vi.fn(() => true), inSpecMode: vi.fn(() => true), inDevMode: vi.fn(() => false),
	reportError: vi.fn(), getConfigDirPath: vi.fn(() => "/config"), getPath: vi.fn(() => "/app"),
	getVersion: vi.fn(() => "1.0.0"),
	config: { get: vi.fn(() => null), onDidChange: vi.fn(() => ({ dispose: vi.fn() })) },
};

let PackageManager;
const options = { configDirPath: "/config", devMode: false, safeMode: false, resourcePath: "/app", specMode: false };
const makeManager = () => new PackageManager(options);

describe("PackageManager window-type filtering matrix", () => {
	beforeEach(async () => {
		vi.resetModules(); PackageManager = (await import("../src/package-manager.js")).default;
		vi.clearAllMocks(); m.packageInstances.length = 0; m.themeInstances.length = 0;
		const cache = { basePackagePaths: ["/plugins/typed"] };
		m.fs.listSync.mockReturnValue([]); m.fs.isDirectorySync.mockReturnValue(false);
		m.fs.readFileSync.mockReturnValue(JSON.stringify({ packageDependencies: {} }));
		m.fs.resolve.mockImplementation((...parts) => `${parts.slice(0, -1).join("|")}/${parts.at(-1)}`);
		globalThis.NylasEnv = {
			isWorkWindow: vi.fn(() => true), inSpecMode: vi.fn(() => true), inDevMode: vi.fn(() => false),
			reportError: vi.fn(), getConfigDirPath: vi.fn(() => "/config"), getPath: vi.fn(() => "/app"),
			getVersion: vi.fn(() => "1.0.0"), fileListCache: vi.fn(() => cache),
			isMainWindow: vi.fn(() => true), focus: vi.fn(),
			config: {
				get: vi.fn((key) => key === "env" ? "production" : []), set: vi.fn(),
				onDidChange: vi.fn(() => ({ dispose: vi.fn() })), transact: vi.fn((fn) => fn()),
			},
		};
	});

	const pathsFor = (windowType, windowTypes) => {
		m.loadMetadata.mockReturnValue({ name: "typed", engines: { nylas: "*" }, windowTypes });
		return makeManager().getAvailablePackagePaths(windowType);
	};


	it("excludes a package declaring only a different window type", () => {
		expect(pathsFor("worker", { composer: true })).toEqual([]);
	});





	it("excludes a typed package from default when it declares neither default nor all", () => {
		expect(pathsFor("default", { worker: true })).toEqual([]);
	});

	it("does not inspect metadata when no window type is requested", () => {
		m.loadMetadata.mockImplementation(() => { throw new Error("should not load"); });
		expect(makeManager().getAvailablePackagePaths()).toEqual(["/plugins/typed"]);
	});

});


describe("PackageManager themes and built-in package partitioning", () => {
	beforeEach(async () => {
		vi.resetModules(); PackageManager = (await import("../src/package-manager.js")).default;
		vi.clearAllMocks(); m.packageInstances.length = 0; m.themeInstances.length = 0;
		const cache = {};
		m.fs.listSync.mockReturnValue([]); m.fs.isDirectorySync.mockReturnValue(false);
		m.fs.readFileSync.mockReturnValue(JSON.stringify({ packageDependencies: {} }));
		m.fs.resolve.mockImplementation((...parts) => parts.at(-1).startsWith("/") ? parts.at(-1) : `/plugins/${parts.at(-1)}`);
		globalThis.NylasEnv = {
			isWorkWindow: vi.fn(() => true), inSpecMode: vi.fn(() => true), inDevMode: vi.fn(() => false),
			reportError: vi.fn(), getConfigDirPath: vi.fn(() => "/config"), getPath: vi.fn(() => "/app"), getVersion: vi.fn(() => "1.0.0"),
			fileListCache: vi.fn(() => cache), isMainWindow: vi.fn(() => true), focus: vi.fn(),
			config: { get: vi.fn((key) => key === "env" ? "production" : []), set: vi.fn(), onDidChange: vi.fn(() => ({ dispose: vi.fn() })), transact: vi.fn((fn) => fn()) },
		};
	});



	it("lists themes alongside regular loaded packages when both types are requested", () => {
		const manager = makeManager(); const theme = { getType: () => "theme" }; const mail = { getType: () => "nylas" };
		manager.loadedPackages = { theme, mail };
		expect(manager.getLoadedPackagesForTypes(["theme", "nylas"])).toEqual([theme, mail]);
	});





	it("does not publish package partitions outside the main window", () => {
		NylasEnv.isMainWindow.mockReturnValue(false); makeManager()._onPluginsChanged();
		expect(m.notifyPluginsChanged).not.toHaveBeenCalled();
	});
});
