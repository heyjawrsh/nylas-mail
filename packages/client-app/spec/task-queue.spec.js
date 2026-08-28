import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	findJSONBlob: vi.fn(() => Promise.resolve([])),
	inTransaction: vi.fn((callback) => callback({ persistJSONBlob: vi.fn() })),
	isInRegistry: vi.fn(() => true),
	recordPerfMetric: vi.fn(),
	listenTo: vi.fn(),
	trigger: vi.fn(),
	onBeforeUnload: vi.fn(),
	MockTask: class MockTask {
		static Status = { Retry: "RETRY", Success: "SUCCESS", Continue: "CONTINUE" };
		static DebugStatus = {
			DequeuedObsolete: "DEQUEUED_OBSOLETE",
			WaitingOnDependency: "WAITING_ON_DEPENDENCY",
			WaitingToRetry: "WAITING_TO_RETRY",
		};

		constructor(id = "task-1") {
			this.id = id;
			this.queueState = { isProcessing: false };
			this.runLocal = vi.fn(() => Promise.resolve());
			this.runRemote = vi.fn(() => Promise.resolve(this.constructor.Status.Success));
			this.cancel = vi.fn(() => Promise.resolve());
			this.createUndoTask = vi.fn(() => new this.constructor(`undo-${id}`));
			this.shouldDequeueOtherTask = vi.fn(() => false);
			this.isDependentOnTask = vi.fn(() => false);
			this.shouldBeDequeuedOnDependencyFailure = vi.fn(() => false);
			this.toJSON = vi.fn(() => ({ id }));
		}
	},
}));

vi.mock("underscore", async (importOriginal) => {
	const original = await importOriginal();
	const underscore = original.default || original;
	return { default: underscore, ...underscore };
});
vi.mock("fs-plus", () => ({ default: {}, named: vi.fn() }));
vi.mock("node:path", async (importOriginal) => {
	const path = await importOriginal();
	return { default: path, ...path };
});
vi.mock("reflux", () => ({ default: {}, named: vi.fn() }));
vi.mock("../src/flux/modules/reflux-coffee.js", () => ({
	default: { Listener: { listenTo: mocks.listenTo }, Publisher: { trigger: mocks.trigger } },
	Listener: { listenTo: mocks.listenTo },
	Publisher: { trigger: mocks.trigger },
}));
vi.mock("../src/flux/coffee-helpers.js", () => {
	const helpers = {
		includeModule(mixin) {
			// Invoked as Klass.include(mixin) — this is the class.
			Object.assign(this.prototype, mixin);
		},
	};
	return { default: helpers, includeModule: helpers.includeModule };
});

vi.mock("../src/flux/tasks/task.js", () => ({
	default: mocks.MockTask,
	MockTask: mocks.MockTask,
}));
vi.mock("../src/registries/task-registry.js", () => ({
	default: { isInRegistry: mocks.isInRegistry },
	isInRegistry: mocks.isInRegistry,
}));
vi.mock("../src/flux/models/utils.js", () => ({ default: {}, named: vi.fn() }));
vi.mock("../src/flux/actions.js", () => {
	const actions = {
		queueTask: {}, queueTasks: {}, undoTaskId: {}, dequeueTask: {},
		dequeueAllTasks: {}, dequeueMatchingTask: {}, clearDeveloperConsole: {},
		recordPerfMetric: mocks.recordPerfMetric,
	};
	return { default: actions, recordPerfMetric: mocks.recordPerfMetric };
});
vi.mock("../src/flux/stores/database-store.js", () => ({
	default: { findJSONBlob: mocks.findJSONBlob, inTransaction: mocks.inTransaction },
	findJSONBlob: mocks.findJSONBlob,
	inTransaction: mocks.inTransaction,
}));
vi.mock("../src/flux/errors.js", () => ({
	default: { APIError: class APIError extends Error {} },
	APIError: class APIError extends Error {},
}));

import taskQueueModule from "../src/flux/stores/task-queue.js";

// CJS singleton (module.exports = new TaskQueue()) under vitest interop:
// resolve the instance, then its class.
const taskQueue =
	taskQueueModule instanceof Function || taskQueueModule?.constructor
		? taskQueueModule
		: taskQueueModule?.default;
const TaskQueue = taskQueue?.constructor;
const MockTask = mocks.MockTask;

