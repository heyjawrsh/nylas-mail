import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ persistModels: vi.fn(), inTransaction: vi.fn(), findAll: vi.fn(), run: vi.fn(), wait: vi.fn(), increment: vi.fn(), decrement: vi.fn() }));
vi.mock("underscore", () => ({ default: {
	pluck: (xs, key) => xs.map((x) => x[key]), extend: Object.assign,
	pick: (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k]])),
	isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b), map: (xs, fn) => xs.map(fn),
	isString: (v) => typeof v === "string", intersection: (a, b) => a.filter((v) => b.includes(v)),
} }));
vi.mock("../src/flux/tasks/task.js", () => ({ default: class Task { static Status = { Success: "SUCCESS", Retry: "RETRY", Failed: "FAILED" }; constructor() { this.sequentialId = null; } } }));
vi.mock("../src/flux/models/thread.js", () => ({ default: class Thread {} }));
vi.mock("../src/flux/models/message.js", () => ({ default: class Message { static attributes = { threadId: { in: (ids) => ids } }; } }));
vi.mock("../src/flux/nylas-api.js", () => ({ default: { PermanentErrorCodes: [400, 401], incrementRemoteChangeLock: m.increment, decrementRemoteChangeLock: m.decrement } }));
vi.mock("../src/flux/syncback-task-api-request.js", () => ({ default: class SyncbackTaskAPIRequest {
	static waitForQueuedRequest = m.wait; constructor(options) { this.options = options; } run() { return m.run(this.options); }
} }));
vi.mock("../src/flux/stores/database-store.js", () => ({ default: { inTransaction: m.inTransaction, findAll: m.findAll } }));
vi.mock("../src/flux/errors.js", () => ({ APIError: class APIError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode; } } }));
vi.mock("../src/flux/tasks/ensure-message-in-sent-folder-task.js", () => ({ default: class EnsureMessageInSentFolderTask { constructor(options = {}) { Object.assign(this, options); } } }));
vi.mock("../src/flux/tasks/base-draft-task.js", () => ({ default: class BaseDraftTask {} }));

const { default: ChangeMailTask } = await import("../src/flux/tasks/change-mail-task.js");
const { default: Thread } = await import("../src/flux/models/thread.js");
const { APIError } = await import("../src/flux/errors.js");
if (!Promise.map) Promise.map = (items, fn) => Promise.all(items.map(fn));

class ExampleTask extends ChangeMailTask {
	changesToModel() { return { unread: false }; }
	requestBodyForModel(model) { return { unread: model.unread }; }
	recordUserEvent() {}
}
const model = (id, unread = true) => ({ id, accountId: "a1", unread, clone() { return { ...this }; } });

beforeEach(() => {
	vi.clearAllMocks();
	m.inTransaction.mockImplementation((cb) => cb({ persistModels: m.persistModels }));
	m.persistModels.mockResolvedValue(undefined); m.run.mockResolvedValue(undefined); m.wait.mockResolvedValue(undefined);
	NylasEnv.showErrorDialog = vi.fn(); NylasEnv.reportError = vi.fn();
});

