import { beforeEach, describe, expect, it, vi } from "vitest";

const { databaseListen } = vi.hoisted(() => ({
	databaseListen: vi.fn(() => vi.fn()),
}));

vi.mock("../src/flux/stores/database-store.js", () => ({
	default: { listen: databaseListen },
}));

vi.mock("../src/flux/models/model.js", () => ({
	default: class Model {
		constructor({ id, keep = true } = {}) {
			this.id = id;
			this.keep = keep;
		}

		matches() {
			return this.keep;
		}
	},
}));

import ListDataSource from "../src/components/list-data-source.js";
import ListSelection from "../src/components/list-selection.js";
import ListTabular from "../src/components/list-tabular.jsx";
import Model from "../src/flux/models/model.js";

const item = (id, keep = true) => new Model({ id, keep });

class FixtureDataSource extends ListDataSource {
	constructor(items = []) {
		super();
		this._fixtureItems = items;
		this.retainedRange = null;
	}

	loaded() {
		return true;
	}

	empty() {
		return this._fixtureItems.length === 0;
	}

	get(idx) {
		return this._fixtureItems[idx] || null;
	}

	getById(id) {
		return this._fixtureItems.find((value) => value.id === id) || null;
	}

	indexOfId(id) {
		return this._fixtureItems.findIndex((value) => value.id === id);
	}

	count() {
		return this._fixtureItems.length;
	}

	itemsCurrentlyInViewMatching(matchFn) {
		return this._fixtureItems.filter(matchFn);
	}

	setRetainedRange(range) {
		this.retainedRange = range;
	}
}

describe("ListDataSource", () => {
	beforeEach(() => {
		databaseListen.mockClear();
	});

	it("requires a function listener", () => {
		expect(() => new FixtureDataSource().listen("nope")).toThrow(
			"must pass a function",
		);
	});

	it("delivers triggered values with the requested context", () => {
		const source = new FixtureDataSource();
		const context = { received: null };
		source.listen(function (value) {
			this.received = value;
		}, context);
		source.trigger("changed");
		expect(context.received).toBe("changed");
	});

	it("implements an always-loaded empty source", () => {
		const source = new ListDataSource.Empty();
		expect(source.loaded()).toBe(true);
		expect(source.empty()).toBe(true);
		expect(source.count()).toBe(0);
		expect(source.get(0)).toBeNull();
		expect(source.indexOfId("missing")).toBe(-1);
	});

	it("provides fixture lookup and retained range behavior", () => {
		const one = item("one");
		const source = new FixtureDataSource([one]);
		source.setRetainedRange({ start: 0, end: 1 });
		expect(source.getById("one")).toBe(one);
		expect(
			source.itemsCurrentlyInViewMatching((value) => value.id === "one"),
		).toEqual([one]);
		expect(source.retainedRange).toEqual({ start: 0, end: 1 });
	});
});

describe("ListTabular", () => {
	it("requires a nonzero item height", () => {
		expect(
			() =>
				new ListTabular({
					dataSource: new FixtureDataSource(),
					columns: [],
				}),
		).toThrow("provide an itemHeight");
	});

	it("stores column presentation options", () => {
		const resolver = vi.fn();
		const column = new ListTabular.Column({
			name: "Subject",
			resolver,
			flex: 2,
			width: 180,
		});
		expect(column).toMatchObject({
			name: "Subject",
			resolver,
			flex: 2,
			width: 180,
		});
	});

	it("exposes its selection and data source classes", () => {
		expect(ListTabular.Selection).toBe(ListSelection);
		expect(ListTabular.DataSource).toBe(ListDataSource);
	});

	it("builds initial state from its data source", () => {
		const source = new FixtureDataSource([item("one"), item("two")]);
		const component = new ListTabular({
			dataSource: source,
			columns: [],
			itemHeight: 40,
		});
		expect(component.state).toMatchObject({
			count: 2,
			loaded: true,
			empty: false,
			renderedRangeStart: -1,
			renderedRangeEnd: -1,
		});
	});
});

