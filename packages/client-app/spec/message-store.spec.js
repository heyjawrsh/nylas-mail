import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	currentPerspective: vi.fn(() => ({ categoriesSharedName: () => "inbox" })),
	fetchFile: vi.fn(),
	findAll: vi.fn(),
}));

vi.mock("nylas-store", () => ({
	default: class NylasStore {
		listenTo() {}
		trigger() {}
	},
}));
vi.mock("../src/flux/actions.js", () => ({
	default: {
		fetchFile: mocks.fetchFile,
		toggleMessageIdExpanded: {},
		toggleAllMessagesExpanded: {},
		toggleHiddenMessages: {},
		popoutThread: {},
		focusThreadMainWindow: {},
	},
}));
vi.mock("../src/flux/models/message.js", () => ({ default: class Message {} }));
vi.mock("../src/flux/models/thread.js", () => ({ default: class Thread {} }));
vi.mock("../src/flux/stores/database-store.js", () => ({
	default: { findAll: mocks.findAll },
}));
vi.mock("../src/flux/stores/account-store.js", () => ({ default: {} }));
vi.mock("../src/flux/stores/task-queue-status-store.js", () => ({
	waitForPerformLocal: vi.fn(),
}));
vi.mock("../src/flux/nylas-api-helpers.js", () => ({}));
vi.mock("../src/registries/extension-registry.js", () => ({
	ExtensionRegistry: { deserialize: vi.fn(), extensions: vi.fn(() => []) },
}));
vi.mock("../src/flux/stores/badge-store.js", () => ({
	default: { trigger: vi.fn(), listen: vi.fn(() => ({ dispose: vi.fn() })) },
}));
vi.mock("nylas-observables", () => ({
	Categories: { forAllAccounts: vi.fn(), forAccount: vi.fn(), standard: vi.fn() },
}));
vi.mock("../src/flux/stores/focused-perspective-store.js", () => ({
	default: { current: mocks.currentPerspective },
}));
vi.mock("../src/flux/stores/focused-content-store.js", () => ({
	default: { focused: vi.fn() },
}));
vi.mock("../src/flux/nylas-api-helpers.js", () => ({
	default: { getCollection: vi.fn() },
}));
vi.mock("../src/registries/extension-registry.js", () => ({
	default: {
		MessageView: {
			extensions: vi.fn(() => []),
			register: vi.fn(),
			unregister: vi.fn(),
		},
	},
}));
vi.mock("../src/deprecate-utils.js", () => ({
	deprecate: (_oldName, _newName, context, fn) => fn.bind(context),
}));

import MessageStore from "../src/flux/stores/message-store.js";

const category = (name) => ({ name });
const message = (id, fields = {}) => ({
	id,
	clientId: `client-${id}`,
	categories: [],
	files: [],
	unread: false,
	draft: false,
	...fields,
});

describe("MessageStore", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		MessageStore._setStoreDefaults();
		mocks.currentPerspective.mockReturnValue({
			categoriesSharedName: () => "inbox",
		});
		NylasEnv.config.get.mockReturnValue(false);
	});

	it("returns visible messages in an ordinary category", () => {
		const inbox = message("inbox");
		MessageStore._items = [inbox];
		expect(MessageStore.items()).toEqual([inbox]);
	});

	it("hides spam in an ordinary category", () => {
		MessageStore._items = [message("spam", { categories: [category("spam")] })];
		expect(MessageStore.items()).toEqual([]);
	});

	it("hides trash in an ordinary category", () => {
		MessageStore._items = [message("trash", { categories: [category("trash")] })];
		expect(MessageStore.numberOfHiddenItems()).toBe(1);
	});

	it("shows hidden-category messages while viewing spam", () => {
		const spam = message("spam", { categories: [category("spam")] });
		mocks.currentPerspective.mockReturnValue({
			categoriesSharedName: () => "spam",
		});
		MessageStore._items = [spam, message("inbox")];
		expect(MessageStore.items()).toEqual([spam]);
	});

	it("keeps drafts visible while viewing a hidden category", () => {
		const draft = message("draft", { draft: true });
		mocks.currentPerspective.mockReturnValue({
			categoriesSharedName: () => "trash",
		});
		MessageStore._items = [draft];
		expect(MessageStore.items()).toEqual([draft]);
	});

	it("returns every message when hidden items are toggled on", () => {
		MessageStore._showingHiddenItems = true;
		MessageStore._items = [message("one"), message("spam", { categories: [category("spam")] })];
		expect(MessageStore.items()).toHaveLength(2);
	});

	it("reports thread and client identifiers", () => {
		MessageStore._thread = { id: "thread-1" };
		MessageStore._items = [message("one"), message("two")];
		expect(MessageStore.threadId()).toBe("thread-1");
		expect(MessageStore.itemClientIds()).toEqual(["client-one", "client-two"]);
	});

	it("returns a copy of expanded state", () => {
		MessageStore._itemsExpanded = { one: "default" };
		const state = MessageStore.itemsExpandedState();
		state.two = "explicit";
		expect(MessageStore.itemsExpandedState()).toEqual({ one: "default" });
	});

	it("expands unread messages, drafts, and the last visible message", () => {
		MessageStore._items = [
			message("read"),
			message("unread", { unread: true }),
			message("draft", { draft: true }),
			message("last"),
		];
		MessageStore._expandItemsToDefault();
		expect(MessageStore._itemsExpanded).toEqual({
			unread: "default",
			draft: "default",
			last: "default",
		});
	});

	it("moves a reply draft directly after its parent message", () => {
		const parent = message("parent");
		const later = message("later");
		const draft = message("draft", { draft: true, replyToMessageId: "parent" });
		expect(MessageStore._sortItemsForDisplay([parent, later, draft])).toEqual([
			parent,
			draft,
			later,
		]);
	});

	it("places an orphaned reply draft at the end", () => {
		const first = message("first");
		const draft = message("draft", { draft: true, replyToMessageId: "missing" });
		expect(MessageStore._sortItemsForDisplay([draft, first])).toEqual([first, draft]);
	});

	it("toggles one message between expanded and collapsed", () => {
		const item = message("one");
		MessageStore._items = [item];
		MessageStore._onToggleMessageIdExpanded("one");
		expect(MessageStore._itemsExpanded.one).toBe("explicit");
		MessageStore._onToggleMessageIdExpanded("one");
		expect(MessageStore._itemsExpanded.one).toBeUndefined();
	});

	it("downloads files only for expanded messages", () => {
		const expandedFile = { id: "file-1" };
		MessageStore._itemsExpanded = { expanded: "default" };
		NylasEnv.config.get.mockReturnValue("automatically");
		MessageStore._fetchExpandedAttachments([
			message("expanded", { files: [expandedFile] }),
			message("collapsed", { files: [{ id: "file-2" }] }),
		]);
		expect(mocks.fetchFile).toHaveBeenCalledOnce();
		expect(mocks.fetchFile).toHaveBeenCalledWith(expandedFile);
	});

	it("does not download files under the manual policy", () => {
		MessageStore._itemsExpanded = { expanded: "default" };
		NylasEnv.config.get.mockReturnValue("manually");
		MessageStore._fetchExpandedAttachments([
			message("expanded", { files: [{ id: "file-1" }] }),
		]);
		expect(mocks.fetchFile).not.toHaveBeenCalled();
	});
});
