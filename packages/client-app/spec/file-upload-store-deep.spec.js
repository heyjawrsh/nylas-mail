import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	if (!Promise.promisifyAll) {
		Promise.promisifyAll = (target) => target;
	}
	if (!Promise.promisify) {
		Promise.promisify = (fn) => (...args) =>
			new Promise((resolve, reject) => fn(...args, (error, value) => error ? reject(error) : resolve(value)));
	}
	const env = {
		getConfigDirPath: vi.fn(() => "/config"),
		inSpecMode: vi.fn(() => true),
		isMainWindow: vi.fn(() => true),
		showErrorDialog: vi.fn(),
		showOpenDialog: vi.fn(),
	};
	globalThis.NylasEnv = env;
	return {
		env,
		addAttachment: vi.fn(),
		listenTo: vi.fn(),
		mkdirp: vi.fn((dir, callback) => callback?.(null)),
		mkdirpSync: vi.fn(),
		generateTempId: vi.fn(() => "temp-upload"),
		readdirAsync: vi.fn(),
		rmdir: vi.fn((path, callback) => callback?.(null)),
		rmdirAsync: vi.fn(),
		statAsync: vi.fn(),
		unlinkAsync: vi.fn(),
		createReadStream: vi.fn(),
		createWriteStream: vi.fn(),
		rimraf: vi.fn(),
		sessionForClientId: vi.fn(),
	};
});

vi.mock("underscore", () => {
	const underscore = { isString: (value) => typeof value === "string" };
	return { default: underscore, ...underscore };
});
vi.mock("node:fs", () => {
	const fs = {
		createReadStream: m.createReadStream,
		createWriteStream: m.createWriteStream,
		readdirAsync: m.readdirAsync,
		rmdir: m.rmdir,
		rmdirAsync: m.rmdirAsync,
		statAsync: m.statAsync,
		unlinkAsync: m.unlinkAsync,
	};
	return { default: fs, ...fs };
});
vi.mock("node:path", () => {
	const path = {
		basename: (value) => value.split("/").at(-1),
		extname: (value) => { const name = value.split("/").at(-1); const index = name.lastIndexOf("."); return index > 0 ? name.slice(index) : ""; },
		join: (...parts) => parts.join("/"),
	};
	return { default: path, ...path };
});
vi.mock("rimraf", () => ({ default: { rimraf: m.rimraf }, rimraf: m.rimraf }));
vi.mock("mkdirp", () => {
	const mkdirp = Object.assign(m.mkdirp, { sync: m.mkdirpSync });
	return { default: { mkdirp }, mkdirp };
});
vi.mock("nylas-store", () => ({
	default: class NylasStore { listenTo(...args) { return m.listenTo(...args); } },
}));
vi.mock("../src/flux/actions.js", () => ({ default: {
	addAttachment: m.addAttachment,
	ensureMessageInSentSuccess: vi.fn(),
	removeAttachment: vi.fn(),
	selectAttachment: vi.fn(),
} }));
vi.mock("../src/flux/models/utils.js", () => ({ default: { generateTempId: m.generateTempId } }));
vi.mock("../src/flux/models/message.js", () => ({ default: class Message {} }));
vi.mock("../src/flux/stores/draft-store.js", () => ({ default: { sessionForClientId: m.sessionForClientId } }));
vi.mock("../src/flux/stores/database-store.js", () => ({ default: { name: "DatabaseStore" } }));

import FileUploadStore from "../src/flux/stores/file-upload-store.js";

const stats = (size, directory = false) => ({ size, isDirectory: () => directory });
const upload = (overrides = {}) => ({
	id: "upload-1", filename: "report.pdf", messageClientId: "draft-1",
	targetDir: "/config/uploads/draft-1/upload-1",
	targetPath: "/config/uploads/draft-1/upload-1/report.pdf",
	...overrides,
});

