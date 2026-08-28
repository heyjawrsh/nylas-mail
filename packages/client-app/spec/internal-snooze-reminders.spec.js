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
	setMetadata: vi.fn(),
	closePopover: vi.fn(),
	recordUserEvent: vi.fn(),
	authPlugin: vi.fn(() => Promise.resolve()),
	futureDateFromString: vi.fn(),
}));

vi.mock("nylas-exports", () => {
	class Category {
		constructor(values) { Object.assign(this, values); this.clientId ??= "category-client-id"; }
	}
	class SyncbackCategoryTask { constructor(values) { Object.assign(this, values); } }
	class Thread {}
	class Message {}
	Message.attributes = { pluginMetadata: { contains: vi.fn() } };
	Thread.attributes = { lastMessageReceivedTimestamp: { descending: vi.fn() } };
	return {
		Actions: {
			queueTask: mocks.queueTask, queueTasks: mocks.queueTasks,
			setMetadata: mocks.setMetadata, closePopover: mocks.closePopover,
			recordUserEvent: mocks.recordUserEvent,
		},
		Thread, Message, Category, SyncbackCategoryTask,
		DateUtils: {
			DATE_FORMAT_SHORT: "MMM D, h:mm A",
			DATE_FORMAT_LONG_NO_YEAR: "MMM D, h:mm A",
			format: (date, format) => date.format(format),
			futureDateFromString: mocks.futureDateFromString,
		},
		TaskFactory: { tasksForApplyingCategories: mocks.tasksForApplyingCategories },
		AccountStore: { accounts: vi.fn(() => []) },
		CategoryStore: { categories: mocks.categories, getInboxCategory: mocks.getInboxCategory },
		DatabaseStore: { findBy: mocks.findBy, modelify: mocks.modelify },
		TaskQueueStatusStore: { waitForPerformRemote: mocks.waitForPerformRemote },
		FolderSyncProgressStore: { whenCategoryListSynced: mocks.whenCategoryListSynced },
		NylasAPIHelpers: { authPlugin: mocks.authPlugin },
		FeatureUsageStore: { asyncUseFeature: vi.fn(), NoProAccess: class NoProAccess extends Error {} },
		Rx: { Observable: { fromQuery: vi.fn() } },
	};
});

import SnoozeUtils from "../internal_packages/thread-snooze/lib/snooze-utils.js";
import {
	getLatestMessage,
	getLatestMessageWithReminder,
	getReminderLabel,
	reminderDateForMessage,
	setDraftReminder,
	setMessageReminder,
} from "../internal_packages/send-reminders/lib/send-reminders-utils.jsx";

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

describe("send reminder helpers", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns null when no message is supplied", () => {
		expect(reminderDateForMessage()).toBeNull();
	});

	it("reads expiration from plugin metadata", () => {
		const message = { metadataForPluginId: vi.fn(() => ({ expiration: "tomorrow" })) };
		expect(reminderDateForMessage(message)).toBe("tomorrow");
	});

	it("returns the final message", () => {
		expect(getLatestMessage({ __messages: ["first", "last"] })).toBe("last");
	});

	it("prefers an explicitly supplied message list", () => {
		expect(getLatestMessage({ __messages: ["stored"] }, ["provided"])).toBe("provided");
	});

	it("finds the latest message carrying a reminder without mutating the list", () => {
		const plain = { metadataForPluginId: () => ({}) };
		const reminded = { metadataForPluginId: () => ({ expiration: "later" }) };
		const messages = [reminded, plain];
		expect(getLatestMessageWithReminder({ __messages: messages })).toBe(reminded);
		expect(messages).toEqual([reminded, plain]);
	});

	it("labels a past or invalid relative date as now", () => {
		mocks.futureDateFromString.mockReturnValue(null);
		expect(getReminderLabel("past", { shortFormat: true })).toBe("now");
	});

	it("creates a short relative reminder label", () => {
		mocks.futureDateFromString.mockReturnValue({ fromNow: () => "2 hours" });
		expect(getReminderLabel("later", { shortFormat: true })).toBe("in 2 hours");
	});

	it("writes reminder metadata into a draft session", async () => {
		const changes = { add: vi.fn(), addPluginMetadata: vi.fn() };
		await setDraftReminder("account", { changes }, null, null);
		expect(changes.add).toHaveBeenCalledWith({ pristine: false });
		expect(changes.addPluginMetadata).toHaveBeenCalledWith("send-reminders", {});
		expect(mocks.closePopover).toHaveBeenCalledOnce();
	});

	it("clears a message reminder with empty metadata", async () => {
		const message = { metadataForPluginId: () => ({ expiration: "old" }) };
		await setMessageReminder("account", message, null, null);
		expect(mocks.setMetadata).toHaveBeenCalledWith(message, "send-reminders", {});
	});
});
