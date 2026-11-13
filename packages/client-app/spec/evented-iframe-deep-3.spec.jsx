import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	defer: vi.fn((callback) => callback()),
	createElement: vi.fn((type, props, ...children) => ({ type, props, children })),
	openLink: vi.fn(),
}));

vi.mock("prop-types", () => {
	const checker = Object.assign(() => null, { isRequired: () => null });
	const types = new Proxy({}, { get: () => checker });
	return { default: types, ...types };
});
vi.mock("react", () => {
	class Component {}
	const react = {
		Component,
		createElement: m.createElement,
		createRef: vi.fn(() => ({ current: null })),
	};
	return { default: react, ...react };
});
vi.mock("nylas-exports", () => {
	const exports = {
		Utils: {
			fastOmit: (object, keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key))),
			generateTempId: vi.fn(() => "region-three"),
			isEqualReact: (left, right) => left === right,
		},
		RegExpUtils: {},
		IdentityStore: { URLRoot: "https://billing.test/", fetchSingleSignOnURL: vi.fn() },
		SearchableComponentMaker: {},
		SearchableComponentStore: {
			listen: vi.fn(), registerSearchRegion: vi.fn(), unregisterSearchRegion: vi.fn(),
			getCurrentRegionIndex: vi.fn(() => 0), getCurrentSearchData: vi.fn(() => ({ searchTerm: "" })),
		},
	};
	return { default: exports, ...exports };
});
vi.mock("../src/searchable-components/iframe-searcher.js", () => {
	const searcher = { highlightSearchInDocument: vi.fn() };
	return { default: searcher, ...searcher };
});
vi.mock("node:url", () => {
	const url = { parse: (href) => ({ protocol: /^[a-z][a-z\d+.-]*:/i.exec(href)?.[0] }) };
	return { default: url, ...url };
});
vi.mock("underscore", () => {
	const underscore = {
		defer: m.defer,
		extend: (target, ...sources) => Object.assign(target, ...sources),
		pick: (object, keys) => Object.fromEntries(keys.filter((key) => key in object).map((key) => [key, object[key]])),
	};
	return { default: underscore, ...underscore };
});
vi.mock("electron", () => {
	const electron = { remote: {}, clipboard: {}, shell: {}, nativeImage: {} };
	return { default: electron, ...electron };
});
vi.mock("@electron/remote", () => {
	const remote = { app: {}, getCurrentWindow: vi.fn() };
	return { default: remote, remote, ...remote };
});

globalThis.NylasEnv = {
	isWorkWindow: vi.fn(() => true),
	inSpecMode: vi.fn(() => true),
	inDevMode: vi.fn(() => false),
	reportError: vi.fn(),
	config: { get: vi.fn(() => null), onDidChange: vi.fn(() => ({ dispose: vi.fn() })) },
	getConfigDirPath: vi.fn(() => "/tmp"),
	getPath: vi.fn(() => "/tmp"),
	getVersion: vi.fn(() => "0.0.0"),
	windowEventHandler: { openLink: m.openLink },
};

const { default: EventedIFrame } = await import("../src/components/evented-iframe.jsx");

function makeNode() {
	const iframe = document.createElement("iframe");
	document.body.appendChild(iframe);
	return iframe;
}

function makeFrame(props = {}, node = makeNode()) {
	const instance = Object.create(EventedIFrame.prototype);
	instance.props = props;
	instance.state = {};
	instance._nodeRef = { current: node };
	return instance;
}

function writeStaticDOM(node, markup) {
	const doc = node.contentDocument;
	doc.open();
	doc.write(markup);
	doc.close();
	return doc;
}

