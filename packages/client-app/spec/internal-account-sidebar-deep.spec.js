import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	focusAccounts: vi.fn(),
	queueTask: vi.fn(),
	normalizeLabel: vi.fn((label) => label),
	standardCategories: vi.fn(() => []),
	categories: vi.fn(() => []),
	getStandardCategories: vi.fn(() => []),
	getStandardCategory: vi.fn(),
	userCategories: vi.fn(() => []),
	extensions: vi.fn(() => []),
	forCategories: vi.fn((categories, options = {}) => ({ kind: "categories", categories, children: [], ...options })),
	forUnread: vi.fn((ids, options = {}) => ({ kind: "unread", ids, ...options })),
	forStarred: vi.fn((ids, options = {}) => ({ kind: "starred", ids, ...options })),
	forDrafts: vi.fn((ids, options = {}) => ({ kind: "drafts", ids, ...options })),
	forSnoozed: vi.fn((ids, options = {}) => ({ kind: "snoozed", ids, ...options })),
	forPerspective: vi.fn((id, perspective, options = {}) => ({ id, perspective, ...options })),
	setKeyCollapsed: vi.fn(),
	createAction: vi.fn((name) => name === "setKeyCollapsed" ? m.setKeyCollapsed : vi.fn()),
	register: vi.fn(),
	unregister: vi.fn(),
}));

vi.mock("nylas-exports", () => {
	class Task { constructor(attrs) { Object.assign(this, attrs); } }
	class Category { constructor(attrs) { Object.assign(this, attrs); } }
	return {
		default: {},
		Actions: { focusDefaultMailboxPerspectiveForAccounts: m.focusAccounts, queueTask: m.queueTask },
		MenuHelpers: { normalizeLabel: m.normalizeLabel },
		CategoryStore: {
			standardCategories: m.standardCategories, categories: m.categories,
			getStandardCategories: m.getStandardCategories,
			getStandardCategory: m.getStandardCategory, userCategories: m.userCategories,
		},
		Category, SyncbackCategoryTask: Task, DestroyCategoryTask: Task,
		MailboxPerspective: class {}, FocusedPerspectiveStore: {},
		ExtensionRegistry: { AccountSidebar: { extensions: m.extensions } },
		RegExpUtils: { subcategorySplitRegex: () => /[./]/g },
		ComponentRegistry: { register: m.register, unregister: m.unregister },
		WorkspaceStore: { Location: { RootSidebar: "root-sidebar" } },
	};
});

vi.mock("reflux", () => ({ default: { createAction: m.createAction }, createAction: m.createAction }));

vi.mock("../internal_packages/account-sidebar/lib/sidebar-item", () => ({
	default: {
		forCategories: m.forCategories, forUnread: m.forUnread, forStarred: m.forStarred,
		forDrafts: m.forDrafts, forSnoozed: m.forSnoozed, forPerspective: m.forPerspective,
	},
}));

vi.mock("../internal_packages/account-sidebar/lib/components/account-sidebar", () => ({
	default: function AccountSidebarStub() {},
}));

// These targets export with module.exports; default imports intentionally test CJS interop.
import AccountCommands from "../internal_packages/account-sidebar/lib/account-commands";
import SidebarActions from "../internal_packages/account-sidebar/lib/sidebar-actions";
import SidebarSection from "../internal_packages/account-sidebar/lib/sidebar-section";
import AccountSidebarMain from "../internal_packages/account-sidebar/lib/main";
import AccountSidebar from "../internal_packages/account-sidebar/lib/components/account-sidebar";

const account = (id, label = `Account ${id}`) => ({
	id, label, categoryLabel: () => "Folders", categoryIcon: () => "folder.png",
});

