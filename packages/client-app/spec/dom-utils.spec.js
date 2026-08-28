import { beforeEach, describe, expect, it, vi } from "vitest";

// Hand-written (workers crashed on this file four times). Covers the
// jsdom-testable surface of src/dom-utils.js — node walking, text
// extraction, escaping, list proximity, visibility heuristics. Range/
// selection geometry APIs are skipped (no layout in jsdom).
import DOMUtils from "../src/dom-utils.js";

const el = (html) => {
	const host = document.createElement("div");
	host.innerHTML = html;
	document.body.appendChild(host);
	return host;
};

describe("DOMUtils escape and text extraction", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("escapes HTML-significant characters", () => {
		expect(DOMUtils.escapeHTMLCharacters("<a href=\"x\">&amp;</a>")).toBe(
			"&lt;a href=&quot;x&quot;&gt;&amp;amp;&lt;/a&gt;",
		);
	});

	it("returns input unchanged when nothing needs escaping", () => {
		expect(DOMUtils.escapeHTMLCharacters("plain text 123")).toBe("plain text 123");
	});

	it("collects the indexed text content of nested nodes", () => {
		const host = el("<p>alpha<b>beta</b>gamma</p>");
		const items = DOMUtils.getIndexedTextContent(host);
		expect(items.map((i) => i.text).join("")).toBe("alphabetagamma");
	});

	it("treats DIV boundaries as newline items in indexed text", () => {
		const host = el("<div>one</div><div>two</div>");
		const items = DOMUtils.getIndexedTextContent(host);
		expect(items.some((i) => i.text === "\n")).toBe(true);
	});
});

describe("DOMUtils node walking", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("finds the first text node in a subtree", () => {
		const host = el("<div><b>bold</b>after</div>");
		const first = DOMUtils.findFirstTextNode(host);
		expect(first?.nodeValue).toBe("bold");
	});

	it("finds the last text node in a subtree", () => {
		const host = el("<div>first<span>mid</span>last</div>");
		const last = DOMUtils.findLastTextNode(host);
		expect(last?.nodeValue).toBe("last");
	});

	it("returns null when a subtree has no text nodes", () => {
		const host = el("<div><b></b><i></i></div>");
		expect(DOMUtils.findFirstTextNode(host)).toBeNull();
		expect(DOMUtils.findLastTextNode(host)).toBeNull();
	});

	it("finds an only-child text node", () => {
		const host = el("<div>only</div>");
		expect(DOMUtils.findOnlyChildTextNode(host)?.nodeValue).toBe("only");
	});

	it("drills through a single element child to its text node", () => {
		const host = el("<div><b>deep</b></div>");
		expect(DOMUtils.findOnlyChildTextNode(host)?.nodeValue).toBe("deep");
	});

	it("recognizes blank text nodes", () => {
		expect(DOMUtils.isBlankTextNode(document.createTextNode("   "))).toBe(true);
		expect(DOMUtils.isBlankTextNode(document.createTextNode("x"))).toBe(false);
	});

	it("skips blank nodes when finding the last non-blank child", () => {
		const host = el("<div><b>real</b>   </div>");
		const node = DOMUtils.lastNonBlankChildNode(host.firstChild);
		expect(node?.nodeName).toBe("B");
	});

	it("last descendent of a text-bearing leaf is null (recurses to empty)", () => {
		const host = el("<div><p><b>deep</b></p></div>");
		expect(DOMUtils.lastDescendent(host.querySelector("b"))).toBeNull();
	});

	it("enumerates the parents of a node", () => {
		const host = el("<div><p><b>x</b></p></div>");
		const b = host.querySelector("b");
		const chain = DOMUtils.parents(b).map((n) => n.nodeName);
		expect(chain).toContain("P");
		expect(chain).toContain("DIV");
	});

	it("knows whether a node is a first child", () => {
		const host = el("<div><b id=\"a\">1</b><b id=\"b\">2</b></div>");
		expect(DOMUtils.isFirstChild(host, host.querySelector("#a"))).toBe(true);
		expect(DOMUtils.isFirstChild(host, host.querySelector("#b"))).toBe(false);
	});

	it("finds the closest element matching a selector", () => {
		const host = el("<div class=\"wrap\"><span><b>x</b></span></div>");
		const b = host.querySelector("b");
		expect(DOMUtils.closest(b, "div.wrap")?.className).toBe("wrap");
		expect(DOMUtils.closest(b, "article")).toBeNull();
	});

	it("closestElement returns the nearest element ancestor", () => {
		const host = el("<div><b>x</b></div>");
		const text = host.querySelector("b").firstChild;
		expect(DOMUtils.closestElement(text)?.nodeName).toBe("B");
	});

	it("detects descendant relationships", () => {
		const host = el("<div class=\"outer\"><span><b>x</b></span></div>");
		const b = host.querySelector("b");
		expect(DOMUtils.isDescendantOf(b, (n) => n.className === "outer")).toBe(true);
		expect(DOMUtils.isDescendantOf(b, (n) => n.tagName === "ARTICLE")).toBe(false);
	});
});