describe("FileUploadStore upload lifecycle", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		m.env.isMainWindow.mockReturnValue(true);
		m.env.inSpecMode.mockReturnValue(true);
		m.env.showOpenDialog.mockReset();
		m.statAsync.mockResolvedValue(stats(10));
		m.readdirAsync.mockResolvedValue([]);
		m.unlinkAsync.mockResolvedValue(undefined);
		m.rmdirAsync.mockResolvedValue(undefined);
		m.mkdirp.mockImplementation((dir, callback) => callback?.(null));
	});

	it("creates an upload with a generated id", () => {
		const value = new FileUploadStore.Upload({ messageClientId: "draft-1", filePath: "/tmp/Photo.JPG", stats: stats(12) });
		expect(value.id).toBe("temp-upload");
	});

	it("preserves an explicitly supplied upload id", () => {
		const value = new FileUploadStore.Upload({ messageClientId: "draft-1", filePath: "/tmp/a.txt", stats: stats(1), id: "known" });
		expect(value.id).toBe("known");
	});

	it("derives the filename and target path", () => {
		const value = new FileUploadStore.Upload({ messageClientId: "draft-1", filePath: "/tmp/a.txt", stats: stats(1), id: "known" });
		expect(value).toMatchObject({ filename: "a.txt", targetDir: "/config/uploads/draft-1/known", targetPath: "/config/uploads/draft-1/known/a.txt" });
	});

	it("uses a custom upload directory", () => {
		const value = new FileUploadStore.Upload({ messageClientId: "draft-1", filePath: "/tmp/a.txt", stats: stats(1), uploadDir: "/custom", id: "known" });
		expect(value.targetPath).toBe("/custom/draft-1/known/a.txt");
	});

	it("reports a lowercase extension without the dot", () => {
		const value = new FileUploadStore.Upload({ messageClientId: "draft-1", filePath: "/tmp/Photo.JPG", stats: stats(1) });
		expect(value.extension).toBe("jpg");
	});

	it("reports an empty extension for an extensionless file", () => {
		const value = new FileUploadStore.Upload({ messageClientId: "draft-1", filePath: "/tmp/README", stats: stats(1) });
		expect(value.extension).toBe("");
	});

	it("rejects handler calls without a draft id", () => {
		expect(() => FileUploadStore._onSelectAttachment({})).toThrow("ID of the message");
	});

	it("returns file stats", async () => {
		const value = stats(42);
		m.statAsync.mockResolvedValue(value);
		await expect(FileUploadStore._getFileStats("/tmp/a")).resolves.toBe(value);
	});

	it("translates stat failures into a useful file error", async () => {
		m.statAsync.mockRejectedValue(new Error("EACCES"));
		await expect(FileUploadStore._getFileStats("/tmp/a")).rejects.toThrow("could not be found, or has invalid file permissions");
	});

	it("aggregates the sizes of every directory entry", async () => {
		m.readdirAsync.mockResolvedValue(["a", "b", "c"]);
		m.statAsync.mockResolvedValueOnce(stats(2)).mockResolvedValueOnce(stats(3)).mockResolvedValueOnce(stats(5));
		await expect(FileUploadStore._getTotalDirSize("/uploads")).resolves.toBe(10);
	});

	it("copies an upload when the read stream ends", async () => {
		const handlers = {};
		const writer = { on: vi.fn() };
		const reader = { on: vi.fn((event, fn) => { handlers[event] = fn; }), pipe: vi.fn(() => queueMicrotask(handlers.end)) };
		m.createReadStream.mockReturnValue(reader);
		m.createWriteStream.mockReturnValue(writer);
		const value = upload();
		await expect(FileUploadStore._copyUpload(value)).resolves.toBe(value);
		expect(reader.pipe).toHaveBeenCalledWith(writer);
	});

	it("rejects a copy when reading fails", async () => {
		const handlers = {};
		m.createReadStream.mockReturnValue({ on: vi.fn((event, fn) => { handlers[event] = fn; }), pipe: vi.fn(() => queueMicrotask(handlers.error)) });
		m.createWriteStream.mockReturnValue({ on: vi.fn() });
		await expect(FileUploadStore._copyUpload(upload())).rejects.toThrow("Could not read file at path");
	});

	it("rejects a copy when writing fails", async () => {
		const handlers = {};
		m.createReadStream.mockReturnValue({ on: vi.fn(), pipe: vi.fn(() => queueMicrotask(handlers.error)) });
		m.createWriteStream.mockReturnValue({ on: vi.fn((event, fn) => { handlers[event] = fn; }) });
		await expect(FileUploadStore._copyUpload(upload())).rejects.toThrow("Could not write report.pdf");
	});

	it("deletes the upload file and its containing directory", async () => {
		await expect(FileUploadStore._deleteUpload(upload())).resolves.toMatchObject({ id: "upload-1" });
		expect(m.unlinkAsync).toHaveBeenCalledWith("/config/uploads/draft-1/upload-1/report.pdf");
		expect(m.rmdirAsync).toHaveBeenCalledWith("/config/uploads/draft-1/upload-1");
	});

	it("wraps deletion failures with the upload filename", async () => {
		m.unlinkAsync.mockRejectedValue(new Error("locked"));
		await expect(FileUploadStore._deleteUpload(upload())).rejects.toThrow("Error deleting file upload report.pdf");
	});

	it("removes all uploads for a draft without glob expansion", () => {
		FileUploadStore._deleteUploadsForClientId("draft-1");
		expect(m.rimraf).toHaveBeenCalledWith("/config/uploads/draft-1", { disableGlob: true }, expect.any(Function));
	});

	it("applies transformed uploads to the editing session", async () => {
		const add = vi.fn();
		m.sessionForClientId.mockResolvedValue({ draft: () => ({ uploads: [upload()] }), changes: { add } });
		await FileUploadStore._applySessionChanges("draft-1", (items) => items.slice(1));
		expect(add).toHaveBeenCalledWith({ uploads: [] });
	});

	it("opens the native picker with multi-selection enabled", () => {
		FileUploadStore._onSelectAttachment({ messageClientId: "draft-1" });
		expect(m.env.showOpenDialog).toHaveBeenCalledWith({ properties: ["openFile", "multiSelections"] }, expect.any(Function));
	});

	it("dispatches one attachment action for a string picker result", () => {
		m.env.showOpenDialog.mockImplementation((options, callback) => callback("/tmp/a.txt"));
		FileUploadStore._onSelectAttachment({ messageClientId: "draft-1" });
		expect(m.addAttachment).toHaveBeenCalledWith({ messageClientId: "draft-1", filePath: "/tmp/a.txt" });
	});

	it("dispatches every selected picker path", () => {
		m.env.showOpenDialog.mockImplementation((options, callback) => callback(["/tmp/a", "/tmp/b"]));
		FileUploadStore._onSelectAttachment({ messageClientId: "draft-1" });
		expect(m.addAttachment.mock.calls.map(([arg]) => arg.filePath)).toEqual(["/tmp/a", "/tmp/b"]);
	});

	it("does nothing when the picker is cancelled", () => {
		m.env.showOpenDialog.mockImplementation((options, callback) => callback(null));
		FileUploadStore._onSelectAttachment({ messageClientId: "draft-1" });
		expect(m.addAttachment).not.toHaveBeenCalled();
	});

	it("creates, copies, records, and announces a valid upload", async () => {
		const created = vi.fn();
		const apply = vi.spyOn(FileUploadStore, "_applySessionChanges").mockResolvedValue(undefined);
		const copy = vi.spyOn(FileUploadStore, "_copyUpload").mockResolvedValue(undefined);
		await FileUploadStore._onAddAttachment({ messageClientId: "draft-1", filePath: "/tmp/a.txt", inline: true, onUploadCreated: created });
		expect(copy).toHaveBeenCalledWith(expect.objectContaining({ inline: true, filename: "a.txt" }));
		expect(apply).toHaveBeenCalledWith("draft-1", expect.any(Function));
		expect(created).toHaveBeenCalledWith(expect.objectContaining({ filename: "a.txt" }));
	});

	it("shows an error instead of copying a directory", async () => {
		m.statAsync.mockResolvedValue(stats(1, true));
		const copy = vi.spyOn(FileUploadStore, "_copyUpload");
		await FileUploadStore._onAddAttachment({ messageClientId: "draft-1", filePath: "/tmp/folder" });
		expect(m.env.showErrorDialog).toHaveBeenCalledWith(expect.stringContaining("is a directory"));
		expect(copy).not.toHaveBeenCalled();
	});

	it("shows an error for a file larger than 25MB", async () => {
		m.statAsync.mockResolvedValue(stats(25000001));
		await FileUploadStore._onAddAttachment({ messageClientId: "draft-1", filePath: "/tmp/huge.zip" });
		expect(m.env.showErrorDialog).toHaveBeenCalledWith(expect.stringContaining("larger than 25MB"));
	});

	it("shows an error when aggregate upload size exceeds the limit", async () => {
		vi.spyOn(FileUploadStore, "_getTotalDirSize").mockResolvedValue(25000001);
		await FileUploadStore._onAddAttachment({ messageClientId: "draft-1", filePath: "/tmp/a.txt" });
		expect(m.env.showErrorDialog).toHaveBeenCalledWith("Can't upload more than 15MB of attachments");
	});

	it("removes an upload from the editing session and disk", async () => {
		const apply = vi.spyOn(FileUploadStore, "_applySessionChanges").mockResolvedValue(undefined);
		const remove = vi.spyOn(FileUploadStore, "_deleteUpload").mockResolvedValue(upload());
		await FileUploadStore._onRemoveAttachment(upload());
		expect(apply.mock.calls[0][1]([upload(), upload({ id: "keep" })])).toEqual([expect.objectContaining({ id: "keep" })]);
		expect(remove).toHaveBeenCalledOnce();
	});

	it("treats removing no upload as a completed no-op", async () => {
		await expect(FileUploadStore._onRemoveAttachment(null)).resolves.toBeUndefined();
		expect(m.unlinkAsync).not.toHaveBeenCalled();
	});

	it("ignores database changes outside the main window", () => {
		m.env.isMainWindow.mockReturnValue(false);
		FileUploadStore._onDataChanged({ objectClass: "Message", type: "unpersist", objects: [{ clientId: "draft-1" }] });
		expect(m.rimraf).not.toHaveBeenCalled();
	});

	it("ignores database changes that are not message removals", () => {
		FileUploadStore._onDataChanged({ objectClass: "Other", type: "persist", objects: [{ clientId: "draft-1" }] });
		expect(m.rimraf).not.toHaveBeenCalled();
	});

	it("cleans uploads for every unpersisted message", () => {
		FileUploadStore._onDataChanged({ objectClass: "Message", type: "unpersist", objects: [{ clientId: "a" }, { clientId: "b" }] });
		expect(m.rimraf.mock.calls.map(([path]) => path)).toEqual(["/config/uploads/a", "/config/uploads/b"]);
	});

	it("presents attachment errors through the environment", () => {
		FileUploadStore._onAttachFileError(new Error("broken"));
		expect(m.env.showErrorDialog).toHaveBeenCalledWith("broken");
	});
});
