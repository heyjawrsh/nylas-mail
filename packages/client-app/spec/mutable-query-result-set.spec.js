import { describe, expect, it, vi } from "vitest";

vi.mock("../src/flux/models/query-result-set.js", () => ({
	default: class QueryResultSet {
		constructor(other = {}) {
			this._ids = [...(other._ids || [])];
			this._modelsHash = { ...(other._modelsHash || {}) };
			this._query = other._query ?? null;
			this._offset = other._offset ?? null;
			this._idToIndexHash = null;
		}

		ids() { return this._ids; }
		models() { return this._ids.map((id) => this._modelsHash[id]); }
	}
}));
vi.mock("../src/flux/attributes/attribute-joined-data.js", () => ({
	default: class AttributeJoinedData {
		constructor(modelKey) { this.modelKey = modelKey; }
	}
}));

import AttributeJoinedData from "../src/flux/attributes/attribute-joined-data.js";
import MutableQueryResultSet from "../src/flux/models/mutable-query-result-set.js";

const range = (offset, limit) => ({ offset, limit, isInfinite: () => false });
const model = (id, extras = {}) => ({ id, clientId: `client-${id}`, ...extras });

describe("MutableQueryResultSet", () => {
	it("replaces its contents when initially populated", () => {
		const set = new MutableQueryResultSet();
		set.addIdsInRange(["a", "b"], range(4, 2));
		expect(set.ids()).toEqual(["a", "b"]);
		expect(set._offset).toBe(4);
	});

	it("prepends an adjacent range", () => {
		const set = new MutableQueryResultSet({ _ids: ["c", "d"], _offset: 2 });
		set.addIdsInRange(["a", "b"], range(0, 2));
		expect(set.ids()).toEqual(["a", "b", "c", "d"]);
	});

	it("retains trailing IDs after a complete overlapping page", () => {
		const set = new MutableQueryResultSet({ _ids: ["a", "old", "c", "d"], _offset: 0 });
		set.addIdsInRange(["b", "c"], range(1, 2));
		expect(set.ids()).toEqual(["a", "b", "c", "d"]);
	});

	it("rejects a range with a gap before the current values", () => {
		const set = new MutableQueryResultSet({ _ids: ["c"], _offset: 3 });
		expect(() => set.addIdsInRange(["a"], range(0, 1))).toThrow("only add adjacent values");
	});

	it("rejects a range with a gap after the current values", () => {
		const set = new MutableQueryResultSet({ _ids: ["a"], _offset: 0 });
		expect(() => set.addIdsInRange(["c"], range(2, 1))).toThrow("only add adjacent values");
	});

	it("clips IDs and cached models to a finite range", () => {
		const models = [model("a"), model("b"), model("c")];
		const set = new MutableQueryResultSet({ _ids: models.map((m) => m.id), _offset: 0 });
		models.forEach((m) => set.updateModel(m));
		set.clipToRange(range(1, 1));
		expect(set.ids()).toEqual(["b"]);
		expect(Object.keys(set._modelsHash).sort()).toEqual(["b", "client-b"]);
	});

	it("leaves an infinite range unchanged", () => {
		const set = new MutableQueryResultSet({ _ids: ["a"], _offset: 0 });
		set.clipToRange({ isInfinite: () => true });
		expect(set.ids()).toEqual(["a"]);
	});

	it("indexes an updated model by both IDs", () => {
		const set = new MutableQueryResultSet();
		const item = model("server");
		set.updateModel(item);
		expect(set._modelsHash.server).toBe(item);
		expect(set._modelsHash["client-server"]).toBe(item);
	});

	it("preserves joined data omitted by a replacement model", () => {
		class Item {}
		Item.attributes = { participants: new AttributeJoinedData("participants") };
		const old = Object.assign(new Item(), model("a"), { participants: ["Ada"] });
		const updated = Object.assign(new Item(), model("a"));
		const set = new MutableQueryResultSet({ _ids: ["a"], _offset: 0 });
		set.updateModel(old);
		set.updateModel(updated);
		expect(updated.participants).toEqual(["Ada"]);
	});

	it("removes an optimistic duplicate when the server model arrives", () => {
		const set = new MutableQueryResultSet({ _ids: ["local", "server"], _offset: 0 });
		set.updateModel({ id: "local", clientId: "local", serverId: null, constructor: { attributes: {} } });
		set.updateModel({ id: "server", clientId: "local", serverId: "server", constructor: { attributes: {} } });
		expect(set.ids()).toEqual(["server"]);
	});

	it("removes a model at an absolute offset", () => {
		const item = model("b");
		const set = new MutableQueryResultSet({ _ids: ["a", "b"], _offset: 5 });
		set.updateModel(item);
		set.removeModelAtOffset(item, 6);
		expect(set.ids()).toEqual(["a"]);
		expect(set._modelsHash.b).toBeUndefined();
	});

	it("clones and finalizes a query before storing it", () => {
		const cloned = { finalize: vi.fn() };
		const query = { clone: vi.fn(() => cloned) };
		const set = new MutableQueryResultSet();
		set.setQuery(query);
		expect(set._query).toBe(cloned);
		expect(cloned.finalize).toHaveBeenCalledOnce();
	});

	it("creates a frozen immutable snapshot without sharing containers", () => {
		const set = new MutableQueryResultSet({ _ids: ["a"], _modelsHash: { a: model("a") }, _offset: 0 });
		const snapshot = set.immutableClone();
		expect(Object.isFrozen(snapshot._ids)).toBe(true);
		expect(Object.isFrozen(snapshot._modelsHash)).toBe(true);
		expect(snapshot._ids).not.toBe(set._ids);
	});
});
