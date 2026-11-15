import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	class Emitter { constructor() { this.map = new Map(); } on(n, cb) { const a = this.map.get(n) || []; a.push(cb); this.map.set(n, a); return { dispose: () => this.map.set(n, a.filter(x => x !== cb)) }; } emit(n, v) { for (const cb of [...(this.map.get(n) || [])]) cb(v); } }
	const stream = () => ({ on: vi.fn(), removeAllListeners: vi.fn() });
	const child = { send: vi.fn(), kill: vi.fn(), on: vi.fn(), removeAllListeners: vi.fn(), stdout: stream(), stderr: stream() };
	const cp = { fork: vi.fn(() => child) };
	const us = { extend: Object.assign, isFunction: x => typeof x === "function", each: (o, cb) => Object.entries(o).forEach(([k, v]) => cb(v, k)), every: (a, cb) => a.every(cb), isMatch: (o, a) => Object.entries(a).every(([k, v]) => o[k] === v) };
	class Thread { constructor(v = {}) { Object.assign(this, v); } } class Category { constructor(v = {}) { Object.assign(this, v); } }
	class CapturedTask { constructor(values) { this.values = values; } }
	class BaseTask { static Status = { Success: "SUCCESS", Retry: "RETRY", Failed: "FAILED" }; validateRequiredFields(fs) { for (const f of fs) if (!this[f]) throw new Error(`Must pass ${f}`); } }
	class APIError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode; } }
	const accountForId = vi.fn(), categoryStore = { getSpamCategory: vi.fn(), getInboxCategory: vi.fn(), getArchiveCategory: vi.fn(), getTrashCategory: vi.fn() };
	const db = { findBy: vi.fn(), inTransaction: vi.fn() }, requestRun = vi.fn(), requests = [];
	class Request { constructor(values) { this.values = values; requests.push(this); } run() { return requestRun(); } }
	const syncRun = vi.fn(), syncWait = vi.fn(), syncRequests = [];
	class SyncRequest { static waitForQueuedRequest(id) { return syncWait(id); } constructor(values) { this.values = values; syncRequests.push(this); } run() { return syncRun(); } }
	const api = { PermanentErrorCodes: [400, 403] }, remote = { app: {} }, electron = { remote };
	return { Emitter, child, cp, us, Thread, Category, CapturedTask, BaseTask, APIError, accountForId, categoryStore, db, requestRun, requests, Request, syncRun, syncWait, syncRequests, SyncRequest, api, remote, electron };
});

vi.mock("underscore", () => ({ default: m.us, ...m.us }));
vi.mock("node:child_process", () => ({ default: m.cp, ...m.cp }));
vi.mock("event-kit", () => ({ default: { Emitter: m.Emitter }, Emitter: m.Emitter }));
vi.mock("../src/compile-cache.js", () => ({ default: { getCacheDirectory: () => "/cache" }, getCacheDirectory: () => "/cache" }));
vi.mock("electron", () => ({ default: m.electron, ...m.electron }));
vi.mock("@electron/remote", () => ({ default: m.remote, ...m.remote, remote: m.remote }));
vi.mock("../src/flux/tasks/change-folder-task.js", () => ({ default: m.CapturedTask }));
vi.mock("../src/flux/tasks/change-labels-task.js", () => ({ default: m.CapturedTask }));
vi.mock("../src/flux/tasks/change-unread-task.js", () => ({ default: m.CapturedTask }));
vi.mock("../src/flux/tasks/change-starred-task.js", () => ({ default: m.CapturedTask }));
vi.mock("../src/flux/stores/account-store.js", () => ({ default: { accountForId: m.accountForId } }));
vi.mock("../src/flux/stores/category-store.js", () => ({ default: m.categoryStore }));
vi.mock("../src/flux/models/thread.js", () => ({ default: m.Thread }));
vi.mock("../src/flux/models/category.js", () => ({ default: m.Category }));
vi.mock("../src/flux/tasks/task.js", () => ({ default: m.BaseTask }));
vi.mock("../src/flux/nylas-api.js", () => ({ default: m.api, ...m.api }));
vi.mock("../src/flux/nylas-api-request.js", () => ({ default: m.Request }));
vi.mock("../src/flux/syncback-task-api-request.js", () => ({ default: m.SyncRequest }));
vi.mock("../src/flux/errors.js", () => ({ default: { APIError: m.APIError }, APIError: m.APIError }));
vi.mock("../src/flux/stores/database-store.js", () => ({ default: m.db }));

