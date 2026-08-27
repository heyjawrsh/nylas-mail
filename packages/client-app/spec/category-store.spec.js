import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	accountForId: vi.fn(),
	subscribe: vi.fn(),
}));

vi.mock("nylas-store", () => ({ default: class NylasStore { trigger = vi.fn(); } }));
vi.mock("rx-lite", () => ({ default: {} }));
vi.mock("../src/flux/stores/account-store.js", () => ({
	default: { accountForId: mocks.accountForId },
}));
vi.mock("../src/flux/models/account.js", () => ({
	default: class Account { constructor(values = {}) { Object.assign(this, values); } },
}));
vi.mock("../src/flux/models/category.js", () => ({
	default: { StandardCategoryNames: ["inbox", "starred", "sent", "drafts", "all", "archive", "trash", "spam", "important"] },
}));
vi.mock("nylas-observables", () => ({
	Categories: { forAllAccounts: () => ({ sort: () => ({ subscribe: mocks.subscribe }) }) },
}));

import categoryStore from "../src/flux/stores/category-store.js";
import Account from "../src/flux/models/account.js";

const category = (id, accountId, name, kind = "standard") => ({
	id, accountId, name,
	isStandardCategory: () => kind === "standard",
	isUserCategory: () => kind === "user",
	isHiddenCategory: () => kind === "hidden",
});

describe("CategoryStore", () => {
	let store;
	let folderAccount;
	let labelAccount;

	beforeEach(() => {
		vi.clearAllMocks();
		folderAccount = new Account({ id: "folders", usesFolders: () => true, usesLabels: () => false });
		labelAccount = new Account({ id: "labels", usesFolders: () => false, usesLabels: () => true });
		mocks.accountForId.mockImplementation((id) => id === "folders" ? folderAccount : id === "labels" ? labelAccount : null);
		store = new categoryStore.constructor();
		vi.spyOn(store, "trigger").mockImplementation(() => {});
		vi.clearAllMocks();
	});

	it("looks up a category by account and ID", () => {
		const inbox = category("inbox-id", "folders", "inbox");
		store._onCategoriesChanged([inbox]);
		expect(store.byId("folders", "inbox-id")).toBe(inbox);
	});

	it("returns undefined for an unknown category", () => {
		expect(store.byId("folders", "missing")).toBeUndefined();
	});

	it("returns categories for one account", () => {
		store._onCategoriesChanged([category("one", "folders", "inbox"), category("two", "labels", "sent")]);
		expect(store.categories("folders").map((c) => c.id)).toEqual(["one"]);
	});

	it("returns categories across accounts", () => {
		store._onCategoriesChanged([category("one", "folders", "inbox"), category("two", "labels", "sent")]);
		expect(store.categories()).toHaveLength(2);
	});

	it("separates standard categories", () => {
		store._onCategoriesChanged([category("one", "folders", "inbox"), category("two", "folders", "custom", "user")]);
		expect(store.standardCategories("folders").map((c) => c.id)).toEqual(["one"]);
	});

	it("separates user categories", () => {
		store._onCategoriesChanged([category("one", "folders", "custom", "user")]);
		expect(store.userCategories("folders").map((c) => c.id)).toEqual(["one"]);
	});

	it("separates hidden categories", () => {
		store._onCategoriesChanged([category("one", "folders", "spam", "hidden")]);
		expect(store.hiddenCategories("folders").map((c) => c.id)).toEqual(["one"]);
	});

	it("sorts standard categories in canonical order", () => {
		store._onCategoriesChanged([category("sent", "folders", "sent"), category("inbox", "folders", "inbox")]);
		expect(store.standardCategories("folders").map((c) => c.name)).toEqual(["inbox", "sent"]);
	});

	it("finds a standard category by name", () => {
		const inbox = category("one", "folders", "inbox");
		store._onCategoriesChanged([inbox]);
		expect(store.getInboxCategory("folders")).toBe(inbox);
	});

	it("rejects a nonstandard category name", () => {
		expect(() => store.getStandardCategory("folders", "made-up")).toThrow("not a standard category");
	});

	it("collects named standard categories for multiple accounts", () => {
		store._onCategoriesChanged([category("f-inbox", "folders", "inbox"), category("l-inbox", "labels", "inbox")]);
		expect(store.getStandardCategories(["folders", "labels"], "inbox").map((c) => c.id)).toEqual(["f-inbox", "l-inbox"]);
	});

	it("uses archive for folder accounts", () => {
		const archive = category("archive", "folders", "archive");
		store._onCategoriesChanged([archive]);
		expect(store.getArchiveCategory("folders")).toBe(archive);
	});

	it("uses all mail as archive for label accounts", () => {
		const all = category("all", "labels", "all");
		store._onCategoriesChanged([all]);
		expect(store.getArchiveCategory("labels")).toBe(all);
	});

	it("returns all mail only for label accounts", () => {
		store._onCategoriesChanged([category("all", "labels", "all")]);
		expect(store.getAllMailCategory("folders")).toBeNull();
		expect(store.getAllMailCategory("labels").id).toBe("all");
	});

	it("publishes after rebuilding category derivations", () => {
		store._onCategoriesChanged([]);
		expect(store.trigger).toHaveBeenCalledOnce();
	});
});
