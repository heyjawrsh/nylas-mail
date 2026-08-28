import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	findNodeByRegex: vi.fn(),
	findSimilarNodeAtIndex: vi.fn(),
	getIndexedTextContent: vi.fn(),
	getNodeIndex: vi.fn(() => 0),
	selectionStartsOrEndsIn: vi.fn(() => true),
}));

vi.mock("underscore", () => {
	const underscore = {
		isNumber: (value) => typeof value === "number",
		isRegExp: (value) => value instanceof RegExp,
		isString: (value) => typeof value === "string",
	};
	return { default: underscore, ...underscore };
});
vi.mock("nylas-exports", () => {
	const DOMUtils = {
		findNodeByRegex: m.findNodeByRegex,
		findSimilarNodeAtIndex: m.findSimilarNodeAtIndex,
		getIndexedTextContent: m.getIndexedTextContent,
		getNodeIndex: m.getNodeIndex,
		selectionStartsOrEndsIn: m.selectionStartsOrEndsIn,
	};
	return { default: { DOMUtils }, DOMUtils };
});
vi.mock("../src/components/contenteditable/exported-selection.js", () => {
	class ExportedSelection {
		constructor(rawSelection, scopeNode) {
			this.rawSelection = rawSelection;
			this.scopeNode = scopeNode;
		}
	}
	return { default: ExportedSelection, ExportedSelection };
});

import ExtendedSelection from "../src/components/contenteditable/extended-selection.js";
import ExportedSelection from "../src/components/contenteditable/exported-selection.js";

const setContents = (html = "<p id='first'>Alpha</p><p id='last'>Beta</p>") => {
	document.body.innerHTML = `<main id="scope">${html}</main><aside>Outside</aside>`;
	return document.querySelector("#scope");
};

