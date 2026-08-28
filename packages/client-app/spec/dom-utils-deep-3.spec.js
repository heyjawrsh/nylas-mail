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

describe("DOMUtils selection geometry and predicates", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		document.getSelection().removeAllRanges();
	});

	it("reads the bounding rectangle from an element anchor", () => {
		const node = mount("<p>text</p>").firstChild;
		const rect = { top: 4, left: 8, right: 12, bottom: 16 };
		node.getBoundingClientRect = vi.fn(() => rect);
		expect(DOMUtils.getSelectionRectFromDOM({ anchorNode: node })).toBe(rect);
	});

	it("measures all contents of a text anchor", () => {
		const textNode = mount("words").firstChild;
		const rect = { top: 1, left: 2, right: 3, bottom: 4 };
		const fakeRange = { selectNodeContents: vi.fn(), getBoundingClientRect: vi.fn(() => rect) };
		const createRange = vi.spyOn(document, "createRange").mockReturnValue(fakeRange);
		expect(DOMUtils.getSelectionRectFromDOM({ anchorNode: textNode })).toBe(rect);
		expect(fakeRange.selectNodeContents).toHaveBeenCalledWith(textNode);
		createRange.mockRestore();
	});

	it("returns null for a comment anchor", () => {
		expect(DOMUtils.getSelectionRectFromDOM({ anchorNode: document.createComment("note") })).toBeNull();
	});

	it("uses the document selection when geometry receives no argument", () => {
		const node = mount("<p>text</p>").firstChild;
		const rect = { top: 7 };
		node.getBoundingClientRect = vi.fn(() => rect);
		select(node, 0);
		expect(DOMUtils.getSelectionRectFromDOM()).toBe(rect);
	});

	it("accepts a collapsed text selection after its first character", () => {
		const textNode = mount("abc").firstChild;
		expect(DOMUtils.isSelectionInTextNode(select(textNode, 1))).toBe(true);
	});

	it("rejects a text selection at offset zero", () => {
		const textNode = mount("abc").firstChild;
		expect(DOMUtils.isSelectionInTextNode(select(textNode, 0))).toBe(false);
	});

	it("rejects a non-collapsed text selection", () => {
		const textNode = mount("abc").firstChild;
		expect(DOMUtils.isSelectionInTextNode(select(textNode, 1, textNode, 2))).toBe(false);
	});

	it("rejects a collapsed element selection", () => {
		const node = mount("<p>abc</p>").firstChild;
		expect(DOMUtils.isSelectionInTextNode(select(node, 0))).toBe(false);
	});

	it("rejects a missing selection", () => {
		const getSelection = vi.spyOn(document, "getSelection").mockReturnValue(null);
		expect(DOMUtils.isSelectionInTextNode()).toBe(false);
		getSelection.mockRestore();
	});

	it("recognizes a tab immediately before the cursor", () => {
		const textNode = mount("a\tb").firstChild;
		expect(DOMUtils.isAtTabChar(select(textNode, 2))).toBe(true);
	});

	it("rejects a tab immediately after the cursor", () => {
		const textNode = mount("a\tb").firstChild;
		expect(DOMUtils.isAtTabChar(select(textNode, 1))).toBe(false);
	});

	it("rejects a tab at the end of a non-collapsed selection", () => {
		const textNode = mount("a\tb").firstChild;
		expect(DOMUtils.isAtTabChar(select(textNode, 1, textNode, 2))).toBe(false);
	});
});

describe("DOMUtils end-of-content walking", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		document.getSelection().removeAllRanges();
	});

	it("accepts offset zero when the final node is an empty element", () => {
		const root = mount("<p>before</p><br>");
		expect(DOMUtils.atEndOfContent(select(root.lastChild, 0), root)).toBe(true);
	});

	it("rejects a positive offset on the final element node", () => {
		const root = mount("<p>before</p><span>last</span>");
		expect(DOMUtils.atEndOfContent(select(root.lastChild, 1), root)).toBe(false);
	});

	it("ignores a trailing comment while finding the final child", () => {
		const root = mount("<p>last</p><!-- trailing -->");
		const textNode = root.firstChild.firstChild;
		expect(DOMUtils.atEndOfContent(select(textNode, textNode.length), root)).toBe(true);
	});

	it("treats nonbreaking-space text as content", () => {
		const root = mount("<p>before</p>&nbsp;");
		const textNode = root.lastChild;
		expect(DOMUtils.atEndOfContent(select(textNode, 1), root)).toBe(true);
	});

	it("walks from an explicit container scope to its final text", () => {
		const root = mount("<section><b>last</b></section>");
		const section = root.firstChild;
		const textNode = root.querySelector("b").firstChild;
		expect(DOMUtils.atEndOfContent(select(textNode, 4), root, section)).toBe(true);
	});

	it("does not apply the empty-root shortcut to an empty nested container", () => {
		const root = mount("<section></section>");
		const section = root.firstChild;
		expect(DOMUtils.atEndOfContent(select(section, 0), root, section)).toBe(false);
	});
});

