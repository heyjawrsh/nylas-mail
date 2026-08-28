import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	class Matcher {
		constructor(attr = null, val = null) { this.attr = attr; this.val = val; }
		joinSQL() { return this.join || ""; }
		whereSQL() { return this.where || ""; }
		attribute() { return this.attr; }
		joinTableRef() { return "CategoryRef"; }
	}
	Matcher.Or = class Or extends Matcher {};
	Matcher.Search = class Search extends Matcher {};
	Matcher.StructuredSearch = class StructuredSearch extends Matcher {};
	class AttributeJoinedData {}
	AttributeJoinedData.NullPlaceholder = "__NULL__";
	class AttributeCollection {}
	class QueryRange {
		constructor({ offset = null, limit = null } = {}) { this.offset = offset; this.limit = limit; }
		static infinite() { return new QueryRange(); }
		static rangesBySubtracting(desired, current) { return m.subtract(desired, current); }
		clone() { return new QueryRange({ offset: this.offset, limit: this.limit }); }
		isInfinite() { return this.offset === null && this.limit === null; }
		isContiguousWith(other) { return m.contiguous(this, other); }
	}
	return {
		Matcher, AttributeJoinedData, AttributeCollection, QueryRange,
		run: vi.fn(), findAll: vi.fn(), subtract: vi.fn(() => []), contiguous: vi.fn(() => true),
		reportError: vi.fn(), tableNameForJoin: vi.fn(() => "ThreadCategory"),
	};
});

vi.mock("node:module", () => {
	const createRequire = () => vi.fn(() => ({}));
	return { default: { createRequire }, createRequire };
});
vi.mock("underscore", () => {
	const underscore = {
		uniq: (items) => [...new Set(items)],
		without: (items, removed) => items.filter((item) => item !== removed),
	};
	return { default: underscore, ...underscore };
});
vi.mock("../src/flux/stores/database-store.js", () => ({
	default: { run: m.run, findAll: m.findAll },
}));
vi.mock("../src/flux/attributes.js", () => ({ default: {
	Matcher: m.Matcher, AttributeJoinedData: m.AttributeJoinedData,
	AttributeCollection: m.AttributeCollection,
} }));
vi.mock("../src/flux/models/query-range.js", () => ({ default: m.QueryRange }));
vi.mock("../src/flux/models/mutable-query-result-set.js", () => ({
	default: class MutableQueryResultSet {
		constructor() { this._ids = []; this._models = new Map(); this._range = range(); }
		addModelsInRange(items, targetRange) {
			this._ids = items.map((item) => item.id); this._range = targetRange;
			for (const item of items) this.updateModel(item);
		}
		addIdsInRange(ids, targetRange) { this._ids = [...ids]; this._range = targetRange; }
		updateModel(item) { this._models.set(item.id, item); this._models.set(item.clientId, item); }
		removeModelAtOffset(item, offset) {
			this._ids.splice(offset - this._range.offset, 1);
			this._models.delete(item.id); this._models.delete(item.clientId);
		}
		offsetOfId(id) {
			const index = this._ids.findIndex((storedId) => storedId === id || this._models.get(storedId)?.clientId === id);
			return index === -1 ? -1 : index + this._range.offset;
		}
		modelWithId(id) { return this._models.get(id); }
		models() { return this._ids.map((id) => this._models.get(id)); }
		ids() { return [...this._ids]; }
		isComplete() { return this._ids.every((id) => this._models.has(id)); }
		modelCacheCount() { return new Set(this._models.values()).size; }
		range() { return this._range; }
		clipToRange() {}
		setQuery(value) { this.query = value; }
		immutableClone() { return { ids: [...this._ids] }; }
	},
}));
vi.mock("../src/flux/models/utils.js", () => ({ default: {
	registeredObjectReviver: (_key, value) => value,
	tableNameForJoin: m.tableNameForJoin,
} }));

import QuerySubscription from "../src/flux/models/query-subscription.js";
import ModelQuery from "../src/flux/models/query.js";

const range = (offset = 0, limit = 10) => new m.QueryRange({ offset, limit });
const model = (id, overrides = {}) => ({ id, clientId: id, matches: vi.fn(() => true), ...overrides });
const query = (overrides = {}) => ({
	_count: false, _klass: class Thread {}, finalize: vi.fn(), range: vi.fn(() => range()),
	objectClass: vi.fn(() => "Thread"), matchers: vi.fn(() => []),
	orderSortDescriptors: vi.fn(() => []), formatResult: vi.fn((items) => [...items]),
	clone: vi.fn(function clone() { return query(); }),
	offset: vi.fn(function offset() { return this; }),
	limit: vi.fn(function limit() { return this; }),
	idsOnly: vi.fn(function idsOnly() { return this; }),
	...overrides,
});
const seeded = (items, overrides = {}) => new QuerySubscription(query(overrides), { initialModels: items });

