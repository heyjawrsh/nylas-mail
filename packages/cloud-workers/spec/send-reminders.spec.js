import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn(async () => {});
const refreshAccessToken = vi.fn(async () => {});

vi.mock("isomorphic-core", () => ({
	SendmailClient: class {
		constructor(account) {
			if (!account.xoauth2) {
				throw new Error("Account is missing xoauth2 token");
			}
		}
		send(...a) {
			return send(...a);
		}
	},
}));

vi.mock("cloud-core", () => ({
	GmailOAuthHelpers: { refreshAccessToken: (...a) => refreshAccessToken(...a) },
}));

import SendRemindersWorker from "../src/workers/send-reminders";

const makeLogger = () => ({
	info: vi.fn(),
	debug: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
});

function makeWorker(db) {
	const job = {
		id: 5,
		accountId: "a1",
		metadataId: "m1",
		status: "NEW",
		attemptNumber: 0,
	};
	const w = new SendRemindersWorker(job, {
		db,
		logger: { child: () => makeLogger() },
	});
	w.logger = makeLogger();
	return w;
}

function makeDb() {
	return {
		sequelize: { transaction: async (fn) => fn({}) },
		Metadata: {
			findOne: vi.fn(async () => null),
			create: vi.fn(async () => ({})),
		},
	};
}

const boxWith = (searchResult, fetchBehavior) => ({
	search: vi.fn(async () => searchResult),
	fetchEach: async (uids, opts, cb) => {
		for (const msg of fetchBehavior(uids)) {
			cb(msg);
		}
	},
});

describe("performAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const account = {
		id: "a1",
		name: "Ann",
		emailAddress: "ann@example.com",
		provider: "imap",
		xoauth2: "tok",
	};

	it("skips the reminder when the thread already has a new reply", async () => {
		const db = makeDb();
		const w = makeWorker(db);
		const conn = {
			openBox: vi.fn(async () =>
				boxWith([1], () => [
					{ headers: Buffer.from("Message-ID: <reply@x>\r\n") },
				]),
			),
		};
		await w.performAction({
			metadatum: {
				accountId: "a1",
				objectId: "o1",
				pluginId: "send-reminders",
				createdAt: new Date(),
				value: {
					messageIdHeaders: ["<orig@x>"],
					folderImapNames: ["INBOX"],
					replyTo: "<orig@x>",
					subject: "re",
				},
			},
			account,
			connection: conn,
		});
		expect(send).not.toHaveBeenCalled();
	});

	it("sends the reminder and marks thread metadata shouldNotify", async () => {
		const db = makeDb();
		const threadMeta = { value: {}, save: vi.fn(async () => {}) };
		db.Metadata.findOne.mockResolvedValueOnce(threadMeta);
		const w = makeWorker(db);
		const conn = { openBox: vi.fn(async () => boxWith([], () => [])) };
		await w.performAction({
			metadatum: {
				accountId: "a1",
				objectId: "o1",
				pluginId: "send-reminders",
				createdAt: new Date(),
				value: {
					messageIdHeaders: ["<orig@x>"],
					folderImapNames: ["INBOX"],
					replyTo: "<orig@x>",
					subject: "re",
				},
			},
			account,
			connection: conn,
		});
		expect(send).toHaveBeenCalledTimes(1);
		expect(threadMeta.value.shouldNotify).toBe(true);
		expect(threadMeta.save).toHaveBeenCalled();
	});

	it("creates thread metadata when none exists", async () => {
		const db = makeDb();
		const w = makeWorker(db);
		const conn = { openBox: vi.fn(async () => boxWith([], () => [])) };
		await w.performAction({
			metadatum: {
				accountId: "a1",
				objectId: "o2",
				pluginId: "send-reminders",
				createdAt: new Date(),
				value: {
					messageIdHeaders: ["<orig@x>"],
					folderImapNames: ["INBOX"],
					replyTo: "<orig@x>",
					subject: "re",
				},
			},
			account,
			connection: conn,
		});
		expect(db.Metadata.create).toHaveBeenCalledWith(
			expect.objectContaining({
				objectId: "t:o2",
				objectType: "thread",
				value: { shouldNotify: true },
			}),
		);
	});

	it("refreshes the access token when the client reports a missing xoauth2", async () => {
		const db = makeDb();
		const w = makeWorker(db);
		const conn = { openBox: vi.fn(async () => boxWith([], () => [])) };
		const noToken = { ...account, xoauth2: undefined };
		refreshAccessToken.mockImplementationOnce(async (acct) => {
			acct.xoauth2 = "tok2";
		});
		await w.performAction({
			metadatum: {
				accountId: "a1",
				objectId: "o3",
				pluginId: "send-reminders",
				createdAt: new Date(),
				value: {
					messageIdHeaders: ["<orig@x>"],
					folderImapNames: ["INBOX"],
					replyTo: "<orig@x>",
					subject: "re",
				},
			},
			account: noToken,
			connection: conn,
		});
		expect(refreshAccessToken).toHaveBeenCalled();
		expect(send).toHaveBeenCalledTimes(1);
	});

	it("refuses malformed metadata", async () => {
		const w = makeWorker(makeDb());
		await expect(
			w.performAction({ metadatum: { value: {} }, account, connection: {} }),
		).rejects.toThrow(/no metadata value/);
	});
});
