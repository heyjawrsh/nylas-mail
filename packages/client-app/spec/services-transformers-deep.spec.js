import { beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({
	handlers: new Map(),
	send: vi.fn(),
}));

vi.mock("electron", () => ({
	ipcRenderer: {
		on: vi.fn((channel, handler) => electron.handlers.set(channel, handler)),
		send: electron.send,
	},
}));

// unwrapped-signature-detector imports this model helper at module load time.
vi.mock("../src/flux/models/utils.js", () => ({
	default: {
		escapeRegExp: (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
	},
}));

import inlineStyleTransformer from "../src/services/inline-style-transformer.js";
import quotedHTMLTransformer from "../src/services/quoted-html-transformer.js";
import sanitizeTransformer from "../src/services/sanitize-transformer.js";
import unwrappedSignatureDetector from "../src/services/unwrapped-signature-detector.js";

const parseHTML = (html) => new DOMParser().parseFromString(html, "text/html");

describe("InlineStyleTransformer deeper behavior", () => {
	beforeEach(() => {
		electron.send.mockClear();
	});

	it("registers its worker response listener at singleton construction", () => {
		expect(electron.handlers.get("inline-styles-result")).toBeTypeOf("function");
	});

	it("recognizes mixed-case style tags with attributes", () => {
		inlineStyleTransformer.run('<STYLE media="screen">p { color: red }</STYLE><p>x</p>');
		expect(electron.send).toHaveBeenCalledOnce();
	});

	it("prepends user-agent CSS before the message stylesheet", () => {
		inlineStyleTransformer.run("prefix<style>.message { color: red }</style><p>x</p>");
		const styled = electron.send.mock.calls[0][1].html;
		expect(styled.indexOf("<style>")).toBeLessThan(styled.indexOf(".message"));
		expect(styled.startsWith("prefix<style>")).toBe(true);
	});

	it("unwraps an HTML-comment stylesheet before sending it", () => {
		inlineStyleTransformer.run("<style>\n<!--p { color: red; }-->\n</style><p>x</p>");
		const styled = electron.send.mock.calls[0][1].html;
		expect(styled).toContain("<style>p { color: red; }</style>");
		expect(styled).not.toContain("<!--");
	});

	it("coalesces simultaneous requests for identical HTML", () => {
		const html = "<style>.same { color: blue }</style><p class=\"same\">x</p>";
		const first = inlineStyleTransformer.run(html);
		const second = inlineStyleTransformer.run(html);
		expect(second).toBe(first);
		expect(electron.send).toHaveBeenCalledOnce();
	});

	it("starts a new request after a cached request resolves", async () => {
		const html = "<style>.again { color: green }</style><p>x</p>";
		const first = inlineStyleTransformer.run(html);
		const { key } = electron.send.mock.calls[0][1];
		electron.handlers.get("inline-styles-result")({}, { html: "first", key });
		await expect(first).resolves.toBe("first");
		const second = inlineStyleTransformer.run(html);
		expect(second).not.toBe(first);
		expect(electron.send).toHaveBeenCalledTimes(2);
	});

	it("keeps different styled documents in separate pending requests", () => {
		inlineStyleTransformer.run("<style>p { color: red }</style><p>red</p>");
		inlineStyleTransformer.run("<style>p { color: blue }</style><p>blue</p>");
		const keys = electron.send.mock.calls.map(([, payload]) => payload.key);
		expect(new Set(keys)).toHaveProperty("size", 2);
	});
});

describe("QuotedHTMLTransformer edge cases", () => {
	it("preserves an inline quote when reply text follows it", () => {
		const html = "<p>First answer</p><blockquote>Earlier question</blockquote><p>Second answer</p>";
		expect(quotedHTMLTransformer.removeQuotedHTML(html)).toContain("Earlier question");
	});

	it("removes an inline quote when includeInline is requested", () => {
		const html = "<p>First answer</p><blockquote>Earlier question</blockquote><p>Second answer</p>";
		const result = quotedHTMLTransformer.removeQuotedHTML(html, { includeInline: true });
		expect(result).not.toContain("Earlier question");
		expect(result).toContain("Second answer");
	});

	it("removes multiple adjacent trailing quote containers", () => {
		const result = quotedHTMLTransformer.removeQuotedHTML(
			'<p>Reply</p><div class="gmail_quote">Old one</div><blockquote>Old two</blockquote>',
		);
		expect(result).toBe("<p>Reply</p>");
	});

	it("removes an Office 365 separator and all following siblings", () => {
		const result = quotedHTMLTransformer.removeQuotedHTML(
			'<p>Reply</p><hr><div id="divRplyFwdMsg">Header</div><div>Forwarded body</div>',
		);
		expect(result).toBe("<p>Reply</p>");
	});

	it("returns a Document when asDOM is requested", () => {
		const result = quotedHTMLTransformer.removeQuotedHTML(
			"<p>Reply</p><blockquote>Old</blockquote>",
			{ asDOM: true },
		);
		expect(result).toBeInstanceOf(Document);
		expect(result.body.innerHTML).toBe("<p>Reply</p>");
	});

	it("retains html and body framing when the input supplied it", () => {
		const result = quotedHTMLTransformer.removeQuotedHTML(
			"<html><head><title>Mail</title></head><body><p>Reply</p><blockquote>Old</blockquote></body></html>",
		);
		expect(result).toContain("<head><title>Mail</title></head>");
		expect(result).toContain("<body><p>Reply</p></body>");
	});

	it("appends quote blocks from the original message", () => {
		const result = quotedHTMLTransformer.appendQuotedHTML(
			"<p>Edited reply</p>",
			'<p>Original reply</p><div class="gmail_quote">Original quote</div>',
		);
		expect(result).toBe('<p>Edited reply</p><div class="gmail_quote">Original quote</div>');
	});

	it("removes only redundant trailing break elements", () => {
		const doc = parseHTML("<p>Reply</p><br><br><br>");
		quotedHTMLTransformer.removeTrailingBr(doc);
		expect(doc.body.innerHTML).toBe("<p>Reply</p><br>");
	});
});

describe("SanitizeTransformer unsafe content", () => {
	it("strips style elements and their CSS in strict mode", async () => {
		await expect(
			sanitizeTransformer.run("<style>body { display: none }</style><p>Visible</p>"),
		).resolves.toBe("<p>Visible</p>");
	});

	it("strips script and style contents together in permissive mode", async () => {
		const html = "<script>steal()</script><style>.x{color:red}</style><div>Safe</div>";
		await expect(
			sanitizeTransformer.run(html, sanitizeTransformer.Preset.Permissive),
		).resolves.toBe("<div>Safe</div>");
	});

	it("allows data images only in permissive mode", async () => {
		const html = '<img src="data:image/png;base64,AAAA" alt="pixel">';
		await expect(sanitizeTransformer.run(html)).resolves.toBe('<img alt="pixel" />');
		await expect(
			sanitizeTransformer.run(html, sanitizeTransformer.Preset.Permissive),
		).resolves.toContain('src="data:image/png;base64,AAAA"');
	});

	it("preserves style attributes in permissive mode", async () => {
		const result = await sanitizeTransformer.run(
			'<div style="color:red" onclick="bad()">Text</div>',
			sanitizeTransformer.Preset.Permissive,
		);
		expect(result).toContain('style="color:red"');
		expect(result).not.toContain("onclick");
	});

	it("keeps safe mailto links in unsafe-only mode", async () => {
		const result = await sanitizeTransformer.run(
			'<a href="mailto:ada@example.com">Email Ada</a>',
			sanitizeTransformer.Preset.UnsafeOnly,
		);
		expect(result).toBe('<a href="mailto:ada@example.com">Email Ada</a>');
	});
});

describe("unwrappedSignatureDetector", () => {
	it("returns trailing nodes repeated inside the final quote", () => {
		const doc = parseHTML(
			"<p>Reply</p><blockquote>Old messageAda LovelaceEngineer</blockquote><div>Ada Lovelace</div><div>Engineer</div>",
		);
		const quote = doc.querySelector("blockquote");
		expect(unwrappedSignatureDetector(doc, [quote])).toEqual([
			doc.body.children[2],
			doc.body.children[3],
		]);
	});

	it("does not classify unrelated trailing prose as a signature", () => {
		const doc = parseHTML(
			"<p>Reply</p><blockquote>Old message and old signature</blockquote><p>Inline response</p>",
		);
		expect(unwrappedSignatureDetector(doc, [doc.querySelector("blockquote")])).toEqual([]);
	});

	it("matches repeated signature text containing regexp punctuation literally", () => {
		const doc = parseHTML(
			"<blockquote>Earlier textA. Developer (R&amp;D)</blockquote><div>A. Developer (R&amp;D)</div>",
		);
		expect(unwrappedSignatureDetector(doc, [doc.querySelector("blockquote")])).toEqual([
			doc.querySelector("div"),
		]);
	});
});
