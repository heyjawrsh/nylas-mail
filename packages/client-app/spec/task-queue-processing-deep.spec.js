import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	if (!Promise.map) Promise.map = (items, fn) => Promise.all(items.map(fn));
	if (!Promise.props) Promise.props = async (values) => {
		const entries = await Promise.all(Object.entries(values).map(async ([key, value]) => [key, await value]));
		return Object.fromEntries(entries);
	};
	class Task {
		static Status = { Retry: "retry", Success: "success", Continue: "continue" };
		static DebugStatus = {
			WaitingOnDependency: "waiting-dependency", WaitingToRetry: "waiting-retry",
			DequeuedDependency: "dequeued-dependency", DequeuedObsolete: "dequeued-obsolete",
		};
		constructor(id = "task") {
			this.id = id;
			this.queueState = { isProcessing: false };
			this.runLocal = vi.fn().mockResolvedValue(undefined);
			this.runRemote = vi.fn().mockResolvedValue(Task.Status.Success);
			this.cancel = vi.fn().mockResolvedValue(undefined);
			this.createUndoTask = vi.fn();
			this.shouldDequeueOtherTask = vi.fn(() => false);
			this.isDependentOnTask = vi.fn(() => false);
			this.shouldBeDequeuedOnDependencyFailure = vi.fn(() => false);
			this.onDependentTaskError = vi.fn().mockResolvedValue(undefined);
			this.toJSON = vi.fn(() => ({ id: this.id }));
		}
	}
	return {
		Task,
		findJSONBlob: vi.fn().mockResolvedValue([]),
		inTransaction: vi.fn((fn) => fn({ persistJSONBlob: vi.fn().mockResolvedValue(undefined) })),
		isInRegistry: vi.fn(() => true), listenTo: vi.fn(), trigger: vi.fn(),
		recordPerfMetric: vi.fn(), onBeforeUnload: vi.fn(),
	};
});

vi.mock("underscore", () => {
	const u = {
		any: (xs, fn) => xs.some(fn), defer: (fn) => fn(), filter: (xs, fn) => xs.filter(fn),
		find: (xs, fn) => xs.find(fn), findWhere: (xs, attrs) => xs.find((x) => Object.entries(attrs).every(([k, v]) => x[k] === v)),
		flatten: (xs) => xs.flat(Infinity), isFunction: (x) => typeof x === "function", isMatch: (x, attrs) => Object.entries(attrs).every(([k, v]) => x[k] === v),
		isString: (x) => typeof x === "string", mapObject: (obj, fn) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v, k)])),
		omit: (obj, fn) => Object.fromEntries(Object.entries(obj).filter(([k, v]) => !fn(v, k))), throttle: (fn) => fn,
	};
	return { default: u, ...u };
});
vi.mock("fs-plus", () => ({ default: {} }));
vi.mock("node:path", () => { const path = { join: (...parts) => parts.join("/") }; return { default: path, ...path }; });
vi.mock("reflux", () => ({ default: {} }));
vi.mock("../src/flux/modules/reflux-coffee.js", () => ({
	default: { Listener: { listenTo: m.listenTo }, Publisher: { trigger: m.trigger } },
	Listener: { listenTo: m.listenTo }, Publisher: { trigger: m.trigger },
}));
vi.mock("../src/flux/coffee-helpers.js", () => {
	const helpers = { includeModule(mixin) { Object.assign(this.prototype, mixin); } };
	return { default: helpers, ...helpers };
});
vi.mock("../src/flux/tasks/task.js", () => ({ default: m.Task, Task: m.Task }));
vi.mock("../src/registries/task-registry.js", () => ({ default: { isInRegistry: m.isInRegistry }, isInRegistry: m.isInRegistry }));
vi.mock("../src/flux/models/utils.js", () => ({ default: {} }));
vi.mock("../src/flux/actions.js", () => {
	const actions = { queueTask: {}, queueTasks: {}, undoTaskId: {}, dequeueTask: {}, dequeueAllTasks: {}, dequeueMatchingTask: {}, clearDeveloperConsole: {}, recordPerfMetric: m.recordPerfMetric };
	return { default: actions, ...actions };
});
vi.mock("../src/flux/stores/database-store.js", () => ({ default: { findJSONBlob: m.findJSONBlob, inTransaction: m.inTransaction }, findJSONBlob: m.findJSONBlob, inTransaction: m.inTransaction }));
vi.mock("../src/flux/errors.js", () => { class APIError extends Error {} return { default: { APIError }, APIError }; });

