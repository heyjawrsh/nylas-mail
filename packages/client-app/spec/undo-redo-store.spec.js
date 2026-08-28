import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ undoTaskId: vi.fn(), queueTasks: vi.fn() }));

vi.mock("nylas-store", () => ({
	default: class NylasStore {
		trigger = vi.fn();
		listenTo = vi.fn();
	},
}));
vi.mock("../src/flux/actions.js", () => ({
	default: {
		queueTask: {}, queueTasks: mocks.queueTasks, undoTaskId: mocks.undoTaskId,
	},
}));

import undoRedoStore from "../src/flux/stores/undo-redo-store.js";

const task = (id, { undoable = true, redo = false } = {}) => ({
	id,
	isRedoTask: redo,
	canBeUndone: vi.fn(() => undoable),
	createIdenticalTask: vi.fn(() => ({ id: `copy-${id}` })),
});

describe("UndoRedoStore", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		store = new undoRedoStore.constructor();
		vi.clearAllMocks();
	});

	it("ignores missing queue arguments", () => {
		store._onQueue(null);
		expect(store.getMostRecent()).toEqual([]);
	});

	it("ignores an empty task batch", () => {
		store._onQueue([]);
		expect(store.trigger).not.toHaveBeenCalled();
	});

	it("records a single undoable task as the most recent batch", () => {
		const queued = task("one");
		store._onQueue(queued);
		expect(store.getMostRecent()).toEqual([queued]);
		expect(store.trigger).toHaveBeenCalledOnce();
	});

	it("rejects the whole batch when one task cannot be undone", () => {
		store._onQueue([task("one"), task("two", { undoable: false })]);
		expect(store.getMostRecent()).toEqual([]);
	});

	it("undo dispatches every original task id", () => {
		store._onQueue([task("one"), task("two")]);
		store.undo();
		expect(mocks.undoTaskId.mock.calls).toEqual([["one"], ["two"]]);
		expect(store.getMostRecent()).toEqual([]);
	});

	it("undo creates redo tasks marked as redo operations", () => {
		store._onQueue(task("one"));
		store.undo();
		store.redo();
		expect(mocks.queueTasks).toHaveBeenCalledWith([
			expect.objectContaining({ id: "copy-one", isRedoTask: true }),
		]);
	});

	it("undo and redo are no-ops with empty stacks", () => {
		store.undo();
		store.redo();
		expect(mocks.undoTaskId).not.toHaveBeenCalled();
		expect(mocks.queueTasks).not.toHaveBeenCalled();
	});

	it("a new ordinary task clears pending redo work", () => {
		store._onQueue(task("one"));
		store.undo();
		store._onQueue(task("two"));
		store.redo();
		expect(mocks.queueTasks).not.toHaveBeenCalled();
	});
});
