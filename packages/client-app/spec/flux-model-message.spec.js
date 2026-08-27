import { describe, expect, it } from "vitest";
import Message from "../src/flux/models/message.js";

const messageFromJSON = (json = {}) => new Message().fromJSON(json);

describe("Message", () => {
	it("inflates API JSON", () => {
		const message = messageFromJSON({
			id: "message-1",
			account_id: "account-1",
			thread_id: "thread-1",
			subject: "Hello",
			snippet: "A short preview",
		});

		expect(message.id).toBe("message-1");
		expect(message.accountId).toBe("account-1");
		expect(message.threadId).toBe("thread-1");
	});

	it("round trips scalar fields", () => {
		const message = messageFromJSON({
			subject: "Hello",
			snippet: "Preview",
			unread: true,
			starred: false,
			version: 3,
			reply_to_message_id: "message-0",
		});

		const copy = messageFromJSON(message.toJSON());
		expect(copy.toJSON()).toEqual(message.toJSON());
	});

	it("defaults collection accessors to empty arrays", () => {
		const message = messageFromJSON();
		expect(message.to).toEqual([]);
		expect(message.cc).toEqual([]);
		expect(message.bcc).toEqual([]);
		expect(message.from).toEqual([]);
		expect(message.files).toEqual([]);
	});

	it("defaults a missing subject to an empty string", () => {
		expect(messageFromJSON().subject).toBe("");
	});

	it("inflates contact collections", () => {
		const message = messageFromJSON({
			account_id: "account-1",
			to: [{ name: "Ada", email: "ada@example.com" }],
			from: [{ name: "Grace", email: "grace@example.com" }],
		});

		expect(message.to[0].toString()).toBe("Ada <ada@example.com>");
		expect(message.from[0].accountId).toBe("account-1");
	});

	it("inflates reply-to using its API key", () => {
		const message = messageFromJSON({
			reply_to: [{ name: "Ada", email: "ada@example.com" }],
		});
		expect(message.replyTo[0].email).toBe("ada@example.com");
	});

	it("inflates file accessors", () => {
		const message = messageFromJSON({
			files: [
				{ id: "file-1", filename: "notes.txt", content_type: "text/plain" },
			],
		});

		expect(message.files[0].filename).toBe("notes.txt");
		expect(message.files[0].contentType).toBe("text/plain");
	});

	it("returns file IDs", () => {
		const message = messageFromJSON({
			files: [{ id: "file-1" }, { id: "file-2" }],
		});
		expect(message.fileIds()).toEqual(["file-1", "file-2"]);
	});

	it("serializes file IDs", () => {
		const message = messageFromJSON({ files: [{ id: "file-1" }] });
		expect(message.toJSON().file_ids).toEqual(["file-1"]);
	});

	it("inflates categories directly", () => {
		const message = messageFromJSON({
			categories: [{ id: "category-1", name: "inbox" }],
		});
		expect(message.categories[0].name).toBe("inbox");
	});

	it("combines folder and label categories", () => {
		const message = messageFromJSON({
			folder: { id: "folder-1", name: "inbox" },
			labels: [{ id: "label-1", name: "important" }],
		});
		expect(message.categories.map((category) => category.name)).toEqual([
			"inbox",
			"important",
		]);
	});

	it("marks a draft from its object type", () => {
		expect(messageFromJSON({ object: "draft" }).draft).toBe(true);
	});

	it("marks a non-draft from its object type", () => {
		expect(messageFromJSON({ object: "message" }).draft).toBe(false);
	});

	it("serializes drafts with the draft object type", () => {
		const message = messageFromJSON({ object: "draft", draft: true });
		expect(message.toJSON().object).toBe("draft");
	});

	it("returns unique participants", () => {
		const message = messageFromJSON({
			to: [{ name: "Ada", email: "ada@example.com" }],
			cc: [{ name: "Ada", email: "ada@example.com" }],
			from: [{ name: "Grace", email: "grace@example.com" }],
		});
		expect(message.participants().map((contact) => contact.email)).toEqual([
			"ada@example.com",
			"grace@example.com",
		]);
	});

	it("can exclude senders from participants", () => {
		const message = messageFromJSON({
			to: [{ email: "ada@example.com" }],
			from: [{ email: "grace@example.com" }],
		});
		expect(
			message.participants({ includeFrom: false }).map((contact) => contact.email),
		).toEqual(["ada@example.com"]);
	});

	it("can include blind-copy participants", () => {
		const message = messageFromJSON({
			bcc: [{ email: "charles@example.com" }],
		});
		expect(
			message.participants({ includeBcc: true }).map((contact) => contact.email),
		).toEqual(["charles@example.com"]);
	});

	it("returns its first sender", () => {
		const message = messageFromJSON({
			from: [{ name: "Ada", email: "ada@example.com" }],
		});
		expect(message.fromContact().email).toBe("ada@example.com");
	});

	it("returns an unknown sender fallback", () => {
		expect(messageFromJSON().fromContact().toString()).toBe("Unknown");
	});

	it("formats its date", () => {
		const message = messageFromJSON({ date: 946728000 });
		expect(message.formattedDate()).toMatch(/^Jan 1 2000, at /);
	});

	it("recognizes a missing body as empty", () => {
		expect(messageFromJSON().hasEmptyBody()).toBe(true);
	});

	it("recognizes markup-only bodies as empty", () => {
		expect(messageFromJSON({ body: "<div> </div>" }).hasEmptyBody()).toBe(true);
	});

	it("recognizes body text as non-empty", () => {
		expect(messageFromJSON({ body: "<p>Hello</p>" }).hasEmptyBody()).toBe(false);
	});

	it("recognizes hidden reminder messages", () => {
		const message = messageFromJSON({
			to: [{ email: "ada@example.com" }],
			from: [{ email: "ada@example.com" }],
			snippet: "Nylas Mail Reminder: follow up",
		});
		expect(message.isHidden()).toBe(true);
	});

	it("does not hide ordinary messages", () => {
		const message = messageFromJSON({
			to: [{ email: "ada@example.com" }],
			from: [{ email: "ada@example.com" }],
			snippet: "Hello",
		});
		expect(message.isHidden()).toBe(false);
	});
});
