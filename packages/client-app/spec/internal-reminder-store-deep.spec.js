import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	focused: vi.fn(() => null), listenFocused: vi.fn(() => vi.fn()), listenDelivery: vi.fn(() => vi.fn()),
	setMetadata: vi.fn(), sent: vi.fn(), observable: vi.fn(), subscribe: vi.fn(), dispose: vi.fn(),
	latest: vi.fn(), latestReminder: vi.fn(), clearReminder: vi.fn(),
	findAll: vi.fn(), where: vi.fn(), order: vi.fn(), replaceQuery: vi.fn(),
}));

vi.mock("nylas-exports", () => {
	class MutableQuerySubscription {
		constructor(query, options) { this.initialQuery = query; this.options = options; }
		replaceQuery(query) { m.replaceQuery(query); }
	}
	class Thread {}
	Thread.attributes = { lastMessageReceivedTimestamp: { descending: vi.fn(() => "descending") } };
	const FocusedContentStore = { focused: m.focused, listen: m.listenFocused };
	const Actions = { setMetadata: m.setMetadata, draftDeliverySucceeded: { listen: m.listenDelivery } };
	const DatabaseStore = { findAll: m.findAll };
	return { default: { Thread, MutableQuerySubscription, FocusedContentStore, Actions, DatabaseStore }, Thread, MutableQuerySubscription, FocusedContentStore, Actions, DatabaseStore };
});
vi.mock("../internal_packages/send-reminders/lib/send-reminders-utils", () => ({
	getLatestMessage: m.latest, getLatestMessageWithReminder: m.latestReminder,
	setMessageReminder: m.clearReminder, asyncUpdateFromSentMessage: m.sent,
	observableForThreadsWithReminders: m.observable,
}));

import storeSingleton from "../internal_packages/send-reminders/lib/send-reminders-store.js";
import SendRemindersQuerySubscription from "../internal_packages/send-reminders/lib/send-reminders-query-subscription.js";

describe("send reminders store", () => {
	let store;
	beforeEach(() => {
		vi.clearAllMocks();
		m.observable.mockReturnValue({ subscribe: m.subscribe });
		m.subscribe.mockReturnValue({ dispose: m.dispose });
		store = new storeSingleton.constructor();
	});

	it("activates focused-thread, delivery, and reminder subscriptions", () => {
		store.activate();
		expect(m.listenFocused).toHaveBeenCalledWith(store._onFocusedContentChanged);
		expect(m.listenDelivery).toHaveBeenCalledWith(m.sent);
		expect(m.subscribe).toHaveBeenCalledWith(store._onThreadsWithRemindersChanged);
	});

	it("remembers the currently focused thread", () => {
		const thread = { id: "one" }; m.focused.mockReturnValue(thread);
		store._onFocusedContentChanged();
		expect(store._lastFocusedThread).toBe(thread);
	});

	it("acknowledges a reminder when its thread is unfocused", () => {
		const clone = { id: "copy" };
		store._lastFocusedThread = { id: "one", metadataForPluginId: () => ({ shouldNotify: true }), clone: () => clone };
		m.focused.mockReturnValue(null);
		store._onFocusedContentChanged();
		expect(m.setMetadata).toHaveBeenCalledWith(clone, "send-reminders", { shouldNotify: false });
	});

	it("does not rewrite metadata while the same thread remains focused", () => {
		const thread = { id: "one", metadataForPluginId: vi.fn() };
		store._lastFocusedThread = thread; m.focused.mockReturnValue(thread);
		store._onFocusedContentChanged();
		expect(m.setMetadata).not.toHaveBeenCalled();
	});

	it("clears a reminder after a newer message arrives", async () => {
		const reminded = { id: "old" }; const latest = { id: "new" };
		m.latest.mockReturnValue(latest); m.latestReminder.mockReturnValue(reminded);
		store._onThreadsWithRemindersChanged([{ accountId: "a1", messages: () => Promise.resolve([reminded, latest]) }]);
		await Promise.resolve();
		expect(m.clearReminder).toHaveBeenCalledWith("a1", reminded, null);
	});

	it("keeps a reminder when it belongs to the latest message", async () => {
		const latest = { id: "same" }; m.latest.mockReturnValue(latest); m.latestReminder.mockReturnValue(latest);
		store._onThreadsWithRemindersChanged([{ accountId: "a", messages: () => Promise.resolve([latest]) }]);
		await Promise.resolve();
		expect(m.clearReminder).not.toHaveBeenCalled();
	});

	it("disposes all subscriptions on deactivate", () => {
		const unsubA = vi.fn(); const unsubB = vi.fn();
		store._unsubscribers = [unsubA, unsubB]; store._disposables = [{ dispose: m.dispose }];
		store.deactivate();
		expect(unsubA).toHaveBeenCalledOnce(); expect(unsubB).toHaveBeenCalledOnce(); expect(m.dispose).toHaveBeenCalledOnce();
	});
});

describe("send reminders query subscription", () => {
	afterEach(() => vi.useRealTimers());
	beforeEach(() => {
		vi.clearAllMocks(); vi.useFakeTimers();
		m.observable.mockReturnValue({ subscribe: m.subscribe });
		m.subscribe.mockReturnValue({ dispose: m.dispose });
		m.findAll.mockReturnValue({ where: m.where }); m.where.mockReturnValue({ order: m.order }); m.order.mockReturnValue("query");
	});

	it("requests IDs for only the supplied accounts", () => {
		const sub = new SendRemindersQuerySubscription(["a", "b"]); sub.fetchThreadsWithReminders();
		expect(m.observable).toHaveBeenCalledWith(["a", "b"], { emitIds: true });
	});

	it("replaces its query when reminder thread IDs arrive", () => {
		m.subscribe.mockImplementationOnce((callback) => { callback(["t1", "t2"]); return { dispose: m.dispose }; });
		new SendRemindersQuerySubscription(["a"]).fetchThreadsWithReminders();
		expect(m.where).toHaveBeenCalledWith({ id: ["t1", "t2"] });
		expect(m.order).toHaveBeenCalledWith("descending");
		expect(m.replaceQuery).toHaveBeenCalledWith("query");
	});

	it("disposes the reminder observable after its last callback", () => {
		const sub = new SendRemindersQuerySubscription([]); sub.fetchThreadsWithReminders(); sub.onLastCallbackRemoved();
		expect(m.dispose).toHaveBeenCalledOnce();
	});
});
