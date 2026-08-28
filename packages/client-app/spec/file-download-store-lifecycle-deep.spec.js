import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	globalThis.NylasEnv = {
		getConfigDirPath: vi.fn(() => "/config"),
		config: { get: vi.fn(() => false) },
		savedState: {},
		reportError: vi.fn(),
		showOpenDialog: vi.fn(),
		showSaveDialog: vi.fn(),
	};
	return {
		accessAsync: vi.fn(),
		createReadStream: vi.fn(),
		createWriteStream: vi.fn(),
		exists: vi.fn(),
		existsSync: vi.fn(),
		listenTo: vi.fn(),
		mkdirp: vi.fn(() => Promise.resolve()),
		openItem: vi.fn(),
		progress: vi.fn((request) => request),
		recordPerfMetric: vi.fn(),
		requestInstances: [],
		showItemInFolder: vi.fn(),
		showMessageBox: vi.fn(),
		statAsync: vi.fn(),
		trigger: vi.fn(),
		unlink: vi.fn(),
		unlinkSync: vi.fn(),
	};
});

vi.mock("bluebird", () => ({ default: Promise }));
vi.mock("underscore", () => {
	const underscore = { clone: (value) => ({ ...value }) };
	return { default: underscore, ...underscore };
});
vi.mock("node:os", () => {
	const os = { tmpdir: vi.fn(() => "/system-tmp") };
	return { default: os, ...os };
});
vi.mock("node:fs", () => {
	const fs = {
		F_OK: 0,
		accessAsync: m.accessAsync,
		createReadStream: m.createReadStream,
		createWriteStream: m.createWriteStream,
		exists: m.exists,
		existsSync: m.existsSync,
		statAsync: m.statAsync,
		unlink: m.unlink,
		unlinkSync: m.unlinkSync,
	};
	return { default: fs, ...fs };
});
vi.mock("node:path", () => {
	const path = {
		dirname: (value) => value.split("/").slice(0, -1).join("/") || "/",
		extname: (value) => { const name = value.split("/").at(-1); const dot = name.lastIndexOf("."); return dot > 0 ? name.slice(dot) : ""; },
		join: (...parts) => parts.filter((part) => part !== "").join("/").replace(/\/{2,}/g, "/"),
	};
	return { default: path, ...path };
});
vi.mock("isomorphic-core", () => {
	const core = { ShellUtils: { spawn: vi.fn() } };
	return { default: core, ...core };
});
vi.mock("electron", () => {
	const shell = { openItem: m.openItem, showItemInFolder: m.showItemInFolder };
	const remote = { dialog: { showMessageBox: m.showMessageBox } };
	return { default: { shell, remote }, shell, remote };
});
vi.mock("@electron/remote", () => {
	const remote = { dialog: { showMessageBox: m.showMessageBox } };
	return { default: { remote, ...remote }, ...remote, remote };
});
vi.mock("mkdirp", () => ({ default: { mkdirp: m.mkdirp }, mkdirp: m.mkdirp }));
vi.mock("request-progress", () => ({ default: m.progress }));
vi.mock("nylas-store", () => ({
	default: class NylasStore {
		listenTo(...args) { return m.listenTo(...args); }
		trigger(...args) { return m.trigger(...args); }
	},
}));
vi.mock("../src/flux/actions.js", () => ({ default: {
	abortFetchFile: vi.fn(), fetchAndOpenFile: vi.fn(), fetchAndSaveAllFiles: vi.fn(),
	fetchAndSaveFile: vi.fn(), fetchFile: vi.fn(), recordPerfMetric: m.recordPerfMetric,
} }));
vi.mock("../src/flux/nylas-api.js", () => ({ default: { name: "NylasAPI" } }));
vi.mock("../src/flux/nylas-api-request.js", () => ({
	default: class NylasAPIRequest {
		constructor(config) { this.config = config; m.requestInstances.push(this); }
		run() { return this.config.options.started(makeRequest()); }
	},
}));

import fileDownloadStore, { Download } from "../src/flux/stores/file-download-store.js";

function makeRequest(statusCode = 200) {
	const handlers = {};
	return {
		abort: vi.fn(),
		handlers,
		on: vi.fn(function on(event, callback) { handlers[event] = callback; return this; }),
		pipe: vi.fn(function pipe() { return this; }),
		response: { statusCode },
	};
}

function makeDownload(overrides = {}) {
	return new Download({
		accountId: "a1", fileId: "f1", filename: "report.pdf", filesize: 200,
		targetPath: "/config/downloads/f1/report.pdf", progressCallback: vi.fn(),
		...overrides,
	});
}

const file = (overrides = {}) => ({
	id: "f1", accountId: "a1", size: 200,
	displayName: () => "report.pdf", safeDisplayName: () => "report.pdf",
	displayExtension: () => "pdf", ...overrides,
});

