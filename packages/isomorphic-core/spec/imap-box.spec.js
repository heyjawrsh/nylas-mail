import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import IMAPBox from "../src/imap-box.js";
import { RetryableError } from "../src/errors.js";
import { IMAPConnectionNotReadyError } from "../src/imap-errors.js";

const stream = (value) => Readable.from([Buffer.from(value)]);

function fixture({ ready = true, messages = [] } = {}) {
	const imap = {
		fetch: vi.fn(() =>
			(async function* () {
				for (const message of messages) yield message;
			})(),
		),
		messageFlagsAdd: vi.fn(async () => "added"),
		messageFlagsRemove: vi.fn(async () => "removed"),
		messageMove: vi.fn(async () => "moved"),
		messageLabelsAdd: vi.fn(async () => "labels-added"),
		messageLabelsRemove: vi.fn(async () => "labels-removed"),
		append: vi.fn(async () => "appended"),
		search: vi.fn(async () => [2, 5]),
		mailboxClose: vi.fn(async () => "closed"),
	};
	const conn = {
		_imap: ready ? imap : null,
		getOpenBoxName: vi.fn(() => "INBOX"),
		_withPreparedConnection: vi.fn((callback) => callback(imap)),
	};
	return {
		box: new IMAPBox(conn, { name: "INBOX", uidvalidity: 7 }),
		conn,
		imap,
	};
}

