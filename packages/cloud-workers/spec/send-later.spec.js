import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aws-sdk/client-s3", () => {
	class S3Client {
		constructor() {
			this.send = vi.fn(async () => ({
				Body: (async function* () {
					yield Buffer.from("s3-bytes");
				})(),
			}));
		}
	}
	return {
		S3Client,
		GetObjectCommand: class {},
		DeleteObjectCommand: class {},
	};
});

const sendCustom = vi.fn(async () => {});

vi.mock("isomorphic-core", () => ({
	SendmailClient: class {
		sendCustom(...a) {
			return sendCustom(...a);
		}
	},
	MessageUtils: { buildMime: vi.fn(async () => "RAW-MIME") },
	TrackingUtils: {
		addRecipientToTrackingLinks: ({ baseMessage }) => baseMessage.body,
	},
	ModelUtils: { deepClone: (m) => JSON.parse(JSON.stringify(m)) },
	Errors: {
		RetryableError: class extends Error {},
		NylasError: class extends Error {},
	},
	IMAPConnectionPool: { withConnectionsForAccount: vi.fn() },
}));

vi.mock("cloud-core", () => ({
	DatabaseConnector: {
		forShared: vi.fn(async () => ({
			sequelize: { transaction: async (fn) => fn({}) },
		})),
	},
}));

import SendLaterWorker from "../src/workers/send-later";

beforeEach(() => {
	sendCustom.mockReset();
	sendCustom.mockImplementation(async () => {});
});

const makeLogger = () => ({
	info: vi.fn(),
	debug: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
});

function makeWorker() {
	const job = {
		id: 3,
		accountId: "a1",
		metadataId: "m1",
		status: "NEW",
		attemptNumber: 0,
	};
	const db = {
		sequelize: { transaction: async (fn) => fn({}) },
		CloudJob: {
			findByPk: vi.fn(async () => ({
				id: 3,
				status: "NEW",
				save: vi.fn(async () => {}),
			})),
		},
	};
	const w = new SendLaterWorker(job, {
		db,
		logger: { child: () => makeLogger() },
	});
	w.logger = makeLogger();
	return w;
}

const folderTable = {
	INBOX: { attribs: ["\\HasNoChildren"], delimiter: "/", children: {} },
	Work: {
		attribs: ["\\HasChildren"],
		delimiter: "/",
		children: {
			Sent: { attribs: ["\\Sent"], delimiter: "/", children: {} },
		},
	},
	Trash: { attribs: ["\\Trash"], delimiter: "/", children: {} },
};

describe("SendLaterWorker folder identification", () => {
	it("finds top-level and nested special-use folders", () => {
		const w = makeWorker();
		expect(w.identifySentFolder(folderTable)).toBe("Work/Sent");
		expect(w.identifyTrashFolder(folderTable)).toBe("Trash");
	});

	it("returns null when the role is absent", () => {
		const w = makeWorker();
		expect(w.identifySentFolder({ INBOX: folderTable.INBOX })).toBeNull();
	});
});

describe("_buildMessageFromJSON", () => {
	it("converts the epoch-seconds date into a Date", () => {
		const w = makeWorker();
		const m = w._buildMessageFromJSON({ date: "1700000000", subject: "hi" });
		expect(m.date).toEqual(new Date(1700000000 * 1000));
	});
});

describe("hydrateAttachments", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns the message untouched when there are no uploads", async () => {
		const w = makeWorker();
		const m = await w.hydrateAttachments({ uploads: null }, "acct");
		expect(m.uploads).toEqual([]);
	});

	it("hydrates S3 attachments through temp files in test env", async () => {
		const w = makeWorker();
		const m = await w.hydrateAttachments(
			{
				uploads: [{ id: "u1", filename: "a.pdf", inline: true }],
			},
			"acct",
		);
		expect(m.uploads).toHaveLength(1);
		expect(m.uploads[0].filename).toBe("a.pdf");
		expect(m.uploads[0].inline).toBe(true);
		expect(typeof m.uploads[0].cleanupCallback).toBe("function");
	});
});

