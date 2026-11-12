import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	defer: vi.fn((callback) => callback()),
	createElement: vi.fn(),
	generateTempId: vi.fn(() => "region-deep"),
	isEqualReact: vi.fn((left, right) => left === right),
	highlight: vi.fn(),
	listen: vi.fn(),
	register: vi.fn(),
	unregister: vi.fn(),
	getRegionIndex: vi.fn(() => 2),
	getSearchData: vi.fn(() => ({ searchTerm: "inbox" })),
	fetchSingleSignOnURL: vi.fn(),
	openLink: vi.fn(),
}));

vi.mock("prop-types", () => {
	const checker = Object.assign(() => null, { isRequired: () => null });
	const types = new Proxy({}, { get: () => checker });
	return { default: types, ...types };
});
vi.mock("react", () => {
	const react = { Component: class Component {}, createElement: m.createElement, createRef: vi.fn(() => ({ current: null })) };
	return { default: react, ...react };
});
vi.mock("react-dom", () => {
	const reactDOM = { findDOMNode: vi.fn() };
	return { default: reactDOM, ...reactDOM };
});
vi.mock("nylas-exports", () => {
	const exports = {
		Utils: {
			fastOmit: (object, keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key))),
			generateTempId: m.generateTempId,
			isEqualReact: m.isEqualReact,
		},
		RegExpUtils: {},
		IdentityStore: { URLRoot: "https://billing.test/", fetchSingleSignOnURL: m.fetchSingleSignOnURL },
		SearchableComponentMaker: {},
		SearchableComponentStore: {
			listen: m.listen,
			registerSearchRegion: m.register,
			unregisterSearchRegion: m.unregister,
			getCurrentRegionIndex: m.getRegionIndex,
			getCurrentSearchData: m.getSearchData,
		},
	};
	return { default: exports, ...exports };
});
vi.mock("../src/searchable-components/iframe-searcher.js", () => {
	const searcher = { highlightSearchInDocument: m.highlight };
	return { default: searcher, ...searcher };
});
vi.mock("node:url", () => {
	const parse = (href) => ({ protocol: /^[a-z][a-z\d+.-]*:/i.exec(href)?.[0] });
	return { default: { parse }, parse };
});
vi.mock("underscore", () => {
	const underscore = {
		defer: m.defer,
		extend: (target, ...sources) => Object.assign(target, ...sources),
		pick: (object, keys) => Object.fromEntries(keys.filter((key) => key in object).map((key) => [key, object[key]])),
	};
	return { default: underscore, ...underscore };
});

import EventedIFrame from "../src/components/evented-iframe.jsx";

globalThis.NylasEnv = { ...globalThis.NylasEnv, windowEventHandler: { openLink: m.openLink } };

function makeNode({ body = document.createElement("body"), withWindow = true } = {}) {
	const contentDocument = { body, addEventListener: vi.fn(), removeEventListener: vi.fn() };
	const contentWindow = withWindow
		? { addEventListener: vi.fn(), removeEventListener: vi.fn(), getSelection: vi.fn(() => ({ empty: vi.fn() })) }
		: null;
	return { contentDocument, contentWindow, dispatchEvent: vi.fn(), height: "" };
}

function makeFrame(props = {}, node = makeNode()) {
	const instance = Object.create(EventedIFrame.prototype);
	instance.props = props;
	instance.state = {};
	instance._nodeRef = { current: node };
	instance._subscribeToIFrameEvents = vi.fn();
	instance._unsubscribeFromIFrameEvents = vi.fn();
	return instance;
}

function clickEvent(target, metaKey = false) {
	return { target, metaKey, stopPropagation: vi.fn(), preventDefault: vi.fn() };
}

describe("EventedIFrame quiet height and document replacement", () => {
	beforeEach(() => vi.clearAllMocks());

	it("writes a pixel height to the iframe", () => {
		const instance = makeFrame();
		expect(instance.setHeightQuietly(315)).toBe("315px");
		expect(instance._nodeRef.current.height).toBe("315px");
	});

	it("marks the next resize for suppression", () => {
		const instance = makeFrame();
		instance.setHeightQuietly(1);
		expect(instance._ignoreNextResize).toBe(true);
	});

	it("clears the quiet marker when the next resize arrives", () => {
		const instance = makeFrame({ onResize: vi.fn() });
		instance._ignoreNextResize = true;
		instance._onIFrameResize(new Event("resize"));
		expect(instance._ignoreNextResize).toBe(false);
	});

	it("does not call onResize for the quiet resize", () => {
		const onResize = vi.fn();
		const instance = makeFrame({ onResize });
		instance.setHeightQuietly(20);
		instance._onIFrameResize(new Event("resize"));
		expect(onResize).not.toHaveBeenCalled();
	});

	it("returns undefined for a normal resize without a callback", () => {
		const instance = makeFrame();
		expect(instance._onIFrameResize(new Event("resize"))).toBeUndefined();
	});

	it("unsubscribes before subscribing after document replacement", () => {
		const instance = makeFrame();
		instance.didReplaceDocument();
		expect(instance._unsubscribeFromIFrameEvents.mock.invocationCallOrder[0]).toBeLessThan(instance._subscribeToIFrameEvents.mock.invocationCallOrder[0]);
	});

	it("returns the replacement subscription result", () => {
		const instance = makeFrame();
		instance._subscribeToIFrameEvents.mockReturnValue("subscribed");
		expect(instance.didReplaceDocument()).toBe("subscribed");
	});
});