describe("EventedIFrame replacement document wiring", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.replaceChildren();
	});

	it("removes click handling before replacing subscriptions", () => {
		const instance = makeFrame();
		const remove = vi.spyOn(instance._nodeRef.current.contentDocument, "removeEventListener");
		instance.didReplaceDocument();
		expect(remove).toHaveBeenCalledWith("click", instance._onIFrameClick);
	});

	it("adds click handling after a document replacement", () => {
		const instance = makeFrame();
		const add = vi.spyOn(instance._nodeRef.current.contentDocument, "addEventListener");
		instance.didReplaceDocument();
		expect(add).toHaveBeenCalledWith("click", instance._onIFrameClick);
	});

	it("rebinds every keyboard event after replacement", () => {
		const instance = makeFrame();
		const add = vi.spyOn(instance._nodeRef.current.contentDocument, "addEventListener");
		instance.didReplaceDocument();
		expect(add.mock.calls.filter(([name]) => ["keydown", "keypress", "keyup"].includes(name))).toHaveLength(3);
	});

	it("rebinds every mouse event after replacement", () => {
		const instance = makeFrame();
		const add = vi.spyOn(instance._nodeRef.current.contentDocument, "addEventListener");
		instance.didReplaceDocument();
		expect(add.mock.calls.filter(([name]) => ["mousedown", "mousemove", "mouseup"].includes(name))).toHaveLength(3);
	});

	it("rebinds the contextual-menu event after replacement", () => {
		const instance = makeFrame();
		const add = vi.spyOn(instance._nodeRef.current.contentDocument, "addEventListener");
		instance.didReplaceDocument();
		expect(add).toHaveBeenCalledWith("contextmenu", instance._onIFrameContextualMenu);
	});

	it("rebinds resize when the frame has an onResize prop", () => {
		const instance = makeFrame({ onResize: vi.fn() });
		const add = vi.spyOn(instance._nodeRef.current.contentWindow, "addEventListener");
		instance.didReplaceDocument();
		expect(add).toHaveBeenCalledWith("resize", instance._onIFrameResize);
	});

	it("does not rebind resize without an onResize prop", () => {
		const instance = makeFrame();
		const add = vi.spyOn(instance._nodeRef.current.contentWindow, "addEventListener");
		instance.didReplaceDocument();
		expect(add).not.toHaveBeenCalledWith("resize", instance._onIFrameResize);
	});
});

describe("EventedIFrame quiet height variants", () => {
	beforeEach(() => document.body.replaceChildren());

	it("accepts a zero height", () => {
		const instance = makeFrame();
		instance.setHeightQuietly(0);
		expect(instance._nodeRef.current.height).toBe("0px");
	});

	it("accepts a fractional height", () => {
		const instance = makeFrame();
		instance.setHeightQuietly(12.5);
		expect(instance._nodeRef.current.height).toBe("12.5px");
	});

	it("preserves a negative numeric height in the assigned value", () => {
		const node = { height: "" };
		makeFrame({}, node).setHeightQuietly(-4);
		expect(node.height).toBe("-4px");
	});

	it("stringifies a numeric string as pixels", () => {
		const node = { height: "" };
		makeFrame({}, node).setHeightQuietly("48");
		expect(node.height).toBe("48px");
	});

	it("suppresses only the first resize after a quiet height change", () => {
		const onResize = vi.fn();
		const instance = makeFrame({ onResize });
		instance.setHeightQuietly(80);
		instance._onIFrameResize(new Event("resize"));
		instance._onIFrameResize(new Event("resize"));
		expect(onResize).toHaveBeenCalledOnce();
	});
});

describe("EventedIFrame static DOM and focus boundaries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.replaceChildren();
	});

	it("retains static markup written into the iframe document", () => {
		const node = makeNode();
		const doc = writeStaticDOM(node, "<!doctype html><html><body><p id='message'>Hello</p></body></html>");
		expect(doc.querySelector("#message")?.textContent).toBe("Hello");
	});


	it("clears the iframe selection when its window blurs", () => {
		const instance = makeFrame();
		const empty = vi.fn();
		vi.spyOn(instance._nodeRef.current.contentWindow, "getSelection").mockReturnValue({ empty });
		instance._onIFrameBlur(new Event("blur"));
		expect(empty).toHaveBeenCalledOnce();
	});

	it("clears the parent selection when the iframe window focuses", () => {
		const instance = makeFrame();
		const empty = vi.fn();
		vi.spyOn(window, "getSelection").mockReturnValue({ empty });
		instance._onIFrameFocus(new Event("focus"));
		expect(empty).toHaveBeenCalledOnce();
	});

	it("passes an onBlur callback through to the rendered iframe", () => {
		const onBlur = vi.fn();
		makeFrame({ onBlur }).render();
		expect(m.createElement.mock.calls.at(-1)[1].onBlur).toBe(onBlur);
	});

	it("passes an onFocus callback through to the rendered iframe", () => {
		const onFocus = vi.fn();
		makeFrame({ onFocus }).render();
		expect(m.createElement.mock.calls.at(-1)[1].onFocus).toBe(onFocus);
	});
});
