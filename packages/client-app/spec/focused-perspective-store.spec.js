import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	accountIds: vi.fn(() => ["a1", "a2"]),
	accountForId: vi.fn((id) => (["a1", "a2"].includes(id) ? { id } : undefined)),
	byId: vi.fn((_accountId, id) => ({ id })),
	categories: vi.fn(() => []),
	getStandardCategory: vi.fn((accountId, name) => ({ id: `${accountId}-${name}`, accountId, name })),
	getArchiveCategory: vi.fn((accountId) => ({ id: `${accountId}-archive`, accountId })),
	rootSheet: vi.fn(() => "Threads"),
	selectRootSheet: vi.fn(),
	popToRootSheet: vi.fn(),
	commands: {},
}));

vi.mock("nylas-store", () => ({
	default: class NylasStore {
		listenTo = vi.fn();
		trigger = vi.fn();
	},
}));
vi.mock("../src/flux/stores/account-store.js", () => ({
	default: { accountIds: mocks.accountIds, accountForId: mocks.accountForId },
}));
vi.mock("../src/flux/stores/category-store.js", () => ({
	default: {
		getStandardCategory: mocks.getStandardCategory,
		getArchiveCategory: mocks.getArchiveCategory,
		byId: mocks.byId,
		categories: mocks.categories,
	},
}));
vi.mock("../src/flux/stores/workspace-store.js", () => ({
	default: {
		Sheet: { Threads: "Threads", Drafts: "Drafts" },
		rootSheet: mocks.rootSheet,
	},
}));
vi.mock("../src/flux/actions.js", () => ({
	default: {
		focusMailboxPerspective: {},
		focusDefaultMailboxPerspectiveForAccounts: {},
		ensureCategoryIsFocused: {},
		selectRootSheet: mocks.selectRootSheet,
		popToRootSheet: mocks.popToRootSheet,
	},
}));
vi.mock("../src/mailbox-perspective.js", () => {
	class Perspective {
		constructor(categories = [], options = {}) {
			this._categories = categories.filter(Boolean);
			this.accountIds = options.accountIds || [...new Set(this._categories.map((c) => c.accountId))];
			this.drafts = options.drafts;
		}
		categories() { return this._categories; }
		categoriesSharedName() {
			const names = [...new Set(this._categories.map((c) => c.name))];
			return names.length === 1 ? names[0] : null;
		}
		isEqual(other) {
			return Boolean(other) && JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON());
		}
		toJSON() { return { accountIds: this.accountIds, categories: this._categories, drafts: this.drafts }; }
	}
	const api = {
		forNothing: () => new Perspective(),
		forCategories: (categories) => categories.filter(Boolean).length ? new Perspective(categories) : new Perspective(),
		forInbox: (ids) => api.forCategories(ids.map((id) => mocks.getStandardCategory(id, "inbox"))),
		forDrafts: (ids) => new Perspective([], { accountIds: ids, drafts: true }),
		forStarred: (ids) => new Perspective([], { accountIds: ids }),
		fromJSON: (json) => new Perspective(json.categories || [], json),
	};
	return { default: api };
});

import focusedPerspectiveStore from "../src/flux/stores/focused-perspective-store.js";
import MailboxPerspective from "../src/mailbox-perspective.js";

describe("FocusedPerspectiveStore", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.accountIds.mockReturnValue(["a1", "a2"]);
		mocks.accountForId.mockImplementation((id) =>
			["a1", "a2"].includes(id) ? { id } : undefined,
		);
		mocks.byId.mockImplementation((_accountId, id) => ({ id }));
		mocks.categories.mockReturnValue([]);
		mocks.rootSheet.mockReturnValue("Threads");
		NylasEnv.savedState = { sidebarAccountIds: ["a2", "a1"] };
		NylasEnv.commands.add.mockImplementation((_element, commands) => Object.assign(mocks.commands, commands));
		store = new focusedPerspectiveStore.constructor();
		store.trigger.mockClear();
	});

	it("starts focused on nothing", () => {
		expect(store.current().accountIds).toEqual([]);
	});

	it("focuses the inbox at once when the categories loaded before it", () => {
		mocks.categories.mockReturnValue([{ id: "a1-inbox" }]);
		const late = new focusedPerspectiveStore.constructor();
		expect(late.current().categoriesSharedName()).toBe("inbox");
	});

	it("waits for the category store when no categories have loaded", () => {
		expect(store.current().categories()).toEqual([]);
		expect(store._initialized).toBe(false);
	});

	it("orders saved sidebar accounts using account-store order", () => {
		expect(store.sidebarAccountIds()).toEqual(["a1", "a2"]);
	});

	it("repairs sidebar accounts containing a removed account", () => {
		NylasEnv.savedState.sidebarAccountIds = ["gone"];
		expect(store.sidebarAccountIds()).toEqual(["a1", "a2"]);
	});

	it("accepts an account subset", () => {
		expect(store._isValidAccountSet(["a2"])).toBe(true);
	});

	it("rejects an unknown account", () => {
		expect(store._isValidAccountSet(["missing"])).toBe(false);
	});

	it("rejects a perspective whose category disappeared", () => {
		mocks.byId.mockReturnValue(null);
		const perspective = MailboxPerspective.forInbox(["a1"]);
		expect(store._isValidPerspective(perspective)).toBe(false);
	});

	it("returns an inbox as the default perspective", () => {
		expect(store._defaultPerspective(["a1"]).categoriesSharedName()).toBe("inbox");
	});

	it("returns forNothing when inbox categories have not loaded", () => {
		mocks.getStandardCategory.mockReturnValue(null);
		expect(store._defaultPerspective(["a1"]).accountIds).toEqual([]);
	});

	it("ignores a missing default-perspective account argument", () => {
		store._onFocusDefaultPerspectiveForAccounts(null);
		expect(store.trigger).not.toHaveBeenCalled();
	});


	it("does not change perspective when a named category is unavailable", () => {
		mocks.getStandardCategory.mockReturnValue(null);
		store._setPerspectiveByName("sent");
		expect(store.current().accountIds).toEqual([]);
	});


	it("does not publish an equal perspective", () => {
		store._setPerspective(store.current());
		expect(store.trigger).not.toHaveBeenCalled();
	});

	it("selects the drafts sheet for a drafts perspective", () => {
		store._setPerspective(MailboxPerspective.forDrafts(["a1"]));
		expect(mocks.selectRootSheet).toHaveBeenCalledWith("Drafts");
	});

	it("always pops back to the root sheet", () => {
		store._setPerspective(store.current());
		expect(mocks.popToRootSheet).toHaveBeenCalledOnce();
	});
});
