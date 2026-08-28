import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	commonAncestor: vi.fn(),
	focused: vi.fn(() => ({ id: "thread-1" })),
	listenTo: vi.fn(),
	visible: vi.fn(() => true),
}));

vi.mock("nylas-store", () => ({
	default: class NylasStore {
		listenTo(...args) { return mocks.listenTo(...args); }
		trigger = vi.fn();
	},
}));
vi.mock("underscore", () => {
	const underscore = {
		contains: (items, value) => Array.from(items || []).includes(value),
		debounce: (fn) => fn,
		each: (object, fn) => Object.values(object || {}).forEach(fn),
		extend: Object.assign,
		extendOwn: Object.assign,
		uniq: (items) => [...new Set(items)],
		values: (object) => Object.values(object || {}),
	};
	return { default: underscore, ...underscore };
});
vi.mock("../src/dom-utils.js", () => ({
	default: {
		commonAncestor: mocks.commonAncestor,
		nodeIsLikelyVisible: mocks.visible,
	},
}));
vi.mock("../src/flux/actions.js", () => ({
	default: { findInThread: {}, nextSearchResult: {}, previousSearchResult: {} },
}));
vi.mock("../src/searchable-components/search-constants.js", () => ({
	MAX_MATCHES: 3,
	CHAR_THRESHOLD: 2,
}));
vi.mock("../src/flux/stores/focused-content-store.js", () => ({
	default: { focused: mocks.focused },
}));

import SearchableComponentStore from "../src/flux/stores/searchable-component-store.js";

const rect = (top, left = 0, height = 10) => ({ top, left, height });

const regionWithMatches = (...matches) => {
	const region = document.createElement("div");
	region.querySelectorAll = vi.fn(() => matches);
	return region;
};

const matchNode = ({ top = 0, left = 0, height = 10, regionId, renderIndex } = {}) => {
	const node = document.createElement("search-match");
	node.getBoundingClientRect = vi.fn(() => rect(top, left, height));
	if (regionId) node.setAttribute("data-region-id", regionId);
	if (renderIndex !== undefined) node.setAttribute("data-render-index", renderIndex);
	return node;
};

