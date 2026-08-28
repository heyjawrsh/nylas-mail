import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	compile: vi.fn(),
	tableNameForJoin: vi.fn(() => "ThreadLabel"),
}));

// models/utils is CommonJS. Expose both interop shapes because Matcher reads
// the default while other consumers of this mock may read the named export.
vi.mock("../src/flux/models/utils.js", () => ({
	default: { tableNameForJoin: mocks.tableNameForJoin },
	tableNameForJoin: mocks.tableNameForJoin,
}));
vi.mock("../src/services/search/search-query-backend-local.js", () => ({
	default: class LocalSearchQueryBackend {
		constructor(tableName) {
			this.tableName = tableName;
		}

		compile(query) {
			return mocks.compile(query, this.tableName);
		}
	},
}));

import AttributeBoolean from "../src/flux/attributes/attribute-boolean.js";
import AttributeCollection from "../src/flux/attributes/attribute-collection.js";
import AttributeNumber from "../src/flux/attributes/attribute-number.js";
import AttributeObject from "../src/flux/attributes/attribute-object.js";
import AttributeString from "../src/flux/attributes/attribute-string.js";
import Matcher from "../src/flux/attributes/matcher.js";

class Thread {}
class Label {}

const stringAttribute = () => new AttributeString({
	modelKey: "subject",
	jsonKey: "subject_line",
	queryable: true,
});
const numberAttribute = () => new AttributeNumber({
	modelKey: "score",
	jsonKey: "score_value",
	queryable: true,
});
const collectionAttribute = () => new AttributeCollection({
	modelKey: "labels",
	jsonKey: "label_ids",
	itemClass: Label,
	queryable: true,
});

describe("Matcher SQL compilation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.tableNameForJoin.mockReturnValue("ThreadLabel");
	});

	it("compiles string equality and escapes apostrophes", () => {
		expect(stringAttribute().equal("Sam's").whereSQL(Thread)).toBe(
			"`Thread`.`subject_line` = 'Sam''s'",
		);
	});

	it("compiles non-null inequality", () => {
		expect(stringAttribute().not("draft").whereSQL(Thread)).toBe(
			"`Thread`.`subject_line` != 'draft'",
		);
	});

	it("uses IS NULL for null equality", () => {
		expect(stringAttribute().equal(null).whereSQL(Thread)).toBe(
			"`Thread`.`subject_line` IS NULL",
		);
	});

	it("uses IS NOT NULL for null inequality", () => {
		expect(stringAttribute().not(null).whereSQL(Thread)).toBe(
			"`Thread`.`subject_line` IS NOT NULL",
		);
	});

	it("compiles less-than", () => {
		expect(numberAttribute().lessThan(10).whereSQL(Thread)).toBe(
			"`Thread`.`score_value` < 10",
		);
	});

	it("compiles greater-than", () => {
		expect(numberAttribute().greaterThan(10).whereSQL(Thread)).toBe(
			"`Thread`.`score_value` > 10",
		);
	});

	it("compiles less-than-or-equal", () => {
		expect(numberAttribute().lessThanOrEqualTo(10).whereSQL(Thread)).toBe(
			"`Thread`.`score_value` <= 10",
		);
	});

	it("compiles greater-than-or-equal", () => {
		expect(numberAttribute().greaterThanOrEqualTo(10).whereSQL(Thread)).toBe(
			"`Thread`.`score_value` >= 10",
		);
	});

	it("compiles multi-value IN and escapes each fixture", () => {
		expect(stringAttribute().in(["inbox", "Sam's"]).whereSQL(Thread)).toBe(
			"`Thread`.`subject_line` in ('inbox','Sam''s')",
		);
	});

	it("compiles multi-value NOT IN", () => {
		expect(stringAttribute().notIn(["spam", "trash"]).whereSQL(Thread)).toBe(
			"`Thread`.`subject_line` not in ('spam','trash')",
		);
	});

	it("rejects non-string IN values at compilation time", () => {
		expect(() => numberAttribute().in([1, 2]).whereSQL(Thread)).toThrow(
			"score_value value 1 must be a string",
		);
	});

	it("compiles LIKE with percent wildcards", () => {
		expect(stringAttribute().like("report").whereSQL(Thread)).toBe(
			"`Thread`.`subject_line` like '%report%'",
		);
	});

	it("preserves the current startsWith SQL placeholder", () => {
		// Surprising but intentional coverage: SQL compilation is still a TODO.
		expect(stringAttribute().startsWith("Re:").whereSQL(Thread)).toBe(
			" RAISE `TODO`; ",
		);
	});

	it("compiles collection contains with a join alias", () => {
		const matcher = collectionAttribute().contains("inbox");
		const ref = matcher.joinTableRef();
		expect(matcher.joinSQL(Thread)).toBe(
			`INNER JOIN \`ThreadLabel\` AS \`${ref}\` ON \`${ref}\`.\`id\` = \`Thread\`.\`id\``,
		);
		expect(matcher.whereSQL(Thread)).toBe(`\`${ref}\`.\`value\` = 'inbox'`);
		expect(mocks.tableNameForJoin).toHaveBeenCalledWith(Thread, Label);
	});

	it("compiles collection containsAny with IN", () => {
		const matcher = collectionAttribute().containsAny(["inbox", "starred"]);
		const ref = matcher.joinTableRef();
		expect(matcher.joinSQL(Thread)).toContain(`AS \`${ref}\``);
		expect(matcher.whereSQL(Thread)).toBe(
			`\`${ref}\`.\`value\` IN ('inbox','starred')`,
		);
	});

	it("returns no join for scalar matchers", () => {
		expect(stringAttribute().equal("hello").joinSQL(Thread)).toBe(false);
	});

	it("compiles OR composites", () => {
		const attr = stringAttribute();
		expect(new Matcher.Or([attr.equal("a"), attr.equal("b")]).whereSQL(Thread)).toBe(
			"(`Thread`.`subject_line` = 'a' OR `Thread`.`subject_line` = 'b')",
		);
	});

	it("compiles AND composites", () => {
		const attr = numberAttribute();
		expect(new Matcher.And([attr.greaterThan(1), attr.lessThan(5)]).whereSQL(Thread)).toBe(
			"(`Thread`.`score_value` > 1 AND `Thread`.`score_value` < 5)",
		);
	});

	it("compiles NOT composites with the implementation's nested parentheses", () => {
		expect(new Matcher.Not([stringAttribute().equal("draft")]).whereSQL(Thread)).toBe(
			"NOT ((`Thread`.`subject_line` = 'draft'))",
		);
	});

	it("collects joins in composite matchers", () => {
		const contains = collectionAttribute().contains("inbox");
		expect(new Matcher.Or([stringAttribute().equal("x"), contains]).joinSQL(Thread)).toBe(
			contains.joinSQL(Thread),
		);
		// And currently returns an array, unlike Or which returns a joined string.
		expect(new Matcher.And([contains]).joinSQL(Thread)).toEqual([contains.joinSQL(Thread)]);
	});

	it("compiles structured searches through the mocked backend", () => {
		const query = { operator: "and" };
		mocks.compile.mockReturnValue("compiled structured SQL");
		expect(new Matcher.StructuredSearch(query).whereSQL(Thread)).toBe(
			"compiled structured SQL",
		);
		expect(mocks.compile).toHaveBeenCalledWith(query, "Thread");
	});

	it("compiles full-text search and escapes both quote styles", () => {
		const matcher = new Matcher.Search(` 'Sam's \"mail\"' `);
		expect(matcher.whereSQL(Thread)).toBe(
			"`Thread`.`id` IN (SELECT `content_id` FROM `ThreadSearch` WHERE `ThreadSearch` MATCH '\"Sam''s \"\"mail\"\"\"*' LIMIT 1000)",
		);
	});

	it("rejects empty full-text searches", () => {
		expect(() => new Matcher.Search("")).toThrow("non-zero length");
		expect(() => new Matcher.Search(null)).toThrow("non-zero length");
	});
});