describe("EventedIFrame render, URL, and state helpers", () => {
	beforeEach(() => vi.clearAllMocks());

	it("omits component-only props from the rendered iframe", () => {
		const instance = makeFrame({ searchable: true, onResize: vi.fn(), src: "about:blank", title: "message" });
		instance.render();
		const [type, renderedProps] = m.createElement.mock.calls[0];
		expect(type).toBe("iframe");
		expect(renderedProps).toMatchObject({ seamless: "seamless", src: "about:blank", title: "message" });
		expect(renderedProps).not.toHaveProperty("searchable");
		expect(renderedProps).not.toHaveProperty("onResize");
	});

	it("updates when props differ", () => {
		m.isEqualReact.mockImplementation((left, right) => left === right);
		const instance = makeFrame({ src: "one" });
		expect(instance.shouldComponentUpdate({ src: "two" }, instance.state)).toBe(true);
	});

	it("updates when state differs", () => {
		const instance = makeFrame({ src: "one" });
		expect(instance.shouldComponentUpdate(instance.props, { ready: true })).toBe(true);
	});

	it("does not update when props and state compare equal", () => {
		const instance = makeFrame({ src: "one" });
		expect(instance.shouldComponentUpdate(instance.props, instance.state)).toBe(false);
	});

	it("blacklists file URLs case-insensitively", () => {
		expect(makeFrame()._isBlacklistedHref("FiLe:///tmp/private")).toBe(true);
	});

	it("does not blacklist an https URL", () => {
		expect(makeFrame()._isBlacklistedHref("https://example.test")).toBe(false);
	});

	it("prevents navigation for a blacklisted URL", () => {
		const link = document.createElement("a");
		link.setAttribute("href", "file:///tmp/private");
		const event = clickEvent(link);
		makeFrame()._onIFrameClick(event);
		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(m.openLink).not.toHaveBeenCalled();
	});

	it("normalizes a protocol-relative URL to https", () => {
		const link = document.createElement("a");
		link.setAttribute("href", "//example.test/path");
		makeFrame()._onIFrameClick(clickEvent(link));
		expect(m.openLink).toHaveBeenCalledWith({ href: "https://example.test/path", metaKey: false });
	});

	it("normalizes a schemeless URL to http", () => {
		const link = document.createElement("a");
		link.setAttribute("href", "example.test/path");
		makeFrame()._onIFrameClick(clickEvent(link, true));
		expect(m.openLink).toHaveBeenCalledWith({ href: "http://example.test/path", metaKey: true });
	});

	it("leaves a valid URL unchanged", () => {
		const link = document.createElement("a");
		link.setAttribute("href", "https://example.test/path");
		makeFrame()._onIFrameClick(clickEvent(link));
		expect(m.openLink).toHaveBeenCalledWith({ href: "https://example.test/path", metaKey: false });
	});

	it("does not open a URL when no containing link exists", () => {
		makeFrame()._onIFrameClick(clickEvent(document.createElement("span")));
		expect(m.openLink).not.toHaveBeenCalled();
	});

});

describe("EventedIFrame searchable region edge cases", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		m.listen.mockReturnValue(vi.fn());
		m.getRegionIndex.mockReturnValue(2);
		m.getSearchData.mockReturnValue({ searchTerm: "inbox" });
	});

	it("does not register a region when searchable is false", () => {
		makeFrame({ searchable: false }).componentDidMount();
		expect(m.register).not.toHaveBeenCalled();
	});




	it("does not register after an update when searchable is false", () => {
		makeFrame({ searchable: false }).componentDidUpdate();
		expect(m.register).not.toHaveBeenCalled();
	});


	it("does not touch the searchable store on a non-searchable unmount", () => {
		makeFrame({ searchable: false }).componentWillUnmount();
		expect(m.unregister).not.toHaveBeenCalled();
	});

	it("does not search after searchable becomes false", () => {
		makeFrame({ searchable: false })._onSearchableStoreChange();
		expect(m.highlight).not.toHaveBeenCalled();
	});





});
