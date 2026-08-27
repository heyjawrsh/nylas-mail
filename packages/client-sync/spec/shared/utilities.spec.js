import { Readable } from "node:stream";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ImapPaths from "../../src/shared/imap-paths-utils.js";
import { QuotedPrintableStreamDecoder } from "../../src/shared/stream-decoders.js";
import SyncActivity from "../../src/shared/sync-activity.js";
import shimSequelize from "../../src/shared/shim-sequelize.js";
import TransactionConnector from "../../src/shared/transaction-connector.js";
import { createLogger } from "../../src/shared/logger.js";

describe("shared utilities", () => {
	it("normalizes Gmail paths and rejects empty paths", () => {
		expect(ImapPaths.formatImapPath("[Gmail]/Sent Mail")).toBe("Sent Mail");
		expect(ImapPaths.formatImapPath("INBOX")).toBe("INBOX");
		expect(() => ImapPaths.formatImapPath("")).toThrow(/empty path/i);
	});

	it("buffers and decodes quoted-printable streams", async () => {
		const decoder = new QuotedPrintableStreamDecoder({ charset: "utf-8" });
		const chunks = [];
		decoder.on("data", (chunk) => chunks.push(chunk));
		await new Promise((resolve, reject) => {
			Readable.from(["hello=20", "world=21"])
				.pipe(decoder)
				.on("end", resolve)
				.on("error", reject);
		});
		expect(Buffer.concat(chunks).toString()).toBe("hello world!");
	});

	it("records activity independently per account", () => {
		vi.spyOn(Date, "now").mockReturnValue(1234);
		SyncActivity.reportSyncActivity("a", "fetching");
		expect(SyncActivity.getLastSyncActivityForAccount("a")).toEqual({
			time: 1234,
			activity: "fetching",
		});
		expect(SyncActivity.getLastSyncActivityForAccount("missing")).toEqual({});
		expect(SyncActivity.getLastSyncActivity()).toMatchObject({
			a: { activity: "fetching" },
		});
		vi.restoreAllMocks();
	});

	describe("sequelize timeout shim", () => {
		beforeEach(() => vi.useFakeTimers());
		afterEach(() => vi.useRealTimers());

		it("preserves sync methods, skips private fields, and resolves promises", async () => {
			class Model {
				instance(value) {
					return Promise.resolve(value);
				}
			}
			Model.staticMethod = (value) => value + 1;
			Model._private = vi.fn();
			shimSequelize({ Model });
			expect(Model.staticMethod(1)).toBe(2);
			await expect(new Model().instance("ok")).resolves.toBe("ok");
			expect(Model._private).not.toHaveBeenCalled();
		});

		it("rejects hung model calls after one minute", async () => {
			class Model {
				hung() {
					return new Promise(() => {});
				}
			}
			shimSequelize({ Model });
			const result = new Model().hung();
			// Attach the rejection handler immediately so the timer's rejection
			// is never "unhandled" between advance and assert.
			const assertion = expect(result).rejects.toThrow("hung timed out");
			await vi.advanceTimersByTimeAsync(60_000);
			await assertion;
			vi.useRealTimers();
		});
	});

	it("publishes account transactions and unsubscribes cleanly", () => {
		const next = vi.fn();
		const subscription =
			TransactionConnector.getObservableForAccountId("acct").subscribe(next);
		TransactionConnector.notifyDelta("acct", { id: 1 });
		TransactionConnector.notifyDelta("other", { id: 2 });
		expect(next).toHaveBeenCalledWith({ id: 1 });
		subscription.unsubscribe();
		TransactionConnector.notifyDelta("acct", { id: 3 });
		expect(next).toHaveBeenCalledTimes(1);
	});

	it("creates cached, contextual child loggers", () => {
		const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const logger = createLogger();
		const account = { id: "a1", emailAddress: "a@example.com" };
		expect(logger.forAccount(account)).toBe(logger.forAccount(account));
		logger.forAccount(account).child({ phase: "sync" }).info("hello", 2);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("<a@example.com>"),
			expect.stringContaining("color:"),
			"color: #333333",
			2,
			{ phase: "sync" },
		);
		expect(() => logger.child("bad")).toThrow(/must be an object/i);
		logSpy.mockRestore();
	});

	it("logs object-first and unprefixed messages", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		createLogger().warn({ code: 1 }, "after");
		expect(warn).toHaveBeenCalledWith("after", { code: 1 }, "");
		warn.mockRestore();
	});
});
