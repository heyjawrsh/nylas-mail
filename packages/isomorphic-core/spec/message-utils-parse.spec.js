import { describe, it, expect, beforeAll } from "vitest";
import { Sequelize } from "sequelize";
import loadModels from "../src/load-models.js";
import {
	parseFromImap,
	parseContacts,
	buildForSend,
} from "../src/message-utils.js";

process.env.DB_ENCRYPTION_ALGORITHM = "aes-256-ctr";
process.env.DB_ENCRYPTION_PASSWORD = "unit-test-password";

let db;
let accountId;
const folder = { id: "f1", name: "INBOX" };

function imapMessage({
	headers,
	body = "Hello",
	uid = 7,
	flags = ["\\Seen"],
	labels,
} = {}) {
	const headerKey =
		"HEADER.FIELDS (FROM TO SUBJECT DATE CC BCC REPLY-TO IN-REPLY-TO REFERENCES MESSAGE-ID)";
	const headerText = Object.entries({
		"Message-ID": "<m-7@example.com>",
		From: "Sender <s@example.com>",
		To: "Me <me@example.com>",
		Subject: "A subject",
		Date: "Thu, 27 Aug 2026 01:02:03 +0000",
		...(headers || {}),
	})
		.map(([k, v]) => `${k}: ${v}`)
		.join("\r\n");
	return {
		attributes: {
			uid,
			flags,
			date: new Date(),
			...(labels ? { "x-gm-labels": labels } : {}),
		},
		parts: {
			[headerKey]: Buffer.from(`${headerText}\r\n`),
			1: Buffer.from(body),
		},
		headers: Buffer.from(headerText),
	};
}

beforeAll(async () => {
	const sequelize = new Sequelize({
		dialect: "sqlite",
		storage: ":memory:",
		logging: false,
	});
	db = await loadModels(Sequelize, sequelize, { loadShared: true });
	await sequelize.sync();
	const account = await db.Account.create({
		id: "msg-acc",
		name: "A",
		provider: "gmail",
		emailAddress: "me@example.com",
		connectionSettings: {},
	});
	accountId = account.id;
	// client-sync model statics per the production contract
	db.Message = class Message {
		static dateString(d) {
			return new Date(d).toISOString();
		}
		static build(attrs) {
			return { ...attrs };
		}
		static buildHeaderMessageId(clientId) {
			return `<${clientId}@mailer.nylas>`;
		}
		static hash(m) {
			return Buffer.from(JSON.stringify([m.to, m.from, m.subject, m.date]))
				.toString("base64")
				.slice(0, 40);
		}
	};
	db.Label = class Label {
		static async findXGMLabels(labels) {
			return labels.map((name) => ({ name, id: name }));
		}
	};
});

describe("parseFromImap", () => {
	it("parses headers, body, and unread/starred state", async () => {
		const parsed = await parseFromImap(
			imapMessage(),
			[
				{
					id: "1",
					mimeType: "text/plain",
					transferEncoding: null,
					charset: null,
				},
			],
			{ db, accountId, folder },
		);
		expect(parsed.subject).toBe("A subject");
		expect(parsed.accountId).toBe(accountId);
		expect(parsed.unread).toBe(false);
		expect(parsed.starred).toBe(false);
		expect(parsed.from).toEqual([{ name: "Sender", email: "s@example.com" }]);
		expect(parsed.body).toContain("Hello");
	});

	it("marks unread when the \\Seen flag is missing", async () => {
		const parsed = await parseFromImap(imapMessage({ flags: [] }), [], {
			db,
			accountId,
			folder,
		});
		expect(parsed.unread).toBe(true);
	});

	it("marks starred when \\Flagged is set", async () => {
		const parsed = await parseFromImap(
			imapMessage({ flags: ["\\Flagged"] }),
			[],
			{ db, accountId, folder },
		);
		expect(parsed.starred).toBe(true);
	});

	it("carries gmail labels onto the parsed message", async () => {
		const parsed = await parseFromImap(
			imapMessage({ labels: ["\\Inbox", "besties"] }),
			[],
			{ db, accountId, folder },
		);
		expect(Array.isArray(parsed.labels)).toBe(true);
	});
});

describe("parseContacts", () => {
	it("parses display names, bare addresses, and unicode", () => {
		const out = parseContacts([
			'"Doe, Jane" <jane@example.com>',
			"AppleBees Zé <a@example.com>",
			"bare@example.com",
		]);
		expect(out[0]).toMatchObject({
			name: "Doe, Jane",
			email: "jane@example.com",
		});
		expect(out[1]).toMatchObject({
			name: "AppleBees Zé",
			email: "a@example.com",
		});
		expect(out[2]).toEqual({ name: "", email: "bare@example.com" });
	});

	it("tolerates junk inputs", () => {
		expect(parseContacts(["   ", ""])).toEqual([]);
	});
});

describe("buildForSend", () => {
	it("builds a mime-ready payload with joined addresses", async () => {
		const payload = await buildForSend(
			{
				Message: db.Message,
				Thread: { findOne: async () => null },
				Reference: { findAll: async () => [] },
			},
			{
				to: [{ name: "A", email: "a@example.com" }],
				from: [{ name: "S", email: "s@example.com" }],
				cc: [],
				bcc: [],
				subject: "Hi",
				body: "<p>There</p>",
				date: Math.floor(Date.now() / 1000),
				account_id: accountId,
			},
		);
		expect(JSON.stringify(payload.to)).toContain("a@example.com");
		expect(payload.subject).toBe("Hi");
	});
});
