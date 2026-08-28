import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generateTempId: vi.fn(() => "token-generated") }));

vi.mock("nylas-exports", () => ({
	default: { Utils: { generateTempId: mocks.generateTempId } },
	Utils: { generateTempId: mocks.generateTempId },
}));

import TokenDataSource from "../internal_packages/composer-mail-merge/lib/token-data-source.js";

describe("composer mail merge TokenDataSource", () => {
	beforeEach(() => vi.clearAllMocks());

	it("starts with no tokens", () => {
		const source = new TokenDataSource();
		expect(source.tokensForField("subject")).toEqual([]);
		expect(source.toJSON()).toEqual([]);
	});

	it("generates an id and records the linked field", () => {
		const source = new TokenDataSource().linkToken("subject", { colIdx: 2 });
		expect(source.getToken("subject", "token-generated")).toEqual({
			field: "subject", tokenId: "token-generated", colIdx: 2,
		});
	});

	it("keeps an explicitly supplied token id", () => {
		const source = new TokenDataSource().linkToken("body", { tokenId: "token-1", colName: "Name" });
		expect(source.getToken("body", "token-1").colName).toBe("Name");
		expect(mocks.generateTempId).not.toHaveBeenCalled();
	});

	it("does not mutate the source when linking another token", () => {
		const original = new TokenDataSource();
		const linked = original.linkToken("body", { tokenId: "token-1" });
		expect(original.tokensForField("body")).toEqual([]);
		expect(linked.tokensForField("body")).toHaveLength(1);
	});

	it("keeps tokens in separate fields", () => {
		const source = new TokenDataSource()
			.linkToken("subject", { tokenId: "subject-1" })
			.linkToken("body", { tokenId: "body-1" });
		expect(source.tokensForField("subject").map((token) => token.tokenId)).toEqual(["subject-1"]);
		expect(source.tokensForField("body").map((token) => token.tokenId)).toEqual(["body-1"]);
	});

	it("finds tokens by matching properties", () => {
		const source = new TokenDataSource()
			.linkToken("body", { tokenId: "one", colName: "First" })
			.linkToken("body", { tokenId: "two", colName: "Last" });
		expect(source.findTokens("body", { colName: "Last" }).map((token) => token.tokenId)).toEqual(["two"]);
	});

	it("returns null for a token in an unknown field", () => {
		expect(new TokenDataSource().getToken("missing", "token-1")).toBeNull();
	});

	it("updates a token without mutating the earlier source", () => {
		const original = new TokenDataSource().linkToken("body", { tokenId: "one", colIdx: 1 });
		const updated = original.updateToken("body", "one", { colIdx: 4 });
		expect(original.getToken("body", "one").colIdx).toBe(1);
		expect(updated.getToken("body", "one").colIdx).toBe(4);
	});

	it("returns the same source when updating an unknown field", () => {
		const source = new TokenDataSource();
		expect(source.updateToken("missing", "one", { colIdx: 4 })).toBe(source);
	});

	it("unlinks a token while preserving other tokens", () => {
		const source = new TokenDataSource()
			.linkToken("body", { tokenId: "one" })
			.linkToken("body", { tokenId: "two" })
			.unlinkToken("body", "one");
		expect(source.tokensForField("body").map((token) => token.tokenId)).toEqual(["two"]);
	});

	it("returns the same source when unlinking an unknown field", () => {
		const source = new TokenDataSource();
		expect(source.unlinkToken("missing", "one")).toBe(source);
	});

	it("round trips serialized tokens", () => {
		const json = [
			{ field: "subject", tokenId: "one", colIdx: 0 },
			{ field: "body", tokenId: "two", colIdx: 1 },
		];
		expect(TokenDataSource.fromJSON(json).toJSON()).toEqual(json);
	});
});
