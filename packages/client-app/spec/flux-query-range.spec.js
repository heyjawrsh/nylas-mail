import { describe, expect, it } from "vitest";
import QueryRange from "../src/flux/models/query-range.js";
import QueryResultSet from "../src/flux/models/query-result-set.js";

const range = (start, end) => new QueryRange({ start, end });

describe("QueryRange", () => {
	it("requires a limit", () => {
		expect(() => new QueryRange({ offset: 0 })).toThrow("specify a limit");
	});

	it("requires an offset", () => {
		expect(() => new QueryRange({ limit: 10 })).toThrow("specify an offset");
	});

	it("stores explicit offset and limit bounds", () => {
		const value = new QueryRange({ offset: 5, limit: 10 });
		expect(value.start).toBe(5);
		expect(value.end).toBe(15);
	});

	it("derives limit from start and end", () => {
		const value = range(10, 25);
		expect(value.offset).toBe(10);
		expect(value.limit).toBe(15);
	});

	it("prefers explicit offset and limit over start and end", () => {
		const value = new QueryRange({ offset: 2, limit: 3, start: 20, end: 40 });
		expect(value.start).toBe(2);
		expect(value.end).toBe(5);
	});

	it("permits empty ranges", () => {
		const value = range(7, 7);
		expect(value.limit).toBe(0);
		expect(value.start).toBe(value.end);
	});

	it("creates an infinite range with null bounds storage", () => {
		const value = QueryRange.infinite();
		expect(value.limit).toBeNull();
		expect(value.offset).toBeNull();
		expect(value.isInfinite()).toBe(true);
	});

	it("does not consider a partly-null range infinite", () => {
		expect(new QueryRange({ offset: null, limit: 10 }).isInfinite()).toBe(false);
	});

	it("clones into a distinct equal range", () => {
		const value = range(3, 8);
		const clone = value.clone();
		expect(clone).not.toBe(value);
		expect(clone.isEqual(value)).toBe(true);
	});

	it("compares ranges by computed bounds", () => {
		expect(range(3, 8).isEqual(new QueryRange({ offset: 3, limit: 5 }))).toBe(
			true,
		);
		expect(range(3, 8).isEqual(range(3, 9))).toBe(false);
	});

	it("formats finite bounds", () => {
		expect(range(3, 8).toString()).toBe("QueryRange{3 - 8}");
	});

	it("considers overlapping ranges contiguous", () => {
		expect(range(0, 10).isContiguousWith(range(5, 15))).toBe(true);
	});

	it("considers touching half-open ranges contiguous", () => {
		expect(range(0, 10).isContiguousWith(range(10, 20))).toBe(true);
	});

	it("rejects separated ranges as non-contiguous", () => {
		expect(range(0, 10).isContiguousWith(range(11, 20))).toBe(false);
	});

	it("considers any range contiguous with infinity", () => {
		expect(range(100, 200).isContiguousWith(QueryRange.infinite())).toBe(true);
	});

	it("unions overlapping windows", () => {
		const value = QueryRange.rangeWithUnion(range(5, 15), range(10, 20));
		expect(value.start).toBe(5);
		expect(value.end).toBe(20);
	});

	it("unions touching windows", () => {
		expect(QueryRange.rangeWithUnion(range(0, 10), range(10, 20)).isEqual(range(0, 20))).toBe(
			true,
		);
	});

	it("returns infinity when either union operand is infinite", () => {
		expect(
			QueryRange.rangeWithUnion(range(0, 10), QueryRange.infinite()).isInfinite(),
		).toBe(true);
	});

	it("rejects union of disjoint windows", () => {
		expect(() => QueryRange.rangeWithUnion(range(0, 10), range(20, 30))).toThrow(
			"do not touch or intersect",
		);
	});

	it("returns no uncovered windows when the second range is absent", () => {
		expect(QueryRange.rangesBySubtracting(range(0, 10), null)).toEqual([]);
	});

	it("returns both uncovered sides around an interior window", () => {
		const values = QueryRange.rangesBySubtracting(range(0, 20), range(5, 15));
		expect(values.map((value) => [value.start, value.end])).toEqual([
			[0, 5],
			[15, 20],
		]);
	});

	it("returns only the uncovered leading window", () => {
		const values = QueryRange.rangesBySubtracting(range(0, 20), range(5, 25));
		expect(values.map((value) => [value.start, value.end])).toEqual([[0, 5]]);
	});

	it("returns only the uncovered trailing window", () => {
		const values = QueryRange.rangesBySubtracting(range(0, 20), range(-5, 15));
		expect(values.map((value) => [value.start, value.end])).toEqual([[15, 20]]);
	});

	it("rejects subtraction involving infinity", () => {
		expect(() =>
			QueryRange.rangesBySubtracting(QueryRange.infinite(), range(0, 10)),
		).toThrow("cannot subtract infinite ranges");
	});
});

