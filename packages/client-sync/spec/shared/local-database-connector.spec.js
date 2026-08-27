import { beforeEach, describe, expect, it, vi } from "vitest";

const core = vi.hoisted(() => ({
	loadModels: vi.fn(),
	transactionHook: vi.fn(),
	versionHook: vi.fn(),
}));

vi.mock("isomorphic-core", () => ({
	StringUtils: { trimTo: vi.fn((value) => value) },
	loadModels: core.loadModels,
	HookIncrementVersionOnSave: core.versionHook,
	HookTransactionLog: core.transactionHook,
}));
vi.mock("../../../isomorphic-core/src/database-extensions.js", () => ({}));

import connector from "../../src/shared/local-database-connector.js";

function fakeSequelize() {
	return {
		authenticate: vi.fn(async () => {}),
		sync: vi.fn(async () => {}),
		drop: vi.fn(async () => {}),
		query: vi.fn(),
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	connector._cache = {};
});

describe("LocalDatabaseConnector caching", () => {
	it("rejects missing account IDs", async () => {
		await expect(connector.forAccount()).rejects.toThrow("pass an accountId");
	});

	it("initializes an account database once and decorates the model collection", async () => {
		const sequelize = fakeSequelize();
		const db = {};
		core.loadModels.mockResolvedValue(db);
		vi.spyOn(connector, "_sequelizePoolForDatabase").mockReturnValue(sequelize);
		const firstPromise = connector.forAccount("a1");
		expect(connector.forAccount("a1")).toBe(firstPromise);
		await expect(firstPromise).resolves.toBe(db);
		expect(db).toMatchObject({ sequelize, accountId: "a1" });
		expect(core.transactionHook).toHaveBeenCalled();
		expect(core.versionHook).toHaveBeenCalledWith(db, sequelize);
		expect(sequelize.authenticate).toHaveBeenCalled();
		expect(sequelize.sync).toHaveBeenCalled();
		connector._sequelizePoolForDatabase.mockRestore();
	});

	it("syncs account models in dependency order", async () => {
		const names = [
			"Contact",
			"Folder",
			"Label",
			"Transaction",
			"Thread",
			"ThreadLabel",
			"ThreadFolder",
			"Message",
			"MessageLabel",
			"Reference",
			"MessageReference",
			"File",
			"SyncbackRequest",
		];
		const calls = [];
		const db = Object.fromEntries(
			names.map((name) => [
				name,
				{ sync: vi.fn(async () => calls.push(name)) },
			]),
		);
		vi.spyOn(connector, "forAccount").mockResolvedValue(db);
		await connector.ensureAccountDatabase("a1");
		expect(calls).toEqual(names);
		connector.forAccount.mockRestore();
	});

	it("drops an in-memory account database and clears its cache", async () => {
		const db = { sequelize: { drop: vi.fn(async () => {}) } };
		connector._cache.a1 = Promise.resolve(db);
		await connector.destroyAccountDatabase("a1");
		expect(db.sequelize.drop).toHaveBeenCalled();
		expect(connector._cache.a1).toBeUndefined();
	});

	it("memoizes the shared database setup", async () => {
		const sequelize = fakeSequelize();
		const db = {};
		core.loadModels.mockResolvedValue(db);
		vi.spyOn(connector, "_sequelizePoolForDatabase").mockReturnValue(sequelize);
		const first = connector.forShared();
		expect(connector.forShared()).toBe(first);
		await expect(first).resolves.toBe(db);
		expect(db.sequelize).toBe(sequelize);
		expect(sequelize.authenticate).toHaveBeenCalledTimes(1);
		connector._sequelizePoolForDatabase.mockRestore();
	});
});
