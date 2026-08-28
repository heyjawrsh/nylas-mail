import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	class Matcher {
		constructor(attr = null, val = null) { this.attr = attr; this.val = val; }
		joinSQL() { return this.join || ""; }
		whereSQL() { return this.where || ""; }
		attribute() { return this.attr; }
		joinTableRef() { return "joined_ref"; }
	}
	Matcher.Or = class Or extends Matcher { constructor(children) { super(); this.children = children; } };
	Matcher.Search = class Search extends Matcher {};
	Matcher.StructuredSearch = class StructuredSearch extends Matcher {};
	class AttributeJoinedData {}
	AttributeJoinedData.NullPlaceholder = "__NULL__";
	class AttributeCollection {}
	class QueryRange {
		constructor({ limit, offset }) { this.limit = limit; this.offset = offset; }
		static infinite() { return new QueryRange({ limit: null, offset: null }); }
		clone() { return new QueryRange({ limit: this.limit, offset: this.offset }); }
	}
	return { Matcher, AttributeJoinedData, AttributeCollection, QueryRange,
		reviver: vi.fn((_key, value) => value), tableNameForJoin: vi.fn(() => "ThreadCategory") };
});

vi.mock("node:module", () => ({
	default: { createRequire: () => vi.fn() },
	createRequire: () => vi.fn(),
}));
vi.mock("../src/flux/attributes.js", () => ({ default: {
	Matcher: mocks.Matcher, AttributeJoinedData: mocks.AttributeJoinedData,
	AttributeCollection: mocks.AttributeCollection,
} }));
vi.mock("../src/flux/models/query-range.js", () => ({ default: mocks.QueryRange }));
vi.mock("../src/flux/models/utils.js", () => ({ default: {
	registeredObjectReviver: mocks.reviver, tableNameForJoin: mocks.tableNameForJoin,
} }));

import ModelQuery from "../src/flux/models/query.js";

const attr = (modelKey, overrides = {}) => ({
	modelKey, jsonKey: modelKey,
	equal: vi.fn((value) => new mocks.Matcher({ modelKey }, value)),
	in: vi.fn((value) => new mocks.Matcher({ modelKey }, value)),
	needsColumn: vi.fn(() => false), ...overrides,
});
class Thread {
	static attributes = { id: attr("id"), subject: attr("subject") };
	static naturalSortOrder = vi.fn(() => null);
	fromJSON(json) { Object.assign(this, json); return this; }
}
const database = () => ({ run: vi.fn().mockResolvedValue([]) });
const matcher = (where, attribute = attr("subject"), join = "") => {
	const value = new mocks.Matcher(attribute, "value"); value.where = where; value.join = join; return value;
};
const order = (sql = "`Thread`.`subject` ASC") => ({ attr: attr("subject"), orderBySQL: vi.fn(() => sql) });

