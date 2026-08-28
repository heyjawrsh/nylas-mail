import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findAll: vi.fn() }));

vi.mock("../src/flux/stores/database-store.js", () => ({
	default: { findAll: mocks.findAll },
}));
vi.mock("../src/flux/models/message.js", () => ({
	default: class Message {
		static attributes = { body: { name: "body" } };
	},
}));
vi.mock("../src/flux/models/contact.js", () => ({
	default: class Contact {
		constructor(values = {}) { Object.assign(this, values); }
	},
}));
vi.mock("../src/flux/models/category.js", () => ({
	default: class Category {},
}));
vi.mock("../src/flux/attributes.js", () => {
	const scalar = (options) => ({ ...options, descending: () => `descending:${options.modelKey}` });
	return {
		default: {
			String: scalar, Boolean: scalar, Number: scalar, DateTime: scalar,
			Collection: (options) => ({
				...options,
				fromJSON: (items) => items.map((item) => ({ ...item, displayName: item.display_name ?? item.displayName })),
			}),
		},
	};
});
vi.mock("../src/flux/models/model-with-metadata.js", () => ({
	default: class ModelWithMetadata {
		static attributes = {};
		constructor(values = {}) { Object.assign(this, values); }
		fromJSON(json = {}) {
			const keys = { account_id: "accountId", categories_type: "categoriesType" };
			for (const [key, value] of Object.entries(json)) this[keys[key] || key] = value;
			return this;
		}
	},
}));

import Thread from "../src/flux/models/thread.js";
import Message from "../src/flux/models/message.js";

const queryReturning = (messages) => {
	const query = { where: vi.fn(), include: vi.fn() };
	query.where.mockReturnValue(query);
	query.include.mockResolvedValue(messages);
	mocks.findAll.mockReturnValue(query);
	return query;
};

const category = (name, { standard = false, hidden = false, displayName = name } = {}) => ({
	name, displayName,
	isStandardCategory: () => standard,
	isHiddenCategory: () => hidden,
});

describe("Thread deeper behavior", () => {
	beforeEach(() => mocks.findAll.mockReset());

	it("queries messages by thread and includes bodies", async () => {
		const messages = [{ id: "m1", isHidden: () => false }];
		const query = queryReturning(messages);
		await expect(new Thread({ id: "t1" }).messages()).resolves.toEqual(messages);
		expect(query.where).toHaveBeenCalledWith({ threadId: "t1" });
		expect(query.include).toHaveBeenCalledWith(Message.attributes.body);
	});

	it("filters hidden messages by default", async () => {
		queryReturning([{ id: "visible", isHidden: () => false }, { id: "hidden", isHidden: () => true }]);
		expect((await new Thread({ id: "t1" }).messages()).map((m) => m.id)).toEqual(["visible"]);
	});

	it("returns hidden messages when requested", async () => {
		const messages = [{ id: "hidden", isHidden: () => true }];
		queryReturning(messages);
		await expect(new Thread({ id: "t1" }).messages({ includeHidden: true })).resolves.toBe(messages);
	});

	it("computes reply-attributed plaintext for every visible message", async () => {
		const originalMap = Promise.map;
		Promise.map = async (items, callback) => Promise.all((await items).map(callback));
		const thread = new Thread();
		thread.messages = vi.fn().mockResolvedValue([
			{ replyAttributionLine: () => "On Monday, Ada wrote:", computePlainText: () => "First" },
			{ replyAttributionLine: () => "On Tuesday, Bob wrote:", computePlainText: () => "Second" },
		]);
		try {
			const text = await thread.computePlainText();
			expect(text).toContain("On Monday, Ada wrote:\n\nFirst");
			expect(text).toContain("--------------------------------------------------");
			expect(text).toContain("On Tuesday, Bob wrote:\n\nSecond");
		} finally {
			Promise.map = originalMap;
		}
	});

	it("computes empty plaintext for a thread without messages", async () => {
		const originalMap = Promise.map;
		Promise.map = async (items, callback) => Promise.all((await items).map(callback));
		const thread = new Thread();
		thread.messages = vi.fn().mockResolvedValue([]);
		try {
			await expect(thread.computePlainText()).resolves.toBe("");
		} finally {
			Promise.map = originalMap;
		}
	});

	it("reports explicit all-mail labels as in all mail", () => {
		const thread = new Thread({ categoriesType: "labels", categories: [{ name: "all" }, { name: "trash" }] });
		expect(thread.inAllMail).toBe(true);
	});

	it("excludes label threads that only live in trash or spam", () => {
		expect(new Thread({ categoriesType: "labels", categories: [{ name: "trash" }] }).inAllMail).toBe(false);
		expect(new Thread({ categoriesType: "labels", categories: [{ name: "spam" }] }).inAllMail).toBe(false);
	});

	it("treats an empty label collection as in all mail", () => {
		expect(new Thread({ categoriesType: "labels", categories: [] }).inAllMail).toBe(true);
	});

	it("ignores an empty labels payload after inflating folders", () => {
		const thread = new Thread().fromJSON({ folders: [{ name: "inbox" }], labels: [] });
		expect(thread.categoriesType).toBe("folders");
		expect(thread.categories.map((c) => c.name)).toEqual(["inbox"]);
	});

	it("does not attempt participant propagation for a non-array value", () => {
		const thread = new Thread().fromJSON({ account_id: "a1", participants: null });
		expect(thread.participants).toBeNull();
	});

	it("returns no sorted categories when categories are absent", () => {
		expect(new Thread().sortedCategories()).toEqual([]);
	});

	it("sorts important, visible standard, then alphabetical user labels", () => {
		const hidden = category("sent", { standard: true, hidden: true });
		const thread = new Thread({ categories: [
			category("z", { displayName: "Zulu" }),
			category("inbox", { standard: true }),
			category("important", { standard: true }),
			category("a", { displayName: "Alpha" }),
			hidden,
		] });
		expect(thread.sortedCategories().map((c) => c.name)).toEqual(["important", "inbox", "a", "z"]);
	});

	it("exposes non-enumerable category attribute aliases", () => {
		expect(Thread.attributes.labels).toBe(Thread.attributes.categories);
		expect(Thread.attributes.folders).toBe(Thread.attributes.categories);
		expect(Object.keys(Thread.attributes)).not.toContain("labels");
	});

	it("uses received time as its natural descending order", () => {
		expect(Thread.sortOrderAttribute()).toBe(Thread.attributes.lastMessageReceivedTimestamp);
		expect(Thread.naturalSortOrder()).toBe("descending:lastMessageReceivedTimestamp");
	});
});
