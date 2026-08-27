import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("imapflow", () => {
	class ImapFlow {
		constructor() {
			this.on = vi.fn();
			this.removeListener = vi.fn();
			this.connect = vi.fn(async () => {});
			this.close = vi.fn();
			this.capabilities = new Set(["IMAP4rev1", "X-GM-EXT-1"]);
			this.mailbox = null;
			this.list = vi.fn(async () => [
				{ path: "INBOX", delimiter: "/", specialUse: null },
				{ path: "Archive", delimiter: "/", specialUse: null },
				{ path: "Work/Projects/Nylas", delimiter: "/", specialUse: null },
				{ path: "Sent", delimiter: "/", specialUse: "Sent" },
			]);
		}
	}
	return { ImapFlow };
});

import IMAPConnection from "../src/imap-connection";

const logger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

function baseSettings(overrides = {}) {
	return {
		imap_host: "imap.example.com",
		imap_port: "993",
		imap_username: "user@example.com",
		imap_password: "hunter2",
		imap_security: "SSL / TLS",
		imap_allow_insecure_ssl: false,
		...overrides,
	};
}

describe("IMAPConnection.asyncResolveIMAPSettings", () => {
	it("maps provider settings to imapflow config with secure TLS defaults", async () => {
		const settings = await IMAPConnection.asyncResolveIMAPSettings(
			baseSettings(),
		);
		expect(settings.host).toBe("imap.example.com");
		expect(settings.port).toBe(993);
		expect(settings.secure).toBe(true);
		expect(settings.auth).toEqual({
			user: "user@example.com",
			pass: "hunter2",
		});
		expect(settings.tls.minVersion).toBe("TLSv1.2");
		expect(settings.tls.rejectUnauthorized).toBe(true);
	});

	it("does NOT default to insecure TLS when the flag is undefined (2017 backcompat removed)", async () => {
		const { imap_allow_insecure_ssl, ...withoutFlag } = baseSettings();
		const settings = await IMAPConnection.asyncResolveIMAPSettings(withoutFlag);
		expect(settings.tls.rejectUnauthorized).toBe(true);
	});

	it("allows explicit insecure opt-in for self-signed providers, still TLS 1.2 floor", async () => {
		const settings = await IMAPConnection.asyncResolveIMAPSettings(
			baseSettings({
				imap_allow_insecure_ssl: true,
			}),
		);
		expect(settings.tls.rejectUnauthorized).toBe(false);
		expect(settings.tls.minVersion).toBe("TLSv1.2");
	});

	it("treats port 143 / STARTTLS security as non-implicit-TLS", async () => {
		const settings = await IMAPConnection.asyncResolveIMAPSettings(
			baseSettings({
				imap_port: "143",
				imap_security: "STARTTLS",
			}),
		);
		expect(settings.secure).toBe(false);
	});

	it("decodes backend-provided XOAUTH2 SASL strings into accessToken auth", async () => {
		const sasl = Buffer.from(
			"user=user@example.com\x01auth=Bearer ya29.xyz\x01\x01",
		).toString("base64");
		const settings = await IMAPConnection.asyncResolveIMAPSettings(
			baseSettings({
				xoauth2: sasl,
				expiry_date: 1234567890,
			}),
		);
		expect(settings.auth).toEqual({
			user: "user@example.com",
			accessToken: "ya29.xyz",
		});
		expect(settings.auth.pass).toBeUndefined();
		expect(settings.expiry_date).toBe(1234567890);
	});

	it("rejects refresh-token settings missing the required fields", async () => {
		await expect(
			IMAPConnection.asyncResolveIMAPSettings(
				baseSettings({
					refresh_token: "r",
					// no client_id / client_secret
				}),
			),
		).rejects.toThrow(/client_id/);
	});
});

describe("IMAPConnection over imapflow", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function connectedConn() {
		const conn = new IMAPConnection({
			settings: baseSettings(),
			logger: logger(),
		});
		return conn.connect().then(() => conn);
	}

	it("connect() resolves and exposes resolved settings", async () => {
		const conn = await connectedConn();
		expect(conn.getResolvedSettings().host).toBe("imap.example.com");
		conn.end();
	});

	it("serverSupports reads the capability set", async () => {
		const conn = await connectedConn();
		expect(conn.serverSupports("X-GM-EXT-1")).toBe(true);
		expect(conn.serverSupports("SORT")).toBe(false);
		conn.end();
	});

	it("getBoxes() rebuilds the nested node-imap box tree with attribs", async () => {
		const conn = await connectedConn();
		const tree = await conn.getBoxes();
		expect(tree.delimiter).toBe("/");
		expect(tree.children.INBOX.attribs).toContain("\\HasNoChildren");
		expect(tree.children.Work.attribs).toContain("\\HasChildren");
		expect(tree.children.Work.children.Projects.children.Nylas).toBeDefined();
		expect(tree.children.Sent.attribs).toContain("\\Sent");
		conn.end();
	});

	it("openBox() returns an IMAPBox whose proxy matches the open box name", async () => {
		const conn = await connectedConn();
		conn._imap.mailboxOpen = vi.fn(async () => ({
			path: "INBOX",
			uidValidity: 1,
			uidNext: 1,
		}));
		const box = await conn.openBox("INBOX");
		expect(box._box.name).toBe("INBOX");
		expect(conn.getOpenBoxName()).toBe("INBOX");
		conn.end();
	});

	it("runOperation queues operations and drains them in order", async () => {
		const conn = await connectedConn();
		const order = [];
		const op = (name) => ({
			description: () => name,
			run: async () => {
				order.push(name);
				return name;
			},
		});
		const results = await Promise.all([
			conn.runOperation(op("first"), {}),
			conn.runOperation(op("second"), {}),
		]);
		expect(results).toEqual(["first", "second"]);
		expect(order).toEqual(["first", "second"]);
		conn.end();
	});

	it("getLatestBoxStatus maps imapflow status keys to the legacy lowercase shape", async () => {
		const conn = await connectedConn();
		conn._imap.status = vi.fn(async () => ({
			messages: 42,
			uidNext: 43,
			uidValidity: 7,
			unseen: 5,
			highestModSeq: 99,
		}));
		const status = await conn.getLatestBoxStatus("INBOX");
		expect(status).toEqual({
			name: "INBOX",
			uidnext: 43,
			uidvalidity: 7,
			messages: 42,
			unseen: 5,
			highestmodseq: 99,
		});
		conn.end();
	});
});
