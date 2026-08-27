import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

const mocks = vi.hoisted(() => ({
	modelify: vi.fn(),
	recordUserEvent: vi.fn(),
	accountForItems: vi.fn(),
	getAllMailCategory: vi.fn(),
	getSpamCategory: vi.fn(),
	getTrashCategory: vi.fn(),
	superPerformLocal: vi.fn(() => Promise.resolve("performed")),
}));

vi.mock("../src/flux/tasks/change-mail-task.js", () => ({
	default: class ChangeMailTask {
		constructor({ threads, thread, messages, message } = {}) {
			this.threads = threads || [];
			if (thread) this.threads.push(thread);
			this.messages = messages || [];
			if (message) this.messages.push(message);
		}

		performLocal() {
			return mocks.superPerformLocal();
		}

		canBeUndone() {
			return true;
		}

		isDependentOnTask() {
			return false;
		}
	},
}));

vi.mock("../src/flux/models/category.js", () => ({
	default: class Category {
		constructor(values = {}) {
			Object.assign(this, values);
		}
	},
}));
vi.mock("../src/flux/models/thread.js", () => ({
	default: class Thread {
		constructor(values = {}) {
			Object.assign(this, values);
		}
	},
}));
vi.mock("../src/flux/models/message.js", () => ({
	default: class Message {
		constructor(values = {}) {
			Object.assign(this, values);
		}
	},
}));
vi.mock("../src/flux/tasks/syncback-category-task.js", () => ({
	default: class SyncbackCategoryTask {},
}));
vi.mock("../src/flux/stores/database-store.js", () => ({
	default: { modelify: mocks.modelify },
}));
vi.mock("../src/flux/actions.js", () => ({
	default: { recordUserEvent: mocks.recordUserEvent },
}));
vi.mock("../src/flux/stores/account-store.js", () => ({
	default: { accountForItems: mocks.accountForItems },
}));
vi.mock("../src/flux/stores/category-store.js", () => ({
	default: {
		getAllMailCategory: mocks.getAllMailCategory,
		getSpamCategory: mocks.getSpamCategory,
		getTrashCategory: mocks.getTrashCategory,
	},
}));

import Category from "../src/flux/models/category.js";
import Message from "../src/flux/models/message.js";
import Thread from "../src/flux/models/thread.js";
import ChangeFolderTask from "../src/flux/tasks/change-folder-task.js";
import ChangeLabelsTask from "../src/flux/tasks/change-labels-task.js";
import ChangeStarredTask from "../src/flux/tasks/change-starred-task.js";
import ChangeUnreadTask from "../src/flux/tasks/change-unread-task.js";

const category = (values = {}) => new Category({ id: "category-1", ...values });

describe("ChangeUnreadTask", () => {
	it("builds labels for both unread states", () => {
		expect(new ChangeUnreadTask({ unread: true }).label()).toBe("Marking as unread");
		expect(new ChangeUnreadTask({ unread: false }).label()).toBe("Marking as read");
	});

	it("describes one changed thread", () => {
		expect(new ChangeUnreadTask({ threads: [{}], unread: false }).description()).toBe("Marked as read");
	});

	it("describes several changed threads", () => {
		expect(new ChangeUnreadTask({ threads: [{}, {}], unread: true }).description()).toBe("Marked 2 threads as unread");
	});

	it("describes an undo", () => {
		const task = new ChangeUnreadTask({ threads: [{}], unread: true });
		task._isUndoTask = true;
		expect(task.description()).toBe("Undoing changes to 1 thread");
	});

	it("changes models and builds request bodies", () => {
		const task = new ChangeUnreadTask({ unread: true });
		expect(task.changesToModel({})).toEqual({ unread: true });
		expect(task.requestBodyForModel({ unread: false })).toEqual({ unread: false });
		expect(task.processNestedMessages()).toBe(true);
	});

	it("rejects an empty thread list", async () => {
		await expect(new ChangeUnreadTask({ unread: true }).performLocal()).rejects.toThrow("must provide a `threads`");
	});
});

describe("ChangeStarredTask", () => {
	it("builds labels for starred and unstarred states", () => {
		expect(new ChangeStarredTask({ starred: true }).label()).toBe("Starring");
		expect(new ChangeStarredTask({ starred: false }).label()).toBe("Unstarring");
	});

	it("describes one and several starred threads", () => {
		expect(new ChangeStarredTask({ threads: [{}], starred: true }).description()).toBe("Starred");
		expect(new ChangeStarredTask({ threads: [{}, {}], starred: false }).description()).toBe("Unstarred 2 threads");
	});

	it("describes an undo", () => {
		const task = new ChangeStarredTask({ threads: [{}, {}], starred: true });
		task._isUndoTask = true;
		expect(task.description()).toBe("Undoing changes to 2 threads");
	});

	it("changes models and builds request bodies", () => {
		const task = new ChangeStarredTask({ starred: false });
		expect(task.changesToModel({})).toEqual({ starred: false });
		expect(task.requestBodyForModel({ starred: true })).toEqual({ starred: true });
	});

	it("rejects an empty thread list", async () => {
		await expect(new ChangeStarredTask({ starred: true }).performLocal()).rejects.toThrow("must provide a `threads`");
	});
});