describe("File download lifecycle deep coverage", () => {
	let store;
	let stream;

	beforeEach(() => {
		vi.clearAllMocks();
		m.requestInstances.length = 0;
		NylasEnv.savedState = {};
		stream = { end: vi.fn() };
		m.createWriteStream.mockReturnValue(stream);
		m.existsSync.mockReturnValue(false);
		m.statAsync.mockRejectedValue(new Error("ENOENT"));
		store = new fileDownloadStore.constructor();
	});

	it("starts a new download as unstarted", () => {
		expect(makeDownload().state).toBe(Download.State.Unstarted);
	});

	it("starts a new download at zero percent", () => {
		expect(makeDownload().percent).toBe(0);
	});

	it("moves to downloading when run begins", () => {
		const download = makeDownload();
		download.run();
		expect(download.state).toBe(Download.State.Downloading);
	});

	it("opens its target path for writing", () => {
		makeDownload().run();
		expect(m.createWriteStream).toHaveBeenCalledWith("/config/downloads/f1/report.pdf");
	});

	it("requests the file bytes without JSON decoding", () => {
		makeDownload().run();
		expect(m.requestInstances[0].config.options).toMatchObject({ json: false, encoding: null });
	});

	it("requests the account-scoped download endpoint", () => {
		makeDownload().run();
		expect(m.requestInstances[0].config.options).toMatchObject({ path: "/files/f1/download", accountId: "a1" });
	});

	it("counts each started request attempt", () => {
		const download = makeDownload();
		download.run();
		expect(download.attempts).toBe(1);
	});

	it("derives percent directly from request progress", () => {
		const download = makeDownload();
		download.run();
		download.request.handlers.progress({ percent: 37.5 });
		expect(download.percent).toBe(37.5);
	});

	it("announces progress after updating the percent", () => {
		const progressCallback = vi.fn();
		const download = makeDownload({ progressCallback });
		download.run();
		download.request.handlers.progress({ percent: 62 });
		expect(progressCallback).toHaveBeenCalledOnce();
	});

	it("moves to finished after a successful response", async () => {
		const download = makeDownload();
		const promise = download.run();
		download.request.handlers.end();
		await promise;
		expect(download.state).toBe(Download.State.Finished);
	});

	it("sets completed downloads to one hundred percent", async () => {
		const download = makeDownload();
		const promise = download.run();
		download.request.handlers.end();
		await promise;
		expect(download.percent).toBe(100);
	});

	it("ends the output stream after success", async () => {
		const download = makeDownload();
		const promise = download.run();
		download.request.handlers.end();
		await promise;
		expect(stream.end).toHaveBeenCalledOnce();
	});

	it("accepts a 202 response as successful", async () => {
		const download = makeDownload();
		const promise = download.run();
		download.request.response.statusCode = 202;
		download.request.handlers.end();
		await expect(promise).resolves.toBe(download);
	});

	it("moves to failed after an HTTP failure", async () => {
		const download = makeDownload();
		const promise = download.run();
		download.request.response.statusCode = 500;
		download.request.handlers.end();
		await expect(promise).rejects.toThrow("Server returned a 500");
		expect(download.state).toBe(Download.State.Failed);
	});

	it("removes a partial file after failure", async () => {
		m.existsSync.mockReturnValue(true);
		const download = makeDownload();
		const promise = download.run();
		download.request.handlers.error(new Error("offline"));
		await expect(promise).rejects.toThrow("offline");
		expect(m.unlinkSync).toHaveBeenCalledWith(download.targetPath);
	});

	it("returns the same promise when run twice", () => {
		const download = makeDownload();
		expect(download.run()).toBe(download.run());
	});

	it("aborts an active request when closed", () => {
		const download = makeDownload();
		download.run();
		const request = download.request;
		download.ensureClosed();
		expect(request.abort).toHaveBeenCalledOnce();
	});

	it("does not abort before a request exists", () => {
		expect(() => makeDownload().ensureClosed()).not.toThrow();
	});

	it("returns detached frozen download data", () => {
		const download = makeDownload();
		const data = download.data();
		download.percent = 80;
		expect(data.percent).toBe(0);
		expect(Object.isFrozen(data)).toBe(true);
	});

	it("reports stored download data for a file", () => {
		store._downloads.f1 = makeDownload();
		expect(store.getDownloadDataForFile("f1")).toMatchObject({ state: "unstarted", percent: 0 });
	});

	it("maps missing and active download data independently", () => {
		store._downloads.f1 = makeDownload();
		expect(store.getDownloadDataForFiles(["f1", "missing"])).toEqual({
			f1: expect.objectContaining({ fileId: "f1" }), missing: null,
		});
	});

	it("uses the configured download directory for file paths", () => {
		expect(store.pathForFile(file())).toBe("/config/downloads/f1/report.pdf");
	});

	it("creates a missing per-file download folder", async () => {
		await store._prepareFolder(file());
		expect(m.mkdirp).toHaveBeenCalledWith("/config/downloads/f1");
	});


	it("treats a full-sized file as already downloaded", async () => {
		m.statAsync.mockResolvedValue({ size: 200 });
		await expect(store._checkForDownloadedFile(file())).resolves.toBe(true);
	});

	it("treats a short file as requiring download", async () => {
		m.statAsync.mockResolvedValue({ size: 199 });
		await expect(store._checkForDownloadedFile(file())).resolves.toBe(false);
	});

	it("uses the OS temporary directory when Downloads is absent", () => {
		m.existsSync.mockReturnValue(false);
		expect(store._defaultSaveDir()).toBe("/system-tmp");
	});

	it("uses an existing remembered download directory", () => {
		NylasEnv.savedState.lastDownloadDirectory = "/remembered";
		m.existsSync.mockImplementation((value) => value === "/remembered");
		expect(store._defaultSaveDir()).toBe("/remembered");
	});

	it("appends a safe filename to the fallback temporary path", () => {
		m.existsSync.mockReturnValue(false);
		expect(store._defaultSavePath(file())).toBe("/system-tmp/report.pdf");
	});

	it("aborting a stored download closes its request", () => {
		const download = makeDownload();
		download.run();
		store._downloads.f1 = download;
		store._abortFetchFile(file());
		expect(download.request.abort).toHaveBeenCalledOnce();
	});

	it("aborting removes an existing partial download asynchronously", () => {
		store._downloads.f1 = { ensureClosed: vi.fn() };
		m.exists.mockImplementation((path, callback) => callback(true));
		store._abortFetchFile(file());
		expect(m.unlink).toHaveBeenCalledWith("/config/downloads/f1/report.pdf");
	});
});
