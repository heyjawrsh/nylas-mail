import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	ipcOn: vi.fn(), find: vi.fn(), findBy: vi.fn(), inTransaction: vi.fn(),
	queue: vi.fn(() => []), focused: vi.fn(), finalizeDraft: vi.fn(),
	queueTask: vi.fn(), dequeueTask: vi.fn(), focusDraft: vi.fn(),
	composePopoutDraft: vi.fn(), playSound: vi.fn(), extensions: vi.fn(() => []),
	sessions: [],
}));

vi.mock("electron", () => ({ ipcRenderer: { on: mocks.ipcOn } }));
vi.mock("nylas-store", () => ({ default: class NylasStore { listenTo() {} trigger() {} } }));
vi.mock("../src/flux/stores/draft-editing-session.js", () => ({
	default: class DraftEditingSession {
		constructor(draftClientId, draft) {
			this.draftClientId = draftClientId; this._draft = draft;
			this.prepare = vi.fn(() => Promise.resolve(this));
			this.teardown = vi.fn();
			this.draft = vi.fn(() => this._draft);
			this.changes = { add: vi.fn(), commit: vi.fn(() => Promise.resolve()) };
			mocks.sessions.push(this);
		}
	},
}));
vi.mock("../src/flux/stores/draft-helpers.js", () => ({ default: { finalizeDraft: mocks.finalizeDraft } }));
vi.mock("../src/flux/stores/draft-factory.js", () => ({ default: {} }));
vi.mock("../src/flux/stores/database-store.js", () => ({
	default: { listen: vi.fn(), find: mocks.find, findBy: mocks.findBy, inTransaction: mocks.inTransaction },
}));
vi.mock("../src/flux/stores/send-actions-store.js", () => ({ default: { DefaultSendActionKey: "send-now" } }));
vi.mock("../src/flux/stores/task-queue-status-store.js", () => ({ default: { queue: mocks.queue } }));
vi.mock("../src/flux/stores/focused-content-store.js", () => ({ default: { focused: mocks.focused } }));
vi.mock("../src/flux/tasks/base-draft-task.js", () => ({ default: class BaseDraftTask {} }));
vi.mock("../src/flux/tasks/perform-send-action-task.js", () => ({
	default: class PerformSendActionTask { constructor(draftClientId, key) { this.draftClientId = draftClientId; this.key = key; } },
}));
vi.mock("../src/flux/tasks/syncback-metadata-task.js", () => ({
	default: class SyncbackMetadataTask { constructor(...args) { this.args = args; } },
}));
vi.mock("../src/flux/tasks/destroy-draft-task.js", () => ({
	default: class DestroyDraftTask { constructor(draftClientId) { this.draftClientId = draftClientId; } },
}));
vi.mock("../src/flux/models/thread.js", () => ({ default: class Thread {} }));
vi.mock("../src/flux/models/message.js", () => ({
	default: class Message { static attributes = { body: {} }; },
}));
vi.mock("../src/flux/models/utils.js", () => ({ default: { generateTempId: vi.fn(() => "temp-1") } }));
vi.mock("../src/flux/actions.js", () => ({
	default: new Proxy({ queueTask: mocks.queueTask, dequeueTask: mocks.dequeueTask, focusDraft: mocks.focusDraft,
		composePopoutDraft: mocks.composePopoutDraft }, { get: (target, key) => target[key] || vi.fn() }),
}));
vi.mock("../src/registries/sound-registry.js", () => ({ default: { playSound: mocks.playSound } }));
vi.mock("../src/registries/extension-registry.js", () => ({ Composer: { extensions: mocks.extensions } }));

import DraftStore from "../src/flux/stores/draft-store.js";
import Message from "../src/flux/models/message.js";
import Thread from "../src/flux/models/thread.js";