describe("AccountCommands", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		globalThis.NylasEnv = {
			isVisible: vi.fn(() => true), show: vi.fn(),
			commands: { add: vi.fn(() => ({ dispose: vi.fn() })) },
			menu: { template: [], update: vi.fn() },
		};
		AccountCommands._commandsDisposable = null;
	});

	it("selects an account in single-account mode", () => {
		expect(AccountCommands._isSelected(account("a"), ["a"])).toBe(true);
	});

	it("does not select a different account", () => {
		expect(AccountCommands._isSelected(account("a"), ["b"])).toBe(false);
	});

	it("selects the account array in unified mode", () => {
		expect(AccountCommands._isSelected([account("a"), account("b")], ["a", "b"])).toBe(true);
	});

	it("creates the All Accounts fallback label", () => {
		expect(AccountCommands.menuItem([account("a")], 0).label).toBe("All Accounts");
	});

	it("marks selected menu items as checked checkboxes", () => {
		expect(AccountCommands.menuItem(account("a"), 1, { isSelected: true })).toMatchObject({ type: "checkbox", checked: true });
	});

	it("adds click handlers and accelerators on demand", () => {
		const item = AccountCommands.menuItem(account("a"), 2, { clickHandlers: true });
		expect(item.accelerator).toBe("CmdOrCtrl+3");
		item.click();
		expect(m.focusAccounts).toHaveBeenCalledWith([expect.objectContaining({ id: "a" })]);
	});

	it("builds one menu entry for a single account", () => {
		expect(AccountCommands.menuTemplate([account("a")], ["a"])).toHaveLength(1);
		expect(AccountCommands.menuTemplate([account("a")], ["a"])[0].command).toBe("window:select-account-0");
	});

	it("prepends All Accounts for multiple accounts", () => {
		const result = AccountCommands.menuTemplate([account("a"), account("b")], ["a", "b"]);
		expect(result.map((item) => item.command)).toEqual([
			"window:select-account-0", "window:select-account-1", "window:select-account-2",
		]);
	});

	it("shows the app when focusing while hidden", () => {
		NylasEnv.isVisible.mockReturnValue(false);
		AccountCommands._focusAccounts([account("a")]);
		expect(NylasEnv.show).toHaveBeenCalledOnce();
	});

	it("registers unified and per-account commands", () => {
		AccountCommands.registerCommands([account("a"), account("b")]);
		const commands = NylasEnv.commands.add.mock.calls[0][1];
		expect(Object.keys(commands)).toEqual([
			"window:select-account-0", "window:select-account-1", "window:select-account-2",
		]);
	});

	it("disposes the previous command registration", () => {
		const dispose = vi.fn();
		AccountCommands._commandsDisposable = { dispose };
		AccountCommands.registerCommands([]);
		expect(dispose).toHaveBeenCalledOnce();
	});

	it("inserts account menu items after the first separator", () => {
		const windowMenu = { label: "Window", submenu: [{ label: "Before" }, { type: "separator" }, { label: "After" }] };
		NylasEnv.menu.template = [windowMenu];
		AccountCommands.registerMenuItems([account("a")], ["a"]);
		expect(windowMenu.submenu.map((item) => item.command || item.label || item.type)).toEqual([
			"Before", "separator", "window:select-account-0", "After",
		]);
		expect(NylasEnv.menu.update).toHaveBeenCalledOnce();
	});

	it("leaves menus alone when there is no Window menu", () => {
		AccountCommands.registerMenuItems([account("a")], ["a"]);
		expect(NylasEnv.menu.update).not.toHaveBeenCalled();
	});
});

	describe("SidebarActions", () => {
	it("creates both synchronous actions", () => {
		// The exported action registry remains an array as well as gaining named properties.
		expect([...SidebarActions]).toEqual(["focusAccounts", "setKeyCollapsed"]);
		expect(SidebarActions.focusAccounts.sync).toBe(true);
		expect(SidebarActions.setKeyCollapsed.sync).toBe(true);
	});
});

describe("SidebarSection", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		globalThis.NylasEnv = { savedState: { sidebarKeysCollapsed: {} } };
		m.categories.mockReturnValue([]);
		m.standardCategories.mockReturnValue([]);
		m.userCategories.mockReturnValue([]);
		m.extensions.mockReturnValue([]);
	});

	it("creates empty sections", () => {
		expect(SidebarSection.empty("Nothing")).toEqual({ title: "Nothing", items: [] });
	});

	it("requires an account for a standard section", () => {
		expect(() => SidebarSection.standardSectionForAccount()).toThrow("You must pass an account");
	});

	it("returns an empty named section when standard categories are absent", () => {
		expect(SidebarSection.standardSectionForAccount(account("a", "Work"))).toEqual({ title: "Work", items: [] });
	});

	it("orders unread, starred, and snoozed immediately after inbox and drafts last", () => {
		m.standardCategories.mockReturnValue([{ name: "inbox" }, { name: "sent" }, { name: "drafts" }]);
		const result = SidebarSection.standardSectionForAccount(account("a"));
		expect(result.items.map((item) => item.kind)).toEqual([
			"categories", "unread", "starred", "snoozed", "categories", "drafts",
		]);
	});

	it("returns All Accounts empty when no accounts are supplied", () => {
		expect(SidebarSection.standardSectionForAccounts([])).toEqual({ title: "All Accounts", items: [] });
	});

	it("delegates a one-account aggregate section", () => {
		m.categories.mockReturnValue([{}]);
		m.standardCategories.mockReturnValue([{ name: "inbox" }]);
		expect(SidebarSection.standardSectionForAccounts([account("a", "Solo")]).title).toBe("Solo");
	});

	it("builds nested user categories from separators", () => {
		m.userCategories.mockReturnValue([
			{ displayName: "Parent" }, { displayName: "Parent.Child" }, { displayName: "Parent.Child.Grandchild" },
		]);
		const result = SidebarSection.forUserCategories(account("a"));
		expect(result.items).toHaveLength(1);
		expect(result.items[0].children[0].name).toBe("Child");
		expect(result.items[0].children[0].children[0].name).toBe("Grandchild");
	});

	it("uses account category metadata by default", () => {
		expect(SidebarSection.forUserCategories(account("a"))).toMatchObject({ title: "Folders", iconName: "folder.png", collapsed: false });
	});


	it("ignores empty category names", () => {
		const section = SidebarSection.forUserCategories(account("a"));
		section.onItemCreated("");
		expect(m.queueTask).not.toHaveBeenCalled();
	});

	it("queues creation of a named category", () => {
		const section = SidebarSection.forUserCategories(account("a"));
		section.onItemCreated("Receipts");
		expect(m.queueTask.mock.calls[0][0].category).toMatchObject({ displayName: "Receipts", accountId: "a" });
	});
});

describe("account-sidebar main", () => {
	beforeEach(() => vi.clearAllMocks());

	it("registers the sidebar component at the root sidebar", () => {
		AccountSidebarMain.activate({ restored: true });
		expect(AccountSidebarMain.state).toEqual({ restored: true });
		expect(m.register).toHaveBeenCalledWith(AccountSidebar, { location: "root-sidebar" });
	});

	it("unregisters the sidebar component", () => {
		AccountSidebarMain.deactivate({ closing: true });
		expect(AccountSidebarMain.state).toEqual({ closing: true });
		expect(m.unregister).toHaveBeenCalledWith(AccountSidebar);
	});
});