describe("IMAPBox", () => {
	it("synthesizes legacy attributes, structure, headers and body parts", async () => {
		const message = {
			uid: 42,
			flags: new Set(["\\Seen", "\\Flagged"]),
			labels: new Set(["\\Inbox", "work"]),
			internalDate: new Date("2024-01-02T03:04:05Z"),
			emailId: "gmail-message",
			threadId: "gmail-thread",
			modseq: 99n,
			bodyStructure: { part: "1", type: "text", subtype: "html", size: 12 },
			headers: stream(
				"From: A <a@example.com>\r\nSubject: Hello\r\n folded\r\nX-Other: no\r\n\r\n",
			),
			bodyParts: new Map([
				["1.2", stream("<b>body</b>")],
				["2.mime", Buffer.from("mime")],
			]),
		};
		const { box, imap } = fixture({ messages: [message] });
		const received = [];
		await box.fetchEach(
			["40:45", 50],
			{
				struct: true,
				bodies: ["HEADER.FIELDS (SUBJECT)", "1.2", "2.MIME"],
			},
			(value) => received.push(value),
		);

		expect(imap.fetch).toHaveBeenCalledWith(
			"40:45,50",
			expect.objectContaining({
				uid: true,
				bodyStructure: true,
				headers: ["SUBJECT"],
				bodyParts: ["1.2", "2.MIME"],
			}),
			{ uid: true },
		);
		expect(received[0].attributes).toMatchObject({
			uid: 42,
			flags: ["\\Seen", "\\Flagged"],
			date: message.internalDate,
			"x-gm-msgid": "gmail-message",
			"x-gm-thrid": "gmail-thread",
			"x-gm-labels": ["\\Inbox", "work"],
			modseq: 99n,
		});
		expect(received[0].attributes.struct).toMatchObject({
			partID: "1",
			type: "text",
			subtype: "html",
		});
		expect(received[0].headers.toString()).toContain("From:");
		expect(received[0].parts["HEADER.FIELDS (SUBJECT)"].toString()).toBe(
			"Subject: Hello\r\n folded\r\n",
		);
		expect(received[0].parts["1.2"].toString()).toBe("<b>body</b>");
		expect(received[0].parts["2.MIME"].toString()).toBe("mime");
	});

	it("splits raw source into HEADER and TEXT and supports full headers", async () => {
		const raw = "From: a@example.com\r\nSubject: Raw\r\n\r\nhello body";
		const { box, imap } = fixture({
			messages: [
				{ uid: 3, source: stream(raw), headers: Buffer.from("Full: yes\r\n") },
			],
		});
		const values = [];
		await box.fetchEach("*", { bodies: ["HEADER", "TEXT"] }, (msg) =>
			values.push(msg),
		);
		expect(imap.fetch.mock.calls[0][1]).toMatchObject({ headers: true });
		expect(values[0].headers.toString()).toBe("Full: yes\r\n");
		expect(values[0].parts.TEXT.toString()).toBe("hello body");

		const second = fixture({ messages: [{ uid: 4, source: "headerless" }] });
		let result;
		await second.box.fetchEach(4, { bodies: ["TEXT"] }, (msg) => {
			result = msg;
		});
		expect(result.headers.toString()).toBe("headerless");
		expect(result.parts.TEXT.toString()).toBe("headerless");
	});

	it("validates fetch arguments, ignores an empty range, and fetches one message", async () => {
		const { box, imap } = fixture({
			messages: [{ uid: 8, source: Buffer.from("H: v\r\n\r\nbody") }],
		});
		await expect(box.fetchEach("1", null, vi.fn())).rejects.toThrow(
			/options object/,
		);
		await box.fetchEach([], {}, vi.fn());
		expect(imap.fetch).not.toHaveBeenCalled();
		await expect(box.fetchMessage()).rejects.toThrow(/message uid/);
		await expect(box.fetchMessage(8)).resolves.toMatchObject({
			attributes: { uid: 8 },
		});
	});

	it("returns a source stream and reports missing messages", async () => {
		const source = stream("raw");
		const done = vi.fn();
		const { box } = fixture({ messages: [{ uid: 1, source }] });
		await expect(box.fetchMessageStream()).rejects.toThrow(/message uid/);
		await expect(box.fetchMessageStream(1)).rejects.toThrow(/options object/);
		expect(
			await box.fetchMessageStream(1, {
				fetchOptions: {},
				onFetchComplete: done,
			}),
		).toBe(source);
		source.resume();
		await new Promise((resolve) => source.on("end", resolve));
		expect(done).toHaveBeenCalled();
		await expect(
			fixture().box.fetchMessageStream(999, { fetchOptions: {} }),
		).rejects.toThrow(/no message/);
	});

	it("returns UID keyed attributes and forwards changedSince", async () => {
		const messages = [
			{
				uid: 11,
				flags: new Set(),
				bodyStructure: { part: "1", type: "text", subtype: "plain" },
			},
		];
		const { box, imap } = fixture({ messages });
		const result = await box.fetchUIDAttributes([10, 11], {
			struct: true,
			modifiers: { changedsince: 55n },
		});
		expect(imap.fetch).toHaveBeenCalledWith(
			"10,11",
			expect.objectContaining({ bodyStructure: true }),
			{ uid: true, changedSince: 55n },
		);
		expect(result[11]).toMatchObject({
			uid: 11,
			flags: [],
			struct: { partID: "1" },
		});
	});

	it("forwards flag, label, move, append, search, and close operations", async () => {
		const { box, imap } = fixture();
		await expect(box.addFlags([1, 2], ["\\Seen"])).resolves.toBe("added");
		await expect(box.delFlags("1:2", ["\\Flagged"])).resolves.toBe("removed");
		await expect(box.moveFromBox(3, "Archive")).resolves.toBe("moved");
		await expect(box.setLabels(4, ["work"])).resolves.toBe("labels-added");
		await expect(box.removeLabels(4, ["old"])).resolves.toBe("labels-removed");
		const date = new Date("2024-01-01Z");
		await expect(
			box.append("raw", { mailbox: "Sent", flags: ["\\Seen"], date }),
		).resolves.toBe("appended");
		await expect(
			box.search([["UNSEEN"], ["FROM", "a@example.com"]]),
		).resolves.toEqual([2, 5]);
		await expect(box.closeBox({ expunge: false })).resolves.toBe("closed");
		expect(imap.messageFlagsAdd).toHaveBeenCalledWith("1,2", ["\\Seen"], {
			uid: true,
		});
		expect(imap.messageMove).toHaveBeenCalledWith("3", "Archive", {
			uid: true,
		});
		expect(imap.append).toHaveBeenCalledWith("Sent", "raw", {
			flags: ["\\Seen"],
			date,
		});
		expect(imap.search).toHaveBeenCalledWith(
			{ seen: false, from: "a@example.com" },
			{ uid: true },
		);
		expect(imap.mailboxClose).toHaveBeenCalled();
	});

	it("guards operations when disconnected and stale proxy methods when another box is open", () => {
		const { box } = fixture({ ready: false });
		for (const invoke of [
			() => box.addFlags(1, []),
			() => box.delFlags(1, []),
			() => box.moveFromBox(1, "A"),
			() => box.setLabels(1, []),
			() => box.removeLabels(1, []),
			() => box.append("x"),
			() => box.search([]),
			() => box.closeBox(),
		])
			expect(invoke).toThrow(IMAPConnectionNotReadyError);

		const stale = fixture();
		stale.conn.getOpenBoxName.mockReturnValue("Archive");
		expect(() => stale.box.search([])).toThrow(RetryableError);
		expect(stale.box.uidvalidity).toBe(7);
	});
});
