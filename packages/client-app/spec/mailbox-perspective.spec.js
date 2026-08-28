import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	accounts: vi.fn(() => []),
	accountForId: vi.fn(),
	accountsForItems: vi.fn(() => []),
	categorySharedName: vi.fn(() => null),
	findAll: vi.fn(),
	getStandardCategories: vi.fn(() => []),
	getStandardCategory: vi.fn(),
	itemsForAccount: vi.fn(() => []),
	modelify: vi.fn(),
	queueTask: vi.fn(),
	queueTasks: vi.fn(),
	taskForInvertingStarred: vi.fn(),
	tasksForApplyingCategories: vi.fn(() => []),
	unreadCount: vi.fn(() => 0),
}));

vi.mock("underscore", () => {
	const underscore = {
		any: (items, predicate) => items.some(predicate),
		debounce: (fn) => fn,
		defer: (fn, ...args) => fn(...args),
		difference: (items, others) => items.filter((item) => !others.includes(item)),
		every: (items, predicate) => items.every(predicate),
		extend: (target, ...sources) => Object.assign(target, ...sources),
		filter: (items, predicate) => items.filter(predicate),
		findWhere: (items, attrs) => items.find((item) => Object.entries(attrs).every(([key, value]) => item[key] === value)),
		isEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
		matcher: (attrs) => (item) => Object.entries(attrs).every(([key, value]) => item[key] === value),
		pluck: (items, key) => items.map((item) => item[key]),
		uniq: (items) => [...new Set(items)],
		values: (object) => Object.values(object),
	};
	return { default: underscore, ...underscore };
});
vi.mock("../src/flux/models/utils.js", () => ({
	default: { registeredObjectReplacer: (_key, value) => value, registeredObjectReviver: (_key, value) => value },
	registeredObjectReplacer: (_key, value) => value,
	registeredObjectReviver: (_key, value) => value,
}));
vi.mock("../src/flux/tasks/task-factory.js", () => ({ default: {
	taskForInvertingStarred: m.taskForInvertingStarred,
	tasksForApplyingCategories: m.tasksForApplyingCategories,
} }));
vi.mock("../src/flux/stores/account-store.js", () => ({ default: {
	accounts: m.accounts, accountForId: m.accountForId, accountsForItems: m.accountsForItems,
} }));
vi.mock("../src/flux/stores/category-store.js", () => ({
	default: { getStandardCategories: m.getStandardCategories, getStandardCategory: m.getStandardCategory },
	getStandardCategories: m.getStandardCategories,
	getStandardCategory: m.getStandardCategory,
}));
vi.mock("../src/flux/stores/database-store.js", () => ({ default: { findAll: m.findAll, modelify: m.modelify } }));
vi.mock("../src/flux/stores/outbox-store.js", () => ({ default: { itemsForAccount: m.itemsForAccount } }));
vi.mock("../src/flux/stores/thread-counts-store.js", () => ({
	default: { unreadCountForCategoryId: m.unreadCount }, unreadCountForCategoryId: m.unreadCount,
}));
vi.mock("../src/flux/stores/recently-read-store.js", () => ({ default: {} }));
vi.mock("../src/flux/models/mutable-query-subscription.js", () => ({
	default: class MutableQuerySubscription { constructor(query, options) { this.query = query; this.options = options; } },
}));
vi.mock("../src/flux/models/unread-query-subscription.js", () => ({
	default: class UnreadQuerySubscription { constructor(categoryIds) { this.categoryIds = categoryIds; } },
}));
vi.mock("../src/flux/attributes/matcher.js", () => ({ default: class Matcher {} }));
vi.mock("../src/flux/models/thread.js", () => {
	const attribute = (name) => ({
		containsAny: (value) => ({ name, operation: "containsAny", value }),
		descending: () => ({ name, direction: "descending" }),
		equal: (value) => ({ name, operation: "equal", value }),
		in: (value) => ({ name, operation: "in", value }),
	});
	return { default: class Thread { static attributes = {
		accountId: attribute("accountId"), categories: attribute("categories"), inAllMail: attribute("inAllMail"),
		lastMessageSentTimestamp: attribute("lastMessageSentTimestamp"), starred: attribute("starred"),
	}; } };
});
vi.mock("../src/flux/models/category.js", () => ({ default: class Category {
	static LockedCategoryNames = ["inbox", "sent", "spam", "trash"];
	static categoriesSharedName(categories) { return m.categorySharedName(categories); }
} }));
vi.mock("../src/flux/actions.js", () => ({ default: { queueTask: m.queueTask, queueTasks: m.queueTasks } }));
vi.mock("../src/flux/tasks/change-starred-task.js", () => ({ default: class ChangeStarredTask { constructor(options) { Object.assign(this, options); } } }));
vi.mock("../src/flux/tasks/change-unread-task.js", () => ({ default: class ChangeUnreadTask { constructor(options) { Object.assign(this, options); } } }));
vi.mock("../src/flux/stores/task-queue-status-store.js", () => ({ default: {} }));
vi.mock("../src/flux/stores/task-queue.js", () => ({ default: {} }));
vi.mock("../src/flux/stores/focused-perspective-store.js", () => ({ default: { current: vi.fn() } }));