describe("attribute subclass JSON round trips", () => {
	it("round trips finite numbers", () => {
		const attr = new AttributeNumber({ modelKey: "count" });
		expect(attr.fromJSON(attr.toJSON(42.5))).toBe(42.5);
	});

	it("coerces numeric JSON strings and maps NaN to null", () => {
		const attr = new AttributeNumber({ modelKey: "count" });
		expect(attr.fromJSON("17")).toBe(17);
		expect(attr.fromJSON(Number.NaN)).toBeNull();
	});

	it("round trips strings", () => {
		const attr = new AttributeString({ modelKey: "subject" });
		expect(attr.fromJSON(attr.toJSON("hello"))).toBe("hello");
	});

	it("normalizes nullish and false string values to null", () => {
		const attr = new AttributeString({ modelKey: "subject" });
		expect(attr.fromJSON(null)).toBeNull();
		expect(attr.fromJSON(undefined)).toBeNull();
		expect(attr.fromJSON(false)).toBeNull();
		expect(attr.fromJSON(12)).toBe("12");
	});

	it("round trips both boolean values", () => {
		const attr = new AttributeBoolean({ modelKey: "unread" });
		expect(attr.fromJSON(attr.toJSON(true))).toBe(true);
		expect(attr.fromJSON(attr.toJSON(false))).toBe(false);
	});

	it("accepts only true and the true string as true JSON", () => {
		const attr = new AttributeBoolean({ modelKey: "unread" });
		expect(attr.fromJSON("true")).toBe(true);
		expect(attr.fromJSON("false")).toBe(false);
		expect(attr.fromJSON(1)).toBe(false);
	});

	it("round trips plain objects without an item class", () => {
		const attr = new AttributeObject({ modelKey: "metadata" });
		const value = { nested: { enabled: true } };
		expect(attr.fromJSON(attr.toJSON(value))).toBe(value);
	});

	it("round trips model objects through their JSON hooks", () => {
		class Item {
			constructor(json = {}) {
				this.clientId = "generated";
				this.name = json.name;
			}

			fromJSON(json) {
				this.name = json.name.toUpperCase();
				return this;
			}

			toJSON() {
				return { name: this.name.toLowerCase() };
			}
		}
		const attr = new AttributeObject({ modelKey: "item", itemClass: Item });
		const restored = attr.fromJSON(attr.toJSON(new Item({ name: "ALPHA" })));
		expect(restored).toBeInstanceOf(Item);
		expect(restored.name).toBe("ALPHA");
		expect(restored.clientId).toBeUndefined();
	});

	it("does not call an object's fromJSON hook for primitive JSON", () => {
		const fromJSON = vi.fn();
		class Item {
			constructor(value) {
				this.value = value;
			}
			fromJSON(value) {
				fromJSON(value);
			}
		}
		const restored = new AttributeObject({ modelKey: "item", itemClass: Item }).fromJSON("raw");
		expect(restored.value).toBe("raw");
		expect(fromJSON).not.toHaveBeenCalled();
	});
});
