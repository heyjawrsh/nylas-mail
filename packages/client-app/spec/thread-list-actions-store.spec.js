import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	globalThis.NylasEnv = {
		isMainWindow: () => true,
		timer: { start: vi.fn(), stop: vi.fn(() => 42) },
	};
	return {
		queueTask: vi.fn(), queueTasks: vi.fn(), recordPerfMetric: vi.fn(),
		tasksForArchiving: vi.fn(() => ["archive-task"]),
		tasksForMovingToTrash: vi.fn(() => ["trash-task"]),
		tasksForMarkingAsSpam: vi.fn(() => ["spam-task"]),
		taskForInvertingStarred: vi.fn(() => "star-task"),
		taskForSettingUnread: vi.fn(() => "unread-task"),
		accountsForItems: vi.fn(() => [{ provider: "gmail" }]),
		generateTempId: vi.fn(() => "timer-1"),
	};
});

vi.mock("nylas-store", () => ({ default: class NylasStore { listenTo() {} stopListeningToAll() {} } }));
vi.mock("../src/flux/actions.js", () => ({
	default: {
		archiveThreads: {}, trashThreads: {}, markAsSpamThreads: {}, toggleStarredThreads: {}, toggleUnreadThreads: {},
		setUnreadThreads: {}, removeThreadsFromView: {}, moveThreadsToPerspective: {}, removeCategoryFromThreads: {},
		applyCategoryToThreads: {}, threadListDidUpdate: {}, queueTask: mocks.queueTask, queueTasks: mocks.queueTasks,
		recordPerfMetric: mocks.recordPerfMetric,
	},
}));
vi.mock("../src/flux/models/utils.js", () => ({ default: { generateTempId: mocks.generateTempId } }));
vi.mock("../src/flux/tasks/task-factory.js", () => ({
	default: {
		tasksForArchiving: mocks.tasksForArchiving, tasksForMovingToTrash: mocks.tasksForMovingToTrash,
		tasksForMarkingAsSpam: mocks.tasksForMarkingAsSpam, taskForInvertingStarred: mocks.taskForInvertingStarred,
		taskForSettingUnread: mocks.taskForSettingUnread, taskForInvertingUnread: vi.fn(),
		taskForApplyingCategory: vi.fn(), taskForRemovingCategory: vi.fn(),
	},
}));
vi.mock("../src/flux/stores/account-store.js", () => ({
	default: { accountsForItems: mocks.accountsForItems, accountForId: vi.fn() },
}));
vi.mock("../src/flux/stores/focused-perspective-store.js", () => ({ default: { current: vi.fn() } }));

import threadListActionsStore from "../src/flux/stores/thread-list-actions-store.js";

const threads = [{ id: "t1", accountId: "a1" }, { id: "t2", accountId: "a1" }];

describe("ThreadListActionsStore", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		store = new threadListActionsStore.constructor();
	});

	it("ignores missing and empty archive selections", () => {
		store._onArchiveThreads();
		store._onArchiveThreads({ threads: [] });
		expect(mocks.queueTasks).not.toHaveBeenCalled();
	});

	it("queues archive tasks and starts removal timing", () => {
		store._onArchiveThreads({ threads, source: "toolbar" });
		expect(mocks.tasksForArchiving).toHaveBeenCalledWith({ threads, source: "toolbar" });
		expect(mocks.queueTasks).toHaveBeenCalledWith(["archive-task"]);
		expect(NylasEnv.timer.start).toHaveBeenCalledWith("timer-1");
	});

	it("queues trash tasks", () => {
		store._onTrashThreads({ threads, source: "keyboard" });
		expect(mocks.tasksForMovingToTrash).toHaveBeenCalledWith({ threads, source: "keyboard" });
		expect(mocks.queueTasks).toHaveBeenCalledWith(["trash-task"]);
	});

	it("queues spam tasks", () => {
		store._onMarkAsSpamThreads({ threads, source: "menu" });
		expect(mocks.tasksForMarkingAsSpam).toHaveBeenCalledWith({ threads, source: "menu" });
		expect(mocks.queueTasks).toHaveBeenCalledWith(["spam-task"]);
	});

	it("queues one starred inversion task", () => {
		store._onToggleStarredThreads({ threads, source: "star" });
		expect(mocks.taskForInvertingStarred).toHaveBeenCalledWith({ threads, source: "star" });
		expect(mocks.queueTask).toHaveBeenCalledWith("star-task");
	});

	it("passes explicit unread state and undoability", () => {
		store._onSetUnreadThreads({ threads, unread: true, canBeUndone: false, source: "menu" });
		expect(mocks.taskForSettingUnread).toHaveBeenCalledWith({ threads, unread: true, canBeUndone: false, source: "menu" });
		expect(mocks.queueTask).toHaveBeenCalledWith("unread-task");
	});

	it("requires account ids when timing raw thread ids", () => {
		expect(() => store._setNewTimer({ threadIds: ["t1"] })).toThrow("Must pass accountIds");
	});

	it("records completed timers only after every thread leaves the list", () => {
		store._onArchiveThreads({ threads, source: "toolbar" });
		store._onThreadListDidUpdate([{ id: "t1" }]);
		expect(mocks.recordPerfMetric).not.toHaveBeenCalled();
		store._onThreadListDidUpdate([]);
		expect(mocks.recordPerfMetric).toHaveBeenCalledWith(expect.objectContaining({ provider: "gmail", actionTimeMs: 42, threadCount: 2 }));
	});
});
