import { createRequire } from "node:module";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	listSync: vi.fn(() => []), readdir: vi.fn(), stat: vi.fn(), unlink: vi.fn(),
	createWriteStream: vi.fn(), sendSync: vi.fn(), openItem: vi.fn(),
	crashStart: vi.fn(), getPath: vi.fn(() => "/tmp"), hostname: vi.fn(() => "mail-host"),
}));

vi.mock("node:os", () => ({ default: { hostname: m.hostname }, hostname: m.hostname }));
vi.mock("fs-plus", () => {
	const fs = { listSync: m.listSync, readdir: m.readdir, stat: m.stat, unlink: m.unlink, createWriteStream: m.createWriteStream };
	return { default: fs, ...fs };
});
vi.mock("node:path", () => {
	const path = { join: (...parts) => parts.join("/"), basename: (value) => value.split("/").pop() };
	return { default: path, ...path };
});
vi.mock("electron", () => {
	const electron = {
		app: { getPath: m.getPath }, crashReporter: { start: m.crashStart },
		ipcRenderer: { sendSync: m.sendSync }, shell: { openItem: m.openItem },
	};
	return { default: electron, ...electron };
});
vi.mock("@electron/remote", () => {
	const remote = { app: { getPath: m.getPath }, process: { pid: 4321 } };
	return { default: remote, ...remote, remote };
});

const originalType = process.type;
process.type = "renderer";
const { default: ErrorLogger } = await import("../src/error-logger.js");

function logger(overrides = {}) {
	return new ErrorLogger({ inSpecMode: true, inDevMode: false, resourcePath: "/resource", ...overrides });
}

function reportingLogger(overrides = {}) {
	const instance = logger(overrides);
	instance.inSpecMode = false;
	return instance;
}

describe("ErrorLogger setup and formatting", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		m.listSync.mockReturnValue([]);
		process.type = "renderer";
	});


	it("adds enumerable error details to JSON serialization", () => {
		logger();
		const error = new Error("broken"); error.code = "E_BROKEN";
		expect(JSON.parse(JSON.stringify(error))).toEqual(expect.objectContaining({ message: "broken", code: "E_BROKEN" }));
	});

	it("ignores hidden extension files", () => {
		m.listSync.mockReturnValue(["/extensions/.hidden"]);
		expect(logger().extensions).toEqual([]);
	});



	it("does not report errors in spec mode", () => {
		const instance = logger(); instance._appendLog = vi.fn(); instance.reportError(new Error("ignored"));
		expect(instance._appendLog).not.toHaveBeenCalled();
	});




	it("starts the crash reporter with uploads off and no submit URL (#8)", () => {
		// error-logger.js is CommonJS, so it gets electron through native
		// require (spec/setup.js's bridge), not through vi.mock.
		const { crashReporter } = createRequire(import.meta.url)("electron");
		const start = vi.spyOn(crashReporter, "start").mockImplementation(() => {});
		logger(); // the constructor starts it
		expect(start).toHaveBeenCalledTimes(1);
		expect(start.mock.calls[0][0]).toStrictEqual({
			productName: "Nylas Mail",
			uploadToServer: false,
		});
		start.mockRestore();
	});

	it("forwards API errors to the log and extensions", () => {
		const instance = logger(); instance._appendLog = vi.fn(); instance._notifyExtensions = vi.fn();
		const error = { statusCode: 429, message: "slow down" }; instance.apiDebug(error);
		expect(instance._appendLog).toHaveBeenCalledWith(error, 429, "slow down");
		expect(instance._notifyExtensions).toHaveBeenCalledWith("onDidLogAPIError", error);
	});

	it("notifies every extension with the requested arguments", () => {
		const instance = logger(); const first = { reportError: vi.fn() }; const second = { reportError: vi.fn() };
		instance.extensions = [first, second]; instance._notifyExtensions("reportError", "error", { x: 1 });
		expect(first.reportError).toHaveBeenCalledWith("error", { x: 1 });
		expect(second.reportError).toHaveBeenCalledWith("error", { x: 1 });
	});

	it("writes structured JSON lines to the log stream", () => {
		const instance = reportingLogger(); instance.loghost = "mail-host"; instance.logstream = { write: vi.fn() };
		instance._appendLog({ event: "started" });
		const line = instance.logstream.write.mock.calls[0][0];
		expect(JSON.parse(line)).toEqual(expect.objectContaining({ host: "mail-host", payload: { event: "started" } }));
	});

	it("prints enabled development debug output and always appends it", () => {
		const instance = logger({ inDevMode: true }); instance._appendLog = vi.fn();
		const log = vi.spyOn(console, "log").mockImplementation(() => {}); instance._consoleDebug(true, "sync", 3);
		expect(log).toHaveBeenCalledWith("sync", 3);
		expect(instance._appendLog).toHaveBeenCalledWith(["sync", 3]);
	});
});

afterAll(() => { process.type = originalType; });
