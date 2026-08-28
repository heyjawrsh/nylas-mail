import { describe, expect, it } from "vitest";

import DOMWalkers from "../src/dom-walkers.js";

const element = (html) => {
	const template = document.createElement("template");
	template.innerHTML = html;
	return template.content.firstChild;
};

describe("DOMWalkers.walk", () => {
	it("walks descendants in document order", () => {
		const root = element("<div><span>A</span><b>B</b></div>");
		expect([...DOMWalkers.walk(root, NodeFilter.SHOW_ELEMENT)].map((node) => node.tagName))
			.toEqual(["SPAN", "B"]);
	});

	it("does not yield the TreeWalker root", () => {
		const root = element("<main><section /></main>");
		expect([...DOMWalkers.walk(root, NodeFilter.SHOW_ELEMENT)]).not.toContain(root);
	});

	it("walks text nodes when requested", () => {
		const root = element("<div>Hello <em>there</em></div>");
		expect([...DOMWalkers.walk(root, NodeFilter.SHOW_TEXT)].map((node) => node.data))
			.toEqual(["Hello ", "there"]);
	});

	it("honors a TreeWalker filter", () => {
		const root = element("<div><i>A</i><b>B</b><i>C</i></div>");
		const filter = {
			acceptNode: (node) => node.tagName === "I"
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP,
		};
		expect([...DOMWalkers.walk(root, NodeFilter.SHOW_ELEMENT, filter)].map((node) => node.textContent))
			.toEqual(["A", "C"]);
	});

	it("returns an empty sequence for a leaf root", () => {
		const root = document.createElement("div");
		expect([...DOMWalkers.walk(root, NodeFilter.SHOW_ALL)]).toEqual([]);
	});
});

describe("DOMWalkers.walkBackwards", () => {
	it("walks a tree in reverse depth-first postorder", () => {
		const root = element("<div><span>A<em>B</em></span><b>C</b></div>");
		const labels = [...DOMWalkers.walkBackwards(root)].map((node) =>
			node.nodeType === Node.TEXT_NODE ? node.data : node.tagName,
		);
		expect(labels).toEqual(["C", "B", "B", "EM", "A", "SPAN", "DIV"]);
	});

	it("yields a leaf node itself", () => {
		const leaf = document.createTextNode("only");
		expect([...DOMWalkers.walkBackwards(leaf)]).toEqual([leaf]);
	});

	it("yields siblings from last to first", () => {
		const root = element("<div><i id='first'></i><i id='second'></i></div>");
		expect([...DOMWalkers.walkBackwards(root)].filter((node) => node.id).map((node) => node.id))
			.toEqual(["second", "first"]);
	});

	it("returns an empty sequence for a null node", () => {
		expect([...DOMWalkers.walkBackwards(null)]).toEqual([]);
	});
});
