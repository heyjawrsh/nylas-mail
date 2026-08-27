import { afterEach, describe, expect, it, vi } from "vitest";
import LocalDatabaseConnector from "../../src/shared/local-database-connector.js";
import SyncProcessManager from "../../src/local-sync-worker/sync-process-manager.js";
import {
	preventCreationOfDuplicateAccounts,
	removeDuplicateAccountsWithOldSettings,
} from "../../src/shared/dedupe-accounts.js";

describe("account deduplication", () => {
	afterEach(() => vi.restoreAllMocks());

	it("removes an existing account whose settings hash changed", async () => {
		const existing = { id: "old", destroy: vi.fn() };
		const db = {
			Account: {
				findOne: vi.fn().mockResolvedValue(existing),
				hash: vi.fn().mockReturnValue("new"),
			},
		};
		vi.spyOn(SyncProcessManager, "removeWorkerForAccountId").mockResolvedValue(
			undefined,
		);
		vi.spyOn(
			LocalDatabaseConnector,
			"destroyAccountDatabase",
		).mockResolvedValue(undefined);
		vi.spyOn(console, "warn").mockImplementation(() => {});
		await preventCreationOfDuplicateAccounts(db, {
			emailAddress: "a@example.com",
		});
		expect(SyncProcessManager.removeWorkerForAccountId).toHaveBeenCalledWith(
			"old",
		);
		expect(LocalDatabaseConnector.destroyAccountDatabase).toHaveBeenCalledWith(
			"old",
		);
		expect(existing.destroy).toHaveBeenCalled();
	});

	it("keeps a matching account and reports lookup errors", async () => {
		const existing = { id: "same", destroy: vi.fn() };
		const db = {
			Account: {
				findOne: vi.fn().mockResolvedValue(existing),
				hash: vi.fn().mockReturnValue("same"),
			},
		};
		await preventCreationOfDuplicateAccounts(db, {
			emailAddress: "a@example.com",
		});
		expect(existing.destroy).not.toHaveBeenCalled();
		const error = new Error("database unavailable");
		db.Account.findOne.mockRejectedValue(error);
		await preventCreationOfDuplicateAccounts(db, {
			emailAddress: "a@example.com",
		});
		expect(NylasEnv.reportError).toHaveBeenCalledWith(error);
		expect(error.message).toMatch(/^Error removing duplicate account/);
	});

	it("removes only duplicate accounts carrying old connection settings", async () => {
		const old = {
			id: "old",
			emailAddress: "a@example.com",
			connectionSettings: {},
			destroy: vi.fn(),
		};
		const current = {
			id: "new",
			emailAddress: "a@example.com",
			connectionSettings: { imap_security: "ssl" },
			destroy: vi.fn(),
		};
		const single = {
			id: "single",
			emailAddress: "b@example.com",
			connectionSettings: {},
			destroy: vi.fn(),
		};
		vi.spyOn(LocalDatabaseConnector, "forShared").mockResolvedValue({
			Account: { findAll: vi.fn().mockResolvedValue([old, current, single]) },
		});
		vi.spyOn(
			LocalDatabaseConnector,
			"destroyAccountDatabase",
		).mockResolvedValue(undefined);
		vi.spyOn(console, "warn").mockImplementation(() => {});
		await removeDuplicateAccountsWithOldSettings();
		expect(LocalDatabaseConnector.destroyAccountDatabase).toHaveBeenCalledTimes(
			1,
		);
		expect(LocalDatabaseConnector.destroyAccountDatabase).toHaveBeenCalledWith(
			"old",
		);
		expect(old.destroy).toHaveBeenCalled();
		expect(current.destroy).not.toHaveBeenCalled();
		expect(single.destroy).not.toHaveBeenCalled();
	});
});
