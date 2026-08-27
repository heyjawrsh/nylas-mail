import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);

vi.mock("nylas-exports", () => ({
	Utils: {
		escapeRegExp: (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
	},
}));

import UnifiedDOMParser from "../src/searchable-components/unified-dom-parser.js";

class FixtureDOMParser extends UnifiedDOMParser {
	*getWalker(dom) {
		const walker = document.createTreeWalker(dom, NodeFilter.SHOW_ALL);
		let node = walker.currentNode;
		while (node) {
			yield node;
			node = walker.nextNode();
		}
	}

	isTextNode(node) {
		return node.nodeType === Node.TEXT_NODE;
	}

	textNodeLength(node) {
		return node.data.length;
	}

	looksLikeBlockElement(node) {
		return ["DIV", "P", "BR"].includes(node.nodeName);
	}

	textNodeContents(node) {
		return node.data;
	}

	getRawFullString(nodes) {
		return nodes.map((node) => node.data).join("");
	}

	createTextNode({ rawText }) {
		return document.createTextNode(rawText);
	}

	createMatchNode({ regionId, renderIndex, matchText, isCurrentMatch }) {
		const node = document.createElement("search-match");
		node.dataset.regionId = regionId;
		node.dataset.renderIndex = String(renderIndex);
		node.className = isCurrentMatch ? "current-match" : "";
		node.textContent = matchText;
		return node;
	}

	textNodeKey(node) {
		return node;
	}
}

const fixture = (html) => {
	const root = document.createElement("section");
	root.innerHTML = html;
	return root;
};

const texts = (groups) => groups.map((group) => group.map((node) => node.data).join(""));

describe("UnifiedDOMParser normalized DOM text", () => {
	it("extracts text from a DOM fixture", () => {
		const parser = new FixtureDOMParser("body");
		expect(texts(parser.buildNormalizedText(fixture("Hello world")))).toEqual(["Hello world"]);
	});

	it("joins text separated by inline markup", () => {
		const parser = new FixtureDOMParser("body");
		expect(texts(parser.buildNormalizedText(fixture("Hello <strong>wide</strong> world")))).toEqual(["Hello wide world"]);
	});

	it("starts a new token group when entering a block element", () => {
		const parser = new FixtureDOMParser("body");
		// The preorder walker has no closing-element event, so trailing sibling
		// text remains in the group opened by the preceding block.
		expect(texts(parser.buildNormalizedText(fixture("before<p>inside</p>after")))).toEqual(["before", "insideafter"]);
	});

	it("does not emit empty groups for adjacent blocks", () => {
		const parser = new FixtureDOMParser("body");
		expect(texts(parser.buildNormalizedText(fixture("<p></p><div>kept</div>")))).toEqual(["kept"]);
	});

	it("assigns offsets across inline text nodes", () => {
		const parser = new FixtureDOMParser("body");
		const [group] = parser.buildNormalizedText(fixture("one<em>two</em>three"));
		expect(group.map((node) => node.fullStringIndex)).toEqual([0, 3, 6]);
	});

	it("resets offsets after a block boundary", () => {
		const parser = new FixtureDOMParser("body");
		const groups = parser.buildNormalizedText(fixture("one<p>two</p>three"));
		expect(groups.map((group) => group.map((node) => node.fullStringIndex))).toEqual([[0], [0, 3]]);
	});
});

describe("UnifiedDOMParser matching", () => {
	it("rejects terms shorter than the character threshold", () => {
		const parser = new FixtureDOMParser("body");
		expect(parser.matchesSearch(fixture("alphabet"), "a")).toBe(false);
	});

	it("rejects whitespace-only terms", () => {
		const parser = new FixtureDOMParser("body");
		expect(parser.matchesSearch(fixture("alphabet"), "  ")).toBe(false);
	});

	it("finds a case-insensitive literal match", () => {
		const parser = new FixtureDOMParser("body");
		expect(parser.matchesSearch(fixture("Quarterly REPORT"), "report")).toBe(true);
	});

	it("does not match across block boundaries", () => {
		const parser = new FixtureDOMParser("body");
		expect(parser.matchesSearch(fixture("alpha<p>beta</p>"), "alphabeta")).toBe(false);
	});

	it("matches across inline element boundaries", () => {
		const parser = new FixtureDOMParser("body");
		expect(parser.matchesSearch(fixture("al<strong>pha</strong>beta"), "alphabeta")).toBe(true);
	});

	it("escapes punctuation in literal search terms", () => {
		const parser = new FixtureDOMParser("body");
		expect(parser.matchesSearch(fixture("fileXjs"), "file.js")).toBe(false);
	});

	it("supports slash-delimited regular expressions", () => {
		const parser = new FixtureDOMParser("body");
		const nodes = [document.createTextNode("item 12, item 345")];
		expect(parser.matchesFromFullString(nodes, "/item \\d+/")).toEqual([[0, 7], [9, 17]]);
	});

	it("returns no matches for invalid regular expressions", () => {
		const parser = new FixtureDOMParser("body");
		expect(parser.matchesFromFullString([document.createTextNode("text")], "/[bad/")).toEqual([]);
	});

	it("returns every non-overlapping match", () => {
		const parser = new FixtureDOMParser("body");
		expect(parser.matchesFromFullString([document.createTextNode("go GO go")], "go")).toEqual([[0, 2], [3, 5], [6, 8]]);
	});
});

describe("UnifiedDOMParser slicing", () => {
	it("slices a match contained by one text node", () => {
		const parser = new FixtureDOMParser("body");
		const node = document.createTextNode("abcdefghij");
		node.fullStringIndex = 5;
		expect(parser.slicePointsForMatches(node, [[7, 10]])).toEqual([[2, 5]]);
	});

	it("slices an entire node contained by a match", () => {
		const parser = new FixtureDOMParser("body");
		const node = document.createTextNode("middle");
		node.fullStringIndex = 5;
		expect(parser.slicePointsForMatches(node, [[2, 11]])).toEqual([[0, 6]]);
	});

	it("slices the beginning when a match starts in a previous node", () => {
		const parser = new FixtureDOMParser("body");
		const node = document.createTextNode("second");
		node.fullStringIndex = 5;
		expect(parser.slicePointsForMatches(node, [[3, 8]])).toEqual([[0, 3]]);
	});

	it("slices the end when a match continues into a future node", () => {
		const parser = new FixtureDOMParser("body");
		const node = document.createTextNode("first");
		node.fullStringIndex = 0;
		expect(parser.slicePointsForMatches(node, [[2, 8]])).toEqual([[2, 5]]);
	});

	it("ignores matches outside the text node", () => {
		const parser = new FixtureDOMParser("body");
		const node = document.createTextNode("middle");
		node.fullStringIndex = 10;
		expect(parser.slicePointsForMatches(node, [[1, 4], [20, 25]])).toEqual([]);
	});

	it("creates text and match nodes for multiple slices", () => {
		const parser = new FixtureDOMParser("body");
		const node = document.createTextNode("one two one");
		const result = parser.slicedTextElement(node, [[0, 3], [8, 11]], 1);
		expect(result.newTextNodes.map((part) => part.textContent)).toEqual(["one", " two ", "one", ""]);
		expect(result.newTextNodes.filter((part) => part.nodeName === "SEARCH-MATCH")).toHaveLength(2);
	});

	it("marks only the requested rendered match as current", () => {
		const parser = new FixtureDOMParser("message-body");
		const node = document.createTextNode("one two one");
		const result = parser.slicedTextElement(node, [[0, 3], [8, 11]], 1);
		const matches = result.newTextNodes.filter((part) => part.nodeName === "SEARCH-MATCH");
		expect(matches.map((part) => part.className)).toEqual(["", "current-match"]);
		expect(matches.map((part) => part.dataset.regionId)).toEqual(["message-body", "message-body"]);
	});

	it("maps every affected inline text node", () => {
		const parser = new FixtureDOMParser("body");
		const root = fixture("al<strong>pha</strong>bet");
		const result = parser.getElementsWithNewMatchNodes(root, "alphabet", 0);
		expect(result.size).toBe(3);
		expect([...result.values()].map(({ newTextNodes }) => newTextNodes[0].textContent)).toEqual(["al", "pha", "bet"]);
	});

	it("returns an empty map when the fixture has no match", () => {
		const parser = new FixtureDOMParser("body");
		expect(parser.getElementsWithNewMatchNodes(fixture("alpha"), "omega", 0).size).toBe(0);
	});
});
