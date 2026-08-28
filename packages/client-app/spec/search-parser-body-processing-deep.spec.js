import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const SearchMatch = function SearchMatch() {};
	const remote = { app: { quit: vi.fn(), relaunch: vi.fn() } };
	const electron = { remote };
	const isValidElement = (value) => !!value && value.$$typeof === "spec.element";
	const React = {
		createElement: (type, props, ...children) => ({
			$$typeof: "spec.element",
			type,
			props: { ...(props || {}), children: children.length === 1 ? children[0] : children },
		}),
		isValidElement,
		cloneElement: (element, props, children) => ({
			...element,
			props: { ...element.props, ...(props || {}), children },
		}),
	};
	const underscore = {
		compact: (values) => values.filter(Boolean),
		defer: (callback) => setTimeout(callback, 0),
		flatten: (values) => values.flat(),
		intersection: (left, right) => left.filter((value) => right.includes(value)),
		isArray: Array.isArray,
		isFunction: (value) => typeof value === "function",
		isString: (value) => typeof value === "string",
		pluck: (values, key) => values.map((value) => value[key]),
		uniq: (values) => [...new Set(values)],
	};
	const walk = vi.fn(function* ({ element, pruneFn }) {
		function* visit(value, parentNode = null, childOffset = 0) {
			const wrapped = typeof value === "string"
				? { element: value, parentNode, childOffset }
				: { element: value, parentNode, childOffset };
			yield wrapped;
			if (typeof value === "string" || !value || pruneFn(value)) return;
			const children = isValidElement(value) ? value.props.children : value;
			for (const [index, child] of (Array.isArray(children) ? children : [children]).entries()) {
				if (child != null) yield* visit(child, value, index);
			}
		}
		yield* visit(element);
	});
	const database = { listen: vi.fn() };
	const messageStore = { extensions: vi.fn(() => []) };
	const sanitize = {
		Preset: { UnsafeOnly: { allowedTags: ["p"] } },
		run: vi.fn(async (body) => `clean:${body}`),
	};
	class Message {}
	class UnifiedDOMParser {
		constructor(regionId) { this.regionId = regionId; this.matchRenderIndex = 0; }
	}
	const removeElements = vi.fn((elements) => {
		for (const element of Array.from(elements || [])) element.remove();
	});
	const domUtils = {
		Mutating: { removeElements },
		nodesWithContent: vi.fn((scope) => Array.from(scope.childNodes).filter((node) => node.textContent.trim())),
	};
	return {
		SearchMatch, React, underscore, walk, database, messageStore, sanitize, Message, UnifiedDOMParser,
		electron, remote,
		domUtils, removeElements, quoteDetector: vi.fn(() => []), signatureDetector: vi.fn(() => []),
	};
});

vi.mock("underscore", () => ({ default: m.underscore, ...m.underscore }));
vi.mock("react", () => ({ default: m.React, ...m.React }));
vi.mock("electron", () => ({ default: m.electron, ...m.electron, remote: m.remote }));
vi.mock("@electron/remote", () => ({ default: m.remote, ...m.remote, remote: m.remote }));
vi.mock("nylas-exports", () => ({
	default: { VirtualDOMUtils: { walk: m.walk } },
	VirtualDOMUtils: { walk: m.walk },
}));
vi.mock("../src/searchable-components/search-match.jsx", () => ({ default: m.SearchMatch }));
vi.mock("../src/searchable-components/unified-dom-parser.js", () => ({ default: m.UnifiedDOMParser }));
vi.mock("../src/flux/models/message.js", () => ({ default: m.Message }));
vi.mock("../src/flux/stores/message-store.js", () => ({ default: m.messageStore }));
vi.mock("../src/flux/stores/database-store.js", () => ({ default: m.database }));
vi.mock("../src/services/sanitize-transformer.js", () => ({ default: m.sanitize }));
vi.mock("../src/dom-utils.js", () => ({ default: m.domUtils }));
vi.mock("../src/services/quote-string-detector.js", () => ({ default: m.quoteDetector }));
vi.mock("../src/services/unwrapped-signature-detector.js", () => ({ default: m.signatureDetector }));

globalThis.NylasEnv = {
	isWorkWindow: vi.fn(() => true),
	inSpecMode: vi.fn(() => true),
	inDevMode: vi.fn(() => false),
	reportError: vi.fn(),
	config: { get: vi.fn(() => null), onDidChange: vi.fn(() => ({ dispose: vi.fn() })) },
	getConfigDirPath: vi.fn(() => "/config"),
	getPath: vi.fn(() => "/tmp"),
	getVersion: vi.fn(() => "0.0.0"),
};

