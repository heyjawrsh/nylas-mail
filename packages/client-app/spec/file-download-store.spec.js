import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	globalThis.NylasEnv = {
		getConfigDirPath: () => "/tmp/nylas-download-spec",
		config: { get: vi.fn() },
		savedState: {},
		reportError: vi.fn(),
	};
	return { showMessageBox: vi.fn(), listenTo: vi.fn() };
});

vi.mock("nylas-store", () => ({
	default: class NylasStore { listenTo(...args) { mocks.listenTo(...args); } trigger() {} },
}));
vi.mock("../src/flux/actions.js", () => ({
	default: {
		fetchFile: {}, fetchAndOpenFile: {}, fetchAndSaveFile: {}, fetchAndSaveAllFiles: {}, abortFetchFile: {},
		recordPerfMetric: vi.fn(),
	},
}));
vi.mock("../src/flux/nylas-api.js", () => ({ default: {} }));
vi.mock("../src/flux/nylas-api-request.js", () => ({ default: class NylasAPIRequest {} }));
vi.mock("@electron/remote", () => {
	const remote = { dialog: { showMessageBox: mocks.showMessageBox } };
	return { default: remote, ...remote, remote };
});
vi.mock("electron", () => ({ remote: { dialog: { showMessageBox: mocks.showMessageBox } } }));
vi.mock("request-progress", () => ({ default: vi.fn() }));

import fileDownloadStore, { Download } from "../src/flux/stores/file-download-store.js";

const file = { id: "f1", accountId: "a1", size: 12, safeDisplayName: () => "report.pdf", displayName: () => "report.pdf" };

describe("Download", () => {
	it("requires an account", () => {
		expect(() => new Download({ fileId: "f", filename: "x", targetPath: "/tmp/x" })).toThrow("accountId");
	});

	it("requires a filename", () => {
		expect(() => new Download({ accountId: "a", fileId: "f", targetPath: "/tmp/x" })).toThrow("filename");
	});

	it("requires a file id and target path", () => {
		expect(() => new Download({ accountId: "a", filename: "x", targetPath: "/tmp/x" })).toThrow("fileID");
		expect(() => new Download({ accountId: "a", fileId: "f", filename: "x" })).toThrow("target path");
	});

	it("returns frozen public data", () => {
		const download = new Download({ accountId: "a", fileId: "f", filename: "x", targetPath: "/tmp/x", filesize: 10 });
		expect(download.data()).toMatchObject({ fileId: "f", filename: "x", percent: 0, state: "unstarted" });
		expect(Object.isFrozen(download.data())).toBe(true);
	});
});

describe("FileDownloadStore", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		store = new fileDownloadStore.constructor();
		vi.spyOn(store, "trigger").mockImplementation(() => {});
	});

	it("returns a safe per-file download path", () => {
		expect(store.pathForFile(file)).toContain("f1/report.pdf");
		expect(store.pathForFile(null)).toBeNull();
	});

	it("returns null for unknown download data", () => {
		expect(store.getDownloadDataForFile("missing")).toBeNull();
	});

	it("maps requested download and preview data by id", () => {
		store._downloads.f1 = { data: () => ({ percent: 50 }) };
		store._filePreviewPaths.f1 = "/tmp/preview.png";
		expect(store.getDownloadDataForFiles(["f1", "f2"])).toEqual({ f1: { percent: 50 }, f2: null });
		expect(store.previewPathsForFiles(["f1"])).toEqual({ f1: "/tmp/preview.png" });
	});

	it("presents file failures with the actual display name", () => {
		store._presentError({ file, error: new Error("offline") });
		expect(mocks.showMessageBox).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.stringContaining("report.pdf") }));
	});

	it("resolves handled filesystem errors and rejects unknown ones", async () => {
		await expect(store._catchFSErrors({ code: "ENOSPC", message: "full" })).resolves.toBeUndefined();
		await expect(store._catchFSErrors({ code: "ENOENT" })).rejects.toEqual({ code: "ENOENT" });
	});
});
