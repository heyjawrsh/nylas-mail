import { describe, expect, it, vi } from "vitest";
import Attribute from "../src/flux/attributes/attribute.js";
import AttributeBoolean from "../src/flux/attributes/attribute-boolean.js";
import AttributeCollection from "../src/flux/attributes/attribute-collection.js";
import AttributeDateTime from "../src/flux/attributes/attribute-datetime.js";
import AttributeJoinedData from "../src/flux/attributes/attribute-joined-data.js";
import AttributeNumber from "../src/flux/attributes/attribute-number.js";
import AttributeObject from "../src/flux/attributes/attribute-object.js";
import AttributeString from "../src/flux/attributes/attribute-string.js";
import Matcher from "../src/flux/attributes/matcher.js";
import SortOrder from "../src/flux/attributes/sort-order.js";

class Row {}

describe("flux attributes", () => {
	it("defaults jsonKey to modelKey", () => {
		const attr = new Attribute({ modelKey: "subject" });
		expect(attr.jsonKey).toBe("subject");
	});

	it("retains an explicit jsonKey and default value", () => {
		const attr = new Attribute({
			modelKey: "isUnread",
			jsonKey: "unread",
			defaultValue: true,
		});
		expect(attr.jsonKey).toBe("unread");
		expect(attr.defaultValue).toBe(true);
	});

	it("rejects loadFromColumn on a non-queryable attribute", () => {
		expect(
			() => new Attribute({ modelKey: "body", loadFromColumn: true }),
		).toThrow("loadFromColumn requires queryable");
	});

	it("allows loadFromColumn on a queryable attribute", () => {
		const attr = new Attribute({
			modelKey: "subject",
			queryable: true,
			loadFromColumn: true,
		});
		expect(attr.loadFromColumn).toBe(true);
	});

	it("retains collection constructor metadata", () => {
		class Item {}
		const attr = new AttributeCollection({
			modelKey: "items",
			jsonKey: "item_data",
			itemClass: Item,
			joinOnField: "remoteId",
			joinQueryableBy: ["email"],
			queryable: true,
		});
		expect(attr.ItemClass).toBe(Item);
		expect(attr.itemClass).toBe(Item);
		expect(attr.joinOnField).toBe("remoteId");
		expect(attr.joinQueryableBy).toEqual(["email"]);
		expect(attr.jsonKey).toBe("item_data");
	});

	it("defaults collection joinQueryableBy to an empty array", () => {
		const attr = new AttributeCollection({
			modelKey: "items",
			itemClass: class Item {},
		});
		expect(attr.joinQueryableBy).toEqual([]);
	});

	it("retains joined-data constructor hooks", () => {
		const serializeFn = (value) => value;
		const deserializeFn = (value) => value;
		const attr = new AttributeJoinedData({
			modelKey: "body",
			modelTable: "MessageBody",
			serializeFn,
			deserializeFn,
		});
		expect(attr.modelTable).toBe("MessageBody");
		expect(attr.serializeFn).toBe(serializeFn);
		expect(attr.deserializeFn).toBe(deserializeFn);
	});

	it("reports whether a queryable non-id attribute needs a column", () => {
		const attr = new AttributeString({ modelKey: "subject", queryable: true });
		expect(attr.needsColumn()).toBe(true);
		expect(
			new AttributeString({ modelKey: "id", queryable: true }).needsColumn(),
		).toBe(false);
	});

	it("requires values for equality matchers", () => {
		const attr = new AttributeString({ modelKey: "subject", queryable: true });
		expect(() => attr.equal()).toThrow("you must provide a value");
	});

	it("rejects matchers on non-queryable attributes", () => {
		const attr = new AttributeString({ modelKey: "subject" });
		expect(() => attr.equal("hello")).toThrow(
			"this field cannot be queried against",
		);
	});

	it("requires an array for in matchers", () => {
		const attr = new AttributeString({ modelKey: "subject", queryable: true });
		expect(() => attr.in("hello")).toThrow("you must pass an array");
	});

	it("warns for an empty in matcher and still creates it", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const attr = new AttributeString({ modelKey: "subject", queryable: true });
		const matcher = attr.in([]);
		expect(warn).toHaveBeenCalledOnce();
		expect(matcher.comparator).toBe("in");
		warn.mockRestore();
	});

	it("reduces one-element in and notIn matchers to scalar comparisons", () => {
		const attr = new AttributeString({ modelKey: "subject", queryable: true });
		expect(attr.in(["a"]).comparator).toBe("=");
		expect(attr.notIn(["a"]).comparator).toBe("!=");
	});

	it("compiles quoted string equality to SQL", () => {
		const attr = new AttributeString({
			modelKey: "subject",
			jsonKey: "subject_line",
			queryable: true,
		});
		expect(attr.equal("Sam's mail").whereSQL(Row)).toBe(
			"`Row`.`subject_line` = 'Sam''s mail'",
		);
	});

	it("compiles null equality and inequality with IS operators", () => {
		const attr = new AttributeString({ modelKey: "subject", queryable: true });
		expect(attr.equal(null).whereSQL(Row)).toBe("`Row`.`subject` IS NULL");
		expect(attr.not(null).whereSQL(Row)).toBe("`Row`.`subject` IS NOT NULL");
	});

	it("compiles booleans as SQLite integers", () => {
		const attr = new AttributeBoolean({ modelKey: "unread", queryable: true });
		expect(attr.equal(true).whereSQL(Row)).toBe("`Row`.`unread` = 1");
		expect(attr.equal(false).whereSQL(Row)).toBe("`Row`.`unread` = 0");
	});

	it("compiles dates as epoch seconds", () => {
		const attr = new AttributeDateTime({ modelKey: "date", queryable: true });
		const date = new Date("2020-01-01T00:00:00.000Z");
		expect(attr.greaterThan(date).whereSQL(Row)).toBe(
			"`Row`.`date` > 1577836800",
		);
	});

	it("compiles string arrays for IN clauses", () => {
		const attr = new AttributeString({ modelKey: "folder", queryable: true });
		expect(attr.in(["inbox", "Sam's"]).whereSQL(Row)).toBe(
			"`Row`.`folder` in ('inbox','Sam''s')",
		);
	});

	it("rejects non-string array members during SQL compilation", () => {
		const attr = new AttributeNumber({ modelKey: "version", queryable: true });
		expect(() => attr.in([1, 2]).whereSQL(Row)).toThrow(
			"version value 1 must be a string",
		);
	});

	it("wraps like values in percent wildcards", () => {
		const attr = new AttributeString({ modelKey: "subject", queryable: true });
		expect(attr.like("hello").whereSQL(Row)).toBe(
			"`Row`.`subject` like '%hello%'",
		);
	});

	it("evaluates scalar and collection matchers", () => {
		const number = new AttributeNumber({ modelKey: "count", queryable: true });
		const collection = new AttributeCollection({
			modelKey: "labels",
			itemClass: class Label {},
			queryable: true,
		});
		expect(number.greaterThanOrEqualTo(3).evaluate({ count: 3 })).toBe(true);
		expect(collection.contains("inbox").evaluate({ labels: [{ id: "inbox" }] })).toBe(
			true,
		);
	});

	it("evaluates function-valued model attributes", () => {
		const attr = new AttributeNumber({ modelKey: "count", queryable: true });
		expect(attr.equal(4).evaluate({ count: () => 4 })).toBe(true);
	});

	it("composes OR, AND, and NOT SQL clauses", () => {
		const attr = new AttributeString({ modelKey: "subject", queryable: true });
		const a = attr.equal("a");
		const b = attr.equal("b");
		expect(new Matcher.Or([a, b]).whereSQL(Row)).toBe(
			"(`Row`.`subject` = 'a' OR `Row`.`subject` = 'b')",
		);
		expect(new Matcher.And([a, b]).whereSQL(Row)).toContain(" AND ");
		expect(new Matcher.Not([a]).whereSQL(Row)).toBe(
			"NOT ((`Row`.`subject` = 'a'))",
		);
	});

	it("normalizes boolean JSON and column values", () => {
		const attr = new AttributeBoolean({
			modelKey: "unread",
			jsonKey: "unread",
			defaultValue: true,
		});
		expect(attr.fromJSON("true")).toBe(true);
		expect(attr.fromJSON("false")).toBe(false);
		expect(attr.fromColumn(1)).toBe(true);
		expect(attr.columnSQL()).toBe("unread INTEGER DEFAULT 1");
	});

	it("converts number values and NaN", () => {
		const attr = new AttributeNumber({ modelKey: "count" });
		expect(attr.fromJSON("12")).toBe(12);
		expect(attr.fromJSON(Number.NaN)).toBeNull();
		expect(attr.columnSQL()).toBe("count INTEGER");
	});

	it("serializes and deserializes date values", () => {
		const attr = new AttributeDateTime({ modelKey: "date" });
		const date = new Date("2020-01-01T00:00:00.000Z");
		expect(attr.toJSON(date)).toBe(1577836800);
		expect(attr.fromJSON(1577836800)).toEqual(date);
		expect(() => attr.toJSON("2020-01-01")).toThrow("is not a date");
	});

	it("validates collection members during serialization", () => {
		class Item {
			toJSON() {
				return { id: "one" };
			}
		}
		const attr = new AttributeCollection({ modelKey: "items", itemClass: Item });
		expect(attr.toJSON([new Item()])).toEqual([{ id: "one" }]);
		expect(() => attr.toJSON({})).toThrow("is not an array");
		expect(() => attr.toJSON([{}])).toThrow("is not an Item");
	});

	it("constructs object attribute values and clears generated client ids", () => {
		class Item {
			constructor(value) {
				this.value = value;
				this.clientId = "generated";
			}
		}
		const attr = new AttributeObject({ modelKey: "item", itemClass: Item });
		const item = attr.fromJSON("value");
		expect(item.value).toBe("value");
		expect(item.clientId).toBeUndefined();
	});

	it("uses joined-data serializers with the owning value as this", () => {
		const owner = { prefix: "body:" };
		const attr = new AttributeJoinedData({
			modelKey: "body",
			modelTable: "MessageBody",
			serializeFn(value) {
				return `${this.prefix}${value}`;
			},
		});
		expect(attr.serialize(owner, "hello")).toBe("body:hello");
		expect(attr.selectSQL()).toContain(AttributeJoinedData.NullPlaceholder);
		expect(attr.includeSQL(Row)).toContain("LEFT OUTER JOIN `MessageBody`");
	});

	it("creates ascending and descending sort orders", () => {
		const attr = new AttributeString({ modelKey: "subject" });
		expect(attr.ascending().orderBySQL(Row)).toBe("`Row`.`subject` ASC");
		expect(attr.descending().orderBySQL(Row)).toBe("`Row`.`subject` DESC");
	});

	it("defaults direct sort orders to descending", () => {
		const attr = new AttributeString({ modelKey: "subject" });
		const order = new SortOrder(attr);
		expect(order.direction).toBe("DESC");
		expect(order.attribute()).toBe(attr);
	});

	it("preserves arbitrary direct sort directions and has no reversal method", () => {
		const attr = new AttributeString({ modelKey: "subject" });
		const order = new SortOrder(attr, "SIDEWAYS");
		expect(order.orderBySQL(Row)).toBe("`Row`.`subject` SIDEWAYS");
		expect(order.reverse).toBeUndefined();
	});
});
