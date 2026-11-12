import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	fetchFile: vi.fn(), setUnreadThreads: vi.fn(), setFocus: vi.fn(), findAll: vi.fn(),
	getCollection: vi.fn(), focused: vi.fn(), current: vi.fn(), trigger: vi.fn(),
	extensions: vi.fn(() => []), register: vi.fn(), unregister: vi.fn(), resetCache: vi.fn(),
}));

vi.mock("nylas-store", () => ({ default: class NylasStore {
	listenTo() {}
	trigger(...args) { return m.trigger(...args); }
} }));
vi.mock("../src/flux/actions.js", () => ({ default: {
	fetchFile: m.fetchFile, setUnreadThreads: m.setUnreadThreads, setFocus: m.setFocus,
	toggleMessageIdExpanded: {}, toggleAllMessagesExpanded: {}, toggleHiddenMessages: {},
	popoutThread: {}, focusThreadMainWindow: {},
} }));
vi.mock("../src/flux/models/message.js", () => ({ default: class Message { static attributes = { body: "body" }; } }));
vi.mock("../src/flux/models/thread.js", () => ({ default: class Thread {} }));
vi.mock("../src/flux/stores/database-store.js", () => ({ default: { findAll: m.findAll } }));
vi.mock("../src/flux/stores/focused-perspective-store.js", () => ({ default: { current: m.current } }));
vi.mock("../src/flux/stores/focused-content-store.js", () => ({ default: { focused: m.focused } }));
vi.mock("../src/flux/nylas-api-helpers.js", () => ({ default: { getCollection: m.getCollection }, getCollection: m.getCollection }));
vi.mock("../src/registries/extension-registry.js", () => {
	const MessageView = { extensions: m.extensions, register: m.register, unregister: m.unregister };
	return { MessageView };
});
vi.mock("../src/deprecate-utils.js", () => {
	const deprecate = (_old, _next, context, fn) => fn.bind(context);
	return { default: { deprecate }, deprecate };
});
vi.mock("../src/flux/stores/message-body-processor.js", () => ({ default: { resetCache: m.resetCache } }));
vi.mock("underscore", () => {
	const u = {
		any: (xs, fn) => xs.some(fn), clone: (x) => ({ ...x }), find: (xs, fn) => xs.find(fn),
		findIndex: (xs, fn) => xs.findIndex(fn),
		findWhere: (xs, attrs) => xs.find((x) => Object.entries(attrs).every(([k, v]) => x[k] === v)),
		pluck: (xs, key) => xs.map((x) => x[key]), size: (x) => Object.keys(x).length,
		some: (xs, fn) => xs.some(fn),
	};
	return { default: u, ...u };
});

globalThis.NylasEnv = {
	config: { get: vi.fn() }, newWindow: vi.fn(), isMainWindow: vi.fn(), focus: vi.fn(),
};

import Store from "../src/flux/stores/message-store.js";
import Message from "../src/flux/models/message.js";
import Thread from "../src/flux/models/thread.js";

const msg = (id, extra = {}) => ({
	id, clientId: `client-${id}`, threadId: "t1", categories: [], files: [],
	unread: false, draft: false, isHidden: () => false, ...extra,
});
const queryFor = (items) => {
	const q = { where: vi.fn(() => q), include: vi.fn(() => q), then: (yes, no) => Promise.resolve(items).then(yes, no) };
	m.findAll.mockReturnValue(q);
	return q;
};