describe("ChangeMailTask", () => {
	it("combines singular and plural constructor inputs", () => {
		const a = model("a"), b = model("b"), c = model("c"), d = model("d");
		expect(new ExampleTask({ threads: [a], thread: b, messages: [c], message: d })).toMatchObject({ threads: [a, b], messages: [c, d] });
	});

	it("throws for unimplemented change methods", () => expect(() => new ChangeMailTask().changesToModel()).toThrow("override"));

	it("applies changes and remembers prior values", () => {
		const original = model("m1"); const task = new ExampleTask({ messages: [original] });
		const changed = task._applyChanges(task.messages);
		expect(changed[0]).toMatchObject({ id: "m1", unread: false });
		expect(task._restoreValues).toEqual({ m1: { unread: true } });
	});

	it("does not clone an already matching model", () => {
		const original = model("m1", false); const task = new ExampleTask({ messages: [original] });
		expect(task._applyChanges(task.messages)).toEqual([]);
		expect(task.messages[0]).toBe(original);
	});

	it("restores saved fields while reverting", () => {
		const task = new ExampleTask({ messages: [model("m1", false)] }); task._isReverting = true; task._restoreValues = { m1: { unread: true } };
		expect(task._applyChanges(task.messages)[0].unread).toBe(true);
	});

	it("rejects an undo local run without restore values", async () => {
		const task = new ExampleTask(); task._isUndoTask = true;
		await expect(task.performLocal()).rejects.toThrow("No _restoreValues");
	});

	it("persists only changed messages", async () => {
		const task = new ExampleTask({ messages: [model("m1"), model("m2", false)] });
		await task.performLocal();
		expect(m.persistModels).toHaveBeenCalledWith([expect.objectContaining({ id: "m1", unread: false })]);
	});

	it("reports but suppresses event-recording errors", async () => {
		const task = new ExampleTask(); task.recordUserEvent = () => { throw new Error("analytics"); };
		await expect(task.performLocal()).resolves.toBeUndefined();
		expect(NylasEnv.reportError).toHaveBeenCalledWith(expect.objectContaining({ message: "analytics" }));
	});

	it("builds a PUT request for messages", async () => {
		const task = new ExampleTask({ messages: [model("m1", false)] });
		await task._performRequests(task.objectClass(), task.objectArray());
		expect(m.run.mock.calls[0][0].options).toMatchObject({ path: "/messages/m1", accountId: "a1", method: "PUT", body: { unread: false } });
	});

	it("builds a PUT request for threads", async () => {
		const thread = Object.assign(new Thread(), model("t1", false)); const task = new ExampleTask({ threads: [thread] });
		await task._performRequests(task.objectClass(), task.objectArray());
		expect(m.run.mock.calls[0][0].options.path).toBe("/threads/t1");
	});

	it("captures the created syncback request id", async () => {
		m.run.mockImplementation(async ({ options }) => options.onSyncbackRequestCreated({ id: "r1" }));
		const task = new ExampleTask({ messages: [model("m1")] }); await task._performRequests(task.objectClass(), task.objectArray());
		expect(task._syncbackRequestIds).toEqual({ m1: "r1" });
	});

	it("waits for a previously queued request", async () => {
		const task = new ExampleTask({ messages: [model("m1")] }); task._syncbackRequestIds = { m1: "r1" };
		await task._performRequests(task.objectClass(), task.objectArray());
		expect(m.wait).toHaveBeenCalledWith("r1"); expect(m.run).not.toHaveBeenCalled();
	});

	it("ignores a 404 request error", async () => {
		m.run.mockRejectedValue(new APIError("gone", 404));
		await expect(new ExampleTask({ messages: [model("m1")] })._performRequests(Object, [model("m1")])).resolves.toEqual([undefined]);
	});

	it("retries non-permanent API errors", async () => {
		const task = new ExampleTask({ messages: [model("m1")] }); task._locked = { m1: 1 }; m.run.mockRejectedValue(new APIError("offline", 500));
		await expect(task.performRemote()).resolves.toBe("RETRY");
	});

	it("reverts local changes after a permanent failure", async () => {
		const task = new ExampleTask({ messages: [model("m1", false)] }); task._restoreValues = { m1: { unread: true } }; task._locked = { m1: 1 }; m.run.mockRejectedValue(new Error("boom"));
		await expect(task.performRemote()).resolves.toEqual(["FAILED", expect.objectContaining({ message: "boom" })]);
		expect(task.messages[0].unread).toBe(true); expect(NylasEnv.showErrorDialog).toHaveBeenCalledOnce();
	});

	it("creates an undo task with ids and restore values", () => {
		const task = new ExampleTask({ messages: [model("m1")] }); task._restoreValues = { m1: { unread: true } };
		const undo = task.createUndoTask();
		expect(undo).toMatchObject({ messages: ["m1"], _isUndoTask: true, _restoreValues: task._restoreValues });
	});

	it("depends on an older overlapping change task", () => {
		const task = new ExampleTask({ messages: [model("m1")] }); task.sequentialId = 2;
		const older = new ExampleTask({ messages: [model("m1")] }); older.sequentialId = 1;
		expect(task.isDependentOnTask(older)).toBe(true);
	});
});
