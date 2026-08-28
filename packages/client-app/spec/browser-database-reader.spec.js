import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	databasePath: vi.fn(() => "/profile/db.sqlite"),
	openDatabase: vi.fn(),
}));

vi.mock("../src/database-helpers.js", () => ({
	databasePath: mocks.databasePath,
	openDatabase: mocks.openDatabase,
}));

import DatabaseReader from "../src/browser/database-reader.js";

describe("DatabaseReader", () => {
	beforeEach(() => vi.clearAllMocks());

	it("derives its database path from the profile and spec mode", () => {
		new DatabaseReader({ configDirPath: "/profile", specMode: true });
		expect(mocks.databasePath).toHaveBeenCalledWith("/profile", true);
	});

	it("opens the derived database", async () => {
		const database = { prepare: vi.fn() };
		mocks.openDatabase.mockResolvedValue(database);
		const reader = new DatabaseReader({ configDirPath: "/profile", specMode: false });
		await reader.open();
		expect(mocks.openDatabase).toHaveBeenCalledWith("/profile/db.sqlite");
		expect(reader.database).toBe(database);
	});

	it("returns the json member of a stored blob", () => {
		const get = vi.fn(() => ({ data: '{"json":{"enabled":true}}' }));
		const reader = new DatabaseReader({ configDirPath: "/profile", specMode: false });
		reader.database = { prepare: vi.fn(() => ({ get })) };
		expect(reader.getJSONBlob("preferences")).toEqual({ enabled: true });
		expect(reader.database.prepare).toHaveBeenCalledWith(
			"SELECT * FROM JSONBlob WHERE id = 'preferences'",
		);
	});

	it("returns null when the row has no data", () => {
		const reader = new DatabaseReader({ configDirPath: "/profile", specMode: false });
		reader.database = { prepare: vi.fn(() => ({ get: () => ({}) })) };
		expect(reader.getJSONBlob("missing")).toBeNull();
	});

	it("returns null for malformed JSON", () => {
		const reader = new DatabaseReader({ configDirPath: "/profile", specMode: false });
		reader.database = { prepare: vi.fn(() => ({ get: () => ({ data: "{" }) })) };
		expect(reader.getJSONBlob("broken")).toBeNull();
	});

	it("returns null when the database read throws", () => {
		const reader = new DatabaseReader({ configDirPath: "/profile", specMode: false });
		reader.database = { prepare: vi.fn(() => { throw new Error("locked"); }) };
		expect(reader.getJSONBlob("locked")).toBeNull();
	});
});