describe("SearchableComponentStore", () => {
	let store;
	let scrollAncestor;

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.focused.mockReturnValue({ id: "thread-1" });
		mocks.visible.mockReturnValue(true);
		scrollAncestor = document.createElement("div");
		scrollAncestor.className = "scroll-region-content";
		scrollAncestor.scrollTop = 0;
		scrollAncestor.getBoundingClientRect = vi.fn(() => rect(0, 0, 100));
		Object.defineProperty(scrollAncestor, "scrollHeight", { configurable: true, value: 400 });
		mocks.commonAncestor.mockReturnValue(scrollAncestor);
		store = new SearchableComponentStore.constructor();
		vi.clearAllMocks();
	});

	it("starts with search inactive and no selection", () => {
		expect(store.getCurrentSearchData()).toEqual({ searchTerm: null, globalIndex: null, resultsLength: 0 });
	});

	it("registers a search region by id", () => {
		const region = regionWithMatches();
		store.registerSearchRegion("body", region);
		expect(store.searchRegions.body).toBe(region);
	});

	it("unregisters a search region", () => {
		store.searchRegions.body = regionWithMatches();
		store.unregisterSearchRegion("body");
		expect(store.searchRegions).not.toHaveProperty("body");
	});

	it("does not recalculate when the search term is unchanged", () => {
		store.searchTerm = "same";
		const recalculate = vi.spyOn(store, "_recalculateMatches");
		store._findInThread("same");
		expect(recalculate).not.toHaveBeenCalled();
	});

	it("publishes and recalculates when the search term changes", () => {
		store.searchTerm = null; // singleton state from prior tests
		const recalculate = vi.spyOn(store, "_recalculateMatches");
		store._findInThread("new");
		expect(store.trigger.mock.calls.length).toBeGreaterThanOrEqual(1);
		// one recalculation for the term change itself; singleton listeners
		// (searchRegions registered by earlier tests) may add one more
		expect(recalculate.mock.calls.length).toBeGreaterThanOrEqual(1);
	});

	it("clears selection below the character threshold", () => {
		store.currentMatch = { node: matchNode() };
		store.globalIndex = 0;
		store.scrollAncestor = scrollAncestor;
		store._findInThread("x");
		expect(store.getCurrentSearchData()).toEqual({ searchTerm: "x", globalIndex: null, resultsLength: 0 });
		expect(store.scrollAncestor).toBeNull();
	});

	it("collects visible matches from registered regions", () => {
		store.searchTerm = "ok";
		store.searchRegions.body = regionWithMatches(matchNode({ top: 20 }), matchNode({ top: 40 }));
		store._recalculateMatches();
		expect(store.matches).toHaveLength(2);
	});

	it("ignores matches reported as invisible", () => {
		mocks.visible.mockReturnValue(false);
		store.searchTerm = "ok";
		store.searchRegions.body = regionWithMatches(matchNode());
		store._recalculateMatches();
		expect(store.matches).toEqual([]);
	});

	it("sorts matches by vertical position and then horizontal position", () => {
		const lower = matchNode({ top: 20 });
		const right = matchNode({ top: 10, left: 20 });
		const left = matchNode({ top: 10, left: 5 });
		store.searchTerm = "ok";
		store.searchRegions.body = regionWithMatches(lower, right, left);
		store._recalculateMatches();
		expect(store.matches.map((entry) => entry.node)).toEqual([left, right, lower]);
	});

	it("limits collected matches to MAX_MATCHES", () => {
		store.searchTerm = "ok";
		store.searchRegions.body = regionWithMatches(...Array.from({ length: 5 }, (_, top) => matchNode({ top })));
		store._recalculateMatches();
		expect(store.matches).toHaveLength(3);
	});

	it("selects the first result after recalculation", () => {
		const first = matchNode({ top: 5 });
		store.searchTerm = "ok";
		store.searchRegions.body = regionWithMatches(first);
		store._recalculateMatches();
		expect(store.globalIndex).toBe(0);
		expect(store.currentMatch.node).toBe(first);
	});

	it("moves to the next result", () => {
		store.matches = [{ node: matchNode() }, { node: matchNode() }];
		store.globalIndex = 0;
		store._nextSearchResult();
		expect(store.globalIndex).toBe(1);
	});

	it("wraps from the last result to the first", () => {
		store.matches = [{ node: matchNode() }, { node: matchNode() }];
		store.globalIndex = 1;
		store._nextSearchResult();
		expect(store.globalIndex).toBe(0);
	});

	it("wraps backward from the first result to the last", () => {
		store.matches = [{ node: matchNode() }, { node: matchNode() }];
		store.globalIndex = 0;
		store._previousSearchResult();
		expect(store.globalIndex).toBe(1);
	});

	it("does not move when there are no matches", () => {
		store._nextSearchResult();
		expect(store.globalIndex).toBeNull();
		expect(store.trigger).not.toHaveBeenCalled();
	});

	it("reports the render index only for the current region", () => {
		store.currentMatch = { node: matchNode({ regionId: "body", renderIndex: "7" }) };
		expect(store.getCurrentRegionIndex("body")).toBe(7);
		expect(store.getCurrentRegionIndex("subject")).toBeNull();
	});

	it("scrolls when the selected match is outside the viewport", () => {
		store.scrollAncestor = scrollAncestor;
		store.currentMatch = { node: matchNode(), top: 200, height: 20 };
		store._scrollIntoView();
		expect(scrollAncestor.scrollTop).toBe(160);
	});

	it("leaves scrolling unchanged when the selected match is visible", () => {
		store.scrollAncestor = scrollAncestor;
		store.currentMatch = { node: matchNode(), top: 20, height: 20 };
		store._scrollIntoView();
		expect(scrollAncestor.scrollTop).toBe(0);
	});

	it("returns scrollbar percentages and marks the current match", () => {
		const first = { node: matchNode(), top: 40 };
		const second = { node: matchNode(), top: 100 };
		store.matches = [first, second];
		store.currentMatch = second;
		store.scrollAncestor = scrollAncestor;
		expect(store.scrollbarTicks()).toEqual([0.1, { percent: 0.25, className: "match" }]);
	});
});
