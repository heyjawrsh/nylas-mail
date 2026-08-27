import { describe, it, expect, vi } from "vitest";
import * as PromiseUtils from "../src/promise-utils.js";
import { NylasError, APIError, RetryableError } from "../src/errors.js";
import * as AuthHelpers from "../src/auth-helpers.js";

describe("promise-utils", () => {
	it("sleep resolves after the delay", async () => {
		vi.useFakeTimers();
		const p = PromiseUtils.sleep(1000).then(() => "woke");
		vi.advanceTimersByTime(1000);
		expect(await p).toBe("woke");
		vi.useRealTimers();
	});

	it("each runs sequentially and returns the accumulated results", async () => {
		const seen = [];
		const out = await PromiseUtils.each([1, 2, 3], async (n) => {
			seen.push(n);
			return n * 10;
		});
		expect(seen).toEqual([1, 2, 3]);
		expect(out).toEqual([1, 2, 3]); // underscore-style: returns the items, not mapper results
	});

	it("promisify converts a callback API", async () => {
		const add = (a, b, cb) => cb(null, a + b);
		const addAsync = PromiseUtils.promisify(add);
		expect(await addAsync(2, 3)).toBe(5);
		const failing = (cb) => cb(new Error("nope"));
		await expect(PromiseUtils.promisify(failing)()).rejects.toThrow("nope");
	});

	it("promisifyAll appends Async variants for functions", () => {
		const obj = { one: (cb) => cb(null, 1), notFn: 5 };
		PromiseUtils.promisifyAll(obj);
		expect(typeof obj.oneAsync).toBe("function");
		expect(obj.notFn).toBe(5);
	});

	it("props resolves a map of promises to a map of values", async () => {
		const out = await PromiseUtils.props({ a: Promise.resolve(1), b: 2 });
		expect(out).toEqual({ a: 1, b: 2 });
	});
});

describe("errors", () => {
	it("NylasError.toJSON serializes custom properties", () => {
		const e = new NylasError("boom");
		e.statusCode = 500;
		const json = e.toJSON();
		expect(json.message).toBe("boom");
		expect(json.statusCode).toBe(500);
	});

	it("APIError and RetryableError carry their shapes", () => {
		const api = new APIError("bad input", 400);
		expect(api.message).toBe("bad input");
		const retry = new RetryableError("temporary");
		expect(retry).toBeInstanceOf(NylasError);
		expect(retry.message).toContain("temporary");
	});
});

describe("auth-helpers", () => {
	it("generateXOAuth2Token produces the SASL format", () => {
		const token = AuthHelpers.generateXOAuth2Token("u@example.com", "ya29.x");
		const decoded = Buffer.from(token, "base64").toString("utf8");
		expect(decoded).toBe("user=u@example.com\x01auth=Bearer ya29.x\x01\x01");
	});

	it("googleSettings builds gmail connection settings + credentials", () => {
		const { connectionSettings, connectionCredentials } =
			AuthHelpers.googleSettings(
				{
					expiry_date: 1893456000000,
					access_token: "ya29.tok",
				},
				"a@gmail.com",
			);
		expect(connectionSettings.imap_host).toBe("imap.gmail.com");
		expect(connectionSettings.imap_port).toBe("993");
		expect(connectionSettings.imap_username).toBe("a@gmail.com");
		expect(connectionSettings.smtp_host).toBe("smtp.gmail.com");
		expect(
			Buffer.from(connectionCredentials.xoauth2, "base64").toString("utf8"),
		).toContain("ya29.tok");
		expect(connectionCredentials.expiry_date).toBe(1893456000);
	});

	it("googleSettings maps insecure flags onto the settings", () => {
		const { connectionSettings } = AuthHelpers.googleSettings(
			{
				imap_allow_insecure_ssl: true,
				smtp_allow_insecure_ssl: true,
				expiry_date: 1893456000000,
				access_token: "t",
			},
			"a@gmail.com",
		);
		expect(connectionSettings.imap_allow_insecure_ssl).toBe(true);
		expect(connectionSettings.smtp_allow_insecure_ssl).toBe(true);
	});

	it("credentialsForProvider returns vendored office365 settings", () => {
		const { connectionSettings } = AuthHelpers.credentialsForProvider({
			provider: "office365",
			settings: {},
			email: "a@b.c",
		});
		expect(connectionSettings.imap_host).toBe("outlook.office365.com");
	});

	it("credentialsForProvider rejects unsupported providers loudly", () => {
		expect(() =>
			AuthHelpers.credentialsForProvider({
				provider: "carrier-pigeon",
				settings: {},
				email: "a@b.c",
			}),
		).toThrow();
	});
});

