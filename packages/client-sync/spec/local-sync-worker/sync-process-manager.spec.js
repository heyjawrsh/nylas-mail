import { IdentityStore } from "nylas-exports";
import { createLogger } from "../../src/shared/logger";
import LocalDatabaseConnector from "../../src/shared/local-database-connector";
import SyncProcessManager from "../../src/local-sync-worker/sync-process-manager";
import SyncActivity from "../../src/shared/sync-activity";
import { vi } from "vitest";

describe("SyncProcessManager", () => {
	beforeEach(async () => {
		global.Logger = createLogger();
		vi.spyOn(IdentityStore, "identity").mockReturnValue(true);
		const db = await LocalDatabaseConnector.forShared();
		await db.Account.create({ id: "test-account" });
	});
	afterEach(async () => {
		const db = await LocalDatabaseConnector.forShared();
		const accounts = await db.Account.findAll();
		await Promise.all(accounts.map((account) => account.destroy()));
		vi.restoreAllMocks();
	});
	describe("when a sync worker is stuck", () => {
		beforeEach(() => {
			vi.spyOn(SyncProcessManager, "removeWorkerForAccountId");
			vi.spyOn(SyncProcessManager, "addWorkerForAccount");
			vi.spyOn(SyncActivity, "getLastSyncActivityForAccount").mockReturnValue({
				time: Date.now() - 2 * SyncProcessManager.MAX_WORKER_SILENCE_MS,
				activity: ["activity"],
			});
			// Make sure the health check interval isn't automatically started
			SyncProcessManager._check_health_interval = 1;
		});
		it("detects it and recovers", async () => {
			await SyncProcessManager.start();
			expect(SyncProcessManager.removeWorkerForAccountId).toHaveBeenCalledTimes(
				0,
			);
			expect(SyncProcessManager.addWorkerForAccount).toHaveBeenCalledTimes(1);

			await SyncProcessManager._checkHealth();
			expect(SyncProcessManager.removeWorkerForAccountId).toHaveBeenCalledTimes(
				1,
			);
			expect(SyncProcessManager.addWorkerForAccount).toHaveBeenCalledTimes(2);
		});
		it("doesn't have zombie workers come back to life", async () => {
			await SyncProcessManager.start();

			// Zombify a worker
			const zombieSync = () => {
				return new Promise(() => {}); // Never resolves
			};
			const zombieWorker = SyncProcessManager.workers()[0];
			const origSync = zombieWorker.syncNow;
			zombieWorker.syncNow = zombieSync;
			zombieWorker.interrupt();
			zombieWorker.syncNow();

			// Make sure the worker is discarded by the manager
			await SyncProcessManager._checkHealth();
			expect(SyncProcessManager.removeWorkerForAccountId).toHaveBeenCalledTimes(
				1,
			);
			expect(SyncProcessManager.addWorkerForAccount).toHaveBeenCalledTimes(2);

			// Try to get the zombie to sync again, check that it doesn't.
			const lastStart = zombieWorker._syncStart;
			zombieWorker.syncNow = origSync;
			zombieWorker.interrupt({ reason: "Playing Frankenstein" });
			await zombieWorker.syncNow();
			expect(zombieWorker._syncStart).toEqual(lastStart);
		});
	});
});