describe("ExtendedSelection", () => {
	let scope;
	let selection;

	beforeEach(() => {
		vi.clearAllMocks();
		m.selectionStartsOrEndsIn.mockReturnValue(true);
		scope = setContents();
		document.getSelection().removeAllRanges();
		selection = new ExtendedSelection(scope);
	});

	it("defaults its scope to the document body", () => {
		expect(new ExtendedSelection().scopeNode).toBe(document.body);
	});

	it("uses the document selection", () => {
		expect(selection.rawSelection).toBe(document.getSelection());
	});

	it("reports a selection inside its scope", () => {
		selection.selectFromToWithIndex(scope.firstChild.firstChild, 1, scope.lastChild.firstChild, 2);
		expect(selection.isInScope()).toBe(true);
	});

	it("reports an empty selection outside its scope", () => {
		expect(selection.isInScope()).toBe(false);
	});

	it("reports a selection with an outside endpoint outside its scope", () => {
		selection.setBaseAndExtent(scope.firstChild.firstChild, 0, document.querySelector("aside").firstChild, 1);
		expect(selection.isInScope()).toBe(false);
	});

	it("exposes the raw anchor node", () => {
		selection.selectFromToWithIndex(scope.firstChild.firstChild, 1, scope.lastChild.firstChild, 2);
		expect(selection.anchorNode).toBe(scope.firstChild.firstChild);
	});

	it("exposes the raw focus offset", () => {
		selection.selectFromToWithIndex(scope.firstChild.firstChild, 1, scope.lastChild.firstChild, 2);
		expect(selection.focusOffset).toBe(2);
	});

	it("prevents assigning proxy properties", () => {
		expect(() => { selection.anchorOffset = 3; }).toThrow("Can't set anchorOffset");
	});

	it("rejects select without arguments", () => {
		expect(() => selection.select()).toThrow("Invalid arguments");
	});

	it("rejects select with three arguments", () => {
		expect(() => selection.select(1, 2, 3)).toThrow("Invalid arguments");
	});

	it("rejects select with five arguments", () => {
		expect(() => selection.select(1, 2, 3, 4, 5)).toThrow("Invalid arguments");
	});

	it("selects a node found by selector", () => {
		expect(selection.select("#first")).toBe(selection);
		expect(selection.toString()).toBe("Alpha");
	});

	it("selects the contents represented by a range", () => {
		const text = scope.firstChild.firstChild;
		const range = new Range();
		range.setStart(text, 1);
		range.setEnd(text, 4);
		selection.select(range);
		expect(selection.toString()).toBe("lph");
	});

	it("selects between two resolved nodes", () => {
		selection.select(scope.firstChild.firstChild, scope.lastChild.firstChild);
		expect(selection.toString()).toBe("AlphaBeta");
	});

	it("selects between explicit offsets", () => {
		selection.select(scope.firstChild.firstChild, 2, scope.lastChild.firstChild, 2);
		expect(selection.toString()).toBe("phaBe");
	});

	it("rejects nonnumeric explicit offsets", () => {
		expect(() => selection.select(scope.firstChild, "1", scope.lastChild, 2)).toThrow("Invalid arguments");
	});

	it("leaves the selection unchanged when an endpoint cannot be found", () => {
		selection.select("#first");
		selection.selectFromTo("#missing", "#last");
		expect(selection.toString()).toBe("Alpha");
	});

	it("returns DOM nodes unchanged from findNodeAt", () => {
		expect(selection.findNodeAt(scope.firstChild)).toBe(scope.firstChild);
	});

	it("resolves strings within the configured scope", () => {
		expect(selection.findNodeAt("#last")).toBe(scope.lastChild);
	});


	it("returns null for an unsupported node locator", () => {
		expect(selection.findNodeAt({})).toBeNull();
	});


	it("ignores imports that are not exported selections", () => {
		expect(selection.importSelection({})).toBeUndefined();
		expect(m.findSimilarNodeAtIndex).not.toHaveBeenCalled();
	});


	it("takes a stable snapshot of current endpoint values", () => {
		selection.select(scope.firstChild.firstChild, 1, scope.lastChild.firstChild, 2);
		expect(selection.selectionSnapshot()).toEqual({
			anchorNode: scope.firstChild.firstChild, anchorOffset: 1,
			focusNode: scope.lastChild.firstChild, focusOffset: 2, isCollapsed: false,
		});
	});

	it("returns null when the selection does not touch the reference", () => {
		m.selectionStartsOrEndsIn.mockReturnValue(false);
		expect(selection.getSelectionTextIndex(scope)).toBeNull();
	});

	it("returns direct text-node offsets", () => {
		const text = scope.firstChild.firstChild;
		selection.setBaseAndExtent(text, 1, text, 4);
		expect(selection.getSelectionTextIndex(text)).toEqual({ startIndex: 1, endIndex: 4 });
	});

	it("maps descendant endpoints to indexed text positions", () => {
		const first = scope.firstChild.firstChild;
		const last = scope.lastChild.firstChild;
		selection.setBaseAndExtent(first, 2, last, 3);
		m.getIndexedTextContent.mockReturnValue([
			{ node: first, start: 0, end: 5 }, { node: last, start: 5, end: 9 },
		]);
		expect(selection.getSelectionTextIndex(scope)).toEqual({ startIndex: 2, endIndex: 8 });
	});

	it("restores offsets directly on a text node", () => {
		const text = scope.firstChild.firstChild;
		selection.restoreSelectionByTextIndex(text, 1, 4);
		expect(selection.toString()).toBe("lph");
	});

	it("restores indexed positions across descendant text nodes", () => {
		const first = scope.firstChild.firstChild;
		const last = scope.lastChild.firstChild;
		m.getIndexedTextContent.mockReturnValue([
			{ node: first, start: 0, end: 5 }, { node: last, start: 5, end: 9 },
		]);
		selection.restoreSelectionByTextIndex(scope, 2, 7);
		expect(selection.selectionSnapshot()).toMatchObject({ anchorNode: first, anchorOffset: 2, focusNode: last, focusOffset: 2 });
	});

	it("forwards collapse to the raw selection", () => {
		const text = scope.firstChild.firstChild;
		selection.select(text);
		selection.collapse(text, 2);
		expect(selection.selectionSnapshot()).toMatchObject({ anchorNode: text, anchorOffset: 2, isCollapsed: true });
	});

	it("forwards selectAllChildren to the raw selection", () => {
		selection.selectAllChildren(scope.lastChild);
		expect(selection.toString()).toBe("Beta");
	});

	it("forwards containsNode to the raw selection", () => {
		selection.select("#first");
		expect(selection.containsNode(scope.firstChild, true)).toBe(true);
	});

	it("forwards removeAllRanges to the raw selection", () => {
		selection.select("#first");
		selection.removeAllRanges();
		expect(selection.rangeCount).toBe(0);
	});
});
