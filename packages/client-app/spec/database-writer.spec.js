import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	if (!Promise.try) Promise.try = (fn) => Promise.resolve().then(fn);
	return {
		replacer: vi.fn((_key, value) => value),
		tableNameForJoin: vi.fn(() => "ItemTag"),
	};
});

vi.mock("node:module", () => {
	const createRequire = () => vi.fn(() => () => ({}));
	return { default: { createRequire }, createRequire };
});
vi.mock("../src/flux/models/model.js", () => ({
	default: class Model {
		constructor(values = {}) { Object.assign(this, values); }
		clone() { return Object.assign(Object.create(Object.getPrototypeOf(this)), this); }
		toJSON() { return { id: this.id, title: this.title, account_id: this.accountId }; }
	},
}));
vi.mock("../src/flux/models/query.js", () => ({
	default: class ModelQuery {
		markNotBackgroundable() { this.notBackgroundable = true; return this; }
	},
}));
vi.mock("../src/flux/models/utils.js", () => ({
	default: {
		tableNameForJoin: mocks.tableNameForJoin,
		registeredObjectReplacer: mocks.replacer,
	},
}));
vi.mock("../src/flux/attributes.js", () => {
	class AttributeCollection {
		constructor(values = {}) { Object.assign(this, values); }
	}
	class AttributeJoinedData {
		constructor(values = {}) { Object.assign(this, values); }
	}
	return { default: { AttributeCollection, AttributeJoinedData } };
});

import DatabaseWriter from "../src/flux/stores/database-writer.js";
import Model from "../src/flux/models/model.js";
import ModelQuery from "../src/flux/models/query.js";
import Attributes from "../src/flux/attributes.js";

const { AttributeCollection, AttributeJoinedData } = Attributes;

class Item extends Model {}
Item.attributes = {
	id: { jsonKey: "id", queryable: true, columnSQL: "TEXT" },
	title: { jsonKey: "title", queryable: true, columnSQL: "TEXT" },
	accountId: { jsonKey: "account_id", queryable: false, columnSQL: "TEXT" },
};

class OtherItem extends Model {}
OtherItem.attributes = Item.attributes;

const item = (id = "one", values = {}) => new Item({ id, title: `Title ${id}`, ...values });

