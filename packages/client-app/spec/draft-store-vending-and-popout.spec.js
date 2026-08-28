import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	if (!Promise.props) Promise.props = (object) => Promise.all(Object.values(object)).then((values) => Object.fromEntries(Object.keys(object).map((key, index) => [key, values[index]])));
	if (!Promise.prototype.thenReturn) Promise.prototype.thenReturn = function thenReturn(value) { return this.then(() => value); };
	if (!Promise.prototype.reflect) Promise.prototype.reflect = function reflect() { return this.then((value) => ({ isFulfilled: () => true, value: () => value }), (error) => ({ isRejected: () => true, reason: () => error })); };
	return {
		ipcOn: vi.fn(), listenTo: vi.fn(), trigger: vi.fn(), sessions: [],
		find: vi.fn(), findBy: vi.fn(), inTransaction: vi.fn(), persistModel: vi.fn(),
		queue: vi.fn(() => []), finalizeDraft: vi.fn(), extensions: vi.fn(() => []),
		queueTask: vi.fn(), dequeueTask: vi.fn(), focusDraft: vi.fn(), sendDraft: vi.fn(),
		addAttachment: vi.fn(), composeBlank: vi.fn(), composePopout: vi.fn(),
		createDraft: vi.fn(), createMailto: vi.fn(), createReply: vi.fn(), createOrUpdateReply: vi.fn(), createForward: vi.fn(),
		playSound: vi.fn(), generateTempId: vi.fn(() => "temp-1"),
	};
});

vi.mock("electron", () => {
	const ipcRenderer = { on: m.ipcOn };
	return { default: { ipcRenderer }, ipcRenderer };
});
vi.mock("nylas-store", () => ({ default: class NylasStore {
	listenTo(...args) { return m.listenTo(...args); }
	trigger(...args) { return m.trigger(...args); }
} }));
vi.mock("underscore", () => {
	const underscore = {
		each: (object, fn) => Object.values(object || {}).forEach(fn),
		extend: (target, ...sources) => Object.assign(target, ...sources),
		clone: (value) => value == null ? value : [...value],
		reject: (items, fn) => items.filter((item) => !fn(item)),
	};
	return { default: underscore, ...underscore };
});
vi.mock("../src/flux/stores/draft-editing-session.js", () => ({ default: class DraftEditingSession {
	constructor(draftClientId, draft) {
		this.draftClientId = draftClientId; this._draft = draft;
		this.prepare = vi.fn(() => Promise.resolve(this)); this.teardown = vi.fn();
		this.draft = vi.fn(() => this._draft);
		this.changes = { add: vi.fn(), commit: vi.fn(() => Promise.resolve()) };
		m.sessions.push(this);
	}
} }));
vi.mock("../src/flux/stores/draft-helpers.js", () => ({ default: { finalizeDraft: m.finalizeDraft } }));
vi.mock("../src/flux/stores/draft-factory.js", () => ({ default: {
	createDraft: m.createDraft, createDraftForMailto: m.createMailto,
	createDraftForReply: m.createReply, createOrUpdateDraftForReply: m.createOrUpdateReply,
	createDraftForForward: m.createForward,
} }));
vi.mock("../src/flux/stores/database-store.js", () => ({ default: {
	find: m.find, findBy: m.findBy, inTransaction: m.inTransaction,
} }));
vi.mock("../src/flux/stores/send-actions-store.js", () => ({ default: { DefaultSendActionKey: "send-now" } }));
vi.mock("../src/flux/stores/task-queue-status-store.js", () => ({ default: { queue: m.queue } }));
vi.mock("../src/flux/stores/focused-content-store.js", () => ({ default: { focused: vi.fn() } }));
vi.mock("../src/flux/tasks/base-draft-task.js", () => ({ default: class BaseDraftTask {
	constructor(id, draftClientId) { this.id = id; this.draftClientId = draftClientId; }
} }));
vi.mock("../src/flux/tasks/perform-send-action-task.js", () => ({ default: class PerformSendActionTask {
	constructor(draftClientId, key) { this.draftClientId = draftClientId; this.key = key; }
} }));
vi.mock("../src/flux/tasks/syncback-metadata-task.js", () => ({ default: class SyncbackMetadataTask {} }));
vi.mock("../src/flux/tasks/destroy-draft-task.js", () => ({ default: class DestroyDraftTask {
	constructor(draftClientId) { this.draftClientId = draftClientId; }
} }));
vi.mock("../src/flux/models/thread.js", () => ({ default: class Thread {} }));
vi.mock("../src/flux/models/message.js", () => ({ default: class Message {
	static attributes = { body: {}, date: { descending: () => "date-desc" } };
} }));
vi.mock("../src/flux/models/utils.js", () => ({ default: { generateTempId: m.generateTempId } }));
vi.mock("../src/flux/actions.js", () => ({ default: {
	composeReply: vi.fn(), composeForward: vi.fn(), composePopoutDraft: m.composePopout,
	composeNewBlankDraft: m.composeBlank, composeNewDraftToRecipient: vi.fn(),
	draftDeliveryFailed: vi.fn(), draftDeliverySucceeded: vi.fn(), didCancelSendAction: vi.fn(),
	sendQuickReply: vi.fn(), finalizeDraftAndSyncbackMetadata: vi.fn(), sendDraft: m.sendDraft,
	destroyDraft: vi.fn(), removeFile: vi.fn(), queueTask: m.queueTask, dequeueTask: m.dequeueTask,
	focusDraft: m.focusDraft, addAttachment: m.addAttachment,
} }));
vi.mock("../src/registries/sound-registry.js", () => ({ default: { playSound: m.playSound } }));
vi.mock("../src/registries/extension-registry.js", () => {
	const registry = { Composer: { extensions: m.extensions } };
	return { default: registry, ...registry };
});