globalThis.NylasEnv = { reportError: m.reportError };

describe("QuerySubscription change reconciliation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		m.run.mockReturnValue(new Promise(() => {}));
		m.findAll.mockResolvedValue([]);
		m.subtract.mockReturnValue([]);
		m.contiguous.mockReturnValue(true);
	});

	it("removes an unpersisted model and requests a complete refresh", () => {
		const subscription = seeded([model("a"), model("b")]);
		const update = vi.spyOn(subscription, "update").mockImplementation(() => {});
		subscription.applyChangeRecord({ objectClass: "Thread", type: "unpersist", objects: [model("a")] });
		expect(subscription._set.ids()).toEqual(["b"]);
		expect(update).toHaveBeenCalledWith({ mustRefetchEntireRange: true });
	});

	it("ignores an unpersist for a model outside the result set", () => {
		const subscription = seeded([model("a")]);
		const update = vi.spyOn(subscription, "update").mockImplementation(() => {});
		subscription.applyChangeRecord({ objectClass: "Thread", type: "unpersist", objects: [model("b")] });
		expect(update).not.toHaveBeenCalled();
	});

	it("removes a persisted model that no longer matches", () => {
		const subscription = seeded([model("a")]);
		const update = vi.spyOn(subscription, "update").mockImplementation(() => {});
		subscription.applyChangeRecord({ objectClass: "Thread", type: "persist", objects: [model("a", { matches: vi.fn(() => false) })] });
		expect(subscription._set.ids()).toEqual([]);
		expect(update).toHaveBeenCalledWith({ mustRefetchEntireRange: true });
	});

	it("adds a newly matching persisted model to the cache before refreshing", () => {
		const subscription = seeded([model("a")]);
		const added = model("b");
		vi.spyOn(subscription, "update").mockImplementation(() => {});
		subscription.applyChangeRecord({ objectClass: "Thread", type: "persist", objects: [added] });
		expect(subscription._set.modelWithId("b")).toBe(added);
	});

	it("notifies callbacks directly when an in-set update preserves sort order", () => {
		const subscription = seeded([model("a", { subject: "old" })]);
		const callback = vi.fn(); subscription.addCallback(callback);
		const updated = model("a", { subject: "new" });
		subscription.applyChangeRecord({ objectClass: "Thread", type: "persist", objects: [updated] });
		expect(callback).toHaveBeenCalledWith([updated]);
	});

	it("refreshes when an in-set update changes a sort attribute", () => {
		const subscription = seeded([model("a", { date: 1 })], { orderSortDescriptors: () => [{ attr: { modelKey: "date" } }] });
		const update = vi.spyOn(subscription, "update").mockImplementation(() => {});
		subscription.applyChangeRecord({ objectClass: "Thread", type: "persist", objects: [model("a", { date: 2 })] });
		expect(update).toHaveBeenCalledWith({ mustRefetchEntireRange: true });
	});

	it("refreshes an offset query when a persisted object has unknown impact", () => {
		const subscription = seeded([model("a")], { range: vi.fn(() => range(10, 10)) });
		const update = vi.spyOn(subscription, "update").mockImplementation(() => {});
		subscription.applyChangeRecord({ objectClass: "Thread", type: "persist", objects: [model("outside", { matches: vi.fn(() => false) })] });
		expect(update).toHaveBeenCalledWith({ mustRefetchEntireRange: true });
	});

	it("defers processing records while an update is in flight", () => {
		const subscription = seeded([model("a")]);
		subscription._updateInFlight = true;
		const process = vi.spyOn(subscription, "_processChangeRecords");
		subscription.applyChangeRecord({ objectClass: "Thread", type: "persist", objects: [model("a")] });
		expect(subscription._queuedChangeRecords).toHaveLength(1);
		expect(process).not.toHaveBeenCalled();
	});

	it("starts an update when queued records arrive before a result set", () => {
		const subscription = new QuerySubscription(null); subscription._query = query();
		subscription._queuedChangeRecords = [{ type: "persist", objects: [model("a")] }];
		const update = vi.spyOn(subscription, "update").mockImplementation(() => {});
		subscription._processChangeRecords();
		expect(update).toHaveBeenCalledOnce();
	});
});

