import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const underscore = {
		intersection: (...arrays) => arrays[0].filter((value) => arrays.slice(1).every((array) => array.includes(value))),
		isString: (value) => typeof value === "string",
		last: (values) => values[values.length - 1],
	};
	const underscoreString = { reverse: (value) => [...value].reverse().join("") };
	return { underscore, underscoreString };
});

vi.mock("underscore", () => ({ default: m.underscore, ...m.underscore }));
vi.mock("underscore.string", () => ({ default: m.underscoreString, ...m.underscoreString }));

globalThis.NylasEnv = {
	isWorkWindow: vi.fn(() => true),
	inSpecMode: vi.fn(() => true),
	inDevMode: vi.fn(() => false),
	reportError: vi.fn(),
	config: { get: vi.fn(() => null), onDidChange: vi.fn(() => ({ dispose: vi.fn() })) },
	getConfigDirPath: vi.fn(() => "/tmp"),
	getPath: vi.fn(() => "/tmp"),
	getVersion: vi.fn(() => "0.0.0"),
};

const { default: DOMUtils } = await import("../src/dom-utils.js");

const mount = (html) => {
	const host = document.createElement("div");
	host.innerHTML = html;
	document.body.appendChild(host);
	return host;
};

const select = (startNode, startOffset, endNode = startNode, endOffset = startOffset) => {
	const range = document.createRange();
	range.setStart(startNode, startOffset);
	range.setEnd(endNode, endOffset);
	const selection = document.getSelection();
	selection.removeAllRanges();
	selection.addRange(range);
	return selection;
};

describe("DOMUtils selection scope checks", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		document.getSelection().removeAllRanges();
	});

	it("rejects a missing selection", () => {
		expect(DOMUtils.selectionInScope(null, document.body)).toBe(false);
	});

	it("rejects a missing scope", () => {
		expect(DOMUtils.selectionInScope(document.getSelection(), null)).toBe(false);
	});

	it("accepts a selection whose endpoints are both in scope", () => {
		const host = mount("<p>alpha <b>beta</b></p>");
		const selection = select(host.querySelector("p").firstChild, 1, host.querySelector("b").firstChild, 2);
		expect(DOMUtils.selectionInScope(selection, host)).toBe(true);
	});

	it("rejects a selection with one endpoint outside scope", () => {
		const host = mount("<p>inside</p><p>outside</p>");
		const selection = select(host.firstChild.firstChild, 0, host.lastChild.firstChild, 2);
		expect(DOMUtils.selectionInScope(selection, host.firstChild)).toBe(false);
	});

	it("returns the current range when it is in scope", () => {
		const host = mount("<p>inside</p>");
		const selection = select(host.firstChild.firstChild, 1);
		expect(DOMUtils.getRangeInScope(host)).toBe(selection.getRangeAt(0));
	});

	it("returns null when the current range is outside scope", () => {
		const host = mount("<p>inside</p><aside>outside</aside>");
		select(host.querySelector("aside").firstChild, 0);
		expect(DOMUtils.getRangeInScope(host.querySelector("p"))).toBeNull();
	});

	it("reports that a collapsed selection starts in its text node", () => {
		const host = mount("<p>inside</p>");
		select(host.firstChild.firstChild, 2);
		expect(DOMUtils.selectionStartsOrEndsIn(host.firstChild.firstChild)).toBe(true);
	});

	it("reports that a selection is fully within a containing range", () => {
		const host = mount("<p>abcdef</p>");
		const text = host.firstChild.firstChild;
		select(text, 2, text, 4);
		const outer = document.createRange();
		outer.setStart(text, 1);
		outer.setEnd(text, 5);
		expect(DOMUtils.selectionIsWithin(outer)).toBe(true);
	});
});

