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

import inlineStyleTransformer from "../src/services/inline-style-transformer.js";
import quoteStringDetector from "../src/services/quote-string-detector.js";
import quotedHTMLTransformer from "../src/services/quoted-html-transformer.js";
import quotedPlainTextTransformer from "../src/services/quoted-plain-text-transformer.js";
import sanitizeTransformer from "../src/services/sanitize-transformer.js";

const parseHTML = (html) => new DOMParser().parseFromString(html, "text/html");

describe("QuotedHTMLTransformer", () => {
	it("detects Gmail quote containers", () => {
		expect(
			quotedHTMLTransformer.hasQuotedHTML(
				'<p>New reply</p><div class="gmail_quote">Old reply</div>',
			),
		).toBe(true);
	});

	it("detects ordinary blockquotes", () => {
		expect(
			quotedHTMLTransformer.hasQuotedHTML("<p>Reply</p><blockquote>Old</blockquote>"),
		).toBe(true);
	});

	it("does not report unmarked prose as quoted", () => {
		expect(quotedHTMLTransformer.hasQuotedHTML("<p>Just a normal message</p>")).toBe(
			false,
		);
	});

	it("removes a trailing Gmail quote", () => {
		const result = quotedHTMLTransformer.removeQuotedHTML(
			'<p>New reply</p><div class="gmail_quote">Old reply</div>',
		);
		expect(result).toContain("New reply");
		expect(result).not.toContain("Old reply");
	});

	it("removes an Outlook forwarded-message section", () => {
		const result = quotedHTMLTransformer.removeQuotedHTML(
			'<p>FYI</p><div id="divRplyFwdMsg">From: Ada<br>Sent: Thursday</div>',
		);
		expect(result).toContain("FYI");
		expect(result).not.toContain("From: Ada");
	});

	it("preserves a body that consists entirely of a quote by default", () => {
		const html = '<blockquote cite="old-message">Only quoted text</blockquote>';
		expect(quotedHTMLTransformer.removeQuotedHTML(html)).toContain(
			"Only quoted text",
		);
	});

	it("annotates and restores hidden quote elements", () => {
		const hidden = quotedHTMLTransformer.hideQuotedHTML(
			'<p>Reply</p><blockquote style="display:block">Old</blockquote>',
		);
		expect(hidden).toContain("nylas-quoted-text-segment");
		expect(hidden).toContain("display: none");
		const restored = quotedHTMLTransformer.restoreAnnotatedHTML(hidden);
		expect(restored).not.toContain("nylas-quoted-text-segment");
		expect(restored).toContain("display: block");
	});
});

describe("QuotedPlainTextTransformer", () => {
	it("extracts visible text above a conventional quote", () => {
		const text = "Sounds good.\n\nOn Thu, Ada wrote:\n> Earlier message";
		expect(quotedPlainTextTransformer.visibleText(text)).toBe("Sounds good.");
	});

	it("returns quoted text through hiddenText", () => {
		const text = "Reply\n\nOn Thu, Ada wrote:\n> First line\n> Second line";
		const hidden = quotedPlainTextTransformer.hiddenText(text);
		expect(hidden).toContain("On Thu, Ada wrote:");
		expect(hidden).toContain("> Second line");
	});

	it("reports whether plain text contains a quote", () => {
		expect(quotedPlainTextTransformer.hasQuotedHTML("Reply\n> quoted")).toBe(true);
		expect(quotedPlainTextTransformer.hasQuotedHTML("Reply only")).toBe(false);
	});

	it("supports multiline wrote headers", () => {
		const text =
			"Fresh reply\n\nOn Thursday, Ada\n<ada@example.com>\nwrote:\n> Old reply";
		expect(quotedPlainTextTransformer.visibleText(text)).toBe("Fresh reply");
	});

	it("hides dash-delimited signatures", () => {
		const text = "Thanks,\nAda\n\n--\nAda Lovelace\nAnalytical Engines";
		expect(quotedPlainTextTransformer.visibleText(text)).toBe("Thanks,\nAda");
	});

	it("can include signatures in visible text", () => {
		const text = "Thanks\n\n--\nAda Lovelace";
		expect(
			quotedPlainTextTransformer.visibleText(text, { showSignature: true }),
		).toContain("Ada Lovelace");
	});

	it("can include quoted fragments in visible text", () => {
		const text = "Reply\n\nOn Thu, Ada wrote:\n> Old reply";
		expect(
			quotedPlainTextTransformer.visibleText(text, { showQuoted: true }),
		).toContain("> Old reply");
	});
});