describe("ListSelection", () => {
	const makeSelection = (values = []) => {
		const view = new FixtureDataSource(values);
		return { view, selection: view.selection };
	};

	it("requires a view", () => {
		expect(() => new ListSelection(null, vi.fn())).toThrow("provide a view");
	});

	it("starts empty", () => {
		const { selection } = makeSelection();
		expect(selection.count()).toBe(0);
		expect(selection.ids()).toEqual([]);
		expect(selection.top()).toBeUndefined();
	});

	it("sets models and returns a cloned item array", () => {
		const one = item("one");
		const { selection } = makeSelection([one]);
		selection.set([one]);
		expect(selection.ids()).toEqual(["one"]);
		expect(selection.items()).not.toBe(selection._items);
	});

	it("rejects non-model values", () => {
		const { selection } = makeSelection();
		expect(() => selection.set([{ id: "plain" }])).toThrow("Models");
		expect(() => selection.toggle({ id: "plain" })).toThrow("Model");
	});

	it("toggles an item in and out", () => {
		const one = item("one");
		const { selection } = makeSelection([one]);
		selection.toggle(one);
		expect(selection.ids()).toEqual(["one"]);
		selection.toggle(one);
		expect(selection.ids()).toEqual([]);
	});

	it("adds distinct models and ignores duplicate ids", () => {
		const one = item("one");
		const { selection } = makeSelection([one]);
		selection.add(one);
		selection.add(item("one"));
		expect(selection.items()).toEqual([one]);
	});

	it("removes one model or a list of models", () => {
		const values = [item("one"), item("two"), item("three")];
		const { selection } = makeSelection(values);
		selection.set(values);
		selection.remove(values[1]);
		expect(selection.ids()).toEqual(["one", "three"]);
		selection.remove([values[0], values[2]]);
		expect(selection.count()).toBe(0);
	});

	it("clears the current selection", () => {
		const one = item("one");
		const { selection } = makeSelection([one]);
		selection.set([one]);
		selection.clear();
		expect(selection.items()).toEqual([]);
	});

	it("removes items that do not match", () => {
		const values = [item("one"), item("two", false)];
		const { selection } = makeSelection(values);
		selection.set(values);
		selection.removeItemsNotMatching({ unread: true });
		expect(selection.ids()).toEqual(["one"]);
	});

	it("expands forward from the most recently selected item", () => {
		const values = [item("one"), item("two"), item("three"), item("four")];
		const { selection } = makeSelection(values);
		selection.set([values[1]]);
		selection.expandTo(values[3]);
		expect(selection.ids()).toEqual(["two", "three", "four"]);
	});

	it("expands backward in traversal order", () => {
		const values = [item("one"), item("two"), item("three")];
		const { selection } = makeSelection(values);
		selection.set([values[2]]);
		selection.expandTo(values[0]);
		expect(selection.ids()).toEqual(["three", "two", "one"]);
	});

	it("does not expand when an endpoint is absent from the view", () => {
		const values = [item("one"), item("two")];
		const { selection } = makeSelection(values);
		selection.set([values[0]]);
		selection.expandTo(item("missing"));
		expect(selection.ids()).toEqual(["one"]);
	});

	it("walks forward and backward through selection history", () => {
		const values = [item("one"), item("two"), item("three")];
		const { selection } = makeSelection(values);
		selection.walk({ current: values[0], next: values[1] });
		expect(selection.ids()).toEqual(["one", "two"]);
		selection.walk({ current: values[1], next: values[2] });
		expect(selection.ids()).toEqual(["one", "two", "three"]);
		selection.walk({ current: values[2], next: values[1] });
		expect(selection.ids()).toEqual(["one", "two"]);
	});

	it("removes unpersisted selected models", () => {
		const values = [item("one"), item("two")];
		const { selection } = makeSelection(values);
		selection.set(values);
		selection._applyChangeRecord({
			objectClass: "Model",
			type: "unpersist",
			objects: [values[0]],
		});
		expect(selection.ids()).toEqual(["two"]);
	});

	it("replaces selected models after persistence", () => {
		const original = item("one");
		const replacement = item("one");
		const { selection } = makeSelection([original]);
		selection.set([original]);
		selection._applyChangeRecord({
			objectClass: "Model",
			type: "persist",
			objects: [replacement],
		});
		expect(selection.items()).toEqual([replacement]);
	});
});
