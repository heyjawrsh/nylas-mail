import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	buildMime: vi.fn().mockResolvedValue("raw mime"),
	getReplyHeaders: vi.fn(() => ({ inReplyTo: "parent", references: ["root"] })),
	factoryCreate: vi.fn(),
}));

vi.mock("isomorphic-core", () => ({
	Provider: { Gmail: "gmail" },
	Errors: {
		APIError: class APIError extends Error {},
		RetryableError: class RetryableError extends Error {},
	},
	MessageUtils: {
		buildMime: mocks.buildMime,
		getReplyHeaders: mocks.getReplyHeaders,
		buildForSend: vi.fn(),
	},
	TrackingUtils: {
		stripTrackingLinksFromBody: vi.fn((body) => body),
		addRecipientToTrackingLinks: vi.fn(),
	},
	ModelUtils: { copyModelValues: vi.fn() },
}));

vi.mock("../../../src/local-sync-worker/sync-task-factory.js", () => ({
	default: { create: mocks.factoryCreate },
}));

import EnsureMessageInSentFolderIMAP from "../../../src/local-sync-worker/syncback-tasks/ensure-message-in-sent-folder.imap.js";
import SyncUnknownUIDs from "../../../src/local-sync-worker/syncback-tasks/sync-unknown-uids.imap.js";

function logger() {
	return { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
}

function request(props) {
	return { type: "test", status: "NEW", accountId: "account", props };
}

function baseMessage() {
	return {
		id: "message",
		body: "body",
		headerMessageId: "<message@example.com>",
		inReplyToLocalMessageId: "parent-id",
		toJSON: vi.fn(() => ({ id: "message" })),
	};
}

describe("EnsureMessageInSentFolderIMAP", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.Logger = { forAccount: logger };
		mocks.factoryCreate.mockReturnValue({ run: vi.fn().mockResolvedValue(undefined) });
	});

	it("appends non-Gmail sent mail and synchronizes the sent folder", async () => {
		const sent = { id: "sent", name: "Sent" };
		const message = baseMessage();
		const box = { append: vi.fn().mockResolvedValue(undefined) };
		const imap = { openBox: vi.fn().mockResolvedValue(box) };
		const db = {
			Folder: { findOne: vi.fn().mockResolvedValue(sent) },
			Label: { findOne: vi.fn() }, File: {}, Reference: {},
			Message: { findByPk: vi.fn().mockResolvedValueOnce(message).mockResolvedValueOnce(null) },
		};
		const account = { id: "account", provider: "imap" };
		const task = new EnsureMessageInSentFolderIMAP(account, request({ messageId: "message", customSentMessage: false }));
		const result = await task.run(db, imap, { syncWorker: "worker" });

		expect(mocks.buildMime).toHaveBeenCalledWith(message, { includeBcc: true });
		expect(box.append).toHaveBeenCalledWith("raw mime", { flags: "SEEN" });
		expect(mocks.factoryCreate).toHaveBeenCalledWith("FetchNewMessagesInFolder", { account, folder: sent });
		expect(result).toEqual({ id: "message" });
	});

	it("deletes Gmail copies in all mail and trash, then appends one custom copy", async () => {
		const trash = { name: "Trash" };
		const all = { name: "All Mail" };
		const sentLabel = { imapLabelIdentifier: vi.fn(() => "\\Sent") };
		const message = baseMessage();
		const allDeleteBox = { search: vi.fn().mockResolvedValue([10, 11]), moveFromBox: vi.fn(), closeBox: vi.fn() };
		const trashBox = { search: vi.fn().mockResolvedValue([12]), addFlags: vi.fn(), closeBox: vi.fn() };
		const saveBox = { append: vi.fn(), search: vi.fn().mockResolvedValue([20]), setLabels: vi.fn() };
		const imap = { openBox: vi.fn().mockResolvedValueOnce(allDeleteBox).mockResolvedValueOnce(trashBox).mockResolvedValueOnce(saveBox) };
		const db = {
			Folder: { findOne: vi.fn(async ({ where }) => ({ trash, all }[where.role])) },
			Label: { findOne: vi.fn().mockResolvedValue(sentLabel) }, File: {}, Reference: {},
			Message: { findByPk: vi.fn().mockResolvedValueOnce(message).mockResolvedValueOnce({ id: "parent" }) },
		};
		await new EnsureMessageInSentFolderIMAP(
			{ id: "account", provider: "gmail" },
			request({ messageId: "message", customSentMessage: true }),
		).run(db, imap);

		expect(allDeleteBox.search).toHaveBeenCalledWith([["HEADER", "Message-ID", "<message@example.com>"]]);
		expect(allDeleteBox.moveFromBox).toHaveBeenCalledTimes(2);
		expect(trashBox.addFlags).toHaveBeenCalledWith(12, "DELETED");
		expect(saveBox.setLabels).toHaveBeenCalledWith(20, "\\Sent");
		expect(message.inReplyTo).toBe("parent");
	});

	it("rejects a missing local message", async () => {
		const db = { Folder: {}, Label: {}, File: {}, Reference: {}, Message: { findByPk: vi.fn().mockResolvedValue(null) } };
		await expect(new EnsureMessageInSentFolderIMAP(
			{ id: "account", provider: "imap" }, request({ messageId: "gone" }),
		).run(db, {})).rejects.toThrow(/Couldn't find message/);
	});

	it("reports a missing non-Gmail sent folder", async () => {
		const db = {
			Folder: { findOne: vi.fn().mockResolvedValue(null) },
			Label: {}, File: {}, Reference: {},
			Message: { findByPk: vi.fn().mockResolvedValueOnce(baseMessage()).mockResolvedValueOnce(null) },
		};
		await expect(new EnsureMessageInSentFolderIMAP(
			{ id: "account", provider: "imap" }, request({ messageId: "message" }),
		).run(db, {})).rejects.toThrow(/Can't find sent folder/);
	});

	it("reports when Gmail cleanup cannot find trash", async () => {
		const message = baseMessage();
		const allMail = { name: "All Mail" };
		const operation = { run: vi.fn().mockResolvedValue(undefined) };
		mocks.factoryCreate.mockReturnValue(operation);
		const db = {
			Folder: {
				findOne: vi.fn()
					.mockResolvedValueOnce(null)
					.mockResolvedValueOnce(allMail),
			},
			Label: { findOne: vi.fn().mockResolvedValue({ id: "sent" }) },
			File: {}, Reference: {},
			Message: { findByPk: vi.fn().mockResolvedValueOnce(message).mockResolvedValueOnce(null) },
		};
		const task = new EnsureMessageInSentFolderIMAP(
			{ id: "account", provider: "gmail" },
			request({ messageId: "message", customSentMessage: true }),
		);
		await expect(task.run(db, {})).rejects.toThrow(/Could not find folder with role 'trash'/);
		expect(operation.run).not.toHaveBeenCalled();
	});

	it("reports missing Gmail sent metadata", async () => {
		const db = {
			Folder: { findOne: vi.fn().mockResolvedValue({ name: "All Mail" }) },
			Label: { findOne: vi.fn().mockResolvedValue(null) },
			File: {}, Reference: {},
			Message: { findByPk: vi.fn().mockResolvedValueOnce(baseMessage()).mockResolvedValueOnce(null) },
		};
		await expect(new EnsureMessageInSentFolderIMAP(
			{ id: "account", provider: "gmail" }, request({ messageId: "message" }),
		).run(db, {})).rejects.toThrow(/Could not save message to sent folder/);
	});
});

