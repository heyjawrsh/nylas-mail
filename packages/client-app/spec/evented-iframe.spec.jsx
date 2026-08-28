import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	defer: vi.fn((fn) => fn()), findDOMNode: vi.fn(), generateTempId: vi.fn(() => "region-1"),
	highlight: vi.fn(), listen: vi.fn(), register: vi.fn(), unregister: vi.fn(),
}));

vi.mock("prop-types", () => ({ default: new Proxy({}, { get: () => (() => null) }) }));
vi.mock("react", () => {
	const react = { Component: class Component {}, createElement: vi.fn() };
	return { default: react, ...react };
});
vi.mock("react-dom", () => ({ default: { findDOMNode: m.findDOMNode }, findDOMNode: m.findDOMNode }));
vi.mock("nylas-exports", () => ({
	Utils: { fastOmit: (object, keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key))), generateTempId: m.generateTempId, isEqualReact: (a, b) => a === b },
	RegExpUtils: {}, IdentityStore: { URLRoot: "https://billing.test/", fetchSingleSignOnURL: vi.fn() }, SearchableComponentMaker: {},
	SearchableComponentStore: { listen: m.listen, registerSearchRegion: m.register, unregisterSearchRegion: m.unregister, getCurrentRegionIndex: vi.fn(() => 0), getCurrentSearchData: vi.fn(() => ({ searchTerm: "mail" })) },
}));
vi.mock("../src/searchable-components/iframe-searcher.js", () => ({ default: { highlightSearchInDocument: m.highlight } }));
vi.mock("node:url", () => ({ default: { parse: (href) => ({ protocol: /^[a-z]+:/i.exec(href)?.[0] }) } }));
vi.mock("underscore", () => {
	const underscore = { values: (o) => Object.values(o || {}), uniq: (a) => [...new Set(a || [])], extend: Object.assign, extendOwn: Object.assign, debounce: (fn) => fn, defer: m.defer, pick: (o, keys) => Object.fromEntries(keys.filter((key) => key in o).map((key) => [key, o[key]])) };
	return { default: underscore, ...underscore };
});

import EventedIFrame from "../src/components/evented-iframe.jsx";

const frameNode = () => {
	const doc = { addEventListener: vi.fn(), removeEventListener: vi.fn(), body: document.createElement("body") };
	const contentWindow = { addEventListener: vi.fn(), removeEventListener: vi.fn(), getSelection: () => ({ empty: vi.fn() }) };
	return { contentDocument: doc, contentWindow, dispatchEvent: vi.fn(), getBoundingClientRect: () => ({ left: 10, top: 20 }) };
};

const frame = (props = {}) => {
	const instance = Object.create(EventedIFrame.prototype);
	instance.props = props;
	instance._nodeRef = { current: m.findDOMNode() };
	instance.state = {};
	instance._onIFrameClick = vi.fn(); instance._onIFrameKeyEvent = vi.fn(); instance._onIFrameMouseEvent = vi.fn(); instance._onIFrameContextualMenu = vi.fn(); instance._onIFrameFocus = vi.fn(); instance._onIFrameBlur = vi.fn(); instance._onIFrameResize = vi.fn();
	return instance;
};

describe("EventedIFrame document bridge lifecycle", () => {
	let node;
	beforeEach(() => { vi.clearAllMocks(); node = frameNode(); m.findDOMNode.mockReturnValue(node); m.listen.mockReturnValue(vi.fn()); });

	it("subscribes to iframe document clicks", () => {
		frame()._subscribeToIFrameEvents();
		expect(node.contentDocument.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
	});

	it("subscribes to all three iframe keyboard events", () => {
		frame()._subscribeToIFrameEvents();
		expect(node.contentDocument.addEventListener.mock.calls.filter(([name]) => ["keydown", "keypress", "keyup"].includes(name))).toHaveLength(3);
	});

	it("subscribes to all three iframe mouse events", () => {
		frame()._subscribeToIFrameEvents();
		expect(node.contentDocument.addEventListener.mock.calls.filter(([name]) => ["mousedown", "mousemove", "mouseup"].includes(name))).toHaveLength(3);
	});

	it("subscribes to iframe contextual menus", () => {
		frame()._subscribeToIFrameEvents();
		expect(node.contentDocument.addEventListener).toHaveBeenCalledWith("contextmenu", expect.any(Function));
	});

	it("subscribes to iframe focus and blur", () => {
		frame()._subscribeToIFrameEvents();
		expect(node.contentWindow.addEventListener.mock.calls.map(([name]) => name)).toEqual(["focus", "blur"]);
	});

	it("only subscribes to resize when an onResize callback exists", () => {
		frame({ onResize: vi.fn() })._subscribeToIFrameEvents();
		expect(node.contentWindow.addEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
	});

	it("removes iframe document listeners", () => {
		frame()._unsubscribeFromIFrameEvents();
		expect(node.contentDocument.removeEventListener).toHaveBeenCalledTimes(8);
	});

	it("removes iframe window listeners", () => {
		frame()._unsubscribeFromIFrameEvents();
		expect(node.contentWindow.removeEventListener.mock.calls.map(([name]) => name)).toEqual(["focus", "blur", "resize"]);
	});

	it("does nothing when the iframe document is unavailable", () => {
		node.contentDocument = null;
		expect(frame()._unsubscribeFromIFrameEvents()).toBeUndefined();
	});

	it("replaces document listeners by unsubscribing before subscribing", () => {
		const instance = frame(); instance._unsubscribeFromIFrameEvents = vi.fn(); instance._subscribeToIFrameEvents = vi.fn();
		instance.didReplaceDocument();
		expect(instance._unsubscribeFromIFrameEvents.mock.invocationCallOrder[0]).toBeLessThan(instance._subscribeToIFrameEvents.mock.invocationCallOrder[0]);
	});





	it("suppresses the resize caused by setHeightQuietly", () => {
		const onResize = vi.fn(); const instance = frame({ onResize }); instance.setHeightQuietly(240); EventedIFrame.prototype._onIFrameResize.call(instance, new Event("resize"));
		expect(onResize).not.toHaveBeenCalled();
	});

	it("forwards later resize events", () => {
		const onResize = vi.fn(); const instance = frame({ onResize }); instance._ignoreNextResize = false; const event = new Event("resize"); EventedIFrame.prototype._onIFrameResize.call(instance, event);
		expect(onResize).toHaveBeenCalledWith(event);
	});
});
