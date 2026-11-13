// src/browser/main.js starts the app normally when Windows passes a
// Squirrel startup argument: there's no Squirrel branch, nothing quits early,
// and the Squirrel helper module is never loaded.
//
// main.js is a CommonJS entry point that runs start() when loaded, so it runs
// here as a module function with a fake require, process and global.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const browserDir = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../src/browser",
);
const mainFile = path.join(browserDir, "main.js");
const resourcePath = path.resolve(browserDir, "../..");
const realRequire = createRequire(mainFile);

function runMain(argv) {
	const app = {
		getVersion: vi.fn(() => "2.1.0"),
		getPath: vi.fn(() => "/tmp/nylas-main-spec-home"),
		setAppUserModelId: vi.fn(),
		requestSingleInstanceLock: vi.fn(() => true),
		on: vi.fn(),
		removeListener: vi.fn(),
		quit: vi.fn(),
		exit: vi.fn(),
	};
	const applicationStart = vi.fn();
	class Application {
		start(options) {
			applicationStart(options);
		}
		once() {}
	}
	const required = [];
	const modules = {
		electron: { app },
		mkdirp: { sync: vi.fn() },
		"../error-logger.js": class {
			reportError() {}
		},
		"../compile-cache.js": { setHomeDirectory: vi.fn() },
		"@electron/remote/main": { initialize: vi.fn() },
		[path.join(resourcePath, "src", "browser", "application")]: {
			default: Application,
		},
	};
	const passThrough = new Set(["node:util", "node:path", "optimist"]);
	const fakeRequire = (id) => {
		required.push(id);
		if (Object.hasOwn(modules, id)) return modules[id];
		if (passThrough.has(id)) return realRequire(id);
		throw new Error(`main.js spec: unexpected require("${id}")`);
	};
	const fakeProcess = {
		argv,
		platform: "win32",
		env: {},
		type: "browser",
		on: vi.fn(),
		exit: vi.fn(),
		stdout: { write: vi.fn() },
	};
	const fakeGlobal = {};
	const savedInspect = console.inspect;
	try {
		const body = readFileSync(mainFile, "utf8");
		// the CommonJS module wrapper, with the fakes in place of the real ones
		const moduleFn = new Function(
			"require",
			"module",
			"exports",
			"__dirname",
			"__filename",
			"process",
			"global",
			body,
		);
		const module = { exports: {} };
		moduleFn(
			fakeRequire,
			module,
			module.exports,
			browserDir,
			mainFile,
			fakeProcess,
			fakeGlobal,
		);
	} finally {
		console.inspect = savedInspect;
	}
	const ready = () => {
		const call = app.on.mock.calls.find(([event]) => event === "ready");
		if (!call) throw new Error("no ready handler");
		call[1]();
	};
	return { app, applicationStart, required, ready, fakeProcess };
}

describe("main.js startup with a Squirrel argument", () => {
	it.each([
		"--squirrel-install",
		"--squirrel-updated",
		"--squirrel-uninstall",
		"--squirrel-obsolete",
		"--squirrel-firstrun",
	])("starts normally with %s", (flag) => {
		const run = runMain(["C:\\Nylas Mail\\Nylas Mail.exe", flag, "2.1.0"]);

		expect(run.app.setAppUserModelId).toHaveBeenCalledWith(
			"com.nylas.nylas-mail",
		);
		expect(run.app.quit).not.toHaveBeenCalled();
		expect(run.fakeProcess.exit).not.toHaveBeenCalled();
		expect(run.app.requestSingleInstanceLock).toHaveBeenCalled();
		expect(run.required.some((id) => id.includes("windows-updater"))).toBe(
			false,
		);

		run.ready();
		expect(run.applicationStart).toHaveBeenCalledTimes(1);
		expect(run.applicationStart.mock.calls[0][0]).toMatchObject({
			resourcePath,
			urlsToOpen: [],
			pathsToOpen: [],
		});
		expect(run.app.quit).not.toHaveBeenCalled();
	});
});