const { default: VirtualDOMParser } = await import("../src/searchable-components/virtual-dom-parser.js");
const { default: messageBodyProcessor } = await import("../src/flux/stores/message-body-processor.js");
const { default: quotedHTMLTransformer } = await import("../src/services/quoted-html-transformer.js");

const el = (type, children, props = {}) => m.React.createElement(type, props, ...(Array.isArray(children) ? children : [children]));
const message = (id, body) => ({ id, body, clone() { return message(this.id, this.body); } });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("VirtualDOMParser React DOM behavior", () => {
	let parser;
	beforeEach(() => { parser = new VirtualDOMParser("region-7"); });

	it("prunes style elements from its walker", () => {
		const style = el("style", "hidden");
		[...parser.getWalker(style)];
		expect(m.walk.mock.calls.at(-1)[0].pruneFn(style)).toBe(true);
	});

	it("recognizes string walker entries as text nodes", () => {
		expect(parser.isTextNode({ element: "hello" })).toBe(true);
	});

	it("reports the exact text-node length", () => {
		expect(parser.textNodeLength({ element: "hello" })).toBe(5);
	});

	it("treats paragraph elements as blocks", () => {
		expect(parser.looksLikeBlockElement({ element: { type: "p" } })).toBe(true);
	});

	it("treats component elements as blocks", () => {
		expect(parser.looksLikeBlockElement({ element: { type() {} } })).toBe(true);
	});

	it("does not treat spans as blocks", () => {
		expect(parser.looksLikeBlockElement({ element: { type: "span" } })).toBe(false);
	});

	it("joins walker text into a raw full string", () => {
		expect(parser.getRawFullString([{ element: "one" }, { element: "two" }])).toBe("onetwo");
	});

	it("merges adjacent string children while normalizing", () => {
		const result = parser.removeMatchesAndNormalize(el("div", ["one", "two"]));
		expect(result.props.children).toEqual(["onetwo"]);
	});

	it("unwraps search-match children while normalizing", () => {
		const match = m.React.createElement(m.SearchMatch, {}, "found");
		const result = parser.removeMatchesAndNormalize(el("div", ["a", match, "b"]));
		expect(result.props.children).toEqual(["a", "found", "b"]);
	});

	it("preserves an element with no children", () => {
		expect(parser.removeMatchesAndNormalize(el("img", [])).props.children).toEqual([]);
	});

	it("creates a current match with region metadata", () => {
		const result = parser.createMatchNode({ matchText: "hit", regionId: "r", isCurrentMatch: true, renderIndex: 4 });
		expect(result.props).toMatchObject({ className: "current-match", regionId: "r", renderIndex: 4, children: "hit" });
	});

	it("replaces a matched string child during highlighting", () => {
		const root = el("div", ["before", "target"]);
		const replacement = ["tar", parser.createMatchNode({ matchText: "get", regionId: "r", renderIndex: 0 })];
		const map = new Map([[root, { originalTextNode: { childOffset: 1 }, newTextNodes: replacement }]]);
		expect(parser.highlightSearch(root, map).props.children[1]).toEqual(replacement);
	});
});

