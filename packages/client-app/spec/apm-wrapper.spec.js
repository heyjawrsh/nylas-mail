import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	bufferedOptions: null,
	processErrorHandler: null,
	valid: vi.fn(),
	validRange: vi.fn(),
	satisfies: vi.fn(),
	gt: vi.fn(),
}));

vi.mock("node:module", () => {
	const createRequire = () => vi.fn(() => () => ({}));
	return { default: { createRequire }, createRequire };
});
vi.mock("electron", () => {
	const remote = { app: { quit: vi.fn(), getVersion: vi.fn(), getPath: vi.fn() }, screen: { getPrimaryDisplay: vi.fn() }, dialog: { showMessageBox: vi.fn() }, getCurrentWindow: vi.fn() };
	const electron = { remote, ipcRenderer: { send: vi.fn() }, shell: {} };
	return { default: electron, ...electron };
});
vi.mock("@electron/remote", () => {
	const remote = { app: { quit: vi.fn(), getVersion: vi.fn(), getPath: vi.fn() }, screen: { getPrimaryDisplay: vi.fn() }, dialog: { showMessageBox: vi.fn() }, getCurrentWindow: vi.fn() };
	const electron = { remote, ipcRenderer: { send: vi.fn() }, shell: {} };
	return { default: electron, ...electron };
});
vi.mock("underscore", () => ({ default: {} }));
vi.mock("q", () => ({ default: {} }));
vi.mock("semver", () => ({ default: { valid: m.valid, validRange: m.validRange, satisfies: m.satisfies, gt: m.gt }, valid: m.valid, validRange: m.validRange, satisfies: m.satisfies, gt: m.gt }));
// apm-wrapper is dual-CJS (native pipeline). Its top-level require() of
// buffered-process bypasses vi.mock, so preload the native require cache.
import { createRequire } from "node:module";
const _req = createRequire(new URL("./apm-wrapper.spec.js", import.meta.url));
import { pathToFileURL } from "node:url";
const _bpPath = new URL("../src/buffered-process.js", import.meta.url).pathname;
class _BufferedProcess {
	constructor(options) { m.bufferedOptions = options; }
	onWillThrowError(handler) { m.processErrorHandler = handler; return this; }
}
const _cache = _req.cache || (_req.cache = {});
_cache[_bpPath] = { id: _bpPath, filename: _bpPath, loaded: true, exports: { default: _BufferedProcess } };

import APMWrapper from "../src/apm-wrapper.js";

const packages = {
	getApmPath: vi.fn(() => "/app/apm"), isPackageActive: vi.fn(),
	isPackageDisabled: vi.fn(), isPackageLoaded: vi.fn(), deactivatePackage: vi.fn(),
	unloadPackage: vi.fn(), activatePackage: vi.fn(), loadPackage: vi.fn(),
};

describe("APMWrapper package commands and availability checks", () => {
	let wrapper;
	beforeEach(() => {
		vi.clearAllMocks(); m.bufferedOptions = null; m.processErrorHandler = null;
		globalThis.NylasEnv = { packages, getLoadSettings: () => ({ resourcePath: "/app" }), getConfigDirPath: () => "/config", getVersion: () => "2.1.0" };
		wrapper = new APMWrapper();
	});



	it("parses a successful package response", () => {
		wrapper.runCommand = vi.fn((_args, _options, callback) => callback(0, '[{"name":"x"}]', ""));
		const callback = vi.fn(); wrapper.runCommandReturningPackages([], "failed", callback);
		expect(callback).toHaveBeenCalledWith(null, [{ name: "x" }]);
	});

	it("uses an empty list when apm returns JSON null", () => {
		wrapper.runCommand = vi.fn((_args, _options, callback) => callback(0, "null", ""));
		const callback = vi.fn(); wrapper.runCommandReturningPackages([], "failed", callback);
		expect(callback).toHaveBeenCalledWith(null, []);
	});

	it("reports malformed package JSON with the source text", () => {
		wrapper.runCommand = vi.fn((_args, _options, callback) => callback(0, "not-json", ""));
		const callback = vi.fn(); wrapper.runCommandReturningPackages([], "Fetching failed", callback);
		const error = callback.mock.calls[0][0]; expect(error.message).toBe("Fetching failed"); expect(error.stderr).toContain("not-json");
	});

	it("preserves command output on an unsuccessful response", () => {
		wrapper.runCommand = vi.fn((_args, _options, callback) => callback(2, "out", "err"));
		const callback = vi.fn(); wrapper.runCommandReturningPackages([], "Fetching failed", callback);
		expect(callback.mock.calls[0][0]).toMatchObject({ message: "Fetching failed", stdout: "out", stderr: "err" });
	});

	it("requests installed packages as JSON", () => {
		wrapper.runCommandReturningPackages = vi.fn(() => ({ onWillThrowError: vi.fn() })); wrapper.loadInstalled(vi.fn());
		expect(wrapper.runCommandReturningPackages).toHaveBeenCalledWith(["ls", "--json"], "Fetching local packages failed.", expect.any(Function));
	});

	it("adds theme and compatibility filters to featured requests", () => {
		m.valid.mockReturnValue(true); wrapper.runCommandReturningPackages = vi.fn(() => ({ onWillThrowError: vi.fn() })); wrapper.loadFeatured({ themes: true }, vi.fn());
		expect(wrapper.runCommandReturningPackages.mock.calls[0][0]).toEqual(["featured", "--json", "--themes", "--compatible", "2.1.0"]);
	});


	it("normalizes prerelease app versions for compatible package lookup", () => {
		wrapper.runCommandReturningPackages = vi.fn(() => ({ onWillThrowError: vi.fn() })); globalThis.NylasEnv.getVersion = () => "2.1.0-beta.3"; wrapper.loadCompatiblePackageVersion("calendar", vi.fn());
		expect(wrapper.runCommandReturningPackages.mock.calls[0][0]).toEqual(["view", "calendar", "--json", "--compatible", "2.1.0"]);
	});


	it("rejects an invalid Nylas engine range", () => {
		m.validRange.mockReturnValue(false); expect(wrapper.satisfiesVersion("2.1.0", { engines: { nylas: "nope" } })).toBe(false); expect(m.satisfies).not.toHaveBeenCalled();
	});

	it("does not upgrade a package with an invalid installed version", () => {
		m.valid.mockReturnValue(false); expect(wrapper.canUpgrade({ metadata: { version: "dev" } }, "3.0.0")).toBe(false);
	});


	it("converts process startup errors into command errors", () => {
		wrapper.runCommandReturningPackages = vi.fn(() => ({ onWillThrowError: (handler) => handler({ error: new Error("spawn ENOENT"), handle: vi.fn() }) }));
		const callback = vi.fn(); wrapper.loadPackage("missing", callback);
		expect(callback.mock.calls[0][0]).toMatchObject({ message: "Fetching package 'missing' failed.", stdout: "", stderr: "spawn ENOENT" });
	});
});