describe("DOMUtils content boundary paths", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		document.getSelection().removeAllRanges();
	});

	it("is at the end of an empty root", () => {
		const root = mount("");
		expect(DOMUtils.atEndOfContent(select(root, 0), root)).toBe(true);
	});

	it("is not at the end for a non-collapsed selection", () => {
		const root = mount("abc");
		expect(DOMUtils.atEndOfContent(select(root.firstChild, 0, root.firstChild, 1), root)).toBe(false);
	});

	it("is not at the end of a root containing only blank text", () => {
		const root = mount("   ");
		expect(DOMUtils.atEndOfContent(select(root.firstChild, 0), root)).toBe(false);
	});

	it("is at the end offset of the last text node", () => {
		const root = mount("<p>final</p>");
		const text = root.firstChild.firstChild;
		expect(DOMUtils.atEndOfContent(select(text, text.length), root)).toBe(true);
	});

	it("is not before the end offset of the last text node", () => {
		const root = mount("<p>final</p>");
		expect(DOMUtils.atEndOfContent(select(root.firstChild.firstChild, 2), root)).toBe(false);
	});

	it("recurses through the final nested element", () => {
		const root = mount("<p>first</p><section><b>last</b></section>  ");
		const text = root.querySelector("b").firstChild;
		expect(DOMUtils.atEndOfContent(select(text, text.length), root)).toBe(true);
	});

	it("rejects a focus node outside the final child", () => {
		const root = mount("<p>first</p><p>last</p>");
		const text = root.firstChild.firstChild;
		expect(DOMUtils.atEndOfContent(select(text, text.length), root)).toBe(false);
	});

	it("recognizes a collapsed cursor anchored directly on a list item", () => {
		const root = mount("<ul><li>item</li></ul>");
		select(root.querySelector("li"), 0);
		expect(DOMUtils.atStartOfList()).toBe(true);
	});

	it("rejects a non-collapsed selection at a list start", () => {
		const root = mount("<ul><li>item</li></ul>");
		const text = root.querySelector("li").firstChild;
		select(text, 0, text, 1);
		expect(DOMUtils.atStartOfList()).toBe(false);
	});

	it("rejects a positive text offset in a list item", () => {
		const root = mount("<ul><li>item</li></ul>");
		select(root.querySelector("li").firstChild, 1);
		expect(DOMUtils.atStartOfList()).toBe(false);
	});

	it("returns undefined when the cursor is not in a list", () => {
		const root = mount("<p>item</p>");
		select(root.firstChild.firstChild, 0);
		expect(DOMUtils.atStartOfList()).toBeUndefined();
	});

	it("recognizes a cursor down the first-child chain of a list item", () => {
		const root = mount("<ul><li><span>item</span></li></ul>");
		select(root.querySelector("span").firstChild, 0);
		expect(DOMUtils.atStartOfList()).toBe(true);
	});

	it("rejects a zero-offset cursor in a later branch of a list item", () => {
		const root = mount("<ul><li><b>before</b><span>item</span></li></ul>");
		select(root.querySelector("span").firstChild, 0);
		expect(DOMUtils.atStartOfList()).toBe(false);
	});
});

describe("DOMUtils wrapping and unwrapping", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	it("wraps a complete text selection in the requested element", () => {
		const root = mount("hello");
		const range = document.createRange();
		range.selectNodeContents(root.firstChild);
		const wrapper = DOMUtils.wrap(range, "strong");
		expect([wrapper.nodeName, root.innerHTML]).toEqual(["STRONG", "<strong>hello</strong>"]);
	});

	it("wraps only the selected portion of a text node", () => {
		const root = mount("hello");
		const range = document.createRange();
		range.setStart(root.firstChild, 1);
		range.setEnd(root.firstChild, 4);
		DOMUtils.wrap(range, "em");
		expect(root.innerHTML).toBe("h<em>ell</em>o");
	});

	it("falls back to extraction for a range crossing element boundaries", () => {
		const root = mount("<b>one</b><i>two</i>");
		const range = document.createRange();
		range.setStart(root.querySelector("b").firstChild, 1);
		range.setEnd(root.querySelector("i").firstChild, 2);
		const wrapper = DOMUtils.wrap(range, "u");
		expect(wrapper.textContent).toBe("netw");
	});

	it("leaves an empty wrapper node unchanged", () => {
		const root = mount("<span></span>");
		const node = root.firstChild;
		expect(DOMUtils.unwrapNode(node)).toBe(node);
	});

	it("leaves a detached non-empty wrapper node unchanged", () => {
		const node = document.createElement("span");
		node.textContent = "orphan";
		expect(DOMUtils.unwrapNode(node)).toBe(node);
	});

	it("replaces a wrapper with its children in order", () => {
		const root = mount("before<span><b>one</b>two<i>three</i></span>after");
		const replaced = DOMUtils.unwrapNode(root.querySelector("span"));
		expect(root.innerHTML).toBe("before<b>one</b>two<i>three</i>after");
		expect(replaced.map((node) => node.textContent)).toEqual(["one", "two", "three"]);
	});
});