globalThis.NylasEnv = {
	isMainWindow: vi.fn(() => true), isComposerWindow: vi.fn(() => false),
	onBeforeUnload: vi.fn(), close: vi.fn(), newWindow: vi.fn(), showErrorDialog: vi.fn(),
	timer: { start: vi.fn() }, config: { get: vi.fn(() => false) },
};

const { default: DraftStore } = await import("../src/flux/stores/draft-store.js");
const { default: Message } = await import("../src/flux/models/message.js");
const { default: Thread } = await import("../src/flux/models/thread.js");
const { default: BaseDraftTask } = await import("../src/flux/tasks/base-draft-task.js");

const draft = (overrides = {}) => ({
	clientId: "draft-1", pristine: false, files: [], pluginMetadata: [],
	toJSON: vi.fn(() => ({ clientId: "draft-1", subject: "Hello" })), ...overrides,
});

describe("DraftStore session vending and teardown", () => {
	let store;
	beforeEach(() => {
		vi.clearAllMocks(); vi.useRealTimers(); m.sessions.length = 0;
		NylasEnv.isMainWindow.mockReturnValue(true); NylasEnv.isComposerWindow.mockReturnValue(false);
		NylasEnv.config.get.mockReturnValue(false);
		m.inTransaction.mockImplementation((fn) => Promise.resolve(fn({ persistModel: m.persistModel })));
		m.persistModel.mockResolvedValue(undefined); m.extensions.mockReturnValue([]); m.queue.mockReturnValue([]);
		store = new DraftStore.constructor(); store.trigger = vi.fn();
	});

	it("tears down every cached session during cleanup", () => {
		const one = store._createSession("one", draft({ clientId: "one" }));
		const two = store._createSession("two", draft({ clientId: "two" }));
		store._cleanupAllSessions();
		expect(one.teardown).toHaveBeenCalledOnce(); expect(two.teardown).toHaveBeenCalledOnce();
	});

	it("empties the session cache during cleanup", () => {
		store._createSession("one", draft()); store._cleanupAllSessions();
		expect(store._draftSessions).toEqual({});
	});

	it("allows unload immediately when no sessions exist", () => {
		expect(store._onBeforeUnload(vi.fn())).toBe(true);
	});

	it("queues destruction of pristine drafts before unload", () => {
		store._createSession("one", draft({ clientId: "one", pristine: true }));
		expect(store._onBeforeUnload(vi.fn())).toBe(true);
		expect(m.queueTask.mock.calls[0][0].draftClientId).toBe("one");
	});

	it("does not commit pristine drafts before unload", () => {
		const session = store._createSession("one", draft({ pristine: true }));
		store._onBeforeUnload(vi.fn()); expect(session.changes.commit).not.toHaveBeenCalled();
	});

	it("blocks unload while an edited draft commits", () => {
		store._createSession("one", draft());
		expect(store._onBeforeUnload(vi.fn())).toBe(false);
	});

	it("releases unload after edited commits settle", async () => {
		vi.useFakeTimers(); const ready = vi.fn(); store._createSession("one", draft());
		store._onBeforeUnload(ready); await Promise.resolve(); await Promise.resolve();
		await vi.advanceTimersByTimeAsync(15); expect(ready).toHaveBeenCalledOnce();
	});

	it("clears cached sessions once unload commits settle", async () => {
		vi.useFakeTimers(); store._createSession("one", draft()); store._onBeforeUnload(vi.fn());
		await Promise.resolve(); await Promise.resolve(); await vi.advanceTimersByTimeAsync(15);
		expect(store._draftSessions).toEqual({});
	});

	it("selects a thread by id when models are not supplied", () => {
		const query = { include: vi.fn(() => query) }; m.find.mockReturnValue(query);
		store._modelifyContext({ threadId: "thread-1", messageId: "message-1" });
		expect(m.find).toHaveBeenCalledWith(Thread, "thread-1");
	});

	it("selects a message by id with its body", () => {
		const query = { include: vi.fn(() => query) }; m.find.mockReturnValue(query);
		const result = store._modelifyContext({ threadId: "thread-1", messageId: "message-1" });
		expect(m.find).toHaveBeenCalledWith(Message, "message-1"); expect(result.message.include).toHaveBeenCalledWith(Message.attributes.body);
	});

	it("selects the newest thread message when no message id is supplied", () => {
		const query = { order: vi.fn(() => query), limit: vi.fn(() => query), include: vi.fn(() => query) };
		m.find.mockReturnValue("thread-query"); m.findBy.mockReturnValue(query);
		store._modelifyContext({ threadId: "thread-1" });
		expect(m.findBy).toHaveBeenCalledWith(Message, { threadId: "thread-1" });
		expect(query.order).toHaveBeenCalledWith("date-desc"); expect(query.limit).toHaveBeenCalledWith(1);
	});

	it("uses the supplied thread id for newest-message selection", () => {
		const thread = new Thread(); thread.id = "model-thread";
		const query = { order: () => query, limit: () => query, include: () => query }; m.findBy.mockReturnValue(query);
		store._modelifyContext({ thread, threadId: "explicit-thread" });
		expect(m.findBy).toHaveBeenCalledWith(Message, { threadId: "explicit-thread" });
	});
});