describe("SanitizeTransformer", () => {
	it("removes script tags and their contents", async () => {
		const result = await sanitizeTransformer.run(
			"<p>Safe</p><script>alert('unsafe')</script>",
		);
		expect(result).toBe("<p>Safe</p>");
	});

	it("transforms headings and divs to paragraphs in strict mode", async () => {
		const result = await sanitizeTransformer.run("<h1>Title</h1><div>Body</div>");
		expect(result).toBe("<p>Title</p><p>Body</p>");
	});

	it("keeps safe anchor attributes and removes event handlers", async () => {
		const result = await sanitizeTransformer.run(
			'<a href="https://example.com" name="top" onclick="steal()">Link</a>',
		);
		expect(result).toContain('href="https://example.com"');
		expect(result).toContain('name="top"');
		expect(result).not.toContain("onclick");
	});

	it("rejects javascript URLs", async () => {
		const result = await sanitizeTransformer.run(
			'<a href="javascript:alert(1)">Bad link</a>',
		);
		expect(result).toBe("<a>Bad link</a>");
	});

	it("limits strict image attributes", async () => {
		const result = await sanitizeTransformer.run(
			'<img src="https://example.com/a.png" alt="diagram" width="500" onerror="x">',
		);
		expect(result).toContain('src="https://example.com/a.png"');
		expect(result).toContain('alt="diagram"');
		expect(result).not.toContain("width");
		expect(result).not.toContain("onerror");
	});

	it("allows table cells in permissive mode", async () => {
		const result = await sanitizeTransformer.run(
			'<table><tr><td colspan="2">Cell</td></tr></table>',
			sanitizeTransformer.Preset.Permissive,
		);
		expect(result).toContain('<td colspan="2">Cell</td>');
	});

	it("preserves the nylas plaintext class in unsafe-only mode", async () => {
		const result = await sanitizeTransformer.run(
			'<pre class="nylas-plaintext other">Plain</pre>',
			sanitizeTransformer.Preset.UnsafeOnly,
		);
		expect(result).toContain('class="nylas-plaintext"');
		expect(result).not.toContain("other");
	});
});

describe("InlineStyleTransformer", () => {
	beforeEach(() => {
		electron.send.mockClear();
	});

	it("passes empty input through without IPC", async () => {
		await expect(inlineStyleTransformer.run("")).resolves.toBe("");
		expect(electron.send).not.toHaveBeenCalled();
	});

	it("passes non-string input through without IPC", async () => {
		await expect(inlineStyleTransformer.run(null)).resolves.toBe(null);
		expect(electron.send).not.toHaveBeenCalled();
	});

	it("passes HTML without a style tag through unchanged", async () => {
		const html = '<p class="notice">Hello</p>';
		await expect(inlineStyleTransformer.run(html)).resolves.toBe(html);
		expect(electron.send).not.toHaveBeenCalled();
	});

	it("sends styled HTML to the inlining worker", () => {
		inlineStyleTransformer.run("<style>p { color: red; }</style><p>Hello</p>");
		expect(electron.send).toHaveBeenCalledOnce();
		const [channel, payload] = electron.send.mock.calls[0];
		expect(channel).toBe("inline-style-parse");
		expect(payload.key).toMatch(/^[a-f0-9]{32}$/);
		expect(payload.html).toContain("p { color: red; }");
	});

	it("resolves a pending transformation from the worker response", async () => {
		const input = "<style>.x { font-weight: bold; }</style><p class=\"x\">Hi</p>";
		const pending = inlineStyleTransformer.run(input);
		const payload = electron.send.mock.calls[0][1];
		electron.handlers.get("inline-styles-result")({}, {
			html: '<p class="x" style="font-weight: bold">Hi</p>',
			key: payload.key,
		});
		await expect(pending).resolves.toContain('style="font-weight: bold"');
	});
});

describe("quoteStringDetector", () => {
	it("finds a single-node Gmail-style wrote header", () => {
		const doc = parseHTML("<p>Reply</p><div>On Thu, Ada wrote:</div>");
		const nodes = quoteStringDetector(doc);
		expect(nodes.some((node) => node.textContent.includes("Ada wrote:"))).toBe(true);
	});

	it("collects a wrote header split across DOM nodes", () => {
		const doc = parseHTML("<p>Reply</p><div>On Thu, <b>Ada</b> wrote:</div>");
		const nodes = quoteStringDetector(doc);
		expect(nodes.map((node) => node.textContent).join(" ")).toContain("On Thu");
		expect(nodes.map((node) => node.textContent).join(" ")).toContain("wrote:");
	});

	it("does not remove unrelated trailing prose", () => {
		const doc = parseHTML("<p>On Thu, Ada wrote:</p><p>My inline response</p>");
		expect(quoteStringDetector(doc)).toEqual([]);
	});

	it("does not match a forwarded From header by itself", () => {
		const doc = parseHTML("<p>Reply</p><div>From: Ada &lt;ada@example.com&gt;</div>");
		expect(quoteStringDetector(doc)).toEqual([]);
	});

	it("returns no nodes for an empty document", () => {
		expect(quoteStringDetector(parseHTML(""))).toEqual([]);
	});
});
