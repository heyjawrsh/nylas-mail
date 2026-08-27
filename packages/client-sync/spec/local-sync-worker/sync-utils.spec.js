import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Errors, IMAPErrors } from "isomorphic-core";
import { APIError, NylasAPIRequest } from "nylas-exports";
import SyncUtils, {
	localizedCategoryNames,
} from "../../src/local-sync-worker/sync-utils.js";

describe("sync-utils", () => {
	const logger = { warn: vi.fn(), error: vi.fn() };

	beforeEach(() => {
		vi.useFakeTimers();
		vi.restoreAllMocks();
		logger.warn.mockClear();
		logger.error.mockClear();
		globalThis.NylasAPI = { PermanentErrorCodes: [400, 401, 403, 404] };
	});
	afterEach(() => vi.useRealTimers());

	it("contains common localized category names", () => {
		expect(localizedCategoryNames.trash.has("[gmail]/trash")).toBe(true);
		expect(localizedCategoryNames.spam.has("junk")).toBe(true);
		expect(localizedCategoryNames.sent.has("sent items")).toBe(true);
		expect(SyncUtils.localizedCategoryNames).toBe(localizedCategoryNames);
	});

	it("does not refresh a valid access token", async () => {
		vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
		const account = {
			decryptedCredentials: () => ({ expiry_date: Date.now() / 1000 + 100 }),
		};
		await expect(
			SyncUtils.ensureGmailAccessToken({ account, logger }),
		).resolves.toBeNull();
	});

	it("refreshes expired credentials and saves them", async () => {
		const credentials = { access_token: "new" };
		vi.spyOn(NylasAPIRequest.prototype, "run").mockResolvedValue(credentials);
		const account = {
			emailAddress: "a@example.com",
			decryptedCredentials: () => ({ expiry_date: 0 }),
			setCredentials: vi.fn(),
			save: vi.fn().mockResolvedValue(),
		};
		await expect(
			SyncUtils.ensureGmailAccessToken({ account, logger }),
		).resolves.toBe(credentials);
		expect(account.setCredentials).toHaveBeenCalledWith(credentials);
		expect(account.save).toHaveBeenCalledOnce();
	});

	it("reports and rethrows unknown refresh failures", async () => {
		const account = { decryptedCredentials: () => null };
		const rejection = await SyncUtils.ensureGmailAccessToken({
			account,
			logger,
		}).then(
			() => {
				throw new Error("should have rejected");
			},
			(err) => err,
		);
		expect(rejection.message).toMatch(
			/Unknown error when refreshing access token.*no IMAP connection credentials/i,
		);
		expect(NylasEnv.reportError).toHaveBeenCalled();
	});

	it("maps retryable and permanent API failures to authentication errors", async () => {
		const account = {
			decryptedCredentials: () => ({ expiry_date: 0 }),
			emailAddress: "a",
		};
		const transient = new APIError("server");
		transient.statusCode = 503;
		vi.spyOn(NylasAPIRequest.prototype, "run").mockRejectedValueOnce(transient);
		await expect(
			SyncUtils.ensureGmailAccessToken({ account, logger }),
		).rejects.toBeInstanceOf(IMAPErrors.IMAPTransientAuthenticationError);
		const permanent = new APIError("denied");
		permanent.statusCode = 401;
		vi.spyOn(NylasAPIRequest.prototype, "run").mockRejectedValueOnce(permanent);
		await expect(
			SyncUtils.ensureGmailAccessToken({ account, logger }),
		).rejects.toBeInstanceOf(IMAPErrors.IMAPAuthenticationError);
	});

	it("resolves immediately on success", async () => {
		await expect(
			SyncUtils.runWithRetryLogic({
				run: vi.fn().mockResolvedValue("done"),
				onRetryableError: vi.fn(),
			}),
		).resolves.toBe("done");
	});

	it("rejects non-retryable errors", async () => {
		const error = new Error("fatal");
		await expect(
			SyncUtils.runWithRetryLogic({
				run: vi.fn().mockRejectedValue(error),
				onRetryableError: vi.fn(),
			}),
		).rejects.toBe(error);
	});

	it("schedules retryable errors using the scheduler", async () => {
		const run = vi
			.fn()
			.mockRejectedValueOnce(new Errors.RetryableError("again"))
			.mockResolvedValueOnce("ok");
		const retryScheduler = {
			nextDelay: vi.fn(),
			currentDelay: vi.fn(() => 25),
		};
		const onRetryableError = vi.fn().mockResolvedValue();
		const result = SyncUtils.runWithRetryLogic({
			run,
			retryScheduler,
			onRetryableError,
		});
		await vi.advanceTimersByTimeAsync(25);
		await expect(result).resolves.toBe("ok");
		expect(onRetryableError).toHaveBeenCalledWith(
			expect.any(Errors.RetryableError),
			25,
		);
		expect(retryScheduler.nextDelay).toHaveBeenCalledOnce();
	});

	it("halts retries when the retry callback throws", async () => {
		const halt = new Error("halt");
		const result = SyncUtils.runWithRetryLogic({
			run: vi.fn().mockRejectedValue(new Errors.RetryableError("again")),
			onRetryableError: vi.fn().mockRejectedValue(halt),
		});
		await expect(result).rejects.toBe(halt);
	});
});