describe("ModelQuery", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		Thread.attributes = { id: attr("id"), subject: attr("subject") };
		Thread.naturalSortOrder.mockReturnValue(null);
	});

	it("starts with an infinite range", () => {
		expect(new ModelQuery(Thread, database()).range()).toMatchObject({ limit: null, offset: null });
	});
	it("adds one matcher", () => {
		const value = matcher("subject = 'hello'");
		expect(new ModelQuery(Thread, database()).where(value).matchers()).toEqual([value]);
	});
	it("adds an array of matchers", () => {
		const values = [matcher("a"), matcher("b")];
		expect(new ModelQuery(Thread, database()).where(values).matchers()).toEqual(values);
	});
	it("rejects a non-Matcher in a matcher array", () => {
		expect(() => new ModelQuery(Thread, database()).where([{}])).toThrow("instances of `Matcher`");
	});
	it("expands object equality shorthand", () => {
		const query = new ModelQuery(Thread, database()).where({ subject: "hello" });
		expect(Thread.attributes.subject.equal).toHaveBeenCalledWith("hello");
		expect(query.matcherValueForModelKey("subject")).toBe("hello");
	});
	it("expands array shorthand with the attribute in matcher", () => {
		new ModelQuery(Thread, database()).where({ id: ["a", "b"] });
		expect(Thread.attributes.id.in).toHaveBeenCalledWith(["a", "b"]);
	});
	it("rejects shorthand for an unknown attribute", () => {
		expect(() => new ModelQuery(Thread, database()).where({ missing: 1 })).toThrow("missing is not an attribute of Thread");
	});
	it("wraps alternative matchers in an Or matcher", () => {
		const children = [matcher("a"), matcher("b")]; const query = new ModelQuery(Thread, database()).whereAny(children);
		expect(query.matchers()[0]).toBeInstanceOf(mocks.Matcher.Or);
		expect(query.matchers()[0].children).toBe(children);
	});
	it("flattens nested matcher groups", () => {
		const children = [matcher("a"), matcher("b")];
		expect(new ModelQuery(Thread, database()).whereAny(children).matchersFlattened()).toEqual(children);
	});
	it("creates a search matcher", () => {
		expect(new ModelQuery(Thread, database()).search("from:me").matchers()[0]).toBeInstanceOf(mocks.Matcher.Search);
	});
	it("creates a structured search matcher", () => {
		expect(new ModelQuery(Thread, database()).structuredSearch({ from: "me" }).matchers()[0]).toBeInstanceOf(mocks.Matcher.StructuredSearch);
	});
	it("appends order descriptors from singular and array calls", () => {
		const first = order("first"), second = order("second");
		expect(new ModelQuery(Thread, database()).order(first).order([second]).orderSortDescriptors()).toEqual([first, second]);
	});
	it("clones mutable query state without sharing arrays or range", () => {
		const original = new ModelQuery(Thread, database()).where(matcher("x")).order(order()).limit(4).offset(2).distinct().idsOnly();
		const copy = original.clone();
		expect(copy).not.toBe(original); expect(copy.matchers()).not.toBe(original.matchers());
		expect(copy.orderSortDescriptors()).not.toBe(original.orderSortDescriptors());
		expect(copy.range()).not.toBe(original.range()); expect(copy).toMatchObject({ _distinct: true, _returnIds: true });
	});
	it("sets limit and offset without mutating the previous range", () => {
		const query = new ModelQuery(Thread, database()); const initial = query.range(); query.limit(20).offset(5);
		expect(initial).toMatchObject({ limit: null, offset: null }); expect(query.range()).toMatchObject({ limit: 20, offset: 5 });
	});
	it("rounds a requested window to padded pages", () => {
		expect(new ModelQuery(Thread, database()).page(130, 180, 50, 100).range()).toMatchObject({ offset: 0, limit: 250 });
	});
	it("prevents a multi-result limit after one", () => {
		expect(() => new ModelQuery(Thread, database()).one().limit(2)).toThrow("limit > 1");
	});
	it("finalization gives one queries a limit of one", () => {
		expect(new ModelQuery(Thread, database()).one().finalize().range().limit).toBe(1);
	});
	it("finalization installs the model natural order", () => {
		const natural = order(); Thread.naturalSortOrder.mockReturnValue(natural);
		expect(new ModelQuery(Thread, database()).finalize().orderSortDescriptors()).toEqual([natural]);
	});
	it("prevents query-builder changes after finalization", () => {
		const query = new ModelQuery(Thread, database()).finalize();
		expect(() => query.where(matcher("x"))).toThrow("cannot modify a query");
	});
	it("throws when a transaction query is moved to the background", () => {
		expect(() => new ModelQuery(Thread, database()).markNotBackgroundable().background()).toThrow("within transactions");
	});
	it("delegates execution to its database", async () => {
		const db = database(); const query = new ModelQuery(Thread, db); await query.run();
		expect(db.run).toHaveBeenCalledWith(query);
	});
	it("inflates count rows to a number", () => {
		expect(new ModelQuery(Thread, database()).count().inflateResult([{ count: "7" }])).toBe(7);
	});
	it("inflates IDs without constructing models", () => {
		expect(new ModelQuery(Thread, database()).idsOnly().inflateResult([{ id: "a" }, { id: "b" }])).toEqual(["a", "b"]);
	});
	it("formats a singular result as its first model", () => {
		expect(new ModelQuery(Thread, database()).one().formatResult(["first", "second"])).toBe("first");
	});
	it("builds where, order, limit, and offset SQL", () => {
		const sql = new ModelQuery(Thread, database()).where(matcher("`Thread`.`subject` = 'hello'"))
			.order(order("`Thread`.`subject` ASC")).limit(10).offset(5).sql();
		expect(sql).toContain("WHERE `Thread`.`subject` = 'hello'");
		expect(sql).toContain("ORDER BY `Thread`.`subject` ASC"); expect(sql).toContain("LIMIT 10 OFFSET 5");
	});
	it("omits ordering from count SQL", () => {
		const sql = new ModelQuery(Thread, database()).order(order()).count().sql();
		expect(sql).toContain("COUNT(*) as count"); expect(sql).not.toContain("ORDER BY");
	});
	it("selects distinct IDs for an IDs-only query", () => {
		expect(new ModelQuery(Thread, database()).distinct().idsOnly().sql()).toContain("SELECT DISTINCT `Thread`.`id`");
	});
});