import MailboxPerspective from "../src/mailbox-perspective.js";

const category = (overrides = {}) => ({
	id: "cat-1", accountId: "account-1", displayName: "Inbox", name: "inbox",
	isArchive: () => false, isLockedCategory: () => false, isSyncComplete: () => true,
	...overrides,
});

const query = () => {
	const value = { where: vi.fn(), limit: vi.fn(), order: vi.fn(), distinct: vi.fn() };
	value.where.mockReturnValue(value);
	value.limit.mockReturnValue(value);
	value.order.mockReturnValue(value);
	value.distinct.mockReturnValue(value);
	return value;
};

describe("MailboxPerspective factories and base behavior", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		m.accounts.mockReturnValue([]);
		m.categorySharedName.mockReturnValue(null);
		m.getStandardCategories.mockReturnValue([]);
		m.itemsForAccount.mockReturnValue([]);
		m.unreadCount.mockReturnValue(0);
	});

	it("creates an empty perspective for a missing category", () => {
		expect(MailboxPerspective.forCategory(null).accountIds).toEqual([]);
	});

	it("creates a category perspective for one category", () => {
		expect(MailboxPerspective.forCategory(category()).categories()).toHaveLength(1);
	});

	it("creates an empty perspective for an empty category list", () => {
		expect(MailboxPerspective.forCategories([]).categories()).toEqual([]);
	});

	it("forInbox requests standard inbox categories", () => {
		MailboxPerspective.forInbox(["account-1"]);
		expect(m.getStandardCategories).toHaveBeenCalledWith(["account-1"], "inbox");
	});

	it("deduplicates account ids represented by categories", () => {
		const perspective = MailboxPerspective.forCategories([category({ id: "one" }), category({ id: "two" })]);
		expect(perspective.accountIds).toEqual(["account-1"]);
	});

	it("rejects non-array draft account ids", () => {
		expect(() => MailboxPerspective.forDrafts("account-1")).toThrow("must provide an array");
	});

	it("rejects account ids with unsupported value types", () => {
		expect(() => MailboxPerspective.forDrafts([{}])).toThrow("must provide an array");
	});

	it("serializes the concrete perspective type", () => {
		expect(MailboxPerspective.forDrafts(["a"]).toJSON()).toEqual({ accountIds: ["a"], type: "DraftsMailboxPerspective" });
	});

	it("restores a drafts perspective", () => {
		expect(MailboxPerspective.fromJSON({ type: "DraftsMailboxPerspective", accountIds: ["a"] }).name).toBe("Drafts");
	});

	it("restores unknown types as inbox perspectives", () => {
		m.getStandardCategories.mockReturnValue([category()]);
		m.categorySharedName.mockReturnValue("inbox");
		expect(MailboxPerspective.fromJSON({ type: "FuturePerspective", accountIds: ["account-1"] }).isInbox()).toBe(true);
		m.categorySharedName.mockReturnValue(null);
	});

	it("only accepts incoming account ids contained by the perspective", () => {
		const perspective = MailboxPerspective.forStarred(["a", "b"]);
		expect(perspective.canReceiveThreadsFromAccountIds(["b"])).toBe(true);
	});

	it("rejects an empty incoming account list", () => {
		expect(MailboxPerspective.forStarred(["a"]).canReceiveThreadsFromAccountIds([])).toBe(false);
	});

	it("rejects incoming account ids outside the perspective", () => {
		expect(MailboxPerspective.forStarred(["a"]).canReceiveThreadsFromAccountIds(["b"])).toBe(false);
	});
});

