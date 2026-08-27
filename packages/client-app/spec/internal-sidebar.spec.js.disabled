import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	accountForId: vi.fn(), current: vi.fn(), focus: vi.fn(), forCategories: vi.fn(),
	getArchive: vi.fn(), getInbox: vi.fn(), getTrash: vi.fn(), move: vi.fn(),
	queueTask: vi.fn(), rootSheet: vi.fn(), setCollapsed: vi.fn(),
}));

vi.mock("nylas-exports", () => {
	class Task { constructor(attrs) { Object.assign(this, attrs); } }
	return {
		AccountStore: { accountForId: m.accountForId },
		Actions: { focusMailboxPerspective: m.focus, moveThreadsToPerspective: m.move, queueTask: m.queueTask },
		CategoryStore: {
			categories: vi.fn(), getArchiveCategory: m.getArchive, getInboxCategory: m.getInbox,
			getStandardCategory: vi.fn(), getTrashCategory: m.getTrash,
		},
		DestroyCategoryTask: Task,
		FocusedPerspectiveStore: { current: m.current },
		MailboxPerspective: { forCategories: m.forCategories, forDrafts: vi.fn(), forStarred: vi.fn(), forUnread: vi.fn() },
		RegExpUtils: { subcategorySplitRegex: () => /[./]/g },
		SyncbackCategoryTask: Task,
		Utils: {},
		WorkspaceStore: { Sheet: { Drafts: "drafts", Threads: "threads" }, rootSheet: m.rootSheet },
	};
});

vi.mock("nylas-component-kit", () => ({ OutlineViewItem: { CounterStyles: { Alt: "alt" } } }));
vi.mock("../internal_packages/account-sidebar/lib/sidebar-actions", () => ({
	default: { setKeyCollapsed: m.setCollapsed }, setKeyCollapsed: m.setCollapsed,
}));

import SidebarItem from "../internal_packages/account-sidebar/lib/sidebar-item";
import Rulesets from "../internal_packages/thread-list/lib/category-removal-target-rulesets";

const perspective = (attrs = {}) => ({
	name: "Inbox", iconName: "inbox.png", isInbox: vi.fn(() => false),
	unreadCount: vi.fn(() => 7), isEqual: vi.fn(() => false),
	canReceiveThreadsFromAccountIds: vi.fn(() => true), category: vi.fn(() => null), ...attrs,
});