describe("sendPerRecipient", () => {
	beforeEach(() => vi.clearAllMocks());

	it("sends an individualized message per recipient and reports failures", async () => {
		sendCustom.mockImplementation((_msg, { to }) => {
			if (to[0].email === "bad@example.com") {
				throw new Error("SMTP rejected");
			}
			return Promise.resolve();
		});
		const w = makeWorker();
		const res = await w.sendPerRecipient({
			account: { id: "a" },
			baseMessage: {
				to: [{ email: "good@example.com" }],
				cc: [{ email: "bad@example.com" }],
				bcc: [],
				body: "<p>hi</p>",
			},
			usesOpenTracking: false,
			usesLinkTracking: false,
			logger: makeLogger(),
		});
		expect(sendCustom).toHaveBeenCalledTimes(2);
		expect(res.failedRecipients).toEqual(["bad@example.com"]);
	});

	it("throws when every recipient fails", async () => {
		sendCustom.mockRejectedValue(new Error("down"));
		const w = makeWorker();
		await expect(
			w.sendPerRecipient({
				account: {},
				baseMessage: {
					to: [{ email: "x@example.com" }],
					cc: [],
					bcc: [],
					body: "b",
				},
				logger: makeLogger(),
			}),
		).rejects.toThrow(/failed for all recipients/);
	});
});

describe("cleanupSentMessages", () => {
	it("moves optimistically-placed messages to trash and appends the sent copy", async () => {
		const w = makeWorker();
		const opened = [];
		const conn = {
			connect: vi.fn(async () => {}),
			getBoxes: vi.fn(async () => folderTable),
			openBox: vi.fn(async (name) => {
				opened.push(name);
				return {
					search: vi.fn(async () => [4]),
					moveFromBox: vi.fn(async () => {}),
					addFlags: vi.fn(async () => {}),
					append: vi.fn(async () => {}),
					closeBox: vi.fn(async () => {}),
				};
			}),
		};
		const logger = makeLogger();
		await w.cleanupSentMessages({ provider: "imap" }, conn, {}, logger, {
			message_id_header: "<m@x>",
		});
		// sent, trash, then sent again for the appended copy
		expect(opened).toEqual(["Work/Sent", "Trash", "Work/Sent"]);
	});
});

describe("performAction", () => {
	beforeEach(() => vi.clearAllMocks());

	it("sends the message, marks NOTRETRYABLE, and cleans up", async () => {
		const w = makeWorker();
		const conn = {
			connect: vi.fn(async () => {}),
			getBoxes: vi.fn(async () => folderTable),
			openBox: vi.fn(async () => ({
				search: vi.fn(async () => []),
				moveFromBox: vi.fn(async () => {}),
				addFlags: vi.fn(async () => {}),
				append: vi.fn(async () => {}),
				closeBox: vi.fn(async () => {}),
			})),
		};
		const account = {
			id: "a1",
			provider: "imap",
			name: "A",
			emailAddress: "a@b.c",
		};
		global.Logger = { forAccount: () => makeLogger() };
		const metadatum = {
			id: "m1",
			value: {
				date: "1700000000",
				to: [{ email: "x@example.com" }],
				cc: [],
				bcc: [],
				body: "hello",
				message_id_header: "<m@x>",
			},
		};
		await w.performAction({ metadatum, account, connection: conn });
		expect(sendCustom).toHaveBeenCalledTimes(1);
		expect(w.db.CloudJob.findByPk).toHaveBeenCalled();
	});

	it("refuses empty metadata values", async () => {
		const w = makeWorker();
		global.Logger = { forAccount: () => makeLogger() };
		await expect(
			w.performAction({
				metadatum: { value: {} },
				account: {},
				connection: {},
			}),
		).rejects.toThrow(/no metadata value/);
	});
});
