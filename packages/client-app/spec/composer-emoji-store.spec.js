import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	findJSONBlob: vi.fn((key) => ({ key })),
	fromQuery: vi.fn(),
	inTransaction: vi.fn((callback) => callback({ persistJSONBlob: mocks.persistJSONBlob })),
	persistJSONBlob: vi.fn(),
	listenTo: vi.fn(),
	trigger: vi.fn(),
}));

vi.mock("nylas-store", () => ({
	default: class NylasStore {
		listenTo = mocks.listenTo;
		trigger = mocks.trigger;
	},
}));
vi.mock("nylas-exports", () => ({
	default: {},
	DatabaseStore: { findJSONBlob: mocks.findJSONBlob, inTransaction: mocks.inTransaction },
	Rx: { Observable: { fromQuery: mocks.fromQuery } },
}));
vi.mock("../internal_packages/composer-emoji/lib/emoji-actions.js", () => ({
	default: { useEmoji: "useEmoji" },
}));

import emojiSingleton from "../internal_packages/composer-emoji/lib/emoji-store.jsx";

describe("composer emoji store", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		store = new emojiSingleton.constructor();
	});

	it("starts with no frequently used emoji", () => {
		expect(store.frequentlyUsedEmoji()).toEqual([]);
	});

	it("sorts frequently used emoji by descending frequency", () => {
		store._emoji = [
			{ emojiName: "wave", frequency: 2 },
			{ emojiName: "coffee", frequency: 5 },
			{ emojiName: "sparkles", frequency: 3 },
		];
		// The lookup sorts the backing store in place, not a defensive copy.
		expect(store.frequentlyUsedEmoji()).toEqual(["coffee", "sparkles", "wave"]);
		expect(store._emoji.map(({ emojiName }) => emojiName)).toEqual(["coffee", "sparkles", "wave"]);
	});

	it("limits frequently used emoji to 32 names", () => {
		store._emoji = Array.from({ length: 40 }, (_, frequency) => ({ emojiName: `emoji-${frequency}`, frequency }));
		expect(store.frequentlyUsedEmoji()).toHaveLength(32);
		expect(store.frequentlyUsedEmoji()[0]).toBe("emoji-39");
	});

	it("returns the platform image path for a known short name", () => {
		const family = process.platform === "darwin" ? "apple" : "twitter";
		expect(store.getImagePath("telephone")).toBe(`images/composer-emoji/${family}/260e.png`);
	});

	it("returns an empty path for an unknown short name", () => {
		expect(store.getImagePath("definitely-not-an-emoji")).toBe("");
	});

	it("adds a newly used emoji with frequency one", () => {
		const emoji = { emojiName: "wave", emojiChar: "👋" };
		store._onUseEmoji(emoji);
		expect(store._emoji).toEqual([{ ...emoji, frequency: 1 }]);
		expect(mocks.trigger).toHaveBeenCalledOnce();
	});

	it("updates matching emoji data and increments its frequency", () => {
		store._emoji = [{ emojiName: "old", emojiChar: "👋", frequency: 2 }];
		store._onUseEmoji({ emojiName: "wave", emojiChar: "👋" });
		expect(store._emoji).toEqual([{ emojiName: "wave", emojiChar: "👋", frequency: 3 }]);
	});

	it("persists usage under the emoji JSON blob key", () => {
		store._onUseEmoji({ emojiName: "wave", emojiChar: "👋" });
		expect(mocks.persistJSONBlob).toHaveBeenCalledWith("emoji", store._emoji);
	});

	it("activates the persisted emoji query and action listener", () => {
		const subscribe = vi.fn((callback) => { callback([{ emojiName: "coffee", frequency: 1 }]); return "subscription"; });
		mocks.fromQuery.mockReturnValue({ subscribe });
		store.activate();
		expect(mocks.findJSONBlob).toHaveBeenCalledWith("emoji");
		expect(store._subscription).toBe("subscription");
		expect(store.frequentlyUsedEmoji()).toEqual(["coffee"]);
		expect(mocks.listenTo).toHaveBeenCalledWith("useEmoji", store._onUseEmoji);
	});

	it("normalizes a null persisted value to an empty list", () => {
		mocks.fromQuery.mockReturnValue({ subscribe: (callback) => callback(null) });
		store.activate();
		expect(store.frequentlyUsedEmoji()).toEqual([]);
	});
});