describe("MessageBodyProcessor sanitizing, extensions, and cache", () => {
	beforeEach(() => {
		m.messageStore.extensions.mockClear();
		m.sanitize.run.mockClear();
		NylasEnv.reportError.mockClear();
		m.messageStore.extensions.mockReturnValue([]);
		m.sanitize.run.mockImplementation(async (body) => `clean:${body}`);
		messageBodyProcessor._subscriptions = [];
		messageBodyProcessor.resetCache();
	});

	it("registers for database changes at construction", () => {
		expect(m.database.listen).toHaveBeenCalledOnce();
	});

	it("returns an empty string for a non-string body", async () => {
		await expect(messageBodyProcessor.retrieve(message("nil", null))).resolves.toBe("");
	});

	it("sanitizes a string body before returning it", async () => {
		await expect(messageBodyProcessor.retrieve(message("a", "raw"))).resolves.toBe("clean:raw");
	});

	it("passes unsafe-only settings that reject file URLs", async () => {
		await messageBodyProcessor.retrieve(message("scheme", "raw"));
		expect(m.sanitize.run.mock.calls[0][1].allowedSchemes.indexOf("file")).toBe(false);
	});

	it("returns a cached body without sanitizing twice", async () => {
		const value = message("cached", "raw");
		await messageBodyProcessor.retrieve(value);
		await messageBodyProcessor.retrieve(value);
		expect(m.sanitize.run).toHaveBeenCalledOnce();
	});

	it("runs each body-formatting extension in order", async () => {
		m.messageStore.extensions.mockReturnValue([
			{ formatMessageBody: ({ message: value }) => { value.body += ":one"; } },
			{ formatMessageBody: ({ message: value }) => { value.body += ":two"; } },
		]);
		await expect(messageBodyProcessor.retrieve(message("ext", "raw"))).resolves.toBe("clean:raw:one:two");
	});

	it("skips extensions without a formatter", async () => {
		m.messageStore.extensions.mockReturnValue([{ name: "passive" }]);
		await expect(messageBodyProcessor.retrieve(message("skip", "raw"))).resolves.toBe("clean:raw");
	});

	it("reports an extension error and retains the previous body", async () => {
		const error = new Error("broken extension");
		m.messageStore.extensions.mockReturnValue([{ formatMessageBody() { throw error; } }]);
		await expect(messageBodyProcessor.retrieve(message("error", "raw"))).resolves.toBe("clean:raw");
		expect(NylasEnv.reportError).toHaveBeenCalledWith(error);
	});

	it("invokes a subscriber asynchronously", async () => {
		const callback = vi.fn();
		messageBodyProcessor.subscribe(message("sub", "raw"), callback);
		expect(callback).not.toHaveBeenCalled();
		await tick(); await tick();
		expect(callback).toHaveBeenCalledWith("clean:raw");
	});

	it("does not invoke a subscriber after immediate unsubscribe", async () => {
		const callback = vi.fn();
		messageBodyProcessor.subscribe(message("gone", "raw"), callback)();
		await tick(); await tick();
		expect(callback).not.toHaveBeenCalled();
	});

	it("evicts the oldest entry after the cache exceeds fifty", () => {
		for (let index = 0; index < 52; index++) messageBodyProcessor._addToCache(`k${index}`, `b${index}`);
		expect(messageBodyProcessor._recentlyProcessedD.k0).toBeUndefined();
	});
});

describe("QuotedHTMLTransformer DOM parsing and annotations", () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it("detects Gmail quote containers", () => {
		expect(quotedHTMLTransformer.hasQuotedHTML('<div class="gmail_quote">old</div>')).toBe(true);
	});

	it("detects Office 365 source sections", () => {
		expect(quotedHTMLTransformer.hasQuotedHTML('<div id="OLK_SRC_BODY_SECTION">old</div>')).toBe(true);
	});

	it("annotates and hides quoted HTML", () => {
		const result = quotedHTMLTransformer.hideQuotedHTML("<p>new</p><blockquote style=\"display:block\">old</blockquote>");
		expect(result).toContain('class="nylas-quoted-text-segment"');
		expect(result).toContain('style="display: none;"');
	});


	it("keeps a whole-body quote when requested", () => {
		const result = quotedHTMLTransformer.hideQuotedHTML("<blockquote>only quote</blockquote>", { keepIfWholeBodyIsQuote: true });
		expect(result).not.toContain("nylas-quoted-text-segment");
	});

	it("identifies a plaintext pre body as wholly quoted", () => {
		const doc = new DOMParser().parseFromString("<pre>&gt; old text</pre>", "text/html");
		expect(quotedHTMLTransformer._wholeNylasPlaintextBodyIsQuote(doc)).toBe(true);
	});

	it("returns document markup when the input includes a body tag", () => {
		const doc = new DOMParser().parseFromString("<body><p>x</p></body>", "text/html");
		expect(quotedHTMLTransformer._outputHTMLFor(doc, { initialHTML: "<body><p>x</p></body>" })).toContain("<body><p>x</p></body>");
	});

	it("collects the malformed Office 365 reply id", () => {
		const doc = new DOMParser().parseFromString('<div id=\'3D"divRplyFwdMsg"\'>old</div>', "text/html");
		const weird = doc.getElementById('3D"divRplyFwdMsg"');
		expect(quotedHTMLTransformer._findOffice365Quotes(doc)).toContain(weird);
	});

	it("includes an Office 365 wrapper when an hr precedes the marker", () => {
		const doc = new DOMParser().parseFromString('<section><hr><div id="divRplyFwdMsg">old</div></section>', "text/html");
		expect(quotedHTMLTransformer._findOffice365Quotes(doc)).toContain(doc.querySelector("section"));
	});

	it("recognizes containment including node identity", () => {
		const node = document.createElement("div");
		expect(quotedHTMLTransformer._contains(node, node)).toBe(true);
	});
});