globalThis.NylasEnv = { isWorkWindow: vi.fn(() => true), inSpecMode: vi.fn(() => true), inDevMode: vi.fn(() => false), reportError: vi.fn(), showErrorDialog: vi.fn(), config: { get: vi.fn(), onDidChange: vi.fn(() => ({ dispose: vi.fn() })) }, getConfigDirPath: vi.fn(() => "/config"), getPath: vi.fn(() => "/tmp"), getVersion: vi.fn(() => "0") };
if (!Promise.prototype.thenReturn) Promise.prototype.thenReturn = function (value) { return this.then(() => value); };

const { default: ProcessTask } = await import("../src/task.js");
const { default: Factory } = await import("../src/flux/tasks/task-factory.js");
const { default: SyncModel } = await import("../src/flux/tasks/syncback-model-task.js");
const { default: SyncCategory } = await import("../src/flux/tasks/syncback-category-task.js");

beforeEach(() => { vi.clearAllMocks(); m.requests.length = 0; m.syncRequests.length = 0; m.cp.fork.mockReturnValue(m.child); m.accountForId.mockReturnValue({ usesFolders: () => false, usesLabels: () => true }); m.db.inTransaction.mockImplementation(cb => cb({ persistModel: vi.fn(x => Promise.resolve(x)), unpersistModel: vi.fn(x => Promise.resolve(x)) })); });

describe("process Task lifecycle", () => {
	it("uses the final function as completion callback", () => { const cb = vi.fn(), t = new ProcessTask("../src/task-bootstrap.js"); t.start("a", cb); t.emitter.emit("task:completed", ["done"]); expect(cb).toHaveBeenCalledWith("done"); t.terminate(); });
	it("runs a once listener once", () => { const cb = vi.fn(), t = new ProcessTask("../src/task-bootstrap.js"); t.once("ready", cb); t.emitter.emit("ready", [1]); t.emitter.emit("ready", [2]); expect(cb).toHaveBeenCalledOnce(); t.terminate(); });
	it("rejects start after termination", () => { const t = new ProcessTask("../src/task-bootstrap.js"); t.terminate(); expect(() => t.start()).toThrow("Cannot start terminated process"); });
	it("rejects send after termination", () => { const t = new ProcessTask("../src/task-bootstrap.js"); t.terminate(); expect(() => t.send({})).toThrow("Cannot send message to terminated process"); });
	it("emits cancellation for a live child", () => { const cb = vi.fn(), t = new ProcessTask("../src/task-bootstrap.js"); t.on("task:canceled", cb); expect(t.cancel()).toBe(true); expect(cb).toHaveBeenCalledOnce(); });
});

describe("TaskFactory dispatch", () => {
	it("requires Thread instances", () => { expect(() => Factory.tasksForApplyingCategories({ threads: [{}] })).toThrow("must be instances of Thread"); });
	it("groups label tasks by account", () => { expect(Factory.tasksForApplyingCategories({ threads: [new m.Thread({ accountId: "a" }), new m.Thread({ accountId: "b" })], categoriesToAdd: () => [new m.Category()] })).toHaveLength(2); });
	it("creates folder work for folder accounts", () => { m.accountForId.mockReturnValue({ usesFolders: () => true }); const folder = new m.Category(); const [t] = Factory.tasksForApplyingCategories({ threads: [new m.Thread({ accountId: "a" })], categoriesToAdd: () => [folder] }); expect(t.values.folder).toBe(folder); });
	it("skips folder work without a destination", () => { m.accountForId.mockReturnValue({ usesFolders: () => true }); expect(Factory.tasksForApplyingCategories({ threads: [new m.Thread({ accountId: "a" })] })).toEqual([]); });
	it("rejects multiple folders", () => { m.accountForId.mockReturnValue({ usesFolders: () => true }); expect(() => Factory.tasksForApplyingCategories({ threads: [new m.Thread({ accountId: "a" })], categoriesToAdd: () => [new m.Category(), new m.Category()] })).toThrow("single `Category`"); });
	it("rejects a non-Category folder", () => { m.accountForId.mockReturnValue({ usesFolders: () => true }); expect(() => Factory.tasksForApplyingCategories({ threads: [new m.Thread({ accountId: "a" })], categoriesToAdd: () => [{}] })).toThrow("must return a Category"); });
	it("inverts unread state", () => { expect(Factory.taskForInvertingUnread({ threads: [{ unread: false }] }).values.unread).toBe(true); });
	it("inverts starred state", () => { expect(Factory.taskForInvertingStarred({ threads: [{ starred: true }] }).values.starred).toBe(false); });
	it("rejects a single-category action across accounts", () => { expect(() => Factory.taskForApplyingCategory({ threads: [new m.Thread({ accountId: "a" }), new m.Thread({ accountId: "b" })], category: new m.Category() })).toThrow("same account"); });
});