globalThis.NylasEnv = { isWorkWindow: vi.fn(() => true), inSpecMode: vi.fn(() => true), inDevMode: vi.fn(() => false), reportError: vi.fn(), config: { get: () => null, onDidChange: () => ({ dispose: () => {} }) }, getConfigDirPath: vi.fn(() => "/tmp"), getPath: vi.fn(() => "/tmp"), getVersion: () => "0.0.0", onBeforeUnload: m.onBeforeUnload };

const imported = await import("../src/flux/stores/task-queue.js");
const singleton = imported.default?.queue ? imported.default : imported;
const TaskQueue = singleton.constructor;
const Task = m.Task;

describe("TaskQueue processing and sequencing", () => {
	let queue;
	beforeEach(async () => {
		vi.clearAllMocks();
		m.findJSONBlob.mockResolvedValue([]);
		m.isInRegistry.mockReturnValue(true);
		queue = new TaskQueue();
		await Promise.resolve(); await Promise.resolve();
		queue._updateSoon = vi.fn();
		queue.trigger = vi.fn();
	});
	afterEach(() => vi.useRealTimers());

	it("does not start a blocked task", () => {
		const upstream = new Task("up"); const downstream = new Task("down"); downstream.isDependentOnTask.mockImplementation((x) => x === upstream); queue._queue = [upstream, downstream]; queue._processTask = vi.fn();
		queue._processQueue(); expect(queue._processTask).not.toHaveBeenCalledWith(downstream);
	});
	it("schedules retry processing with the safety margin", () => {
		vi.useFakeTimers(); vi.setSystemTime(1000); const task = new Task(); task.queueState.retryAfter = 2000; queue._queue = [task]; queue._processQueue();
		expect(vi.getTimerCount()).toBe(1); expect(queue._processQueueTimeout).toBeTruthy();
	});
	it("clears an existing queue timeout before processing", () => {
		vi.useFakeTimers(); queue._processQueueTimeout = setTimeout(() => {}, 5000); queue._processQueue(); expect(queue._processQueueTimeout).toBeNull();
	});
	it("triggers after at least one task starts", () => {
		queue._queue = [new Task()]; queue._processTask = vi.fn(); queue._processQueue(); expect(queue.trigger).toHaveBeenCalledOnce();
	});
	it("does not trigger when every task is delayed", () => {
		const task = new Task(); task.queueState.retryAfter = Date.now() + 1000; queue._queue = [task]; queue._processQueue(); expect(queue.trigger).not.toHaveBeenCalled();
	});
	it("ignores a task already being processed", () => {
		const task = new Task(); task.queueState.isProcessing = true; expect(queue._processTask(task)).toBeUndefined(); expect(task.runRemote).not.toHaveBeenCalled();
	});
	it("sets the processing flag before remote work", async () => {
		let observed; const task = new Task(); task.runRemote.mockImplementation(() => { observed = task.queueState.isProcessing; return Promise.resolve(Task.Status.Success); }); queue._queue = [task];
		queue.dequeue = vi.fn(); queue._updateSoon = vi.fn();
		await queue._processTask(task);
		expect(observed).toBe(true); expect(queue.dequeue).toHaveBeenCalledWith(task);
	});
	it("starts periodic updates while a task is processing", () => {
		vi.useFakeTimers(); const task = new Task(); task.queueState.isProcessing = true; queue._queue = [task]; queue._ensurePeriodicUpdates(); expect(vi.getTimerCount()).toBe(1);
	});
	it("does not create a second periodic update timer", () => {
		vi.useFakeTimers(); const task = new Task(); task.queueState.isProcessing = true; queue._queue = [task]; queue._ensurePeriodicUpdates(); queue._ensurePeriodicUpdates(); expect(vi.getTimerCount()).toBe(1);
	});
	it("stops periodic updates when processing finishes", () => {
		vi.useFakeTimers(); const task = new Task(); task.queueState.isProcessing = true; queue._queue = [task]; queue._ensurePeriodicUpdates(); task.queueState.isProcessing = false; queue._ensurePeriodicUpdates(); expect(queue._updatePeriodicallyTimeout).toBeNull();
	});
});
