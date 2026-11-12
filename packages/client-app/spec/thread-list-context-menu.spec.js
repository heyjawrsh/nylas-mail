import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	archive: vi.fn(), build: vi.fn(), composeForward: vi.fn(), composeReply: vi.fn(),
	current: vi.fn(), findBy: vi.fn(), modelify: vi.fn(() => Promise.resolve([])),
	popup: vi.fn(), toggleStarred: vi.fn(), toggleUnread: vi.fn(), trash: vi.fn(),
}));

vi.mock("nylas-exports", () => {
	const exports = {
		Actions: {
			archiveThreads: m.archive, composeForward: m.composeForward,
			composeReply: m.composeReply, toggleStarredThreads: m.toggleStarred,
			toggleUnreadThreads: m.toggleUnread, trashThreads: m.trash,
		},
		DatabaseStore: { findBy: m.findBy, modelify: m.modelify },
		FocusedPerspectiveStore: { current: m.current },
		Message: { attributes: { date: { descending: vi.fn(() => "descending") } } },
		Thread: { name: "Thread" },
	};
	return { default: exports, ...exports };
});

vi.mock("electron", () => {
	const electron = {
		remote: {
			getCurrentWindow: vi.fn(() => "window"),
			Menu: { buildFromTemplate: m.build },
		},
	};
	return { default: electron, ...electron };
});
// The code reads the remote surface from @electron/remote; reuse the electron
// mock's remote so both stay in step.
vi.mock("@electron/remote", async () => {
	const electron = await import("electron");
	const remote = electron.remote ?? electron.default?.remote;
	return { default: remote, ...remote, remote };
});

import ThreadListContextMenu from "../internal_packages/thread-list/lib/thread-list-context-menu";

const perspective = (archive = true, trash = true) => ({
	canArchiveThreads: vi.fn(() => archive),
	canMoveThreadsTo: vi.fn(() => trash),
});

describe("ThreadListContextMenu", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		m.current.mockReturnValue(perspective());
		m.modelify.mockResolvedValue([]);
		m.findBy.mockReturnValue({
			order: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve(null)) })),
		});
	});

	it("omits reply for multiple selected threads", () => {
		expect(new ThreadListContextMenu({ threadIds: ["a", "b"] }).replyItem()).toBeNull();
	});

	it("composes a popped-out reply for one thread", () => {
		const item = new ThreadListContextMenu({ threadIds: ["a"] }).replyItem();
		item.click();
		expect(m.composeReply).toHaveBeenCalledWith({ threadId: "a", popout: true, type: "reply", behavior: "prefer-existing-if-pristine" });
	});

	it("composes a popped-out forward for one thread", () => {
		const item = new ThreadListContextMenu({ threadIds: ["a"] }).forwardItem();
		item.click();
		expect(m.composeForward).toHaveBeenCalledWith({ threadId: "a", popout: true });
	});

	it("offers Reply All when the newest message supports it", async () => {
		const canReplyAll = vi.fn(() => true);
		m.findBy.mockReturnValue({ order: () => ({ limit: () => Promise.resolve({ canReplyAll }) }) });
		const item = await new ThreadListContextMenu({ threadIds: ["a"] }).replyAllItem();
		expect(item.label).toBe("Reply All");
		item.click();
		expect(m.composeReply).toHaveBeenCalledWith(expect.objectContaining({ threadId: "a", type: "reply-all" }));
	});

	it("omits Reply All when the newest message cannot support it", async () => {
		m.findBy.mockReturnValue({ order: () => ({ limit: () => Promise.resolve({ canReplyAll: () => false }) }) });
		expect(await new ThreadListContextMenu({ threadIds: ["a"] }).replyAllItem()).toBeNull();
	});

	it("archives the modelified threads with the context-menu source", () => {
		const menu = new ThreadListContextMenu({ threadIds: ["a"] });
		menu.threads = [{ id: "a" }];
		menu.archiveItem().click();
		expect(m.archive).toHaveBeenCalledWith({ source: "Context Menu: Thread List", threads: menu.threads });
	});

	it("omits archive when the perspective disallows it", () => {
		m.current.mockReturnValue(perspective(false, true));
		const menu = new ThreadListContextMenu({ threadIds: ["a"] });
		menu.threads = [];
		expect(menu.archiveItem()).toBeNull();
	});

	it("trashes the modelified threads with the context-menu source", () => {
		const menu = new ThreadListContextMenu({ threadIds: ["a"] });
		menu.threads = [{ id: "a" }];
		menu.trashItem().click();
		expect(m.trash).toHaveBeenCalledWith({ source: "Context Menu: Thread List", threads: menu.threads });
	});

	it("labels an all-read selection Mark as Unread", () => {
		const menu = new ThreadListContextMenu({});
		menu.threads = [{ unread: false }, { unread: false }];
		expect(menu.markAsReadItem().label).toBe("Mark as Unread");
	});

	it("labels a mixed selection Mark as Read and toggles it", () => {
		const menu = new ThreadListContextMenu({});
		menu.threads = [{ unread: false }, { unread: true }];
		const item = menu.markAsReadItem();
		expect(item.label).toBe("Mark as Read");
		item.click();
		expect(m.toggleUnread).toHaveBeenCalledWith({ source: "Context Menu: Thread List", threads: menu.threads });
	});

	it("uses singular and plural remove-star labels", () => {
		const one = new ThreadListContextMenu({ threadIds: ["a"] });
		one.threads = [{ starred: true }];
		const many = new ThreadListContextMenu({ threadIds: ["a", "b"] });
		many.threads = [{ starred: true }, { starred: false }];
		expect(one.starItem().label).toBe("Remove Star");
		expect(many.starItem().label).toBe("Remove Stars");
	});

	it("modelifies ids and removes a trailing separator from denied actions", async () => {
		m.current.mockReturnValue(perspective(false, false));
		m.modelify.mockResolvedValue([{ id: "a", unread: true, starred: false }]);
		const labels = (await new ThreadListContextMenu({ threadIds: ["a"] }).menuItemTemplate()).map((item) => item.label || item.type);
		expect(m.modelify).toHaveBeenCalledWith(expect.anything(), ["a"]);
		expect(labels).toEqual(["Reply", "Forward", "separator", "Mark as Read", "Star"]);
	});

	it("builds and displays the Electron menu through require interop", async () => {
		m.build.mockReturnValue({ popup: m.popup });
		const menu = new ThreadListContextMenu({});
		vi.spyOn(menu, "menuItemTemplate").mockResolvedValue([{ label: "Star" }]);
		menu.displayMenu();
		await vi.waitFor(() => expect(m.popup).toHaveBeenCalledWith("window"));
	});
});
