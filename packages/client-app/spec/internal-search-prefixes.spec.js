import { describe, expect, it } from "vitest";

import SearchQueryParser from "../src/services/search/search-query-parser.js";
import IMAPSearchQueryBackend from "../src/services/search/search-query-backend-imap.js";
import LocalSearchQueryBackend from "../src/services/search/search-query-backend-local.js";

const compileIMAP = (query, folder = { name: "inbox" }) =>
	IMAPSearchQueryBackend.compile(SearchQueryParser.parse(query), folder);

describe("structured search prefixes", () => {
	it("compiles a from provider", () => {
		expect(compileIMAP("from:ada@example.com")).toEqual([["FROM", "ada@example.com"]]);
	});

	it("compiles a to provider", () => {
		expect(compileIMAP("to:team@example.com")).toEqual([["TO", "team@example.com"]]);
	});

	it("preserves spaces in a quoted subject", () => {
		expect(compileIMAP('subject:"quarterly report"')).toEqual([["SUBJECT", "quarterly report"]]);
	});

	it("maps unread and read prefixes to opposite IMAP flags", () => {
		expect(compileIMAP("is:unread")).toEqual(["UNSEEN"]);
		expect(compileIMAP("is:read")).toEqual(["SEEN"]);
	});

	it("maps starred and unstarred prefixes to opposite IMAP flags", () => {
		expect(compileIMAP("is:starred")).toEqual(["FLAGGED"]);
		expect(compileIMAP("is:unstarred")).toEqual(["UNFLAGGED"]);
	});

	it("turns an in prefix into ALL only for the selected folder", () => {
		expect(compileIMAP("in:inbox")).toEqual(["ALL"]);
		expect(compileIMAP("in:archive")).toEqual(["!ALL"]);
	});

	it("finds the union of folders in an OR query", () => {
		const ast = SearchQueryParser.parse("in:inbox OR in:archive");
		expect(IMAPSearchQueryBackend.folderNamesForQuery(ast)).toEqual(["inbox", "archive"]);
	});

	it("returns all folders when either OR branch has no folder restriction", () => {
		const ast = SearchQueryParser.parse("in:inbox OR from:ada");
		expect(IMAPSearchQueryBackend.folderNamesForQuery(ast)).toBe("all");
	});

	it("compiles prefix filters for the local provider", () => {
		const backend = new LocalSearchQueryBackend("Thread");
		const sql = backend.compile(SearchQueryParser.parse("from:ada AND is:unread"));
		expect(sql).toContain('(from_ : "ada"*)');
		expect(sql).toContain("`Thread`.`unread` = 1");
	});
});
