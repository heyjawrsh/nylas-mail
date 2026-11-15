import moment from "moment";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	queueTask: vi.fn(),
	queueTasks: vi.fn(),
	waitForPerformRemote: vi.fn(() => Promise.resolve()),
	findBy: vi.fn(),
	modelify: vi.fn(),
	categories: vi.fn(() => []),
	getInboxCategory: vi.fn(),
	whenCategoryListSynced: vi.fn(() => Promise.resolve()),
	tasksForApplyingCategories: vi.fn(() => []),
}));

vi.mock("nylas-exports", () => {
	class Category {
		constructor(values) { Object.assign(this, values); this.clientId ??= "category-client-id"; }
	}
	class SyncbackCategoryTask { constructor(values) { Object.assign(this, values); } }
	class Thread {}
	return {
		Actions: {
			queueTask: mocks.queueTask, queueTasks: mocks.queueTasks,
		},
		Thread, Category, SyncbackCategoryTask,
		DateUtils: {
			DATE_FORMAT_SHORT: "MMM D, h:mm A",
			format: (date, format) => date.format(format),
		},
		TaskFactory: { tasksForApplyingCategories: mocks.tasksForApplyingCategories },
		AccountStore: { accounts: vi.fn(() => []) },
		CategoryStore: { categories: mocks.categories, getInboxCategory: mocks.getInboxCategory },
		DatabaseStore: { findBy: mocks.findBy, modelify: mocks.modelify },
		TaskQueueStatusStore: { waitForPerformRemote: mocks.waitForPerformRemote },
		FolderSyncProgressStore: { whenCategoryListSynced: mocks.whenCategoryListSynced },
	};
});

import SnoozeUtils from "../internal_packages/thread-snooze/lib/snooze-utils.js";
describe("thread snooze helpers", () => {
	beforeEach(() => vi.clearAllMocks());

	it("uses the base label without a date", () => {
		expect(SnoozeUtils.snoozedUntilMessage()).toBe("Snoozed");
	});

	it("omits the day and minutes for an on-the-hour time within 24 hours", () => {
		const now = moment("2026-01-01T09:00:00");
		expect(SnoozeUtils.snoozedUntilMessage(moment("2026-01-02T08:00:00"), now)).toBe("Snoozed until 8 AM");
	});

	it("keeps minutes for a near time off the hour", () => {
		const now = moment("2026-01-01T09:00:00");
		expect(SnoozeUtils.snoozedUntilMessage(moment("2026-01-01T10:05:00"), now)).toBe("Snoozed until 10:05 AM");
	});

	it("includes the date once the time is at least 24 hours away", () => {
		const now = moment("2026-01-01T09:00:00");
		expect(SnoozeUtils.snoozedUntilMessage(moment("2026-01-02T10:00:00"), now)).toBe("Snoozed until Jan 2, 10 AM");
	});

	it("returns an existing snooze category after folder sync", async () => {
		const category = { displayName: "Later" };
		mocks.categories.mockReturnValue([category]);
		await expect(SnoozeUtils.getSnoozeCategory("account", "Later")).resolves.toBe(category);
		expect(mocks.whenCategoryListSynced).toHaveBeenCalledWith("account");
	});




	it("queues category tasks and modelifies the updated threads", async () => {
		const threads = [{ clientId: "one" }, { clientId: "two" }];
		const tasks = [{ id: 1 }, { id: 2 }];
		mocks.tasksForApplyingCategories.mockReturnValue(tasks);
		mocks.modelify.mockResolvedValue(threads);
		await expect(SnoozeUtils.moveThreads(threads, { snooze: true })).resolves.toBe(threads);
		expect(mocks.queueTasks).toHaveBeenCalledWith(tasks);
		expect(mocks.waitForPerformRemote).toHaveBeenCalledTimes(2);
		expect(mocks.modelify).toHaveBeenCalledWith(expect.any(Function), ["one", "two"]);
	});
});
