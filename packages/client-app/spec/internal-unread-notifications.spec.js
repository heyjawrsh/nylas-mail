import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	display: vi.fn(() => ({ close: vi.fn() })),
	find: vi.fn(),
	listenDatabase: vi.fn(() => vi.fn()),
	listenMail: vi.fn(() => vi.fn()),
	playSound: vi.fn(),
	quickReply: vi.fn(),
	ensureCategory: vi.fn(),
	setFocus: vi.fn(),
}));

vi.mock("nylas-exports", () => ({
	default: {},
	Thread: class Thread {},
	Actions: {
		onNewMailDeltas: { listen: m.listenMail },
		sendQuickReply: m.quickReply,
		ensureCategoryIsFocused: m.ensureCategory,
		setFocus: m.setFocus,
	},
	SoundRegistry: { playSound: m.playSound },
	NativeNotifications: { displayNotification: m.display },
	DatabaseStore: { listen: m.listenDatabase, find: m.find },
}));

import { Notifier } from "../internal_packages/unread-notifications/lib/main.js";

const thread = (id = "t1", inbox = true) => ({
	id,
	accountId: "a1",
	categoryNamed: vi.fn(() => inbox),
});
const message = (overrides = {}) => ({
	unread: true,
	date: new Date(Date.now() + 1000),
	threadId: "t1",
	from: [{ displayName: () => "Ada" }],
	subject: "Hello",
	snippet: "Preview",
	isFromMe: vi.fn(() => false),
	...overrides,
});

describe("UnreadNotifications filtering", () => {
	let notifier;

	beforeEach(() => {
		vi.clearAllMocks();
		globalThis.NylasEnv = {
			config: { get: vi.fn(() => true) },
			displayWindow: vi.fn(),
			showErrorDialog: vi.fn(),
		};
		notifier = new Notifier();
	});

	it("ignores all incoming mail when notifications are disabled", async () => {
		NylasEnv.config.get.mockReturnValue(false);
		await notifier._onNewMailReceived({ message: [message()], thread: [thread()] });
		expect(m.display).not.toHaveBeenCalled();
	});

	it("filters messages that are already read", async () => {
		await notifier._onNewMailReceived({ message: [message({ unread: false })], thread: [thread()] });
		expect(m.display).not.toHaveBeenCalled();
	});

	it("filters messages older than notifier activation", async () => {
		await notifier._onNewMailReceived({ message: [message({ date: new Date(0) })], thread: [thread()] });
		expect(m.display).not.toHaveBeenCalled();
	});

	it("filters messages sent by the current user", async () => {
		await notifier._onNewMailReceived({ message: [message({ isFromMe: () => true })], thread: [thread()] });
		expect(m.display).not.toHaveBeenCalled();
	});

	it("filters unread messages outside the inbox", async () => {
		await notifier._onNewMailReceived({ message: [message()], thread: [thread("t1", false)] });
		expect(m.display).not.toHaveBeenCalled();
	});

	it("uses an incoming thread without querying the database", async () => {
		await notifier._onNewMailReceived({ message: [message()], thread: [thread()] });
		expect(m.find).not.toHaveBeenCalled();
		expect(m.display).toHaveBeenCalledOnce();
	});

	it("renders sender, subject, and snippet for a matching message", async () => {
		await notifier._onNewMailReceived({ message: [message()], thread: [thread()] });
		expect(m.display.mock.calls[0][0]).toMatchObject({
			title: "Ada", subtitle: "Hello", body: "Preview", canReply: true,
		});
	});

	it("falls back to Unknown and promotes the snippet when sender and subject are absent", () => {
		notifier._notifyOne({ message: message({ from: [], subject: "" }), thread: thread() });
		expect(m.display.mock.calls[0][0]).toMatchObject({ title: "Unknown", subtitle: "Preview", body: null });
	});

	it("closes active notifications when their thread becomes read", () => {
		const first = { close: vi.fn() };
		const second = { close: vi.fn() };
		notifier.activeNotifications.t1 = [first, second];
		notifier._onDatabaseUpdated({ objectClass: "Thread", objects: [{ id: "t1", unread: false }] });
		expect(first.close).toHaveBeenCalledOnce();
		expect(second.close).toHaveBeenCalledOnce();
		expect(notifier.activeNotifications.t1).toBeUndefined();
	});
});
