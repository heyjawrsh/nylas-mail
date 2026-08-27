import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	accountIds: ["account-1"],
	categories: [],
	getStandardCategories: vi.fn(() => []),
	unreadCount: vi.fn(() => 0),
	totalCount: vi.fn(() => 0),
	configChange: null,
	ipcSend: vi.fn(),
}));

vi.mock("nylas-store", () => ({
	default: class NylasStore {
		listenTo = vi.fn();
		trigger = vi.fn();
	},
}));
vi.mock("../src/flux/stores/focused-perspective-store", () => ({
	default: { current: () => ({ accountIds: mocks.accountIds }) },
}));
vi.mock("../src/flux/stores/thread-counts-store.js", () => ({
	default: {
		unreadCountForCategoryId: mocks.unreadCount,
		totalCountForCategoryId: mocks.totalCount,
	},
}));
vi.mock("../src/flux/stores/category-store.js", () => ({
	default: { getStandardCategories: mocks.getStandardCategories },
}));
// The store sends over the native electron bridge (nodeRequire), so spy on
// the shared native module rather than vi.mock-ing the vite-pipeline alias.
const { createRequire } = await import("node:module");
const nodeRequire = createRequire(import.meta.url);
const electronBridge = nodeRequire("electron");
vi.spyOn(electronBridge.ipcRenderer, "send").mockImplementation(mocks.ipcSend);

import badgeStore from "../src/flux/stores/badge-store.js";

describe("BadgeStore", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.categories = [];
		mocks.getStandardCategories.mockImplementation(() => mocks.categories);
		mocks.unreadCount.mockReturnValue(0);
		mocks.totalCount.mockReturnValue(0);
		NylasEnv.config.get.mockReturnValue("unread");
		NylasEnv.config.onDidChange.mockImplementation((_key, callback) => {
			mocks.configChange = callback;
			return { dispose: vi.fn() };
		});
		store = new badgeStore.constructor();
		store.trigger.mockClear();
		mocks.ipcSend.mockClear();
	});

	it("subscribes to both count inputs", () => {
		expect(store.listenTo).toHaveBeenCalledTimes(2);
	});

	it("observes the badge preference", () => {
		expect(NylasEnv.config.onDidChange).toHaveBeenCalledWith("core.notifications.countBadge", expect.any(Function));
	});

	it("requests inbox categories for focused accounts", () => {
		store._updateCounts();
		expect(mocks.getStandardCategories).toHaveBeenCalledWith(["account-1"], "inbox");
	});

	it("sums unread counts across inbox categories", () => {
		mocks.categories = [{ id: "one" }, { id: "two" }];
		mocks.unreadCount.mockImplementation((id) => (id === "one" ? 2 : 3));
		store._updateCounts();
		expect(store.unread()).toBe(5);
	});

	it("sums total counts across inbox categories", () => {
		mocks.categories = [{ id: "one" }, { id: "two" }];
		mocks.totalCount.mockImplementation((id) => (id === "one" ? 4 : 6));
		store._updateCounts();
		expect(store.total()).toBe(10);
	});

	it("publishes when derived counts change", () => {
		mocks.categories = [{ id: "inbox" }];
		mocks.unreadCount.mockReturnValue(1);
		store._updateCounts();
		expect(store.trigger).toHaveBeenCalledOnce();
	});

	it("does not publish when derived counts are unchanged", () => {
		store._unread = 0;
		store._total = 0;
		store._updateCounts();
		expect(store.trigger).not.toHaveBeenCalled();
	});

	it("sets an unread badge", () => {
		store._unread = 7;
		store._setBadgeForCount();
		expect(mocks.ipcSend).toHaveBeenCalledWith("set-badge-value", "7");
	});

	it("sets a total badge", () => {
		NylasEnv.config.get.mockReturnValue("total");
		store._total = 12;
		store._setBadgeForCount();
		expect(mocks.ipcSend).toHaveBeenCalledWith("set-badge-value", "12");
	});

	it("caps the displayed badge at 999+", () => {
		store._unread = 1000;
		store._setBadgeForCount();
		expect(mocks.ipcSend).toHaveBeenCalledWith("set-badge-value", "999+");
	});

	it("displays 999 without capping it", () => {
		store._unread = 999;
		store._setBadgeForCount();
		expect(mocks.ipcSend).toHaveBeenCalledWith("set-badge-value", "999");
	});

	it("clears the badge for zero", () => {
		store._unread = 0;
		store._setBadgeForCount();
		expect(mocks.ipcSend).toHaveBeenCalledWith("set-badge-value", "");
	});

	it("does not set a badge when the preference is hidden", () => {
		NylasEnv.config.get.mockReturnValue("hide");
		store._setBadgeForCount();
		expect(mocks.ipcSend).not.toHaveBeenCalled();
	});

	it("clears the badge when the preference changes to hide", () => {
		mocks.configChange({ newValue: "hide" });
		expect(mocks.ipcSend).toHaveBeenCalledWith("set-badge-value", "");
	});

	it("refreshes the badge when the preference becomes visible", () => {
		store._unread = 4;
		mocks.configChange({ newValue: "unread" });
		expect(mocks.ipcSend).toHaveBeenCalledWith("set-badge-value", "4");
	});

	it("does not set badges in a secondary production window", () => {
		NylasEnv.isMainWindow.mockReturnValue(false);
		NylasEnv.inSpecMode.mockReturnValue(false);
		store._unread = 4;
		store._setBadgeForCount();
		expect(mocks.ipcSend).not.toHaveBeenCalled();
	});
});
