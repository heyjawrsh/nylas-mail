import { describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

import SearchQueryParser from "../src/services/search/search-query-parser.js";
import LSQB from "../src/services/search/search-query-backend-local.js";
const LocalSearchQueryBackend = LSQB.default || LSQB;
import IMAPSearchQueryBackend from "../src/services/search/search-query-backend-imap.js";
import RealDOMParser from "../src/searchable-components/real-dom-parser.js";
import {
	AndQueryExpression,
	FromQueryExpression,
	GenericQueryExpression,
	OrQueryExpression,
	SearchQueryToken,
	StarredStatusQueryExpression,
	TextQueryExpression,
	UnreadStatusQueryExpression,
} from "../src/services/search/search-query-ast.js";

const parse = (query) => SearchQueryParser.parse(query);

describe("SearchQueryParser", () => {
	it("parses an unqualified term", () => {
		const ast = parse("quarterly");
		expect(ast).toBeInstanceOf(GenericQueryExpression);
		expect(ast.text.token.s).toBe("quarterly");
	});

	it("keeps spaces inside quoted terms", () => {
		const ast = parse('"quarterly report"');
		expect(ast.text.token.s).toBe("quarterly report");
	});

	it("parses a from qualifier case-insensitively", () => {
		const ast = parse("FROM:alice@example.com");
		expect(ast).toBeInstanceOf(FromQueryExpression);
		expect(ast.text.token.s).toBe("alice@example.com");
	});

	it("parses subject text containing spaces", () => {
		const ast = parse('subject:"Launch Plan"');
		expect(ast.constructor.name).toBe("SubjectQueryExpression");
		expect(ast.text.token.s).toBe("Launch Plan");
	});

	it("parses unread status", () => {
		const ast = parse("is:unread");
		expect(ast).toBeInstanceOf(UnreadStatusQueryExpression);
		expect(ast.status).toBe(true);
	});

	it("parses unstarred status", () => {
		const ast = parse("is:unstarred");
		expect(ast).toBeInstanceOf(StarredStatusQueryExpression);
		expect(ast.status).toBe(false);
	});

	it("gives OR precedence inside an explicit AND", () => {
		const ast = parse("from:alice or to:bob and is:unread");
		expect(ast).toBeInstanceOf(AndQueryExpression);
		expect(ast.e1).toBeInstanceOf(OrQueryExpression);
		expect(ast.e2).toBeInstanceOf(UnreadStatusQueryExpression);
	});

	it("combines adjacent terms with an implicit AND", () => {
		const ast = parse("alpha beta");
		expect(ast).toBeInstanceOf(AndQueryExpression);
		expect(ast.e1.text.token.s).toBe("alpha");
		expect(ast.e2.text.token.s).toBe("beta");
	});

	it("honors parenthesized expressions", () => {
		const ast = parse("(from:alice or from:bob) is:starred");
		expect(ast.e1).toBeInstanceOf(OrQueryExpression);
		expect(ast.e2.status).toBe(true);
	});

	it("rejects an unterminated quoted term", () => {
		expect(() => parse('subject:"unfinished')).toThrow("ran out of input");
	});

	it("rejects an empty query", () => {
		expect(() => parse("   ")).toThrow("Unable to parse query");
	});
});

describe("search query AST", () => {
	it("compares tokens by value", () => {
		expect(new SearchQueryToken("same").equals(new SearchQueryToken("same"))).toBe(true);
		expect(new SearchQueryToken("same").equals(new SearchQueryToken("other"))).toBe(false);
	});

	it("marks text-only boolean trees as match compatible", () => {
		const text = (value) => new TextQueryExpression(new SearchQueryToken(value));
		expect(new AndQueryExpression(text("one"), text("two")).isMatchCompatible()).toBe(true);
	});

	it("marks trees containing status filters as incompatible", () => {
		const text = new TextQueryExpression(new SearchQueryToken("one"));
		expect(new AndQueryExpression(text, new UnreadStatusQueryExpression(true)).isMatchCompatible()).toBe(false);
	});
});

describe("LocalSearchQueryBackend", () => {
	const backend = new LocalSearchQueryBackend("Thread");

	it("compiles a generic term to an FTS prefix match", () => {
		expect(backend.compile(parse("invoice"))).toContain("MATCH '(\"invoice\"*)'");
	});

	it("indexes sender fields", () => {
		expect(backend.compile(parse("from:alice"))).toContain('(from_ : "alice"*)');
	});

	it("indexes recipient and subject fields in a boolean query", () => {
		const sql = backend.compile(parse("to:bob or subject:launch"));
		expect(sql).toContain('(to_ : "bob"*) OR (subject : "launch"*)');
	});

	it("compiles unread state outside the full-text match", () => {
		const sql = backend.compile(parse("invoice and is:unread"));
		expect(sql).toContain("`Thread`.`unread` = 1");
		expect(sql).toContain("`ThreadSearch` MATCH");
	});

	it("compiles read and unstarred states as zero", () => {
		const sql = backend.compile(parse("is:read and is:unstarred"));
		expect(sql).toContain("`Thread`.`unread` = 0");
		expect(sql).toContain("`Thread`.`starred` = 0");
	});

	it("uses the configured model class for table names", () => {
		const sql = new LocalSearchQueryBackend("Message").compile(parse("roadmap"));
		expect(sql).toContain("`Message`.`id`");
		expect(sql).toContain("`MessageSearch`");
	});
});

describe("IMAPSearchQueryBackend", () => {
	const inbox = { name: "Inbox" };

	it("compiles field-qualified terms", () => {
		expect(IMAPSearchQueryBackend.compile(parse("from:alice"), inbox)).toEqual([
			["FROM", "alice"],
		]);
	});

	it("compiles adjacent filters as an IMAP criteria list", () => {
		expect(IMAPSearchQueryBackend.compile(parse("from:alice is:unread"), inbox)).toEqual([
			["FROM", "alice"],
			"UNSEEN",
		]);
	});

	it("compiles OR as a nested IMAP expression", () => {
		expect(IMAPSearchQueryBackend.compile(parse("from:alice or to:bob"), inbox)).toEqual([
			["OR", ["FROM", "alice"], ["TO", "bob"]],
		]);
	});

	it("restricts matching in-folder queries to ALL", () => {
		expect(IMAPSearchQueryBackend.compile(parse("in:Inbox"), inbox)).toEqual(["ALL"]);
	});

	it("rejects a different folder with the sentinel criterion", () => {
		expect(IMAPSearchQueryBackend.compile(parse("in:Archive"), inbox)).toEqual(["!ALL"]);
	});

	it("finds the intersection of explicit folders", () => {
		expect(IMAPSearchQueryBackend.folderNamesForQuery(parse("in:Inbox and in:Archive"))).toEqual([]);
	});

	it("returns all folders when any OR branch is unrestricted", () => {
		expect(IMAPSearchQueryBackend.folderNamesForQuery(parse("in:Inbox or invoice"))).toBe("all");
	});
});

describe("RealDOMParser", () => {
	const makeRoot = (html) => {
		const root = document.createElement("div");
		root.innerHTML = html;
		return root;
	};

	it("requires at least two non-whitespace search characters", () => {
		const parser = new RealDOMParser("message-body");
		expect(parser.matchesSearch(makeRoot("An annual report"), "a")).toBe(false);
		expect(parser.matchesSearch(makeRoot("An annual report"), "an")).toBe(true);
	});

	it("matches literal terms case-insensitively", () => {
		const parser = new RealDOMParser("message-body");
		expect(parser.matchesSearch(makeRoot("Quarterly REPORT"), "report")).toBe(true);
	});

	it("escapes regex punctuation in literal terms", () => {
		const parser = new RealDOMParser("message-body");
		expect(parser.matchesSearch(makeRoot("Use file.js, not fileXjs"), "file.js")).toBe(true);
		expect(parser.matchesFromFullString([document.createTextNode("fileXjs")], "file.js")).toEqual([]);
	});

	it("supports slash-delimited regular expressions", () => {
		const parser = new RealDOMParser("message-body");
		const node = document.createTextNode("Order 123 and order 456");
		expect(parser.matchesFromFullString([node], "/order \\d+/i")).toEqual([
			[0, 9],
			[14, 23],
		]);
	});

	it("returns no matches for an invalid regular expression", () => {
		const parser = new RealDOMParser("message-body");
		expect(parser.matchesFromFullString([document.createTextNode("text")], "/[bad/")).toEqual([]);
	});

	it("finds every non-overlapping occurrence", () => {
		const parser = new RealDOMParser("message-body");
		expect(parser.matchesFromFullString([document.createTextNode("one ONE one")], "one")).toEqual([
			[0, 3],
			[4, 7],
			[8, 11],
		]);
	});

	it("calculates slices for a match inside a text node", () => {
		const parser = new RealDOMParser("message-body");
		const node = document.createTextNode("quarterly report");
		node.fullStringIndex = 0;
		expect(parser.slicePointsForMatches(node, [[10, 16]])).toEqual([[10, 16]]);
	});

	it("splits and highlights matching DOM text", () => {
		const parser = new RealDOMParser("message-body");
		const root = makeRoot("A quarterly report");
		const matches = parser.getElementsWithNewMatchNodes(root, "quarterly", 0);
		parser.highlightSearch(root, matches);
		const match = root.querySelector("search-match");
		expect(match.textContent).toBe("quarterly");
		expect(match.getAttribute("data-region-id")).toBe("message-body");
		expect(match.className).toBe("current-match");
	});

	it("numbers multiple rendered matches in document order", () => {
		const parser = new RealDOMParser("message-body");
		const root = makeRoot("report and report");
		parser.highlightSearch(root, parser.getElementsWithNewMatchNodes(root, "report", 1));
		const matches = root.querySelectorAll("search-match");
		expect([...matches].map((node) => node.getAttribute("data-render-index"))).toEqual(["0", "1"]);
		expect(matches[1].className).toBe("current-match");
	});

	it("removes match wrappers and normalizes adjacent text", () => {
		const parser = new RealDOMParser("message-body");
		const root = makeRoot('before <search-match>match</search-match> after');
		expect(parser.removeMatchesAndNormalize(root)).toBe(root);
		expect(root.querySelector("search-match")).toBeNull();
		expect(root.childNodes).toHaveLength(1);
		expect(root.textContent).toBe("before match after");
	});
});