describe("TaskQueue", () => {
	let queue;

	beforeEach(async () => {
		vi.clearAllMocks();
		mocks.findJSONBlob.mockResolvedValue([]);
		mocks.isInRegistry.mockReturnValue(true);
		queue = new TaskQueue();
		queue._updateSoon = vi.fn();
		queue.trigger = vi.fn();
		// Let the constructor's asynchronous restore settle before each assertion.
		await Promise.resolve();
		await Promise.resolve();
		queue._updateSoon.mockClear();
		queue.trigger.mockClear();
	});

	it("constructs a fresh queue from the singleton constructor", () => {
		expect(queue).toBeInstanceOf(TaskQueue);
		expect(queue.queue()).toEqual([]);
	});


	it("returns the live queued task array", () => {
		const task = new MockTask();
		queue._queue.push(task);
		expect(queue.queue()).toBe(queue._queue);
		expect(queue.queue()).toEqual([task]);
	});

	it("returns the live completed task array", () => {
		const task = new MockTask();
		queue._completed.push(task);
		expect(queue.completed()).toBe(queue._completed);
	});

	it("combines queued and completed tasks without mutating either list", () => {
		queue._queue = [new MockTask("queued")];
		queue._completed = [new MockTask("done")];
		expect(queue.allTasks().map((task) => task.id)).toEqual(["queued", "done"]);
		expect(queue._queue).toHaveLength(1);
	});

	it("finds the first queued task by constructor name", () => {
		const task = new MockTask("one");
		queue._queue = [task];
		expect(queue.findTask("MockTask")).toBe(task);
	});

	it("accepts a task class when finding tasks", () => {
		const task = new MockTask("one");
		queue._queue = [task];
		expect(queue.findTasks(MockTask)).toEqual([task]);
	});

	it("filters found tasks with an object fixture", () => {
		queue._queue = [new MockTask("one"), new MockTask("two")];
		expect(queue.findTask("MockTask", { id: "two" }).id).toBe("two");
	});

	it("filters found tasks with a predicate", () => {
		queue._queue = [new MockTask("one"), new MockTask("two")];
		expect(queue.findTasks("MockTask", (task) => task.id === "one")).toHaveLength(1);
	});

	it("excludes completed tasks by default", () => {
		queue._completed = [new MockTask("done")];
		expect(queue.findTask("MockTask", { id: "done" })).toBeUndefined();
	});

	it("optionally includes completed tasks in searches", () => {
		const done = new MockTask("done");
		queue._completed = [done];
		expect(queue.findTasks("MockTask", {}, { includeCompleted: true })).toEqual([done]);
	});

	it("rejects values that are not Task instances", () => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		expect(() => queue.enqueue({ id: "plain", queueState: {} })).toThrow("Task` instance");
	});






	it("delegates undo creation back through enqueue", () => {
		const task = new MockTask("original");
		queue._queue = [task];
		queue.enqueue = vi.fn();
		queue.enqueueUndoOfTaskId("original");
		expect(task.createUndoTask).toHaveBeenCalledOnce();
		expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ id: "undo-original" }));
	});

	it("can undo a completed task fixture", () => {
		const task = new MockTask("completed");
		queue._completed = [task];
		queue.enqueue = vi.fn();
		queue.enqueueUndoOfTaskId("completed");
		expect(queue.enqueue).toHaveBeenCalledOnce();
	});


	it("delegates dequeue of a processing task to cancellation", () => {
		const task = new MockTask();
		task.queueState.isProcessing = true;
		queue._queue = [task];
		queue.dequeue(task.id);
		expect(task.cancel).toHaveBeenCalledOnce();
		expect(queue._queue).toEqual([task]);
	});

	it("throws when dequeue cannot resolve a task", () => {
		expect(() => queue.dequeue("missing")).toThrow("Couldn't find task");
	});



	it("clears completed tasks and publishes", () => {
		queue._completed = [new MockTask()];
		queue.clearCompleted();
		expect(queue._completed).toEqual([]);
		expect(queue.trigger).toHaveBeenCalledOnce();
	});

	it("reports whether dependencies block a task", () => {
		const upstream = new MockTask("upstream");
		const downstream = new MockTask("downstream");
		downstream.isDependentOnTask.mockImplementation((task) => task === upstream);
		queue._queue = [upstream, downstream];
		expect(queue._taskIsBlocked(downstream)).toBe(true);
		expect(queue._taskIsBlocked(upstream)).toBe(false);
	});


});
