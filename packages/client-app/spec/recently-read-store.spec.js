import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("nylas-store", () => ({
	default: class NylasStore { listenTo = vi.fn(); trigger = vi.fn(); },
}));
vi.mock("../src/flux/actions.js", () => ({
	default: { focusMailboxPerspective: {}, queueTasks: {}, queueTask: {} },
}));
vi.mock("../src/flux/tasks/change-unread-task.js", () => ({ default: class ChangeUnreadTask {} }));
vi.mock("../src/flux/tasks/change-labels-task.js", () => ({ default: class ChangeLabelsTask {} }));
vi.mock("../src/flux/tasks/change-folder-task.js", () => ({ default: class ChangeFolderTask {} }));

import recentlyReadStore from "../src/flux/stores/recently-read-store.js";
import ChangeUnreadTask from "../src/flux/tasks/change-unread-task.js";
import ChangeLabelsTask from "../src/flux/tasks/change-labels-task.js";
import ChangeFolderTask from "../src/flux/tasks/change-folder-task.js";

describe("RecentlyReadStore", () => {
	let store;
	beforeEach(() => {
		store = new recentlyReadStore.constructor();
		store.trigger.mockClear();
	});

	it("starts empty", () => expect(store.ids).toEqual([]));

	it("records thread model IDs changed to read", () => {
		const task = Object.assign(new ChangeUnreadTask(), { threads: [{ id: "t1" }] });
		store.tasksQueued([task]);
		expect(store.ids).toEqual(["t1"]);
	});

	it("records raw thread IDs changed to read", () => {
		const task = Object.assign(new ChangeUnreadTask(), { threads: ["t1"] });
		store.tasksQueued([task]);
		expect(store.ids).toEqual(["t1"]);
	});

	it("appends IDs from successive unread tasks", () => {
		const first = Object.assign(new ChangeUnreadTask(), { threads: ["t1"] });
		const second = Object.assign(new ChangeUnreadTask(), { threads: ["t2"] });
		store.tasksQueued([first, second]);
		expect(store.ids).toEqual(["t1", "t2"]);
	});

	it("removes IDs moved by a label task", () => {
		store.ids = ["t1", "t2"];
		store.tasksQueued([Object.assign(new ChangeLabelsTask(), { threads: ["t1"] })]);
		expect(store.ids).toEqual(["t2"]);
	});

	it("removes IDs moved by a folder task", () => {
		store.ids = ["t1", "t2"];
		store.tasksQueued([Object.assign(new ChangeFolderTask(), { threads: [{ id: "t2" }] })]);
		expect(store.ids).toEqual(["t1"]);
	});

	it("publishes after a relevant task", () => {
		store.tasksQueued([Object.assign(new ChangeUnreadTask(), { threads: [] })]);
		// Actual behavior: task type, not whether IDs changed, controls publishing.
		expect(store.trigger).toHaveBeenCalledOnce();
	});

	it("ignores unrelated tasks", () => {
		store.tasksQueued([{ threads: ["t1"] }]);
		expect(store.trigger).not.toHaveBeenCalled();
	});
});
