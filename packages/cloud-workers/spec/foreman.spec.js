import { describe, it, expect, vi } from "vitest";
import { Op } from "sequelize";
import Foreman from "../src/foreman";

function makeDb() {
	return {
		sequelize: {
			transaction: async (fn) => fn({ id: "t" }),
		},
		Metadata: {
			findAll: vi.fn(async () => []),
		},
		CloudJob: {
			findAll: vi.fn(async () => []),
			update: vi.fn(async () => [1]),
			count: vi.fn(async () => 0),
			bulkCreate: vi.fn(async () => []),
		},
	};
}

const makeLogger = () => ({
	child: () => ({ info: vi.fn(), debug: vi.fn(), error: vi.fn() }),
});
const WorkerClass = class TestWorker {};

function makeForeman(db) {
	return new Foreman({
		db,
		logger: makeLogger(),
		pluginId: "send-later",
		WorkerClass,
	});
}

describe("Foreman", () => {
	it("exposes a stable foreman id per plugin", () => {
		const f = makeForeman(makeDb());
		expect(f.foremanId).toContain("send-later");
		expect(f.foremanId).toContain(process.pid);
	});

	it("createJobsFromMetadata: creates jobs and clears expiration for expired metadata", async () => {
		const db = makeDb();
		const cleared = [];
		db.Metadata.findAll.mockResolvedValueOnce([
			{
				id: 1,
				pluginId: "send-later",
				accountId: "a1",
				clearExpiration: vi.fn(async () => {
					cleared.push(1);
				}),
			},
			{
				id: 2,
				pluginId: "send-later",
				accountId: "a2",
				clearExpiration: vi.fn(async () => {
					cleared.push(2);
				}),
			},
		]);
		const f = makeForeman(db);
		await f.createJobsFromMetadata();

		const where = db.Metadata.findAll.mock.calls[0][0].where;
		expect(where.pluginId).toBe("send-later");
		expect(
			String(
				where.expiration[Symbol.for("jest.mock") ? "and" : "lte"] ||
					where.expiration[Op.lte],
			),
		).toBeDefined();

		expect(db.CloudJob.bulkCreate).toHaveBeenCalledTimes(1);
		const rows = db.CloudJob.bulkCreate.mock.calls[0][0];
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			type: "send-later",
			metadataId: 1,
			accountId: "a1",
		});
		expect(cleared).toEqual([1, 2]);
	});

	it("createJobsFromMetadata: deletes corrupted metadata when clearing fails", async () => {
		const db = makeDb();
		const destroy = vi.fn(async () => {});
		db.Metadata.findAll.mockResolvedValueOnce([
			{
				id: 3,
				pluginId: "send-later",
				accountId: "a3",
				clearExpiration: vi.fn(async () => {
					throw new Error("corrupt");
				}),
				destroy,
			},
		]);
		const f = makeForeman(db);
		await f.createJobsFromMetadata();
		expect(destroy).toHaveBeenCalled();
	});

	it("claimJobs: claims found jobs by marking them INPROGRESS-RETRYABLE", async () => {
		const db = makeDb();
		db.CloudJob.findAll.mockResolvedValueOnce([{ id: 11 }, { id: 12 }]);
		const f = makeForeman(db);
		const claimed = await f.claimJobs();

		expect(claimed).toEqual([{ id: 11 }, { id: 12 }]);
		expect(db.CloudJob.update).toHaveBeenCalledTimes(1);
		const [values, options] = db.CloudJob.update.mock.calls[0];
		expect(values.status).toBe("INPROGRESS-RETRYABLE");
		expect(values.foremanId).toBe(f.foremanId);
		expect(options.where.id[Op.in]).toEqual([11, 12]);

		const where = db.CloudJob.findAll.mock.calls[0][0].where;
		expect(Array.isArray(where[Op.or])).toBe(true);
		expect(where[Op.or]).toHaveLength(3);
	});

	it("claimJobs: does not update when nothing is claimable", async () => {
		const db = makeDb();
		const f = makeForeman(db);
		const claimed = await f.claimJobs();
		expect(claimed).toEqual([]);
		expect(db.CloudJob.update).not.toHaveBeenCalled();
	});

	it("cleanupDeadJobs: marks exhausted jobs FAILED with error details", async () => {
		const db = makeDb();
		db.CloudJob.findAll.mockResolvedValueOnce([{ id: 21 }, { id: 22 }]);
		const f = makeForeman(db);
		await f.cleanupDeadJobs();

		const [values, options] = db.CloudJob.update.mock.calls[0];
		expect(values.status).toBe("FAILED");
		expect(values.error.message).toBe("Job failed too many times");
		expect(values.error.stack).toBeTruthy();
		expect(options.where.id[Op.in]).toEqual([21, 22]);
	});

	it("currentJobLimit: never goes negative", async () => {
		const db = makeDb();
		db.CloudJob.count.mockResolvedValueOnce(50);
		const f = makeForeman(db);
		expect(await f.currentJobLimit({})).toBe(0);
		db.CloudJob.count.mockResolvedValueOnce(2);
		expect(await f.currentJobLimit({})).toBe(18);
	});

	it("run: schedules itself again and spawns workers for claimed jobs", async () => {
		vi.useFakeTimers();
		try {
			const db = makeDb();
			db.CloudJob.findAll.mockResolvedValue([{ id: 31 }]);
			const f = makeForeman(db);
			const spawned = [];
			f.runWorkers = (jobs) => {
				spawned.push(...jobs);
			};
			await f.run();
			expect(spawned).toEqual([{ id: 31 }]);
			expect(vi.getTimerCount()).toBe(1);
			f.stop();
			expect(vi.getTimerCount()).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});
});