describe("message-utils extras", () => {
	it("parseContacts handles empty and malformed inputs", async () => {
		const { parseContacts } = await import("../src/message-utils.js");
		expect(parseContacts([])).toEqual([]);
		expect(parseContacts(["   "])).toEqual([]);
	});

	it("parseContacts parses display-name + address pairs", async () => {
		const { parseContacts } = await import("../src/message-utils.js");
		const out = parseContacts([
			'"Doe, Jane" <jane@example.com>',
			"bob@example.com",
		]);
		expect(out[0]).toMatchObject({
			name: "Doe, Jane",
			email: "jane@example.com",
		});
		expect(out[1]).toMatchObject({ email: "bob@example.com" });
	});

	it("getReplyHeaders builds reply-to-all headers", async () => {
		const { getReplyHeaders } = await import("../src/message-utils.js");
		const headers = getReplyHeaders(
			{
				from: [{ email: "sender@example.com", name: "Sender" }],
				to: [{ email: "me@example.com" }],
				cc: [{ email: "other@example.com" }],
				messageId: "<m-1@example.com>",
				accountId: "a",
			},
			{ accountId: "a" },
		);
		expect(headers).toBeDefined();
		expect(headers).not.toBeNull();
	});
});

describe("IMAPConnection command paths", () => {
	it("proxies mailbox admin commands to imapflow", async () => {
		const { default: IMAPConnection } = await import(
			"../src/imap-connection.js"
		);
		const base = {
			imap_host: "h",
			imap_port: "993",
			imap_username: "u",
			imap_password: "p",
			imap_security: "SSL / TLS",
			imap_allow_insecure_ssl: false,
		};
		const conn = new IMAPConnection({
			settings: base,
			logger: {
				info() {},
				warn() {},
				error() {},
				child: () => ({ info() {}, warn() {}, error() {} }),
			},
		});
		conn._resolvedSettings = { ...base, socketTimeout: 1000, tls: {} };
		conn._imap = {
			on() {},
			removeListener() {},
			capabilities: new Set(["IMAP4rev1"]),
			mailbox: null,
			mailboxCreate: async () => ({ path: "New" }),
			mailboxRename: async () => true,
			mailboxDelete: async () => true,
			status: async () => ({
				messages: 1,
				uidNext: 2,
				uidValidity: 3,
				unseen: 0,
			}),
		};
		await expect(conn.addBox("New")).resolves.toBeDefined();
		await expect(conn.renameBox("Old", "New")).resolves.toBe(true);
		await expect(conn.delBox("Old")).resolves.toBe(true);
		const status = await conn.getLatestBoxStatus("Whatever");
		expect(status).toMatchObject({
			name: "Whatever",
			uidnext: 2,
			uidvalidity: 3,
			messages: 1,
		});
		// not-ready guards throw the documented error
		conn._imap = null;
		expect(() => conn.serverSupports("X")).toThrow(/connect\(\) first/);
		await expect(conn.getBoxes()).rejects.toThrow(/connect\(\) first/);
	});
});

describe("sendmail-client config", () => {
	it("derives SMTP transport settings for plain accounts", async () => {
		const { default: SendmailClient } = await import(
			"../src/sendmail-client.js"
		);
		const client = new SendmailClient(
			{
				id: "a",
				provider: "imap",
				emailAddress: "x@example.com",
				connectionSettings: {
					smtp_host: "smtp.example.com",
					smtp_port: "587",
					smtp_security: "STARTTLS",
				},
				connectionCredentials: {
					smtp_username: "x@example.com",
					smtp_password: "pw",
				},
				smtpConfig: () => ({
					host: "smtp.example.com",
					port: 587,
					secure: false,
					auth: { user: "x@example.com", pass: "pw" },
				}),
			},
			{
				info() {},
				error() {},
				warn() {},
				debug() {},
				child() {
					return this;
				},
			},
		);
		expect(client._smtpConfig.host).toBe("smtp.example.com");
		expect(typeof client._transporter).toBe("object");
	});
});