describe("perspective counts and identity", () => {
	beforeEach(() => { vi.clearAllMocks(); m.categorySharedName.mockReturnValue("inbox"); });

	it("counts outbox items across draft accounts", () => {
		m.itemsForAccount.mockImplementation((id) => id === "a" ? [{}, {}] : [{}]);
		expect(MailboxPerspective.forDrafts(["a", "b"]).unreadCount()).toBe(3);
	});

	it("sums unread counts for every selected category", () => {
		m.unreadCount.mockImplementation((id) => id === "one" ? 2 : 5);
		const perspective = MailboxPerspective.forCategories([category({ id: "one" }), category({ id: "two" })]);
		expect(perspective.unreadCount()).toBe(7);
	});

	it("an unread perspective deliberately reports zero unread count", () => {
		expect(MailboxPerspective.forUnread([category()]).unreadCount()).toBe(0);
	});

	it("returns the sole selected category", () => {
		const selected = category();
		expect(MailboxPerspective.forCategory(selected).category()).toBe(selected);
	});

	it("returns null when multiple categories are selected", () => {
		const perspective = MailboxPerspective.forCategories([category({ id: "one" }), category({ id: "two", accountId: "account-2" })]);
		expect(perspective.category()).toBeNull();
	});

	it("reports a category perspective as syncing when one category is incomplete", () => {
		const perspective = MailboxPerspective.forCategory(category({ isSyncComplete: () => false }));
		expect(perspective.hasSyncingCategories()).toBe(true);
	});

	it("recognizes archive only when every category is archival", () => {
		const perspective = MailboxPerspective.forCategories([category({ isArchive: () => true }), category({ id: "two", isArchive: () => true })]);
		expect(perspective.isArchive()).toBe(true);
	});

	it("compares category ids as part of equality", () => {
		const left = MailboxPerspective.forCategory(category({ id: "one" }));
		const right = MailboxPerspective.forCategory(category({ id: "two" }));
		expect(left.isEqual(right)).toBe(false);
	});

	it("serializes selected categories", () => {
		const json = MailboxPerspective.forCategory(category()).toJSON();
		expect(JSON.parse(json.serializedCategories)[0].id).toBe("cat-1");
	});
});

