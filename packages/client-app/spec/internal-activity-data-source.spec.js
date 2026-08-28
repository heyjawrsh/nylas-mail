import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	contains: vi.fn(() => "metadata-clause"),
	descending: vi.fn(() => "date-desc"),
	findAll: vi.fn(),
	fromQuery: vi.fn(),
}));

vi.mock("nylas-exports", () => ({
	default: {},
	Rx: { Observable: { fromQuery: m.fromQuery } },
	Message: {
		attributes: {
			date: { descending: m.descending },
			pluginMetadata: { contains: m.contains },
		},
	},
	DatabaseStore: { findAll: m.findAll },
}));

import ActivityDataSource from "../internal_packages/activity-list/lib/activity-data-source.js";
import TestDataSource from "../internal_packages/activity-list/lib/test-data-source.js";

describe("ActivityDataSource", () => {
	let query;

	beforeEach(() => {
		vi.clearAllMocks();
		query = {
			order: vi.fn(() => query),
			where: vi.fn(() => query),
			limit: vi.fn(() => query),
		};
		m.findAll.mockReturnValue(query);
		m.fromQuery.mockReturnValue({ subscribe: vi.fn(() => "subscription") });
	});

	it("orders tracked messages newest first", () => {
		new ActivityDataSource().buildObservable({ openTrackingId: "open", linkTrackingId: "link", messageLimit: 50 });
		expect(query.order).toHaveBeenCalledWith("date-desc");
	});

	it("filters on both tracking plugin IDs", () => {
		new ActivityDataSource().buildObservable({ openTrackingId: "open", linkTrackingId: "link", messageLimit: 50 });
		expect(m.contains).toHaveBeenCalledWith("open", "link");
		expect(query.where).toHaveBeenCalledWith("metadata-clause");
	});

	it("applies the requested message limit", () => {
		new ActivityDataSource().buildObservable({ openTrackingId: "open", linkTrackingId: "link", messageLimit: 25 });
		expect(query.limit).toHaveBeenCalledWith(25);
	});

	it("converts the completed query to an observable", () => {
		const observable = { subscribe: vi.fn() };
		m.fromQuery.mockReturnValue(observable);
		expect(new ActivityDataSource().buildObservable({ messageLimit: 1 })).toBe(observable);
		expect(m.fromQuery).toHaveBeenCalledWith(query);
	});

	it("subscribes through the observable built earlier", () => {
		const source = new ActivityDataSource();
		const callback = vi.fn();
		source.buildObservable({ messageLimit: 1 });
		expect(source.subscribe(callback)).toBe("subscription");
		expect(source.observable.subscribe).toHaveBeenCalledWith(callback);
	});
});

describe("TestDataSource", () => {
	it("is its own observable", () => {
		const source = new TestDataSource();
		expect(source.buildObservable()).toBe(source);
	});

	it("emits an empty initial collection on subscribe", () => {
		const source = new TestDataSource();
		const onNext = vi.fn();
		source.subscribe(onNext);
		expect(onNext).toHaveBeenCalledWith([]);
	});

	it("forwards manually triggered messages", () => {
		const source = new TestDataSource();
		const onNext = vi.fn();
		source.subscribe(onNext);
		const messages = [{ id: "m1" }];
		source.manuallyTrigger(messages);
		expect(onNext).toHaveBeenLastCalledWith(messages);
	});

	it("disposal invokes the installed unsubscribe hook", () => {
		const source = new TestDataSource();
		source._unsub = vi.fn();
		const subscription = source.subscribe(vi.fn());
		subscription.dispose();
		expect(source._unsub).toHaveBeenCalledOnce();
	});
});