describe("DOMUtils common ancestors and character lookup", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	it("returns null when there are no nodes", () => {
		expect(DOMUtils.commonAncestor([])).toBeNull();
	});

	it("finds the nearest common ancestor of sibling descendants", () => {
		const root = mount("<section><b>one</b><i>two</i></section>");
		expect(DOMUtils.commonAncestor([root.querySelector("b").firstChild, root.querySelector("i").firstChild])).toBe(root.firstChild);
	});

	it("returns the node itself for a one-node input", () => {
		const root = mount("<p>one</p>");
		expect(DOMUtils.commonAncestor([root.firstChild])).toBe(root.firstChild);
	});

	it("limits eligible parent nodes with a filter", () => {
		const root = mount("<article><section><b>one</b><i>two</i></section></article>");
		const ancestor = DOMUtils.commonAncestor(
			[root.querySelector("b").firstChild, root.querySelector("i").firstChild],
			(node) => node.nodeName === "ARTICLE",
		);
		expect(ancestor).toBe(root.firstChild);
	});

	it("finds the first occurrence across nested text nodes", () => {
		const root = mount("<span>abc</span><b>zoo</b>");
		expect(DOMUtils.findCharacter(root, "o")).toEqual({ node: root.querySelector("b").firstChild, index: 1 });
	});

	it("prefers an occurrence in the earliest text node", () => {
		const root = mount("<span>xray</span><b>xylophone</b>");
		expect(DOMUtils.findCharacter(root, "x").node).toBe(root.querySelector("span").firstChild);
	});

	it("returns null fields when the character is absent", () => {
		const root = mount("abc");
		expect(DOMUtils.findCharacter(root, "z")).toEqual({ node: null, index: null });
	});

	it("finds an empty search string at index zero", () => {
		const root = mount("abc");
		expect(DOMUtils.findCharacter(root, "")).toEqual({ node: root.firstChild, index: 0 });
	});
});

describe("DOMUtils pure scroll adjustment math", () => {
	it("scrolls down by the amount a rectangle extends below", () => {
		expect(DOMUtils.scrollAdjustmentToMakeRectVisibleInRect(
			{ top: 90, height: 30 }, { top: 10, height: 100 },
		)).toBe(10);
	});

	it("scrolls up by the amount a rectangle extends above", () => {
		expect(DOMUtils.scrollAdjustmentToMakeRectVisibleInRect(
			{ top: 5, height: 20 }, { top: 10, height: 100 },
		)).toBe(-5);
	});

	it("returns zero for a rectangle fully inside its container", () => {
		expect(DOMUtils.scrollAdjustmentToMakeRectVisibleInRect(
			{ top: 20, height: 20 }, { top: 10, height: 100 },
		)).toBe(0);
	});

	it("treats a bottom edge exactly on the boundary as zero adjustment", () => {
		expect(DOMUtils.scrollAdjustmentToMakeRectVisibleInRect(
			{ top: 90, height: 20 }, { top: 10, height: 100 },
		)).toBe(0);
	});

	it("uses node and container rectangles for node adjustment", () => {
		const node = { getBoundingClientRect: vi.fn(() => ({ top: 120, height: 20 })) };
		const container = { getBoundingClientRect: vi.fn(() => ({ top: 20, height: 100 })) };
		expect(DOMUtils.scrollAdjustmentToMakeNodeVisibleInContainer(node, container)).toBe(20);
	});

	it("returns undefined when no node is supplied", () => {
		expect(DOMUtils.scrollAdjustmentToMakeNodeVisibleInContainer(null, {})).toBeUndefined();
	});
});
