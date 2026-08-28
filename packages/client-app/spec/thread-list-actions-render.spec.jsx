import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const m = vi.hoisted(() => ({
	archive: vi.fn(), canArchive: vi.fn(() => true), canTrash: vi.fn(() => true),
	current: vi.fn(), extensions: vi.fn(() => []), forwarded: vi.fn(() => false),
	toggleStarred: vi.fn(), trash: vi.fn(),
}));

vi.mock("nylas-exports", () => {
	const exports = {
		AccountStore: { accountForId: vi.fn() },
		Actions: { archiveThreads: m.archive, toggleStarredThreads: m.toggleStarred, trashThreads: m.trash },
		CategoryStore: { getInboxCategory: vi.fn() },
		DraftHelpers: { isForwardedMessage: m.forwarded },
		ExtensionRegistry: { ThreadList: { extensions: m.extensions } },
		FocusedPerspectiveStore: { current: m.current },
		TaskFactory: { taskForArchiving: vi.fn() },
		Thread: { name: "Thread" }, ChangeStarredTask: class {},
	};
	return { default: exports, ...exports };
});

import ThreadListIcon from "../internal_packages/thread-list/lib/thread-list-icon";
import quickActions from "../internal_packages/thread-list/lib/thread-list-quick-actions";

const { ThreadArchiveQuickAction, ThreadTrashQuickAction } = quickActions;
const thread = (attrs = {}) => ({ id: "t1", starred: false, unread: false, __messages: [], ...attrs });

afterEach(cleanup);

beforeEach(() => {
	vi.clearAllMocks();
	m.canArchive.mockReturnValue(true);
	m.canTrash.mockReturnValue(true);
	m.current.mockReturnValue({ canArchiveThreads: m.canArchive, canMoveThreadsTo: m.canTrash });
	m.extensions.mockReturnValue([]);
});

describe("ThreadListIcon rendering", () => {
	it("renders the no-thread hover-star class", () => {
		render(<ThreadListIcon />);
		expect(screen.getByTitle("Star").className).toContain("thread-icon-star-on-hover");
	});

	it("renders a starred thread as a star", () => {
		render(<ThreadListIcon thread={thread({ starred: true })} />);
		expect(screen.getByTitle("Star").className).toContain("thread-icon-star");
	});

	it("renders an unread thread with unread and hover classes", () => {
		render(<ThreadListIcon thread={thread({ unread: true })} />);
		expect(screen.getByTitle("Star").className).toContain("thread-icon-unread thread-icon-star-on-hover");
	});


	it("ignores extensions without an icon callback", () => {
		m.extensions.mockReturnValue([{}]);
		render(<ThreadListIcon thread={thread({ starred: true })} />);
		expect(screen.getByTitle("Star").className).toContain("thread-icon-star");
	});

	it("renders replied when the last of multiple messages is from me", () => {
		const message = (serverId, isMe) => ({ serverId, draft: false, from: [{ isMe: () => isMe }] });
		render(<ThreadListIcon thread={thread({ __messages: [message("1", false), message("2", true)] })} />);
		expect(screen.getByTitle("Star").className).toContain("thread-icon-replied");
	});


	it("filters drafts and unsynced messages before choosing an icon", () => {
		const fromMe = { from: [{ isMe: () => true }] };
		render(<ThreadListIcon thread={thread({ __messages: [{ ...fromMe, serverId: null, draft: false }, { ...fromMe, serverId: "2", draft: true }] })} />);
		expect(screen.getByTitle("Star").className).toContain("thread-icon-none");
	});

});

describe("thread-list quick actions", () => {
	it("renders Archive when allowed", () => {
		render(<ThreadArchiveQuickAction thread={thread()} />);
		expect(screen.getByTitle("Archive").className).toContain("action-archive");
	});





});