describe("DOMUtils additional wrap and unwrap operations", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	it("returns the inserted wrapper", () => {
		const root = mount("text");
		const range = document.createRange();
		range.selectNodeContents(root);
		expect(DOMUtils.wrap(range, "mark")).toBe(root.firstChild);
	});

	it("creates the requested custom element", () => {
		const root = mount("text");
		const range = document.createRange();
		range.selectNodeContents(root);
		expect(DOMUtils.wrap(range, "aside").nodeName).toBe("ASIDE");
	});

	it("preserves nested markup inside a wrapped range", () => {
		const root = mount("<b>bold</b><i>italic</i>");
		const range = document.createRange();
		range.selectNodeContents(root);
		DOMUtils.wrap(range, "section");
		expect(root.innerHTML).toBe("<section><b>bold</b><i>italic</i></section>");
	});

	it("inserts an empty wrapper for a collapsed range", () => {
		const root = mount("ab");
		const range = document.createRange();
		range.setStart(root.firstChild, 1);
		range.collapse(true);
		DOMUtils.wrap(range, "em");
		expect(root.innerHTML).toBe("a<em></em>b");
	});

	it("unwraps a single text child", () => {
		const root = mount("<span>only</span>");
		const textNode = root.firstChild.firstChild;
		expect(DOMUtils.unwrapNode(root.firstChild)).toEqual([textNode]);
	});

	it("keeps unwrapped element children as the same node objects", () => {
		const root = mount("<span><b>one</b><i>two</i></span>");
		const children = [...root.firstChild.childNodes];
		expect(DOMUtils.unwrapNode(root.firstChild)).toEqual(children);
	});

	it("removes the wrapper element from its parent", () => {
		const root = mount("<span>one</span>");
		const wrapper = root.firstChild;
		DOMUtils.unwrapNode(wrapper);
		expect(root.contains(wrapper)).toBe(false);
	});
});

describe("DOMUtils common ancestors over fixture trees", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	it("accepts an omitted node list", () => {
		expect(DOMUtils.commonAncestor()).toBeNull();
	});

	it("returns a shared text node when it is repeated", () => {
		const textNode = mount("same").firstChild;
		expect(DOMUtils.commonAncestor([textNode, textNode])).toBe(textNode);
	});

	it("returns an ancestor that is also one of the input nodes", () => {
		const root = mount("<section><b>deep</b></section>");
		const section = root.firstChild;
		expect(DOMUtils.commonAncestor([section, section.firstChild.firstChild])).toBe(section);
	});

	it("finds the fixture root across separate branches", () => {
		const root = mount("<section><b>left</b></section><aside><i>right</i></aside>");
		expect(DOMUtils.commonAncestor([root.querySelector("b"), root.querySelector("i")])).toBe(root);
	});

	it("finds body for nodes in separate attached fixtures", () => {
		const left = mount("<p>left</p>");
		const right = mount("<p>right</p>");
		expect(DOMUtils.commonAncestor([left.firstChild, right.firstChild])).toBe(document.body);
	});

	it("returns undefined for nodes in disconnected trees", () => {
		const left = document.createElement("div");
		const right = document.createElement("div");
		expect(DOMUtils.commonAncestor([left, right])).toBeUndefined();
	});

	it("allows the input node through even when its parents fail the filter", () => {
		const section = mount("<section><b>deep</b></section>").firstChild;
		expect(DOMUtils.commonAncestor([section], () => false)).toBe(section);
	});

	it("selects the nearest shared parent admitted by a filter", () => {
		const root = mount("<article><section><b>left</b><i>right</i></section></article>");
		const nodes = [root.querySelector("b").firstChild, root.querySelector("i").firstChild];
		expect(DOMUtils.commonAncestor(nodes, (node) => ["SECTION", "ARTICLE"].includes(node.nodeName))).toBe(root.querySelector("section"));
	});
});
