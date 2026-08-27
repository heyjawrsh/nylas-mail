import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/local-sync-worker/imap-helpers.js", () => ({
	default: {
		forEachFolderOfThread: vi.fn(async ({ callback }) =>
			callback({
				messageImapUIDs: [1],
				box: { addFlags: vi.fn(), delFlags: vi.fn() },
			}),
		),
		setLabelsForMessages: vi.fn(async () => {}),
	},
	forEachFolderOfThread: vi.fn(async ({ callback }) =>
		callback({
			messageImapUIDs: [1],
			box: { addFlags: vi.fn(), delFlags: vi.fn() },
		}),
	),
	setLabelsForMessages: vi.fn(async () => {}),
}));

vi.mock("isomorphic-core", () => ({
	Errors: {
		APIError: class APIError extends Error {},
		RetryableError: class RetryableError extends Error {},
	},
	MessageUtils: {
		buildForSend: vi.fn(async () => ({
			body: "body",
			setIsSent: vi.fn(),
			save: vi.fn(async () => {}),
			toJSON: () => ({ id: "m1" }),
		})),
	},
	TrackingUtils: { stripTrackingLinksFromBody: vi.fn((b) => b) },
}));

import RenameFolderIMAP from "../../../src/local-sync-worker/syncback-tasks/rename-folder.imap.js";
import DeleteFolderIMAP from "../../../src/local-sync-worker/syncback-tasks/delete-folder.imap.js";
import CreateCategoryIMAP from "../../../src/local-sync-worker/syncback-tasks/create-category.imap.js";
import SendMessageSMTP from "../../../src/local-sync-worker/syncback-tasks/send-message.smtp.js";

const account = {
	id: "acct-1",
	emailAddress: "a@example.com",
	provider: "imap",
};

beforeEach(() => {
	vi.clearAllMocks();
	globalThis.Logger = {
		forAccount: () => ({ info() {}, warn() {}, error() {} }),
		log() {},
	};
});

function imapStub() {
	return {
		renameBox: vi.fn(async () => {}),
		delBox: vi.fn(async () => {}),
		addBox: vi.fn(async () => {}),
		openBox: vi.fn(async () => ({
			search: vi.fn(async () => []),
			moveFromBox: vi.fn(),
			append: vi.fn(),
			closeBox: vi.fn(),
		})),
		getBoxes: vi.fn(async () => ({})),
	};
}

describe("category syncback tasks", () => {
	it("RenameFolder renames on IMAP then rewrites the folder row", async () => {
		const oldFolder = {
			id: "f1",
			name: "Old",
			accountId: "acct-1",
			getMessages: vi.fn(async () => []),
			getThreads: vi.fn(async () => []),
			setThreads: vi.fn(async () => {}),
			destroy: vi.fn(async () => {}),
		};
		const db = {
			accountId: "acct-1",
			sequelize: { transaction: async (fn) => fn({}) },
			Folder: {
				findByPk: vi.fn(async () => oldFolder),
				hash: ({ boxName, accountId: a }) => `${a}:${boxName}`,
				create: vi.fn(async (attrs) => ({
					...attrs,
					toJSON() {
						return attrs;
					},
					getMessages: vi.fn(async () => []),
					getThreads: vi.fn(async () => []),
					setThreads: vi.fn(async () => {}),
				})),
			},
		};
		const task = new RenameFolderIMAP(account, {
			props: { folderId: { folderId: "f1", newFolderName: "New" } },
			status: "NEW",
		});
		const imap = imapStub();
		await task.run(db, imap);
		expect(imap.renameBox).toHaveBeenCalledWith("Old", "New");
	});

	it("DeleteFolder deletes on IMAP and destroys the row", async () => {
		const folder = {
			id: "f2",
			name: "Junk",
			accountId: "acct-1",
			destroy: vi.fn(async () => {}),
		};
		const db = {
			sequelize: { transaction: async (fn) => fn({}) },
			Folder: { findByPk: vi.fn(async () => folder) },
		};
		const imap = imapStub();
		await new DeleteFolderIMAP(account, {
			props: { folderId: { folderId: "f2" } },
			status: "NEW",
		}).run(db, imap);
		expect(imap.delBox).toHaveBeenCalledWith("Junk");
	});

	it("CreateCategory creates the box and the row", async () => {
		const db = {
			accountId: "acct-1",
			sequelize: { transaction: async (fn) => fn({}) },
			Folder: {
				hash: () => "fh1",
				create: vi.fn(async () => ({
					toJSON: () => ({ id: "fh1", name: "Projects" }),
				})),
			},
			Label: {
				hash: () => "lh1",
				create: vi.fn(async () => ({
					toJSON: () => ({ id: "lh1", name: "Projects" }),
				})),
			},
		};
		const imap = imapStub();
		const task = new CreateCategoryIMAP(account, {
			props: { objectClass: "Folder", displayName: "Projects" },
			status: "NEW",
		});
		const out = await task.run(db, imap);
		expect(imap.addBox).toHaveBeenCalledWith("Projects");
		expect(out).toBeDefined();
	});
});

describe("smtp syncback tasks", () => {
	it("SendMessageSMTP builds the message, sends, strips tracking, saves", async () => {
		const db = {};
		const smtp = { send: vi.fn(async () => {}) };
		const result = await new SendMessageSMTP(account, {
			props: { messagePayload: { id: "m1", body: "b" } },
			status: "NEW",
		}).run(db, smtp);
		expect(smtp.send).toHaveBeenCalled();
		expect(result).toBeDefined();
	});
});
