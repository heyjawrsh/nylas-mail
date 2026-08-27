import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/local-sync-worker/imap-helpers.js", () => {
	const forEachFolderOfThread = vi.fn(async ({ threadMessages, callback }) => {
		const messageImapUIDs = threadMessages.map((m) => m.folderImapUID);
		const box = {
			addFlags: vi.fn(async () => {}),
			delFlags: vi.fn(async () => {}),
		};
		await callback({ messageImapUIDs, box });
		return box;
	});
	const setLabelsForMessages = vi.fn(async () => {});
	return {
		default: { forEachFolderOfThread, setLabelsForMessages },
		forEachFolderOfThread,
		setLabelsForMessages,
	};
});

import MarkThreadAsRead from "../../../src/local-sync-worker/syncback-tasks/mark-thread-as-read.imap.js";
import MarkThreadAsUnread from "../../../src/local-sync-worker/syncback-tasks/mark-thread-as-unread.imap.js";
import StarThread from "../../../src/local-sync-worker/syncback-tasks/star-thread.imap.js";
import UnstarThread from "../../../src/local-sync-worker/syncback-tasks/unstar-thread.imap.js";
import { forEachFolderOfThread } from "../../../src/local-sync-worker/imap-helpers.js";
import SyncbackTask from "../../../src/local-sync-worker/syncback-tasks/syncback-task.js";

const account = {
	id: "acct-1",
	emailAddress: "a@example.com",
	provider: "imap",
};

function threadDb({ messages } = {}) {
	const msgs = messages || [
		{ folderImapUID: 11, update: vi.fn(async () => {}) },
		{ folderImapUID: 12, update: vi.fn(async () => {}) },
	];
	const thread = {
		id: "t1",
		getMessages: vi.fn(async () => msgs),
		update: vi.fn(async () => {}),
		folders: [],
		labels: [],
	};
	const db = {
		sequelize: { transaction: async (fn) => fn({}) },
		Thread: { findByPk: vi.fn(async (id) => (id === "t1" ? thread : null)) },
	};
	return { db, thread, msgs };
}

function requestFor(Task, props = {}) {
	return new Task(account, { props, type: "test", status: "NEW" });
}

beforeEach(() => {
	vi.clearAllMocks();
	globalThis.Logger = {
		forAccount: () => ({ info() {}, warn() {}, error() {} }),
		log() {},
	};
});

describe("thread flag syncback tasks", () => {
	it("MarkThreadAsRead flags every message SEEN and persists unread=false", async () => {
		const { db, thread, msgs } = threadDb();
		const task = requestFor(MarkThreadAsRead, { threadId: "t1" });
		await task.run(db, {});
		const call = forEachFolderOfThread.mock.calls[0][0];
		expect(call.threadMessages).toBe(msgs);
		for (const m of msgs) {
			expect(m.update).toHaveBeenCalledWith(
				expect.objectContaining({ unread: false }),
				expect.anything(),
			);
		}
		expect(thread.update).toHaveBeenCalledWith(
			{ unreadCount: 0 },
			expect.anything(),
		);
	});

	it("MarkThreadAsUnread unflags and persists unread=true", async () => {
		const { db, msgs } = threadDb();
		await requestFor(MarkThreadAsUnread, { threadId: "t1" }).run(db, {});
		expect(msgs[0].update).toHaveBeenCalled();
	});

	it("StarThread/UnstarThread flag \\Flagged", async () => {
		const star = threadDb();
		await requestFor(StarThread, { threadId: "t1" }).run(star.db, {});
		expect(star.msgs[0].update).toHaveBeenCalled();
		const unstar = threadDb();
		await requestFor(UnstarThread, { threadId: "t1" }).run(unstar.db, {});
		expect(unstar.msgs[0].update).toHaveBeenCalled();
	});

	it("missing threadId rejects with APIError", async () => {
		const { db } = threadDb();
		await expect(requestFor(MarkThreadAsRead, {}).run(db, {})).rejects.toThrow(
			/threadId is required/,
		);
	});

	it("unknown thread rejects 404", async () => {
		const { db } = threadDb();
		await expect(
			requestFor(MarkThreadAsRead, { threadId: "nope" }).run(db, {}),
		).rejects.toThrow(/Can't find thread/);
	});
});

describe("SyncbackTask base", () => {
	it("requires account and syncbackRequest", () => {
		expect(() => new SyncbackTask(null, {})).toThrow(/requires an account/);
		expect(() => new SyncbackTask(account, null)).toThrow(
			/requires a syncbackRequest/,
		);
	});

	it("abstract methods reject until implemented", async () => {
		const t = new SyncbackTask(account, { props: {}, status: "NEW" });
		expect(() => t.description()).toThrow(/description/);
		expect(() => t.resource()).toThrow(/resource/);
		expect(() => t.affectsImapMessageUIDs()).toThrow(/affectsImapMessageUIDs/);
		await expect(t.run({}, {})).rejects.toThrow(/_run/);
	});

	it("tasks declare their resource class", () => {
		expect(requestFor(MarkThreadAsRead).description()).toContain(
			"MarkThreadAsRead",
		);
		expect(typeof requestFor(MarkThreadAsRead).inProgressStatusType()).toBe(
			"string",
		);
	});
});
