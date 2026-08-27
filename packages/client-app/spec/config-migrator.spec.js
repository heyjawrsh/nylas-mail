import { beforeEach, describe, expect, it, vi } from "vitest";

import ConfigMigrator from "../src/browser/config-migrator.js";

function makeFixture(identity) {
	const run = vi.fn();
	const prepare = vi.fn(() => ({ run }));
	const config = { get: vi.fn(() => identity), set: vi.fn() };
	const database = { database: { prepare } };
	return { config, database, prepare, run };
}

beforeEach(() => vi.clearAllMocks());

describe("ConfigMigrator", () => {
	it("does nothing when the old identity is missing", () => {
		const fixture = makeFixture(undefined);
		new ConfigMigrator(fixture.config, fixture.database).migrate();
		expect(fixture.prepare).not.toHaveBeenCalled();
		expect(fixture.config.set).not.toHaveBeenCalled();
	});

	it("does nothing when the old identity has no id", () => {
		const fixture = makeFixture({ email: "ada@example.com" });
		new ConfigMigrator(fixture.config, fixture.database).migrate();
		expect(fixture.run).not.toHaveBeenCalled();
	});

	it("writes an identity fixture to the JSONBlob table", () => {
		const identity = { id: "identity-1", email: "ada@example.com" };
		const fixture = makeFixture(identity);
		new ConfigMigrator(fixture.config, fixture.database).migrate();
		expect(fixture.prepare).toHaveBeenCalledWith(
			"REPLACE INTO JSONBlob (id, data, client_id) VALUES (?,?,?)",
		);
		expect(fixture.run).toHaveBeenCalledWith([
			"NylasID",
			JSON.stringify({ id: "NylasID", clientId: "NylasID", serverId: "NylasID", json: identity }),
			"NylasID",
		]);
	});

	it("clears the legacy config only after writing it", () => {
		const fixture = makeFixture({ id: "identity-1" });
		fixture.run.mockImplementation(() => {
			expect(fixture.config.set).not.toHaveBeenCalled();
		});
		new ConfigMigrator(fixture.config, fixture.database).migrate();
		expect(fixture.config.set).toHaveBeenCalledWith("nylas.identity", null);
	});
});