describe("SidebarItem", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		globalThis.NylasEnv = { config: { get: vi.fn(() => false) }, savedState: { sidebarKeysCollapsed: {} } };
		m.rootSheet.mockReturnValue("threads");
		m.current.mockReturnValue(perspective());
	});

	it("copies perspective fields", () => {
		const source = perspective({ name: "Archive", iconName: "archive.png" });
		expect(SidebarItem.forPerspective("archive", source)).toMatchObject({ id: "archive", name: "Archive", iconName: "archive.png", perspective: source });
	});

	it("starts with no children", () => {
		expect(SidebarItem.forPerspective("inbox", perspective()).children).toEqual([]);
	});

	it("uses the alternate counter style for inbox", () => {
		expect(SidebarItem.forPerspective("inbox", perspective({ isInbox: () => true })).counterStyle).toBe("alt");
	});

	it("shows inbox unread count", () => {
		expect(SidebarItem.forPerspective("inbox", perspective({ isInbox: () => true, unreadCount: () => 12 })).count).toBe(12);
	});

	it("hides non-inbox unread count by default", () => {
		expect(SidebarItem.forPerspective("sent", perspective()).count).toBe(0);
	});

	it("shows non-inbox unread count when configured", () => {
		NylasEnv.config.get.mockReturnValue(true);
		expect(SidebarItem.forPerspective("sent", perspective({ unreadCount: () => 4 })).count).toBe(4);
	});

	it("marks the current perspective selected", () => {
		const source = perspective({ isEqual: () => true });
		m.current.mockReturnValue(source);
		expect(SidebarItem.forPerspective("inbox", source).selected).toBe(true);
	});

	it("does not select outside mailbox sheets", () => {
		m.rootSheet.mockReturnValue("composer");
		expect(SidebarItem.forPerspective("inbox", perspective({ isEqual: () => true })).selected).toBe(false);
	});

	it("honors saved expanded state", () => {
		NylasEnv.savedState.sidebarKeysCollapsed.inbox = false;
		expect(SidebarItem.forPerspective("inbox", perspective()).collapsed).toBe(false);
	});

	it("focuses the selected perspective", () => {
		const item = SidebarItem.forPerspective("inbox", perspective());
		item.onSelect(item);
		expect(m.focus).toHaveBeenCalledWith(item.perspective);
	});

	it("does not toggle a leaf", () => {
		const item = SidebarItem.forPerspective("leaf", perspective());
		item.onCollapseToggled(item);
		expect(m.setCollapsed).not.toHaveBeenCalled();
	});

	it("toggles an item with children", () => {
		const item = SidebarItem.forPerspective("parent", perspective());
		item.children.push({ id: "child" });
		item.onCollapseToggled(item);
		expect(m.setCollapsed).toHaveBeenCalledWith("parent", false);
	});

	it("preserves nested labels on rename", () => {
		const category = { displayName: "a.b/c", displayType: () => "label" };
		m.forCategories.mockReturnValue(perspective({ category: () => category }));
		const item = SidebarItem.forCategories([category]);
		item.onEdited(item, "d");
		expect(m.queueTask.mock.calls[0][0].displayName).toBe("a.b/d");
	});

	it("renames top-level labels", () => {
		const category = { displayName: "a", displayType: () => "label" };
		m.forCategories.mockReturnValue(perspective({ category: () => category }));
		const item = SidebarItem.forCategories([category]);
		item.onEdited(item, "b");
		expect(m.queueTask.mock.calls[0][0].displayName).toBe("b");
	});

	it("ignores unchanged renames", () => {
		const category = { displayName: "same", displayType: () => "label" };
		m.forCategories.mockReturnValue(perspective({ category: () => category }));
		const item = SidebarItem.forCategories([category]);
		item.onEdited(item, "same");
		expect(m.queueTask).not.toHaveBeenCalled();
	});

	it("queues category deletion", () => {
		const category = { displayName: "old", displayType: () => "label" };
		m.forCategories.mockReturnValue(perspective({ category: () => category }));
		const item = SidebarItem.forCategories([category]);
		item.onDelete(item);
		expect(m.queueTask.mock.calls[0][0].category).toBe(category);
	});

	it("rejects drops without thread data", () => {
		const item = SidebarItem.forPerspective("archive", perspective());
		expect(item.shouldAcceptDrop(item, { dataTransfer: { types: [] } })).toBe(false);
	});

	it("checks dragged account IDs", () => {
		const source = perspective();
		const item = SidebarItem.forPerspective("archive", source);
		expect(item.shouldAcceptDrop(item, { dataTransfer: { types: ["nylas-threads-data", "nylas-accounts=a1,a2"] } })).toBe(true);
		expect(source.canReceiveThreadsFromAccountIds).toHaveBeenCalledWith(["a1", "a2"]);
	});
});

describe("CategoryRemovalTargetRulesets", () => {
	const { Default, Gmail } = Rulesets;
	beforeEach(() => vi.clearAllMocks());

	it("leaves Gmail archive, all, spam, and sent unchanged", () => {
		expect([Gmail.archive, Gmail.all, Gmail.spam, Gmail.sent]).toEqual([null, null, null, null]);
	});

	it("moves Gmail trash to inbox", () => {
		m.getInbox.mockReturnValue("inbox");
		expect(Gmail.trash("a1")).toBe("inbox");
		expect(m.getInbox).toHaveBeenCalledWith("a1");
	});

	it("moves Gmail folders to archive", () => {
		const account = { usesFolders: () => true };
		m.accountForId.mockReturnValue(account);
		m.getArchive.mockReturnValue("archive");
		expect(Gmail.other("a1")).toBe("archive");
		expect(m.getArchive).toHaveBeenCalledWith(account);
	});

	it("removes Gmail labels without moving them", () => {
		m.accountForId.mockReturnValue({ usesFolders: () => false });
		expect(Gmail.other("a1")).toBeNull();
		expect(m.getArchive).not.toHaveBeenCalled();
	});

	it("uses the default finished category for inbox", () => {
		const account = { defaultFinishedCategory: vi.fn(() => "finished") };
		m.accountForId.mockReturnValue(account);
		expect(Default.inbox("a1")).toBe("finished");
		expect(account.defaultFinishedCategory).toHaveBeenCalledOnce();
	});

	it("moves default archive removal to trash", () => {
		m.getTrash.mockReturnValue("trash");
		expect(Default.archive("a1")).toBe("trash");
		expect(m.getTrash).toHaveBeenCalledWith("a1");
	});
});