describe("category thread filtering", () => {
	beforeEach(() => { vi.clearAllMocks(); m.accounts.mockReturnValue([{}, {}]); });

	it("filters threads by selected category ids", () => {
		const q = query(); m.findAll.mockReturnValue(q); m.categorySharedName.mockReturnValue("inbox");
		MailboxPerspective.forCategory(category()).threads();
		expect(q.where.mock.calls[0][0][0]).toMatchObject({ operation: "containsAny", value: ["cat-1"] });
	});

	it("requires inAllMail outside spam and trash", () => {
		const q = query(); m.findAll.mockReturnValue(q); m.categorySharedName.mockReturnValue("inbox");
		MailboxPerspective.forCategory(category()).threads();
		expect(q.where).toHaveBeenCalledWith({ inAllMail: true });
	});

	it("does not require inAllMail for spam", () => {
		const q = query(); m.findAll.mockReturnValue(q); m.categorySharedName.mockReturnValue("spam");
		MailboxPerspective.forCategory(category({ name: "spam" })).threads();
		expect(q.where).not.toHaveBeenCalledWith({ inAllMail: true });
	});

	it("does not require inAllMail for trash", () => {
		const q = query(); m.findAll.mockReturnValue(q); m.categorySharedName.mockReturnValue("trash");
		MailboxPerspective.forCategory(category({ name: "trash" })).threads();
		expect(q.where).not.toHaveBeenCalledWith({ inAllMail: true });
	});

	it("orders sent threads by sent timestamp descending", () => {
		const q = query(); m.findAll.mockReturnValue(q); m.categorySharedName.mockReturnValue("sent");
		MailboxPerspective.forCategory(category({ name: "sent" })).threads();
		expect(q.order).toHaveBeenCalledWith({ name: "lastMessageSentTimestamp", direction: "descending" });
	});

	it("uses distinct when multiple selected categories belong to one account", () => {
		const q = query(); m.findAll.mockReturnValue(q); m.categorySharedName.mockReturnValue(null);
		MailboxPerspective.forCategories([category({ id: "one" }), category({ id: "two" })]).threads();
		expect(q.distinct).toHaveBeenCalledOnce();
	});

	it("does not use distinct when selected categories belong to different accounts", () => {
		const q = query(); m.findAll.mockReturnValue(q); m.categorySharedName.mockReturnValue(null);
		MailboxPerspective.forCategories([category({ id: "one", accountId: "a" }), category({ id: "two", accountId: "b" })]).threads();
		expect(q.distinct).not.toHaveBeenCalled();
	});

	it("builds unread subscriptions from selected category ids", () => {
		// forUnread perspectives vend an UnreadQuerySubscription (real module)
		const subscription = MailboxPerspective.forUnread([category({ id: "one" }), category({ id: "two" })]).threads();
		expect(subscription.constructor.name).toBe("UnreadQuerySubscription");
	});
});

describe("category movement rules", () => {
	beforeEach(() => { vi.clearAllMocks(); m.categorySharedName.mockReturnValue("inbox"); });

	it("prevents receiving threads in a locked category", () => {
		const perspective = MailboxPerspective.forCategory(category({ isLockedCategory: () => true }));
		expect(perspective.canReceiveThreadsFromAccountIds(["account-1"])).toBe(false);
	});

	it("prevents moving threads to the category already displayed", () => {
		expect(MailboxPerspective.forCategory(category()).canMoveThreadsTo([], "inbox")).toBe(false);
	});

	it("allows moving only when every account has the destination category", () => {
		m.accountsForItems.mockReturnValue([{ id: "a" }, { id: "b" }]);
		m.getStandardCategory.mockImplementation((account) => account.id === "a" ? {} : null);
		expect(MailboxPerspective.forCategory(category()).canMoveThreadsTo([{}], "trash")).toBe(false);
	});

	it("returns no removal tasks for no threads", () => {
		expect(MailboxPerspective.forCategory(category()).tasksForRemovingItems([], {})).toEqual([]);
	});

	it("requires a removal ruleset", () => {
		expect(() => MailboxPerspective.forCategory(category()).tasksForRemovingItems([{}])).toThrow("ruleset object");
	});

	it("returns no tasks when the current category rule is null", () => {
		expect(MailboxPerspective.forCategory(category()).tasksForRemovingItems([{}], { inbox: null })).toEqual([]);
	});

	it("passes account-matched removals and rule destinations to the task factory", () => {
		const destination = category({ id: "archive" });
		m.tasksForApplyingCategories.mockImplementation((options) => options);
		const selected = category();
		const options = MailboxPerspective.forCategory(selected).tasksForRemovingItems([{}], { inbox: () => destination });
		expect(options.categoriesToRemove("account-1")).toEqual([selected]);
		expect(options.categoriesToAdd("account-1")).toEqual([destination]);
	});
});