describe("DatabaseWriter", () => {
	let database;
	let writer;

	beforeEach(() => {
		vi.clearAllMocks();
		Item.attributes = {
			id: { jsonKey: "id", queryable: true, columnSQL: "TEXT" },
			title: { jsonKey: "title", queryable: true, columnSQL: "TEXT" },
			accountId: { jsonKey: "account_id", queryable: false, columnSQL: "TEXT" },
		};
		database = {
			_query: vi.fn().mockResolvedValue(undefined),
			accumulateAndTrigger: vi.fn(),
			mutationHooks: vi.fn(() => []),
			find: vi.fn(), findBy: vi.fn(), findAll: vi.fn(), modelify: vi.fn(),
			count: vi.fn(), findJSONBlob: vi.fn(),
		};
		writer = new DatabaseWriter(database);
	});

	it("forwards find arguments to the database", () => {
		database.find.mockReturnValue("found");
		expect(writer.find(Item, "one")).toBe("found");
		expect(database.find).toHaveBeenCalledWith(Item, "one");
	});

	it("forwards findBy to the database", () => {
		writer.findBy(Item, { id: "one" });
		expect(database.findBy).toHaveBeenCalledWith(Item, { id: "one" });
	});

	it("forwards findAll to the database", () => {
		writer.findAll(Item);
		expect(database.findAll).toHaveBeenCalledWith(Item);
	});

	it("forwards modelify to the database", () => {
		writer.modelify(Item, { id: "one" });
		expect(database.modelify).toHaveBeenCalledWith(Item, { id: "one" });
	});

	it("forwards count to the database", () => {
		writer.count(Item);
		expect(database.count).toHaveBeenCalledWith(Item);
	});

	it("forwards findJSONBlob to the database", () => {
		writer.findJSONBlob("settings");
		expect(database.findJSONBlob).toHaveBeenCalledWith("settings");
	});

	it("marks forwarded model queries non-backgroundable", () => {
		const query = new ModelQuery();
		database.find.mockReturnValue(query);
		expect(writer.find(Item)).toBe(query);
		expect(query.notBackgroundable).toBe(true);
	});

	it("wraps errors from forwarded operations", () => {
		database.find.mockImplementation(() => { throw new Error("sqlite"); });
		expect(() => writer.find(Item)).toThrow("Error trying to perform find on database");
	});

	it("execute passes the writer to its callback", async () => {
		const callback = vi.fn();
		await writer.execute(callback);
		expect(callback).toHaveBeenCalledWith(writer);
	});

	it("execute flushes accumulated change records", async () => {
		writer._changeRecords.push({ type: "persist" });
		await writer.execute(async () => {});
		expect(database.accumulateAndTrigger).toHaveBeenCalledWith({ type: "persist" });
	});

	it("execute retains flushed change records", async () => {
		const record = { type: "persist" };
		writer._changeRecords.push(record);
		await writer.execute(async () => {});
		// The writer is intended for one execution; flushing does not drain its queue.
		expect(writer._changeRecords).toEqual([record]);
	});

	it("execute flushes changes when its callback rejects", async () => {
		writer._changeRecords.push({ type: "unpersist" });
		await expect(writer.execute(async () => { throw new Error("failed"); })).rejects.toThrow("failed");
		expect(database.accumulateAndTrigger).toHaveBeenCalledOnce();
	});

	it("starts an immediate transaction before invoking its callback", async () => {
		const callback = vi.fn().mockResolvedValue(undefined);
		await writer.executeInTransaction(callback);
		expect(database._query.mock.calls[0][0]).toBe("BEGIN IMMEDIATE TRANSACTION");
		expect(callback).toHaveBeenCalledWith(writer);
	});

	it("commits a successful transaction", async () => {
		await writer.executeInTransaction(async () => {});
		expect(database._query).toHaveBeenLastCalledWith("COMMIT");
	});

	it("commits even when the transaction callback rejects", async () => {
		await expect(writer.executeInTransaction(async () => { throw new Error("failed"); })).rejects.toThrow("failed");
		// Current semantics finalize with COMMIT, not ROLLBACK, on callback failure.
		expect(database._query).toHaveBeenLastCalledWith("COMMIT");
	});

	it("rejects transaction callbacks that do not return a promise", async () => {
		await expect(writer.executeInTransaction(() => undefined)).rejects.toThrow("must return a Promise");
	});

	it("does not commit when beginning the transaction fails", async () => {
		database._query.mockRejectedValueOnce(new Error("busy"));
		await expect(writer.executeInTransaction(async () => {})).rejects.toThrow("busy");
		expect(database._query).toHaveBeenCalledOnce();
	});

	it("prevents nesting while a transaction is open", () => {
		writer._opened = true;
		expect(() => writer.executeInTransaction(async () => {})).toThrow("already called");
	});

	it("flushes transaction changes only after commit", async () => {
		writer._changeRecords.push({ objectIds: ["one"] });
		await writer.executeInTransaction(async () => {});
		expect(database.accumulateAndTrigger).toHaveBeenCalledWith({ objectIds: ["one"] });
	});

	it("rejects persistModel values outside the Model hierarchy", () => {
		expect(() => writer.persistModel({ id: "one" })).toThrow("instance of the Model class");
	});

	it("persistModel delegates as a one-model batch", async () => {
		const model = item();
		vi.spyOn(writer, "persistModels").mockResolvedValue("saved");
		await expect(writer.persistModel(model, { silent: true })).resolves.toBe("saved");
		expect(writer.persistModels).toHaveBeenCalledWith([model], { silent: true });
	});

	it("resolves an empty persistence batch without querying", async () => {
		await writer.persistModels([]);
		expect(database._query).not.toHaveBeenCalled();
	});

	it("rejects mixed model classes in a persistence batch", () => {
		expect(() => writer.persistModels([item(), new OtherItem({ id: "two" })])).toThrow("same type");
	});

	it("rejects duplicate model ids in a persistence batch", () => {
		expect(() => writer.persistModels([item("same"), item("same")])).toThrow("different ids");
	});

	it("clones models before asynchronous persistence", async () => {
		const model = item();
		vi.spyOn(writer, "_writeModels").mockResolvedValue([]);
		await writer.persistModels([model], { silent: true });
		expect(writer._writeModels.mock.calls[0][0][0]).not.toBe(model);
	});

	it("silent persistence skips mutation hooks and change records", async () => {
		vi.spyOn(writer, "_writeModels").mockResolvedValue([]);
		await writer.persistModels([item()], { silent: true });
		expect(database.mutationHooks).not.toHaveBeenCalled();
		expect(writer._changeRecords).toEqual([]);
	});

	it("passes affectsJoins through to the write path", async () => {
		vi.spyOn(writer, "_writeModels").mockResolvedValue([]);
		await writer.persistModels([item()], { silent: true, affectsJoins: false });
		expect(writer._writeModels).toHaveBeenCalledWith(expect.any(Array), { affectsJoins: false });
	});

	it("runs before and after hooks around persistence", async () => {
		const hook = { beforeDatabaseChange: vi.fn().mockResolvedValue("token"), afterDatabaseChange: vi.fn() };
		database.mutationHooks.mockReturnValue([hook]);
		vi.spyOn(writer, "_writeModels").mockResolvedValue([]);
		await writer.persistModels([item()]);
		expect(hook.beforeDatabaseChange).toHaveBeenCalledOnce();
		expect(hook.afterDatabaseChange).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ type: "persist" }), "token");
	});

	it("records persistence metadata using cloned objects", async () => {
		const model = item("one");
		vi.spyOn(writer, "_writeModels").mockResolvedValue([]);
		await writer.persistModels([model]);
		expect(writer._changeRecords[0]).toMatchObject({ objectClass: "Item", objectIds: ["one"], type: "persist" });
		expect(writer._changeRecords[0].objects[0]).not.toBe(model);
	});

	it("suppresses rejected mutation hooks in spec mode", async () => {
		database.mutationHooks.mockReturnValue([{ beforeDatabaseChange: vi.fn().mockRejectedValue(new Error("hook")) }]);
		await expect(writer._runMutationHooks("beforeDatabaseChange", {})).resolves.toEqual([]);
	});

	it("silent unpersist deletes without recording a change", async () => {
		vi.spyOn(writer, "_deleteModel").mockResolvedValue([]);
		await writer.unpersistModel(item(), { silent: true });
		expect(writer._changeRecords).toEqual([]);
	});

	it("unpersist records cloned model metadata", async () => {
		const model = item();
		vi.spyOn(writer, "_deleteModel").mockResolvedValue([]);
		await writer.unpersistModel(model);
		expect(writer._changeRecords[0]).toMatchObject({ objectClass: "Item", objectIds: ["one"], type: "unpersist" });
		expect(writer._changeRecords[0].objects[0]).not.toBe(model);
	});

	it("removes every row using the class table name", async () => {
		await writer.removeAllOfClass(Item);
		expect(database._query).toHaveBeenCalledWith("DELETE FROM Item");
	});

	it("writes primary rows with queryable columns", async () => {
		await writer._writeModels([item("one"), item("two")], { affectsJoins: false });
		expect(database._query).toHaveBeenCalledWith(
			"REPLACE INTO `Item` (id,data,title) VALUES (?,?,?),(?,?,?)",
			["one", expect.any(String), "Title one", "two", expect.any(String), "Title two"],
		);
	});

	it("splits writes larger than fifty models", async () => {
		const models = Array.from({ length: 51 }, (_, idx) => item(String(idx)));
		await writer._writeModels(models, { affectsJoins: false });
		expect(database._query).toHaveBeenCalledTimes(2);
	});

	it("rebuilds queryable collection joins", async () => {
		const tags = new AttributeCollection({ queryable: true, modelKey: "tags", itemClass: class Tag {}, joinOnField: "id", joinQueryableBy: ["accountId"] });
		Item.attributes = { ...Item.attributes, tags };
		await writer._writeModels([item("one", { accountId: "acct", tags: [{ id: "tag-1" }] })]);
		expect(database._query).toHaveBeenCalledWith("DELETE FROM `ItemTag` WHERE `id` IN ('one')");
		expect(database._query).toHaveBeenCalledWith(
			"INSERT OR IGNORE INTO `ItemTag` (`id`,`value`,`account_id`) VALUES (?,?,?)",
			["one", "tag-1", "acct"],
		);
	});

	it("requires queryable collections to define joinOnField", () => {
		Item.attributes = { ...Item.attributes, tags: new AttributeCollection({ queryable: true, modelKey: "tags", itemClass: class Tag {}, joinQueryableBy: [] }) };
		expect(() => writer._writeModels([item("one", { tags: [{ id: "tag-1" }] })])).toThrow("must specify a joinOnField");
	});

	it("writes defined joined data to its side table", async () => {
		const body = new AttributeJoinedData({ modelKey: "body", modelTable: "ItemBody", serialize: vi.fn((_model, value) => `serialized:${value}`) });
		Item.attributes = { ...Item.attributes, body };
		await writer._writeModels([item("one", { body: "hello" })]);
		expect(database._query).toHaveBeenCalledWith("REPLACE INTO `ItemBody` (`id`, `value`) VALUES (?, ?)", ["one", "serialized:hello"]);
	});

	it("deletes primary, collection, and joined-data rows", async () => {
		Item.attributes = {
			...Item.attributes,
			tags: new AttributeCollection({ queryable: true, itemClass: class Tag {} }),
			body: new AttributeJoinedData({ modelTable: "ItemBody" }),
		};
		await writer._deleteModel(item("one"));
		expect(database._query.mock.calls.map(([sql]) => sql)).toEqual([
			"DELETE FROM `Item` WHERE `id` = ?",
			"DELETE FROM `ItemTag` WHERE `id` = ?",
			"DELETE FROM `ItemBody` WHERE `id` = ?",
		]);
	});
});
