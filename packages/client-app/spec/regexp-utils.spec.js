import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	difference: vi.fn((values, excluded) => values.filter((value) => !excluded.includes(value))),
	emojiChars: vi.fn(() => ["😀", "❤️"]),
}));

vi.mock("underscore", () => ({
	default: { difference: mocks.difference },
	difference: mocks.difference,
}));
vi.mock("emoji-data", () => ({
	default: { chars: mocks.emojiChars },
	chars: mocks.emojiChars,
}));

import * as RegExpUtilsModule from "../src/regexp-utils.js";

// The source is CommonJS; Vitest exposes module.exports through this interop slot.
const RegExpUtils = RegExpUtilsModule.default;

describe("RegExpUtils", () => {
	it("matches ASCII and international email addresses", () => {
		expect("to ada@example.com and 用户@例子.com".match(RegExpUtils.emailRegex())).toEqual([
			"ada@example.com", "用户@例子.com",
		]);
	});

	it("returns a fresh stateful email regex each time", () => {
		const first = RegExpUtils.emailRegex();
		first.exec("a@example.com");
		expect(first.lastIndex).toBeGreaterThan(0);
		expect(RegExpUtils.emailRegex().lastIndex).toBe(0);
	});

	it("matches formatted phone numbers and extensions", () => {
		expect("Call +1 (415) 555-1212 x42".match(RegExpUtils.phoneRegex())).toEqual([
			"+1 (415) 555-1212 x42",
		]);
	});

	it("does not match an unformatted eleven-digit number", () => {
		expect(RegExpUtils.phoneRegex().test("12223334444")).toBe(false);
	});

	it("matches a bare domain only at the start", () => {
		// NOTE: the TLD quantifier is lazy ({2,11}?) so the match stops at
		// the shortest suffix — documented actual behavior, flagged for
		// regex review.
		expect(RegExpUtils.domainRegex().exec("docs.example.com/path")?.[0]).toBe("docs.example.co");
		expect(RegExpUtils.domainRegex().test("visit example.com")).toBe(false);
	});

	it("captures hashtags and mentions preceded by whitespace", () => {
		expect(RegExpUtils.hashtagOrMentionRegex().exec("hello @team_name")?.slice(1)).toEqual(["@", "team_name"]);
		expect(RegExpUtils.hashtagOrMentionRegex().test("#leading")).toBe(false);
	});

	it("recognizes dotted IPv4-shaped strings", () => {
		expect(RegExpUtils.ipAddressRegex().test("192.168.1.20")).toBe(true);
		// Actual behavior checks shape, not octet range.
		expect(RegExpUtils.ipAddressRegex().test("999.999.999.999")).toBe(true);
	});

	it("matches a Nylas command case-insensitively", () => {
		expect(RegExpUtils.nylasCommandRegex().exec("run NYLAS:compose now")?.[0]).toBe("NYLAS:compose");
	});

	it("matches common-TLD bare URLs", () => {
		expect(RegExpUtils.urlRegex().exec("See nylas.com/docs today")?.[0]).toBe("nylas.com/docs");
	});

	it("requires a scheme for uncommon URL TLDs", () => {
		expect(RegExpUtils.urlRegex().test("nylas.ai")).toBe(false);
		expect(RegExpUtils.urlRegex().test("https://nylas.ai")).toBe(true);
	});

	it("anchors URLs when matchEntireString is requested", () => {
		expect(RegExpUtils.urlRegex({ matchEntireString: true }).test("https://example.com/path")).toBe(true);
		expect(RegExpUtils.urlRegex({ matchEntireString: true }).test("See https://example.com")).toBe(false);
	});

	it("captures link tag components and multiline contents", () => {
		const match = RegExpUtils.linkTagRegex().exec('<a class="x" href="/go">one\ntwo</a>');
		expect(match?.slice(2, 6)).toEqual(["/go", '\">', "one\ntwo", "</a>"]);
	});

	it("matches URL links but excludes mailto links", () => {
		expect(RegExpUtils.urlLinkTagRegex().test('<a href="https://example.com">site</a>')).toBe(true);
		expect(RegExpUtils.urlLinkTagRegex().test('<a href="mailto:a@example.com">mail</a>')).toBe(false);
	});

	it("captures double-quoted image sources", () => {
		expect(RegExpUtils.imageTagRegex().exec('<img alt="x" src="photo.png">')?.[1]).toBe("photo.png");
		expect(RegExpUtils.imageTagRegex().test("<img src='photo.png'>")).toBe(false);
	});

	it("captures the redirect parameter from tracked links", () => {
		const input = '"https://link.nylas.com/link/id?foo=1&redirect=https%3A%2F%2Fexample.com&bar=2"';
		expect(RegExpUtils.trackedLinkRegex().exec(input)?.[1]).toBe("https%3A%2F%2Fexample.com");
	});

	it("matches punctuation and honors exclusions", () => {
		expect("a,b.c".match(RegExpUtils.punctuation())).toEqual([",", "."]);
		expect("a,b.c".match(RegExpUtils.punctuation({ exclude: [","] }))).toEqual(["."]);
	});

	it("recognizes valid URI schemes", () => {
		expect(RegExpUtils.hasValidSchemeRegex().test("git+ssh://host/repo")).toBe(true);
		expect(RegExpUtils.hasValidSchemeRegex().test("//host/path")).toBe(false);
	});


	it("matches loose style tag starts case-insensitively", () => {
		expect("<STYLE>.x{}</STYLE>".match(RegExpUtils.looseStyleTag())).toEqual(["<STYLE"]);
	});

	it("captures traditional and arrow function arguments", () => {
		expect(RegExpUtils.functionArgs().exec("function (first, second)")?.[1]).toBe("first, second");
		expect(RegExpUtils.functionArgs().exec("value => value")?.[2]).toBe("value");
	});

	it("matches characters illegal in Windows paths", () => {
		expect('bad:file?.txt'.match(RegExpUtils.illegalPathCharactersRegexp())).toEqual([":", "?"]);
	});

	it("matches a signature region including newlines", () => {
		expect(RegExpUtils.signatureRegex().test("<br/><signature>Thanks\nAda</signature>")).toBe(true);
	});

	it("finds the start of an N1 quote region", () => {
		expect(RegExpUtils.n1QuoteStartRegex().exec('<div class="gmail_quote">quoted')?.[0])
			.toBe('<div class="gmail_quote');
	});

	it("splits hierarchical subcategories on every supported separator", () => {
		expect("parent.child/leaf\\twig".split(RegExpUtils.subcategorySplitRegex()))
			.toEqual(["parent", "child", "leaf", "twig"]);
	});
});