describe("SyncUnknownUIDs", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.Logger = { forAccount: logger };
	});

	it("syncs UIDs in batches and chains the remainder after twenty batches", async () => {
		const operations = [];
		mocks.factoryCreate.mockImplementation(() => {
			const operation = { on: vi.fn(), run: vi.fn().mockResolvedValue(undefined), removeAllListeners: vi.fn(), interrupt: vi.fn() };
			operations.push(operation);
			return operation;
		});
		const uids = Array.from({ length: 505 }, (_, i) => i + 1);
		const syncback = { ...request({ folderId: "folder", uids }), reload: vi.fn().mockResolvedValue(undefined) };
		const create = vi.fn().mockResolvedValue(undefined);
		const db = { Folder: { findByPk: vi.fn().mockResolvedValue({ id: "folder" }) }, SyncbackRequest: { create } };
		await new SyncUnknownUIDs({ id: "account", provider: "imap" }, syncback).run(db, {}, { syncWorker: "worker" });

		expect(mocks.factoryCreate).toHaveBeenCalledTimes(20);
		expect(mocks.factoryCreate).toHaveBeenNthCalledWith(1, "FetchSpecificMessagesInFolder", expect.objectContaining({ uids: uids.slice(0, 25) }));
		expect(create).toHaveBeenCalledWith({ type: "SyncUnknownUIDs", props: { folderId: "folder", uids: uids.slice(500) }, accountId: "account" });
		expect(operations[0].run).toHaveBeenCalledWith(db, {}, { syncWorker: "worker" });
	});

	it("stops before syncing when the request was cancelled", async () => {
		const syncback = { ...request({ folderId: "folder", uids: [1] }), status: "CANCELLED", reload: vi.fn() };
		await new SyncUnknownUIDs({ id: "account", provider: "imap" }, syncback).run(
			{ Folder: { findByPk: vi.fn().mockResolvedValue({ id: "folder" }) } }, {},
		);
		expect(mocks.factoryCreate).not.toHaveBeenCalled();
	});

	it.each([
		[{ folderId: "folder", uids: [] }, /uids are required/],
		[{ uids: [1] }, /folderId is required/],
	])("validates required request properties", async (props, error) => {
		await expect(new SyncUnknownUIDs(
			{ id: "account", provider: "imap" }, { ...request(props), reload: vi.fn() },
		).run({ Folder: { findByPk: vi.fn() } }, {})).rejects.toThrow(error);
	});

	it("rejects a folder that no longer exists", async () => {
		await expect(new SyncUnknownUIDs(
			{ id: "account", provider: "imap" },
			{ ...request({ folderId: "gone", uids: [1] }), reload: vi.fn() },
		).run({ Folder: { findByPk: vi.fn().mockResolvedValue(null) } }, {}))
			.rejects.toThrow(/folder not found/);
	});

	it("interrupts the active operation when cancellation arrives with progress", async () => {
		const operation = { interrupt: vi.fn().mockResolvedValue(undefined) };
		const syncback = { ...request({ folderId: "folder", uids: [1] }), status: "CANCELLED", reload: vi.fn() };
		const task = new SyncUnknownUIDs({ id: "account", provider: "imap" }, syncback);
		task._db = {};
		task._syncOperation = operation;
		await task.onMessageProcessed();
		expect(operation.interrupt).toHaveBeenCalledOnce();
	});
});
