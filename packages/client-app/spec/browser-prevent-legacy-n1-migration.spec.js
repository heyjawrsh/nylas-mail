import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	existsSync: vi.fn(),
	legacyRequire: vi.fn(),
	writeFileSync: vi.fn(),
}));

vi.mock("node:module", () => ({ default: { createRequire: () => mocks.legacyRequire }, createRequire: () => mocks.legacyRequire }));
vi.mock("node:fs", () => ({
	default: { existsSync: mocks.existsSync, writeFileSync: mocks.writeFileSync },
}));

import preventLegacyN1Migration from "../src/browser/prevent-legacy-n1-migration.js";

describe("preventLegacyN1Migration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.existsSync.mockReturnValue(true);
		mocks.legacyRequire.mockReturnValue({ "*": {} });
		vi.spyOn(Date, "now").mockReturnValue(123456);
	});
	afterEach(() => vi.restoreAllMocks());

	it("does nothing when the legacy config is absent", () => {
		mocks.existsSync.mockReturnValue(false);
		preventLegacyN1Migration("/home/alice/.nylas-mail");
		expect(mocks.legacyRequire).not.toHaveBeenCalled();
		expect(mocks.writeFileSync).not.toHaveBeenCalled();
	});

	it("marks an existing legacy config with the migration time", () => {
		mocks.legacyRequire.mockReturnValue({ "*": { theme: "dark" } });
		preventLegacyN1Migration("/home/alice/.nylas-mail");
		expect(mocks.writeFileSync).toHaveBeenCalledWith(
			"/home/alice/.nylas/config.json",
			JSON.stringify({ "*": { theme: "dark", nylasMailBasicMigrationTime: 123456 } }),
		);
	});

	it("creates the star settings object when missing", () => {
		mocks.legacyRequire.mockReturnValue({ account: "a" });
		preventLegacyN1Migration("/home/alice/.nylas-mail");
		expect(JSON.parse(mocks.writeFileSync.mock.calls[0][1])).toEqual({
			account: "a",
			"*": { nylasMailBasicMigrationTime: 123456 },
		});
	});

	it("logs and swallows failures", () => {
		mocks.legacyRequire.mockImplementation(() => { throw new Error("bad config"); });
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(() => preventLegacyN1Migration("/profile")).not.toThrow();
		expect(error).toHaveBeenCalledWith("Error preventing legacy N1 migration");
		expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: "bad config" }));
		error.mockRestore();
	});
});
