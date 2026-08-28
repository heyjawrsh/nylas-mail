import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ run: vi.fn(), findAll: vi.fn() }));
vi.mock("../src/flux/stores/database-store.js", () => ({
	default: { run: mocks.run, findAll: mocks.findAll },
}));
vi.mock("../src/flux/models/query-range.js", () => ({
	default: class QueryRange {
		constructor({ offset, limit }) { this.offset = offset; this.limit = limit; }
		isInfinite() { return this.offset === null && this.limit === null; }
		static rangesBySubtracting(a, b) { return a.subtractResult ? a.subtractResult(b) : []; }
	}
}));
vi.mock("../src/flux/models/mutable-query-result-set.js", () => ({
	default: class MutableQueryResultSet {
		constructor() { this._ids = []; this._models = {}; this._offset = 0; }
		addModelsInRange(items, range) { this._ids = items.map((x) => x.id); items.forEach((x) => this.updateModel(x)); this._offset = range.offset; }
		addIdsInRange(ids, range) { this._ids = [...ids]; this._offset = range.offset; }
		updateModel(item) { this._models[item.id] = item; this._models[item.clientId] = item; }
		removeModelAtOffset(item, offset) { this._ids.splice(offset - this._offset, 1); delete this._models[item.id]; delete this._models[item.clientId]; }
		offsetOfId(id) { const index = this._ids.findIndex((x) => x === id || this._models[x]?.clientId === id); return index < 0 ? -1 : index + this._offset; }
		modelWithId(id) { return this._models[id]; }
		models() { return this._ids.map((id) => this._models[id]); }
		ids() { return this._ids; }
		isComplete() { return this._ids.every((id) => this._models[id]); }
		modelCacheCount() { return Object.keys(this._models).length; }
		range() { return { isInfinite: () => false, isContiguousWith: () => true }; }
		clipToRange() {}
		setQuery(query) { this.query = query; }
		immutableClone() { return { ids: [...this._ids] }; }
	}
}));

import QuerySubscription from "../src/flux/models/query-subscription.js";

const finiteRange = (offset = 0, limit = 10) => ({ offset, limit, isInfinite: () => false });
const query = (overrides = {}) => ({
	_count: false,
	_klass: class Item {},
	finalize: vi.fn(),
	range: vi.fn(() => finiteRange()),
	objectClass: vi.fn(() => "Thread"),
	matchers: vi.fn(() => []),
	orderSortDescriptors: vi.fn(() => []),
	formatResult: vi.fn((models) => models),
	// The real clone returns a query with the range-mutator chain surface.
	clone: vi.fn(function () {
		return query({});
	}),
	offset: vi.fn(function () {
		return this;
	}),
	limit: vi.fn(function () {
		return this;
	}),
	idsOnly: vi.fn(function () {
		return this;
	}),
	...overrides,
});

describe("QuerySubscription lifecycle", () => {
	beforeEach(() => { vi.clearAllMocks(); mocks.run.mockReturnValue(new Promise(() => {})); });

	it("rejects count queries", () => {
		expect(() => new QuerySubscription(query({ _count: true }))).toThrow("count queries");
	});

	it("finalizes a duck-typed query and begins its initial update", () => {
		const q = query();
		new QuerySubscription(q);
		expect(q.finalize).toHaveBeenCalledOnce();
		expect(mocks.run).toHaveBeenCalledOnce();
	});

	it("accepts a query without finalize", () => {
		expect(() => new QuerySubscription(query({ finalize: undefined }))).not.toThrow();
	});

	it("does not update a duck-typed query without range", () => {
		new QuerySubscription(query({ range: undefined }));
		expect(mocks.run).not.toHaveBeenCalled();
	});

	it("seeds initial models without querying the database", () => {
		const item = { id: "a", clientId: "a" };
		const subscription = new QuerySubscription(query(), { initialModels: [item] });
		expect(subscription._lastResult).toEqual([item]);
		expect(mocks.run).not.toHaveBeenCalled();
	});

	it("validates callbacks", () => {
		const subscription = new QuerySubscription(null);
		expect(() => subscription.addCallback("nope")).toThrow("expects a function");
		expect(() => subscription.removeCallback(null)).toThrow("expects a function");
	});

	it("tracks and removes callbacks", () => {
		const subscription = new QuerySubscription(null);
		const callback = vi.fn();
		subscription.addCallback(callback);
		expect(subscription.hasCallback(callback)).toBe(true);
		subscription.removeCallback(callback);
		expect(subscription.callbackCount()).toBe(0);
	});

	it("notifies a late callback asynchronously with the last result", async () => {
		vi.useFakeTimers();
		const item = { id: "a", clientId: "a" };
		const subscription = new QuerySubscription(query(), { initialModels: [item] });
		const callback = vi.fn();
		subscription.addCallback(callback);
		expect(callback).not.toHaveBeenCalled();
		await vi.runAllTimersAsync();
		expect(callback).toHaveBeenCalledWith([item]);
		vi.useRealTimers();
	});

	it("ignores records for another object class and empty records", () => {
		const subscription = new QuerySubscription(null);
		subscription._query = query();
		const process = vi.spyOn(subscription, "_processChangeRecords");
		subscription.applyChangeRecord({ objectClass: "Message", objects: [{}] });
		subscription.applyChangeRecord({ objectClass: "Thread", objects: [] });
		expect(process).not.toHaveBeenCalled();
	});

	it("queues a relevant record and starts processing it", () => {
		const subscription = new QuerySubscription(null);
		subscription._query = query();
		const process = vi.spyOn(subscription, "_processChangeRecords").mockImplementation(() => {});
		const record = { objectClass: "Thread", objects: [{}] };
		subscription.applyChangeRecord(record);
		expect(subscription._queuedChangeRecords).toEqual([record]);
		expect(process).toHaveBeenCalledOnce();
	});

	it("invalidates an in-flight update", () => {
		const subscription = new QuerySubscription(null);
		subscription._updateInFlight = true;
		subscription.cancelPendingUpdate();
		expect(subscription._queryVersion).toBe(2);
		expect(subscription._updateInFlight).toBe(false);
	});

	it("configures a cloned query for a finite range", () => {
		const ranged = { offset: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis() };
		const subscription = new QuerySubscription(null);
		subscription._query = query({ clone: vi.fn(() => ranged) });
		expect(subscription._getQueryForRange(finiteRange(5, 2), true)).toBe(ranged);
		expect(ranged.offset).toHaveBeenCalledWith(5);
		expect(ranged.limit).toHaveBeenCalledWith(2);
	});

	it("requests IDs only when complete models are unnecessary", () => {
		const cloned = { idsOnly: vi.fn() };
		const subscription = new QuerySubscription(null);
		subscription._query = query({ clone: vi.fn(() => cloned) });
		subscription._getQueryForRange({ isInfinite: () => true }, false);
		expect(cloned.idsOnly).toHaveBeenCalledOnce();
	});

	it("reports whether a sort attribute changed", () => {
		const subscription = new QuerySubscription(null);
		subscription._query = query({ orderSortDescriptors: () => [{ attr: { modelKey: "date" } }] });
		expect(subscription._itemSortOrderHasChanged({ date: 1 }, { date: 1 })).toBe(false);
		expect(subscription._itemSortOrderHasChanged({ date: 1 }, { date: 2 })).toBe(true);
	});
});
