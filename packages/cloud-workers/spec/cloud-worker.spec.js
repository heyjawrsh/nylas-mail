import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("isomorphic-core", () => {
	class RetryableError extends Error {}
	class NylasError extends Error {}
	const withConnectionsForAccount = vi.fn(async (_account, { onConnected }) => {
		const connection = {
			openBox: vi.fn(),
			search: vi.fn(async () => [5]),
			moveFromBox: vi.fn(),
		};
		await onConnected([connection]);
	});
	return {
		Errors: { RetryableError, NylasError },
		IMAPConnectionPool: { withConnectionsForAccount },
	};
});

vi.mock("cloud-core", () => ({
	GmailOAuthHelpers: { refreshAccessToken: vi.fn(async () => {}) },
}));

import CloudWorker from "../src/cloud-worker";
import SnoozeWorker from "../src/workers/snooze";
import { Errors } from "isomorphic-core";

const makeLogger = () => {
	const l = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
	l.child = () => makeLogger();
	return l;
};

function makeJob() {
	return {
		job: {
			id: 7,
			accountId: "acc1",
			metadataId: "meta1",
			status: "NEW",
			attemptNumber: 0,
		},
		db: {
			sequelize: { transaction: async (fn) => fn({ id: "t" }) },
			Account: {
				findByPk: vi.fn(async () => ({
					id: "acc1",
					provider: "imap",
					emailAddress: "a@b.c",
					decryptedCredentials: () => ({}),
				})),
			},
			Metadata: {
				findByPk: vi.fn(async () => ({
					id: "meta1",
					value: { header: "<x@y>" },
				})),
			},
			CloudJob: {
				findByPk: vi.fn(async () => ({
					id: 7,
					status: "NEW",
					attemptNumber: 1,
					save: vi.fn(async () => {}),
				})),
				update: vi.fn(async () => [1]),
			},
		},
		logger: makeLogger(),
	};
}

class TestWorker extends CloudWorker {
	pluginId() {
		return "test";
	}
	async performAction() {}
}

describe("CloudWorker", () => {
	beforeEach(() => vi.clearAllMocks());

	it("runs a job to SUCCEEDED", async () => {
		const ctx = makeJob();
		const w = new TestWorker(ctx.job, { db: ctx.db, logger: ctx.logger });
		await w.run();
		expect(ctx.db.CloudJob.update).toHaveBeenCalledWith(
			{ status: "SUCCEEDED", statusUpdatedAt: expect.any(Date) },
			{ where: { id: 7 } },
		);
	});

	it("marks WAITING-TO-RETRY with exponential backoff on retryable errors", async () => {
		const ctx = makeJob();
		const saved = {
			id: 7,
			status: "",
			attemptNumber: 1,
			retryAt: null,
			save: vi.fn(async () => {}),
		};
		ctx.db.CloudJob.findByPk.mockResolvedValueOnce(saved);
		const w = new TestWorker(ctx.job, { db: ctx.db, logger: ctx.logger });
		w.logger = makeLogger();
		await w._onError(new Errors.RetryableError("socket hiccup"));
		expect(saved.status).toBe("WAITING-TO-RETRY");
		expect(saved.retryAt).toBeInstanceOf(Date);
	});

	it("marks FAILED on permanent errors", async () => {
		const ctx = makeJob();
		const saved = {
			id: 7,
			status: "",
			attemptNumber: 3,
			save: vi.fn(async () => {}),
		};
		ctx.db.CloudJob.findByPk.mockResolvedValueOnce(saved);
		const w = new TestWorker(ctx.job, { db: ctx.db, logger: ctx.logger });
		w.logger = makeLogger();
		await w._onError(new Error("nope"));
		expect(saved.status).toBe("FAILED");
	});

	it("_markInProgress increments the attempt number", async () => {
		const ctx = makeJob();
		const saved = {
			id: 7,
			status: "NEW",
			attemptNumber: 4,
			save: vi.fn(async () => {}),
		};
		ctx.db.CloudJob.findByPk.mockResolvedValueOnce(saved);
		const w = new TestWorker(ctx.job, { db: ctx.db, logger: ctx.logger });
		await w._markInProgress();
		expect(saved.status).toBe("INPROGRESS-RETRYABLE");
		expect(saved.attemptNumber).toBe(5);
	});

	it("base class enforces overrides", async () => {
		const ctx = makeJob();
		const w = new CloudWorker(ctx.job, { db: ctx.db, logger: ctx.logger });
		w.logger = makeLogger();
		expect(() => w.pluginId()).toThrow(/override/);
		await expect(w.performAction()).rejects.toThrow(/override/);
	});
});

describe("SnoozeWorker", () => {
	it("searches the snooze folder by message id and moves results to INBOX", async () => {
		const ctx = makeJob();
		const moves = [];
		const connection = {
			openBox: vi.fn(async () => ({
				search: vi.fn(async () => [9, 10]),
				moveFromBox: (uid) => {
					moves.push(uid);
				},
			})),
		};
		const w = new SnoozeWorker(ctx.job, { db: ctx.db, logger: ctx.logger });
		w.logger = makeLogger();
		await w.performAction({
			metadatum: { value: { header: "<x@y>" } },
			connection,
		});
		expect(connection.openBox).toHaveBeenCalledWith("N1-Snoozed");
		expect(moves).toEqual([9, 10]);
	});

	it("refuses to unsnooze without a message-id header", async () => {
		const ctx = makeJob();
		const w = new SnoozeWorker(ctx.job, { db: ctx.db, logger: ctx.logger });
		w.logger = makeLogger();
		await expect(
			w.performAction({ metadatum: { value: {} }, connection: {} }),
		).rejects.toThrow(/message-id-header/);
	});
});