describe("ChangeFolderTask", () => {
	it("uses a folder display name in its label", () => {
		expect(new ChangeFolderTask({ folder: category({ displayName: "Archive" }) }).label()).toBe("Moving to Archive");
	});

	it("honors an explicit task description", () => {
		expect(new ChangeFolderTask({ taskDescription: "Filed away" }).description()).toBe("Filed away");
	});

	it("describes moving threads and messages", () => {
		const folder = category({ displayName: "Projects" });
		expect(new ChangeFolderTask({ folder, threads: [{}, {}] }).description()).toBe("Moved 2 threads to Projects");
		expect(new ChangeFolderTask({ folder, messages: [{}, {}] }).description()).toBe("Moved 2 messages to Projects");
	});

	it("rejects a missing folder", async () => {
		await expect(new ChangeFolderTask({ threads: [{}] }).performLocal()).rejects.toThrow("Must specify a `folder`");
	});

	it("rejects mixed threads and messages", async () => {
		const task = new ChangeFolderTask({ folder: category(), threads: [{}], messages: [{}] });
		await expect(task.performLocal()).rejects.toThrow("not both");
	});

	it("returns folder request bodies for model fixtures", () => {
		const task = new ChangeFolderTask({ folder: category() });
		expect(task.requestBodyForModel(new Thread({ folders: [{ id: "inbox" }] }))).toEqual({ folder: "inbox" });
		expect(task.requestBodyForModel(new Message({ folder: null }))).toEqual({ folder: null });
	});

	it("replaces categories on thread and message fixtures", () => {
		const folder = category({ id: "archive" });
		const task = new ChangeFolderTask({ folder });
		expect(task.changesToModel(new Thread())).toEqual({ categories: [folder] });
		expect(task.changesToModel(new Message())).toEqual({ categories: [folder] });
		expect(task.changesToModel({})).toBeNull();
	});
});

describe("ChangeLabelsTask", () => {
	it("describes spam and trash changes", () => {
		expect(new ChangeLabelsTask({ labelsToAdd: [category({ name: "spam" })] }).description()).toBe("Marked as Spam");
		expect(new ChangeLabelsTask({ labelsToAdd: [category({ name: "trash" })] }).description()).toBe("Trashed");
	});

	it("describes archive moves for several threads", () => {
		const task = new ChangeLabelsTask({
			threads: [{}, {}],
			labelsToAdd: [category({ name: "all" })],
			labelsToRemove: [category({ name: "inbox" })],
		});
		expect(task.description()).toBe("Archived 2 threads");
	});

	it("describes adding and removing one custom label", () => {
		expect(new ChangeLabelsTask({ labelsToAdd: [category({ displayName: "Travel" })] }).description()).toBe("Added Travel");
		expect(new ChangeLabelsTask({ labelsToRemove: [category({ displayName: "Travel" })] }).description()).toBe("Removed Travel");
	});

	it("rejects label changes on individual messages", async () => {
		const task = new ChangeLabelsTask({ messages: [{}], labelsToAdd: [category()] });
		await expect(task.performLocal()).rejects.toThrow("individual messages");
	});

	it("rejects a task with no label changes", async () => {
		await expect(new ChangeLabelsTask({ threads: [{}] }).performLocal()).rejects.toThrow("Must specify `labelsToAdd`");
	});

	it("removes, adds, and deduplicates model labels", () => {
		const kept = category({ id: "kept" });
		const removed = category({ id: "removed" });
		const added = category({ id: "added" });
		const task = new ChangeLabelsTask({ labelsToAdd: [added, added], labelsToRemove: [removed] });
		expect(task.changesToModel({ labels: [kept, removed] })).toEqual({ labels: [kept, added] });
	});

	it("separates folder and label ids in request bodies", () => {
		const task = new ChangeLabelsTask();
		expect(task.requestBodyForModel({ labels: [
			category({ id: "folder-1", object: "folder" }),
			category({ id: "label-1", object: "label" }),
		] })).toEqual({ folder: "folder-1", labels: ["label-1"] });
	});

	it("returns only labels when no folder is present", () => {
		const task = new ChangeLabelsTask();
		// NOTE: actual behavior returns the label OBJECTS (unmapped) in the
		// no-folder branch — asymmetric with the folder branch which maps to
		// ids. Asserting current behavior; flagged for API review.
		const label = category({ id: "label-1", object: "label" });
		expect(task.requestBodyForModel({ labels: [label] })).toEqual({
			labels: [label],
		});
	});
});

describe("DatabaseStore isolation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		Promise.props = (values) => Promise.all(Object.entries(values).map(async ([key, value]) => [key, await value]))
			.then((entries) => Object.fromEntries(entries));
	});

	it("modelifies unread thread fixtures without database access", async () => {
		const thread = new Thread({ id: "thread-1" });
		mocks.modelify.mockResolvedValueOnce([thread]);
		const task = new ChangeUnreadTask({ threads: ["thread-1"], unread: true });
		await task.retrieveModels();
		expect(task.threads).toEqual([thread]);
		expect(mocks.modelify).toHaveBeenCalledWith(Thread, ["thread-1"]);
	});

	it("modelifies folder, thread, and message fixtures", async () => {
		const folder = category({ id: "archive" });
		const thread = new Thread({ id: "thread-1" });
		mocks.modelify.mockResolvedValueOnce([folder]).mockResolvedValueOnce([thread]).mockResolvedValueOnce([]);
		const task = new ChangeFolderTask({ folder: "archive", threads: ["thread-1"] });
		await task.retrieveModels();
		expect(task.folder).toBe(folder);
		expect(task.threads).toEqual([thread]);
		expect(mocks.modelify).toHaveBeenCalledTimes(3);
	});
});