describe("QuerySubscription fetching and notification", () => {
	beforeEach(() => {
		vi.clearAllMocks(); m.run.mockResolvedValue([]); m.findAll.mockResolvedValue([]);
		m.subtract.mockReturnValue([]); m.contiguous.mockReturnValue(true);
	});

	it("fetches only the missing finite range while extending a result set", () => {
		const subscription = seeded([model("a")]);
		const missing = range(10, 5); m.subtract.mockReturnValue([missing]);
		const fetch = vi.spyOn(subscription, "_fetchRange").mockImplementation(() => {});
		subscription.update();
		expect(fetch).toHaveBeenCalledWith(missing, expect.objectContaining({ fetchEntireModels: true }));
	});

	it("falls back to the desired range when subtraction has multiple gaps", () => {
		const subscription = new QuerySubscription(null);
		const desired = range(0, 20); m.subtract.mockReturnValue([range(0, 2), range(8, 2)]);
		expect(subscription._getMissingRange(desired, range(2, 6))).toBe(desired);
	});

	it("fetches IDs for a full refresh when models are already cached", () => {
		const subscription = seeded([model("a")]);
		const fetch = vi.spyOn(subscription, "_fetchRange").mockImplementation(() => {});
		subscription.update({ mustRefetchEntireRange: true });
		expect(fetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ fetchEntireModels: false }));
	});

	it("uses the original query for an infinite full-model fetch", () => {
		const q = query(); const subscription = new QuerySubscription(null); subscription._query = q;
		expect(subscription._getQueryForRange(m.QueryRange.infinite(), true)).toBe(q);
		expect(q.clone).not.toHaveBeenCalled();
	});

	it("does not query for models when every ID is cached", async () => {
		const subscription = seeded([model("a")]);
		expect(await subscription._fetchMissingModels()).toEqual([]);
		expect(m.findAll).not.toHaveBeenCalled();
	});

	it("queries the model class for uncached IDs", async () => {
		const subscription = seeded([model("a")]); subscription._set.addIdsInRange(["a", "b"], range());
		m.findAll.mockResolvedValue([model("b")]);
		expect(await subscription._fetchMissingModels()).toEqual([expect.objectContaining({ id: "b" })]);
		expect(m.findAll).toHaveBeenCalledWith(subscription._query._klass, { id: ["b"] });
	});

	it("ignores database results from a cancelled query version", async () => {
		let resolve; m.run.mockReturnValue(new Promise((done) => { resolve = done; }));
		const subscription = new QuerySubscription(query()); subscription.cancelPendingUpdate(); resolve([model("a")]);
		await Promise.resolve(); await Promise.resolve();
		expect(subscription._set).toBeNull();
	});

	it("replaces a noncontiguous set before adding fetched models", async () => {
		m.contiguous.mockReturnValue(false); m.run.mockResolvedValue(["b"]); m.findAll.mockResolvedValue([model("b")]);
		const subscription = seeded([model("a")]); subscription.update({ mustRefetchEntireRange: true });
		await vi.waitFor(() => expect(subscription._lastResult).toEqual([expect.objectContaining({ id: "b" })]));
	});

	it("reports and recovers from a result set with missing models", () => {
		const subscription = seeded([model("a")]); subscription._set.addIdsInRange(["missing"], range());
		const update = vi.spyOn(subscription, "update").mockImplementation(() => {});
		subscription._createResultAndTrigger();
		expect(m.reportError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("missing models") }));
		expect(subscription._set).toBeNull(); expect(update).toHaveBeenCalledOnce();
	});

	it("reports and recovers from duplicate result IDs", () => {
		const item = model("a"); const subscription = seeded([item]);
		subscription._set.addModelsInRange([item, item], range());
		const update = vi.spyOn(subscription, "update").mockImplementation(() => {});
		subscription._createResultAndTrigger();
		expect(m.reportError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("duplicate IDs") }));
		expect(update).toHaveBeenCalledOnce();
	});

	it("emits an immutable result set when requested", () => {
		const subscription = new QuerySubscription(query(), { initialModels: [model("a")], emitResultSet: true });
		expect(subscription._lastResult).toEqual({ ids: ["a"] });
		expect(subscription._set.query).toBe(subscription._query);
	});

	it("drains queued records after publishing an in-flight update", () => {
		const subscription = seeded([model("a")]); subscription._updateInFlight = true;
		const process = vi.spyOn(subscription, "_processChangeRecords").mockImplementation(() => {});
		subscription._createResultAndTrigger();
		expect(subscription._updateInFlight).toBe(false); expect(process).toHaveBeenCalledOnce();
	});
});