describe("SyncbackModelTask", () => {
	class Model {} class Concrete extends SyncModel { getModelConstructor() { return Model; } }
	it("dequeues the same client", () => { expect(new Concrete({ clientId: "c" }).shouldDequeueOtherTask(new Concrete({ clientId: "c" }))).toBe(true); });
	it("requires clientId locally", () => { expect(() => new Concrete().performLocal()).toThrow("Must pass clientId"); });
	it("looks up its model", async () => { m.db.findBy.mockResolvedValue({}); await new Concrete({ clientId: "c" }).getLatestModel(); expect(m.db.findBy).toHaveBeenCalledWith(Model, { clientId: "c" }); });
	it("rejects a missing model", () => { expect(() => new Concrete({ clientId: "c" }).verifyModel()).toThrow("Can't find a 'Model'"); });
	it("builds POST data for a new model", () => { const model = { isSavedRemotely: () => false, toJSON: () => ({ n: 1 }) }; expect(new Concrete({ endpoint: "/events" }).getRequestData(model)).toEqual({ path: "/events", body: { n: 1 }, method: "POST" }); });
	it("builds PUT data for a saved model", () => { const model = { serverId: "s", isSavedRemotely: () => true, toJSON: () => ({}) }; expect(new Concrete({ endpoint: "/events" }).getRequestData(model).path).toBe("/events/s"); });
	it("adds accountId to requests", async () => { m.requestRun.mockResolvedValue({}); await new Concrete({ endpoint: "/e" }).makeRequest({ accountId: "a", isSavedRemotely: () => false, toJSON: () => ({}) }); expect(m.requests[0].values.options.accountId).toBe("a"); });
	it("applies only id and version", () => { const model = { name: "local" }; new Concrete().applyRemoteChangesToModel(model, { id: "s", version: 2, name: "remote" }); expect(model).toEqual({ name: "local", serverId: "s", version: 2 }); });
	it("retries temporary API errors", async () => { await expect(new Concrete().handleRemoteError(new m.APIError("busy", 503))).resolves.toBe("RETRY"); });
	it("reports unexpected errors", async () => { const e = new Error("x"); await new Concrete().handleRemoteError(e); expect(NylasEnv.reportError).toHaveBeenCalledWith(e); });
});

describe("SyncbackCategoryTask", () => {
	const cat = (v = {}) => ({ accountId: "a", displayName: "Receipts", displayType: () => "label", ...v });
	it("labels creates", () => { expect(new SyncCategory({ category: cat() }).label()).toBe("Creating new label"); });
	it("labels updates", () => { expect(new SyncCategory({ category: cat({ serverId: "s" }) }).label()).toBe("Updating label"); });
	it("rejects missing local category", async () => { await expect(new SyncCategory().performLocal()).rejects.toThrow("without this.category"); });
	it("renames before local persistence", async () => { const c = cat({ serverId: "s" }), t = new SyncCategory({ category: c, displayName: "Bills" }); await t.performLocal(); expect(c.displayName).toBe("Bills"); expect(t._initialDisplayName).toBe("Receipts"); });
	it("builds label POST requests", async () => { m.syncRun.mockResolvedValue({ id: "s" }); await new SyncCategory({ category: cat() }).performRemote(); expect(m.syncRequests[0].values.options).toEqual(expect.objectContaining({ path: "/labels", method: "POST", body: { display_name: "Receipts" } })); });
	it("builds folder PUT requests", async () => { m.accountForId.mockReturnValue({ usesLabels: () => false }); m.syncRun.mockResolvedValue({ id: "s" }); await new SyncCategory({ category: cat({ serverId: "s" }), displayName: "Bills" }).performRemote(); expect(m.syncRequests[0].values.options).toEqual(expect.objectContaining({ path: "/folders/s", method: "PUT" })); });
	it("records queued request ids", () => { m.syncRun.mockReturnValue(new Promise(() => {})); const t = new SyncCategory({ category: cat() }); t.performRemote(); m.syncRequests[0].values.options.onSyncbackRequestCreated({ id: "q" }); expect(t._syncbackRequestId).toBe("q"); });
	it("waits for queued requests", async () => { m.syncWait.mockResolvedValue({ id: "s" }); const t = new SyncCategory({ category: cat() }); t._syncbackRequestId = "q"; await t.performRemote(); expect(m.syncWait).toHaveBeenCalledWith("q"); });
});
