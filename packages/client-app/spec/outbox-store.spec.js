import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queue: vi.fn(() => []) }));

vi.mock("nylas-store", () => ({
	default: class NylasStore {
		trigger = vi.fn();
		listenTo = vi.fn();
	},
}));
vi.mock("../src/flux/tasks/send-draft-task.js", () => ({
	default: class SendDraftTask {
		constructor(values = {}) { Object.assign(this, values); }
	},
}));
vi.mock("../src/flux/stores/task-queue-status-store.js", () => ({
	default: { queue: mocks.queue },
	queue: mocks.queue,
}));

import outboxStore from "../src/flux/stores/outbox-store.js";
import SendDraftTask from "../src/flux/tasks/send-draft-task.js";

describe("OutboxStore", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.queue.mockReturnValue([]);
		store = new outboxStore.constructor();
		vi.clearAllMocks();
	});

	it("starts with no outbox items", () => {
		expect(store.itemsForAccount("a")).toEqual([]);
	});

	it("keeps only send-draft tasks", () => {
		const send = new SendDraftTask({ draftAccountId: "a" });
		mocks.queue.mockReturnValue([send, { draftAccountId: "a" }]);
		store._populate();
		expect(store.itemsForAccount("a")).toEqual([send]);
	});

	it("filters items by draft account", () => {
		const a = new SendDraftTask({ draftAccountId: "a" });
		const b = new SendDraftTask({ draftAccountId: "b" });
		mocks.queue.mockReturnValue([a, b]);
		store._populate();
		expect(store.itemsForAccount("b")).toEqual([b]);
	});

	it("does not publish when both old and new queues are empty", () => {
		store._populate();
		expect(store.trigger).not.toHaveBeenCalled();
	});

	it("publishes when the last send task disappears", () => {
		mocks.queue.mockReturnValue([new SendDraftTask({ draftAccountId: "a" })]);
		store._populate();
		vi.clearAllMocks();
		mocks.queue.mockReturnValue([]);
		store._populate();
		expect(store.trigger).toHaveBeenCalledOnce();
		expect(store.itemsForAccount("a")).toEqual([]);
	});
});