describe("DraftStore popouts, triggers, and task handoff", () => {
	let store;
	beforeEach(() => {
		vi.clearAllMocks(); m.sessions.length = 0; vi.useRealTimers();
		NylasEnv.isMainWindow.mockReturnValue(true); NylasEnv.isComposerWindow.mockReturnValue(false); NylasEnv.config.get.mockReturnValue(false);
		m.inTransaction.mockImplementation((fn) => Promise.resolve(fn({ persistModel: m.persistModel })));
		m.persistModel.mockResolvedValue(undefined); m.extensions.mockReturnValue([]); m.queue.mockReturnValue([]);
		store = new DraftStore.constructor(); store.trigger = vi.fn();
	});

	it("lets composer extensions prepare a new draft", async () => {
		const prepareNewDraft = vi.fn(); m.extensions.mockReturnValue([{ prepareNewDraft }]); const value = draft();
		await store._finalizeAndPersistNewMessage(value);
		expect(prepareNewDraft).toHaveBeenCalledWith({ draft: value });
	});

	it("persists a new draft before focusing it", async () => {
		const value = draft(); await store._finalizeAndPersistNewMessage(value);
		expect(m.persistModel).toHaveBeenCalledWith(value); expect(m.focusDraft).toHaveBeenCalledWith({ draftClientId: "draft-1" });
	});

	it("returns the persisted draft and its client id", async () => {
		const value = draft();
		await expect(store._finalizeAndPersistNewMessage(value)).resolves.toEqual({ draftClientId: "draft-1", draft: value });
	});

	it("commits session changes before opening a popout", async () => {
		const session = store._createSession("draft-1", draft()); await store._onPopoutDraftClientId("draft-1");
		expect(session.changes.commit).toHaveBeenCalledOnce();
	});

	it("tracks a popout by a stable composer window key", async () => {
		store._createSession("draft-1", draft()); await store._onPopoutDraftClientId("draft-1");
		expect(NylasEnv.newWindow).toHaveBeenCalledWith(expect.objectContaining({ windowKey: "composer-draft-1", timerId: "draft-1" }));
	});

	it("labels explicitly new popouts as New Message", async () => {
		store._createSession("draft-1", draft()); await store._onPopoutDraftClientId("draft-1", { newDraft: true, timerId: "timer" });
		expect(NylasEnv.newWindow).toHaveBeenCalledWith(expect.objectContaining({ title: "New Message" }));
	});

	it("passes serialized draft state into the popout", async () => {
		const value = draft(); store._createSession("draft-1", value); await store._onPopoutDraftClientId("draft-1", { marker: 7 });
		expect(NylasEnv.newWindow.mock.calls[0][0].windowProps).toMatchObject({ marker: 7, draftClientId: "draft-1", draftJSON: { subject: "Hello" } });
	});

	it("does not restart a caller-provided popout timer", async () => {
		store._createSession("draft-1", draft()); await store._onPopoutDraftClientId("draft-1", { timerId: "existing" });
		expect(NylasEnv.timer.start).not.toHaveBeenCalled();
	});

	it("creates a recipient draft with the contact selected", async () => {
		const value = draft(); m.createDraft.mockResolvedValue(value); vi.spyOn(store, "_onPopoutDraftClientId").mockResolvedValue();
		await store._onPopoutNewDraftToRecipient({ email: "a@example.com" });
		expect(m.createDraft).toHaveBeenCalledWith({ to: [{ email: "a@example.com" }] });
	});

	it("creates an empty draft for a blank composer", async () => {
		m.createDraft.mockResolvedValue(draft()); vi.spyOn(store, "_onPopoutDraftClientId").mockResolvedValue();
		await store._onPopoutBlankDraft(); expect(m.createDraft).toHaveBeenCalledWith();
	});

	it("opens a mailto draft after parsing the URL", async () => {
		m.createMailto.mockResolvedValue(draft()); vi.spyOn(store, "_onPopoutDraftClientId").mockResolvedValue();
		await store._onHandleMailtoLink({}, "mailto:a@example.com"); expect(m.createMailto).toHaveBeenCalledWith("mailto:a@example.com");
	});

	it("reports malformed mailto links", async () => {
		m.createMailto.mockRejectedValue(new Error("bad mailto")); await store._onHandleMailtoLink({}, "bad");
		expect(NylasEnv.showErrorDialog).toHaveBeenCalledWith("Error: bad mailto");
	});

	it("waits for every attachment upload before opening mail files", async () => {
		m.createDraft.mockResolvedValue(draft()); const popout = vi.spyOn(store, "_onPopoutDraftClientId").mockResolvedValue();
		await store._onHandleMailFiles({}, ["one.txt", "two.txt"]); expect(popout).not.toHaveBeenCalled();
		m.addAttachment.mock.calls[0][0].onUploadCreated(); expect(popout).not.toHaveBeenCalled();
		m.addAttachment.mock.calls[1][0].onUploadCreated(); expect(popout).toHaveBeenCalledWith("draft-1", { timerId: "temp-1" });
	});

	it("dequeues only queued draft tasks for the destroyed draft", () => {
		m.queue.mockReturnValue([new BaseDraftTask("matching", "draft-1"), new BaseDraftTask("other", "draft-2"), { id: "plain", draftClientId: "draft-1" }]);
		store._onDestroyDraft("draft-1"); expect(m.dequeueTask).toHaveBeenCalledOnce(); expect(m.dequeueTask).toHaveBeenCalledWith("matching");
	});

	it("closes a composer after destroying its draft", () => {
		NylasEnv.isComposerWindow.mockReturnValue(true); store._onDestroyDraft("draft-1"); expect(NylasEnv.close).toHaveBeenCalledOnce();
	});

	it("queues the default send action and tears down its session", async () => {
		const session = store._createSession("draft-1", draft()); m.finalizeDraft.mockResolvedValue(draft());
		await store._onSendDraft("draft-1"); const task = m.queueTask.mock.calls[0][0];
		expect(task).toMatchObject({ draftClientId: "draft-1", key: "send-now" }); expect(session.teardown).toHaveBeenCalledOnce();
	});

	it("plays the send sound when enabled", async () => {
		NylasEnv.config.get.mockReturnValue(true); store._createSession("draft-1", draft()); m.finalizeDraft.mockResolvedValue(draft());
		await store._onSendDraft("draft-1", "later"); expect(m.playSound).toHaveBeenCalledWith("hit-send");
	});
});
