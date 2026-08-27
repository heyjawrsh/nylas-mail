import { describe, expect, it } from "vitest";
import Thread from "../src/flux/models/thread.js";

const threadFromJSON = (json = {}) => new Thread().fromJSON(json);

describe("Thread", () => {
	it("inflates API JSON", () => {
		const thread = threadFromJSON({
			id: "thread-1",
			account_id: "account-1",
			subject: "Hello",
			snippet: "Preview",
		});
		expect(thread.id).toBe("thread-1");
		expect(thread.accountId).toBe("account-1");
		expect(thread.subject).toBe("Hello");
	});

	it("round trips scalar fields", () => {
		const thread = threadFromJSON({
			subject: "Hello",
			snippet: "Preview",
			unread: true,
			starred: false,
			version: 2,
		});
		const copy = threadFromJSON(thread.toJSON());
		expect(copy.toJSON()).toEqual(thread.toJSON());
	});

	it("maps timestamp JSON keys", () => {
		const thread = threadFromJSON({
			last_message_received_timestamp: 10,
			last_message_sent_timestamp: 20,
		});
		expect(thread.lastMessageReceivedTimestamp.getTime()).toBe(10000);
		expect(thread.lastMessageSentTimestamp.getTime()).toBe(20000);
	});

	it("maps search index JSON keys", () => {
		const thread = threadFromJSON({
			is_search_indexed: true,
			search_index_id: 12,
		});
		expect(thread.isSearchIndexed).toBe(true);
		expect(thread.searchIndexId).toBe(12);
	});

	it("inflates participants", () => {
		const thread = threadFromJSON({
			participants: [{ name: "Ada", email: "ada@example.com" }],
		});
		expect(thread.participants[0].toString()).toBe(
			"Ada <ada@example.com>",
		);
	});

	it("propagates the account ID to participants", () => {
		const thread = threadFromJSON({
			account_id: "account-1",
			participants: [{ email: "ada@example.com" }],
		});
		expect(thread.participants[0].accountId).toBe("account-1");
	});

	it("inflates folders as categories", () => {
		const thread = threadFromJSON({
			folders: [{ id: "folder-1", name: "inbox", display_name: "Inbox" }],
		});
		expect(thread.categoriesType).toBe("folders");
		expect(thread.categories[0].displayName).toBe("Inbox");
	});

	it("inflates labels as categories", () => {
		const thread = threadFromJSON({
			labels: [{ id: "label-1", name: "important" }],
		});
		expect(thread.categoriesType).toBe("labels");
		expect(thread.categories[0].name).toBe("important");
	});

	it("combines folders and labels", () => {
		const thread = threadFromJSON({
			folders: [{ id: "folder-1", name: "inbox" }],
			labels: [{ id: "label-1", name: "important" }],
		});
		expect(thread.categories.map((category) => category.name)).toEqual([
			"inbox",
			"important",
		]);
	});

	it("aliases labels to categories", () => {
		const thread = threadFromJSON({
			categories: [{ id: "category-1", name: "inbox" }],
		});
		expect(thread.labels).toBe(thread.categories);
	});

	it("sets categories through the labels alias", () => {
		const thread = threadFromJSON();
		const labels = [{ name: "inbox" }];
		thread.labels = labels;
		expect(thread.categories).toBe(labels);
	});

	it("aliases folders to categories", () => {
		const thread = threadFromJSON({
			categories: [{ id: "category-1", name: "inbox" }],
		});
		expect(thread.folders).toBe(thread.categories);
	});

	it("sets categories through the folders alias", () => {
		const thread = threadFromJSON();
		const folders = [{ name: "inbox" }];
		thread.folders = folders;
		expect(thread.categories).toBe(folders);
	});

	it("finds a category by name", () => {
		const thread = threadFromJSON({
			categories: [{ id: "category-1", name: "inbox" }],
		});
		expect(thread.categoryNamed("inbox").id).toBe("category-1");
	});

	it("returns undefined for an absent category", () => {
		const thread = threadFromJSON({ categories: [] });
		expect(thread.categoryNamed("spam")).toBeUndefined();
	});

	it("reports ordinary label threads in all mail via the computed getter", () => {
		const thread = threadFromJSON({ labels: [{ name: "inbox" }] });
		expect(thread.inAllMail).toBe(true);
	});

	it("reports folder threads in all mail", () => {
		const thread = threadFromJSON({ folders: [{ name: "trash" }] });
		expect(thread.inAllMail).toBe(true);
	});

	it("allows unread to be toggled", () => {
		const thread = threadFromJSON({ unread: true });
		thread.unread = false;
		expect(thread.unread).toBe(false);
	});

	it("allows starred to be toggled", () => {
		const thread = threadFromJSON({ starred: false });
		thread.starred = true;
		expect(thread.starred).toBe(true);
	});

	it("serializes unread and starred toggles", () => {
		const thread = threadFromJSON({ unread: true, starred: false });
		thread.unread = false;
		thread.starred = true;
		expect(thread.toJSON()).toMatchObject({ unread: false, starred: true });
	});

	it("exposes its full-text search metadata", () => {
		expect(Thread.searchable).toBe(true);
		expect(Thread.searchFields).toContain("subject");
	});
});