describe("QueryResultSet", () => {
	const makeSet = () =>
		new QueryResultSet({
			_offset: 10,
			_query: { name: "inbox" },
			_ids: ["a", "b", "c"],
			_modelsHash: {
				a: { id: "a", clientId: "client-a" },
				b: { id: "b", clientId: "client-b" },
				c: { id: "c", clientId: "client-c" },
			},
		});

	it("defaults to an empty result shape", () => {
		const set = new QueryResultSet();
		expect(set.ids()).toEqual([]);
		expect(set.models()).toEqual([]);
		expect(set.count()).toBe(0);
		expect(set.empty()).toBe(true);
	});

	it("reports complete when every id has a truthy model", () => {
		expect(makeSet().isComplete()).toBe(true);
	});

	it("reports incomplete when a model is missing", () => {
		const set = makeSet();
		delete set._modelsHash.b;
		expect(set.isComplete()).toBe(false);
	});

	it("describes its pagination window from offset and id count", () => {
		const window = makeSet().range();
		expect(window.start).toBe(10);
		expect(window.end).toBe(13);
	});

	it("returns ids at absolute query offsets", () => {
		const set = makeSet();
		expect(set.idAtOffset(10)).toBe("a");
		expect(set.idAtOffset(12)).toBe("c");
		expect(set.idAtOffset(13)).toBeUndefined();
	});

	it("returns models in id order", () => {
		expect(makeSet().models().map((model) => model.id)).toEqual(["a", "b", "c"]);
	});

	it("returns models at absolute query offsets", () => {
		const set = makeSet();
		expect(set.modelAtOffset(11).id).toBe("b");
		expect(set.modelAtOffset(9)).toBeUndefined();
	});

	it("rejects non-integer offsets for model lookup", () => {
		expect(() => makeSet().modelAtOffset("10")).toThrow("numeric index");
		expect(() => makeSet().modelAtOffset(10.5)).toThrow("numeric index");
	});

	it("looks up models directly by id", () => {
		expect(makeSet().modelWithId("c")).toEqual({ id: "c", clientId: "client-c" });
	});

	it("counts cached models independently from result ids", () => {
		const set = makeSet();
		set._modelsHash.extra = { id: "extra" };
		expect(set.modelCacheCount()).toBe(4);
		expect(set.count()).toBe(3);
	});

	it("returns the original query reference", () => {
		const set = makeSet();
		expect(set.query()).toBe(set._query);
	});

	it("finds absolute offsets by object id", () => {
		expect(makeSet().offsetOfId("b")).toBe(11);
	});

	it("finds absolute offsets by loaded model client id", () => {
		expect(makeSet().offsetOfId("client-c")).toBe(12);
	});

	it("returns -1 for ids outside the pagination window", () => {
		expect(makeSet().offsetOfId("missing")).toBe(-1);
	});

	it("clones arrays and hashes while retaining query identity", () => {
		const set = makeSet();
		const clone = set.clone();
		expect(clone).not.toBe(set);
		expect(clone._ids).not.toBe(set._ids);
		expect(clone._modelsHash).not.toBe(set._modelsHash);
		expect(clone.query()).toBe(set.query());
	});

	it("applies a model hash to a clone without changing the source", () => {
		const set = makeSet();
		const models = { a: { id: "a", clientId: "new-a" } };
		const applied = QueryResultSet.setByApplyingModels(set, models);
		expect(applied).not.toBe(set);
		expect(applied._modelsHash).toBe(models);
		expect(set.modelCacheCount()).toBe(3);
	});

	it("rejects an array when applying models", () => {
		expect(() => QueryResultSet.setByApplyingModels(makeSet(), [])).toThrow(
			"A hash of models is required",
		);
	});

	it("rebuilds cached offsets after applying models", () => {
		const set = makeSet();
		expect(set.offsetOfId("client-a")).toBe(10);
		const applied = QueryResultSet.setByApplyingModels(set, {
			a: { id: "a", clientId: "replacement-a" },
		});
		expect(applied.offsetOfId("replacement-a")).toBe(10);
		expect(applied.offsetOfId("client-a")).toBe(-1);
	});
});