describe("MessageStore deep population and derived state", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		vi.useFakeTimers();
		Store._setStoreDefaults();
		Store._onFocusChangedTimer = null;
		Store._lastLoadedThreadId = null;
		m.current.mockReturnValue({ categoriesSharedName: () => "inbox", toJSON: () => ({ name: "inbox" }) });
		NylasEnv.config.get.mockReturnValue("manually");
		NylasEnv.isMainWindow.mockReturnValue(false);
	});

	it("filters a mixed folder view down to ordinary messages", () => {
		Store._items = [msg("inbox"), msg("spam", { categories: [{ name: "spam" }] }), msg("trash", { categories: [{ name: "trash" }] })];
		expect(Store.items().map((x) => x.id)).toEqual(["inbox"]);
	});

	it("includes messages with starred categories in an ordinary folder", () => {
		Store._items = [msg("starred", { categories: [{ name: "starred" }] })];
		expect(Store.items().map((x) => x.id)).toEqual(["starred"]);
	});

	it("queries only messages belonging to the current thread", async () => {
		Store._thread = { id: "t1" };
		const q = queryFor([msg("one")]);
		await Store._fetchFromCache();
		expect(q.where).toHaveBeenCalledWith({ threadId: "t1" });
	});

	it("includes bodies in the population query", async () => {
		Store._thread = { id: "t1" };
		const q = queryFor([msg("one")]);
		await Store._fetchFromCache();
		expect(q.include).toHaveBeenCalledWith(Message.attributes.body);
	});

	it("removes model-hidden messages during population", async () => {
		Store._thread = { id: "t1" };
		queryFor([msg("hidden", { isHidden: () => true }), msg("visible")]);
		await Store._fetchFromCache();
		expect(Store._items.map((x) => x.id)).toEqual(["visible"]);
	});

	it("derives reply-draft ordering during population", async () => {
		Store._thread = { id: "t1" };
		queryFor([msg("draft", { draft: true, replyToMessageId: "parent" }), msg("parent"), msg("later")]);
		await Store._fetchFromCache();
		expect(Store._items.map((x) => x.id)).toEqual(["parent", "draft", "later"]);
	});

	it("does not install stale results after focus moves", () => {
		Store._thread = { id: "t1" };
		let deliver;
		m.findAll.mockReturnValue({ where: vi.fn(), include: vi.fn(), then: vi.fn((fn) => { deliver = fn; }) });
		Store._fetchFromCache();
		Store._thread = { id: "t2" };
		deliver([msg("stale")]);
		expect(Store._items).toEqual([]);
	});

	it("requests API population for an empty cache", async () => {
		Store._thread = { id: "t1", accountId: "a1" };
		queryFor([]);
		await Store._fetchFromCache();
		expect(m.getCollection).toHaveBeenCalledWith("a1", "messages", { thread_id: "t1" });
	});

	it("keeps loading while API population is pending", async () => {
		Store._thread = { id: "t1", accountId: "a1" };
		Store._itemsLoading = true;
		queryFor([]);
		await Store._fetchFromCache();
		expect(Store.itemsLoading()).toBe(true);
	});

	it("finishes loading when cached messages exist", async () => {
		Store._thread = { id: "t1" };
		Store._itemsLoading = true;
		queryFor([msg("one")]);
		await Store._fetchFromCache();
		expect(Store.itemsLoading()).toBe(false);
	});

	it("notifies observers with the populated store", async () => {
		Store._thread = { id: "t1" };
		queryFor([msg("one")]);
		await Store._fetchFromCache();
		expect(m.trigger).toHaveBeenCalledWith(Store);
	});

	it("ignores message changes outside the displayed thread", () => {
		Store._thread = { id: "t1" };
		const fetch = vi.spyOn(Store, "_fetchFromCache");
		Store._onDataChanged({ objectClass: Message, objects: [msg("other", { threadId: "t2" })], type: "persist" });
		expect(fetch).not.toHaveBeenCalled();
	});


	it("uses client id to recognize an existing persisted draft", () => {
		Store._thread = { id: "t1" };
		Store._items = [msg("temp", { clientId: "same" })];
		vi.spyOn(Store, "_fetchFromCache").mockImplementation(() => {});
		Store._onDataChanged({ objectClass: Message, objects: [msg("server", { clientId: "same", draft: true })], type: "persist" });
		expect(Store._items).toHaveLength(1);
	});



	it("resets derived state when focus moves to a new thread", () => {
		const focused = { id: "t2" };
		m.focused.mockReturnValue(focused);
		Store._thread = { id: "t1" };
		Store._items = [msg("old")];
		Store._itemsExpanded = { old: "explicit" };
		vi.spyOn(Store, "_fetchFromCache").mockImplementation(() => {});
		Store._onApplyFocusChange();
		expect(Store.thread()).toBe(focused);
		expect(Store._items).toEqual([]);
		expect(Store.itemsExpandedState()).toEqual({});
	});

	it("ignores focus changes unrelated to threads", () => {
		Store._onFocusChanged({ impactsCollection: vi.fn(() => false) });
		expect(m.focused).not.toHaveBeenCalled();
	});

	it("collapses all but the latest message", () => {
		Store._items = [msg("first"), msg("latest")];
		Store._itemsExpanded = { first: "explicit", latest: "explicit" };
		Store._onToggleAllMessagesExpanded();
		expect(Store._itemsExpanded).toEqual({ latest: "explicit" });
	});

	it("expands every message when one is collapsed", () => {
		Store._items = [msg("first"), msg("second")];
		Store._itemsExpanded = { second: "default" };
		Store._onToggleAllMessagesExpanded();
		expect(Store._itemsExpanded).toEqual({ first: "explicit", second: "explicit" });
	});

	it("ignores expansion of an unknown message", () => {
		Store._items = [msg("known")];
		Store._onToggleMessageIdExpanded("missing");
		expect(Store._itemsExpanded).toEqual({});
	});

	it("fetches every attachment when expanding a message", () => {
		NylasEnv.config.get.mockReturnValue("automatically");
		const item = msg("one", { files: [{ id: "f1" }, { id: "f2" }] });
		Store._items = [item];
		Store._onToggleMessageIdExpanded("one");
		expect(m.fetchFile.mock.calls.map(([file]) => file.id)).toEqual(["f1", "f2"]);
	});

	it("marks an unread thread read after its configured delay", async () => {
		Store._thread = { id: "t1", unread: true };
		NylasEnv.config.get.mockReturnValue(25);
		Store._markAsRead();
		await vi.advanceTimersByTimeAsync(25);
		expect(m.setUnreadThreads).toHaveBeenCalledWith({ threads: [Store._thread], source: "Thread Selected", canBeUndone: false, unread: false });
	});

	it("does not mark unread after focus moves", async () => {
		Store._thread = { id: "t1", unread: true };
		NylasEnv.config.get.mockReturnValue(25);
		Store._markAsRead();
		Store._thread = { id: "t2", unread: true };
		await vi.advanceTimersByTimeAsync(25);
		expect(m.setUnreadThreads).not.toHaveBeenCalled();
	});

	it("honors disabled mark-as-read behavior", async () => {
		Store._thread = { id: "t1", unread: true };
		NylasEnv.config.get.mockReturnValue(-1);
		Store._markAsRead();
		await vi.runAllTimersAsync();
		expect(m.setUnreadThreads).not.toHaveBeenCalled();
	});

	it("bypasses folder filtering after hidden messages are toggled", () => {
		Store._items = [msg("spam", { categories: [{ name: "spam" }] })];
		Store._onToggleHiddenMessages();
		expect(Store.items().map((x) => x.id)).toEqual(["spam"]);
	});

	it("opens a popout with thread and perspective state", () => {
		Store._onPopoutThread({ id: "t7" });
		expect(NylasEnv.newWindow).toHaveBeenCalledWith(expect.objectContaining({ windowKey: "thread-t7", windowProps: { threadId: "t7", perspectiveJSON: { name: "inbox" } } }));
	});

	it("focuses a requested thread in the main window", () => {
		NylasEnv.isMainWindow.mockReturnValue(true);
		const thread = { id: "t4" };
		Store._onFocusThreadMainWindow(thread);
		expect(m.setFocus).toHaveBeenCalledWith({ collection: "thread", item: thread });
		expect(NylasEnv.focus).toHaveBeenCalledOnce();
	});
});
