import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const normalize = (value) => {
		const absolute = String(value).startsWith("/");
		const parts = [];
		for (const part of String(value).split("/")) {
			if (!part || part === ".") continue;
			if (part === "..") parts.pop();
			else parts.push(part);
		}
		return `${absolute ? "/" : ""}${parts.join("/")}` || (absolute ? "/" : ".");
	};
	const path = {
		sep: "/",
		join: (...parts) => normalize(parts.join("/")),
		resolve: (...parts) => normalize(parts.join("/")),
		dirname: (value) => { const normalized = normalize(value); const index = normalized.lastIndexOf("/"); return index <= 0 ? (normalized[0] === "/" ? "/" : ".") : normalized.slice(0, index); },
		basename: (value) => normalize(value).split("/").pop(),
		extname: (value) => { const base = normalize(value).split("/").pop(); const index = base.lastIndexOf("."); return index <= 0 ? "" : base.slice(index); },
		relative: (from, to) => { const prefix = `${normalize(from).replace(/\/$/, "")}/`; return normalize(to).startsWith(prefix) ? normalize(to).slice(prefix.length) : normalize(to); },
	};
	return {
		path,
		module: { _cache: {}, _pathCache: {}, _resolveFilename: vi.fn((request) => `fallback:${request}`), prototype: {} },
		listSync: vi.fn(() => []), isFileSync: vi.fn(() => false), readFileSync: vi.fn(),
		writeFileSync: vi.fn(), realpathSync: vi.fn((value) => value), traverseTreeSync: vi.fn(),
	};
});

vi.mock("node:module", () => {
	const createRequire = () => vi.fn(() => () => ({}));
	const Module = m.module;
	return { default: Object.assign(Module, { createRequire }), createRequire };
});
vi.mock("node:path", () => ({ default: m.path, ...m.path }));
vi.mock("semver", () => {
	class Range {
		constructor(raw) { if (raw === "invalid") throw new Error("invalid range"); this.raw = raw; }
		test(version) {
			if (this.raw === "*" || this.raw === version) return true;
			if (this.raw.startsWith("^")) return version.split(".")[0] === this.raw.slice(1).split(".")[0];
			return false;
		}
	}
	return { default: { Range }, Range };
});
vi.mock("fs-plus", () => ({
	default: {
		listSync: m.listSync, isFileSync: m.isFileSync, readFileSync: m.readFileSync,
		writeFileSync: m.writeFileSync, realpathSync: m.realpathSync,
		traverseTreeSync: m.traverseTreeSync,
	},
	listSync: m.listSync, isFileSync: m.isFileSync, readFileSync: m.readFileSync,
	writeFileSync: m.writeFileSync, realpathSync: m.realpathSync,
	traverseTreeSync: m.traverseTreeSync,
}));
vi.mock("../src/compile-cache.js", () => ({ default: { register: vi.fn() }, register: vi.fn() }));

let ModuleCache;

const metadata = (overrides = {}) => ({
	_nylasModuleCache: { version: 1, dependencies: [], folders: [], extensions: {}, ...overrides },
});

beforeEach(async () => {
	vi.clearAllMocks();
	m.module._cache = {};
	m.module._pathCache = {};
	m.module._resolveFilename = vi.fn((request) => `fallback:${request}`);
	m.module.prototype = {};
	vi.resetModules();
	// module-cache is CommonJS; exposing the controlled Module object preserves its
	// legacy resolver lifecycle while every imported dependency remains mocked.
	const nodeModule = await import("node:module");
	Object.assign(nodeModule.default, m.module);
	ModuleCache = await import("../src/module-cache.js");
});

describe("module-cache registration", () => {
	it("starts unregistered", () => { expect(ModuleCache.cache.registered).toBe(false); });
});

describe("module-cache additions and resolution", () => {
	it("ignores metadata without a generated cache", () => { ModuleCache.add("/pkg", {}); expect(ModuleCache.cache.dependencies).toEqual({}); });
	it("registers a dependency version", () => { ModuleCache.add("/pkg", metadata({ dependencies: [{ name: "dep", version: "1.0.0", path: "node_modules/dep/index.js" }] })); expect(ModuleCache.cache.dependencies.dep["1.0.0"]).toBe("/pkg/node_modules/dep/index.js"); });
	it("keeps the first path for a duplicate dependency version", () => { const data = metadata({ dependencies: [{ name: "dep", version: "1.0.0", path: "index.js" }] }); ModuleCache.add("/first", data); ModuleCache.add("/second", data); expect(ModuleCache.cache.dependencies.dep["1.0.0"]).toBe("/first/index.js"); });
	it("keeps distinct versions of one dependency", () => { ModuleCache.add("/one", metadata({ dependencies: [{ name: "dep", version: "1.0.0", path: "a.js" }] })); ModuleCache.add("/two", metadata({ dependencies: [{ name: "dep", version: "2.0.0", path: "b.js" }] })); expect(Object.keys(ModuleCache.cache.dependencies.dep)).toEqual(["1.0.0", "2.0.0"]); });
	it("registers compatibility requirements for the package root", () => { ModuleCache.add("/pkg", metadata({ folders: [{ paths: [""], dependencies: { dep: "^1.0.0" } }] })); expect(ModuleCache.cache.folders["/pkg"]).toEqual({ dep: "^1.0.0" }); });
	it("registers compatibility requirements for nested folders", () => { ModuleCache.add("/pkg", metadata({ folders: [{ paths: ["lib"], dependencies: { dep: "*" } }] })); expect(ModuleCache.cache.folders["/pkg/lib"]).toEqual({ dep: "*" }); });
	it("deduplicates extension paths", () => { ModuleCache.add("/pkg", metadata({ extensions: { ".js": ["lib/a.js", "lib/a.js"] } })); expect([...ModuleCache.cache.extensions[".js"]]).toEqual(["/pkg/lib/a.js"]); });
	it("merges extension paths from multiple packages", () => { ModuleCache.add("/one", metadata({ extensions: { ".js": ["a.js"] } })); ModuleCache.add("/two", metadata({ extensions: { ".js": ["b.js"] } })); expect(ModuleCache.cache.extensions[".js"].size).toBe(2); });
});