describe("DraftStore", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks(); mocks.sessions.length = 0;
		NylasEnv.isMainWindow.mockReturnValue(true);
		NylasEnv.isComposerWindow = vi.fn(() => false);
		NylasEnv.close = vi.fn();
		NylasEnv.showErrorDialog = vi.fn();
		store = new DraftStore.constructor(); store.trigger = vi.fn();
	});

	it("requires a client id when requesting a session", () => {
		expect(() => store.sessionForClientId()).toThrow("requires a clientId");
	});

	it("creates and prepares one editing session per client id", async () => {
		const first = await store.sessionForClientId("draft-1");
		const second = await store.sessionForClientId("draft-1");
		expect(first).toBe(second);
		expect(mocks.sessions).toHaveLength(1);
		expect(first.prepare).toHaveBeenCalledTimes(2);
	});

	it("creates an optimistic session around a supplied draft", () => {
		const draft = { clientId: "draft-2" };
		expect(store._createSession("draft-2", draft)._draft).toBe(draft);
	});

	it("tears down and removes a completed session", () => {
		const session = store._createSession("draft-1", {});
		store._doneWithSession(session);
		expect(session.teardown).toHaveBeenCalledOnce();
		expect(store._draftSessions["draft-1"]).toBeUndefined();
	});

	it("reports false for a draft with no send in progress", () => {
		expect(store.isSendingDraft("draft-1")).toBe(false);
	});

	it("ignores database changes for non-message models", () => {
		store._onDataChanged({ objectClass: "Thread", objects: [{ draft: true }] });
		expect(store.trigger).not.toHaveBeenCalled();
	});

	it("ignores message changes that contain no drafts", () => {
		store._onDataChanged({ objectClass: Message.name, objects: [{ draft: false }] });
		expect(store.trigger).not.toHaveBeenCalled();
	});

	it("publishes message changes that contain a draft", () => {
		const change = { objectClass: Message.name, objects: [{ draft: true }] };
		store._onDataChanged(change);
		expect(store.trigger).toHaveBeenCalledWith(change);
	});

	it("accepts model instances as compose context without database reads", () => {
		const thread = new Thread(); const message = new Message();
		expect(store._modelifyContext({ thread, message })).toEqual({ thread, message });
		expect(mocks.find).not.toHaveBeenCalled();
	});

	it("rejects plain thread objects in compose context", () => {
		expect(() => store._modelifyContext({ thread: {} })).toThrow("expected a Model");
	});

	it("rejects plain message objects in compose context", () => {
		expect(() => store._modelifyContext({ threadId: "t", message: {} })).toThrow("expected a Model");
	});

	it("clears sending state after a cancelled send action", () => {
		store._draftsSending["draft-1"] = true;
		store._onDidCancelSendAction({ draftClientId: "draft-1" });
		expect(store.isSendingDraft("draft-1")).toBe(false);
		expect(store.trigger).toHaveBeenCalledWith("draft-1");
	});

	it("clears sending state after successful syncback", () => {
		store._draftsSending["draft-1"] = true;
		store._onSendDraftSuccess({ draftClientId: "draft-1" });
		expect(store.isSendingDraft("draft-1")).toBe(false);
	});

	it("marks a failed syncback as not sending", () => {
		NylasEnv.isMainWindow.mockReturnValue(false);
		store._draftsSending["draft-1"] = true;
		store._onSendDraftFailed({ draftClientId: "draft-1" });
		// Actual behavior keeps an explicit false entry instead of deleting it.
		expect(store._draftsSending["draft-1"]).toBe(false);
		expect(store.trigger).toHaveBeenCalledWith("draft-1");
	});

	it("shows an error in place when the failed draft thread is focused", () => {
		mocks.focused.mockReturnValue({ id: "thread-1" });
		store._notifyUserOfError({ draftClientId: "draft-1", threadId: "thread-1", errorMessage: "Nope", errorDetail: "Details" });
		expect(NylasEnv.showErrorDialog).toHaveBeenCalledWith("Nope", { detail: "Details" });
	});

	it("pops out a failed draft when its thread is not focused", () => {
		mocks.focused.mockReturnValue({ id: "other" });
		store._notifyUserOfError({ draftClientId: "draft-1", threadId: "thread-1", errorMessage: "Nope", errorDetail: "Details" });
		expect(mocks.composePopoutDraft).toHaveBeenCalledWith("draft-1", { errorMessage: "Nope", errorDetail: "Details" });
	});

	it("removes a file through the editing session change set", async () => {
		const session = store._createSession("draft-1", { files: [{ id: "keep" }, { id: "remove" }] });
		await store._onRemoveFile({ file: { id: "remove" }, messageClientId: "draft-1" });
		expect(session.changes.add).toHaveBeenCalledWith({ files: [{ id: "keep" }] });
		expect(session.changes.commit).toHaveBeenCalledOnce();
	});

	it("queues metadata syncback tasks after finalizing a draft", async () => {
		const draft = { clientId: "draft-1", pluginMetadata: [{ pluginId: "plugin-a" }, { pluginId: "plugin-b" }] };
		store._createSession("draft-1", draft); mocks.finalizeDraft.mockResolvedValue(draft);
		await store._onFinalizeDraftAndSyncbackMetadata("draft-1");
		expect(mocks.queueTask).toHaveBeenCalledTimes(2);
		expect(mocks.queueTask.mock.calls[0][0].args).toEqual(["draft-1", Message.name, "plugin-a"]);
	});

	it("enters sending state before draft finalization completes", () => {
		store._createSession("draft-1", {}); mocks.finalizeDraft.mockReturnValue(new Promise(() => {}));
		store._onSendDraft("draft-1");
		expect(store.isSendingDraft("draft-1")).toBe(true);
	});
});