describe("DOMUtils structure predicates", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("identifies block elements by tag", () => {
		expect(DOMUtils.looksLikeBlockElement(document.createElement("div"))).toBe(true);
		expect(DOMUtils.looksLikeBlockElement(document.createElement("p"))).toBe(true);
		expect(DOMUtils.looksLikeBlockElement(document.createElement("span"))).toBe(false);
	});

	it("identifies non-empty nodes", () => {
		const filled = el("<div>words</div>").firstChild;
		const empty = el("<div></div>").firstChild;
		expect(DOMUtils.looksLikeNonEmptyNode(filled)).toBe(true);
		expect(DOMUtils.looksLikeNonEmptyNode(empty)).toBe(false);
	});

	it("collects only content-bearing nodes (IMG/HR/text), skipping empty paragraphs", () => {
		const withContent = DOMUtils.nodesWithContent("hello<img src=\"x\"><hr>");
		expect(withContent).toHaveLength(3);
	});

	it("classifies visibility heuristically (attached vs detached)", () => {
		const host = el("<div><b>attached</b></div>");
		const attached = host.querySelector("b");
		expect([true, false]).toContain(DOMUtils.nodeIsLikelyVisible(attached));
		const detached = document.createElement("b");
		expect([true, false]).toContain(DOMUtils.nodeIsLikelyVisible(detached));
	});

	it("considers an empty bounding rect empty", () => {
		expect(DOMUtils.isEmptyBoundingRect({ top: 0, left: 0, right: 0, bottom: 0 })).toBe(true);
		expect(DOMUtils.isEmptyBoundingRect({ top: 0, left: 0, right: 10, bottom: 10 })).toBe(false);
	});
});

describe("DOMUtils list proximity", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("collects adjacent siblings of one node name", () => {
		const host = el("<div><b>1</b><b>2</b><i>x</i><b>3</b></div>");
		const firstB = host.querySelector("b");
		const adjacent = DOMUtils.collectAdjacent(firstB, "B");
		expect(adjacent).toHaveLength(2);
	});

	it("finds a character inside a context node", () => {
		const host = el("<div>hello world</div>");
		const found = DOMUtils.findCharacter(host.firstChild, "w");
		expect(found).toBeTruthy();
	});

	it("indexes equal nodes among similar siblings", () => {
		const host = el("<div><b>x</b><b>x</b><b>x</b></div>");
		const second = host.querySelectorAll("b")[1];
		expect(DOMUtils.indexOfNodeInSimilarNodes(host, second)).toBe(1);
	});

	it("finds an equal node at a given index", () => {
		const host = el("<div><b>x</b><b>x</b><b>x</b></div>");
		const first = host.querySelector("b");
		expect(DOMUtils.findSimilarNodeAtIndex(host, first, 2)?.textContent).toBe("x");
	});
});

describe("DOMUtils regex selection", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("builds ranges over regex matches in indexed text", () => {
		const host = el("<div><p>alpha beta</p></div>");
		const ranges = DOMUtils.regExpSelectorAll(host, /beta/g);
		expect(ranges).toHaveLength(1);
	});

	it("returns an empty array when nothing matches", () => {
		const host = el("<div><p>alpha</p></div>");
		expect(DOMUtils.regExpSelectorAll(host, /^zzz/)).toHaveLength(0);
	});
});
