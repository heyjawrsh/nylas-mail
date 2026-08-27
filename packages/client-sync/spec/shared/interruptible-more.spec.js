import { describe, it, expect, vi } from "vitest";
import Interruptible from "../../src/shared/interruptible.js";

describe("Interruptible additional behavior", () => {
	it("returns the generator result and passes context and arguments", async () => {
		const context = { prefix: "result" };
		function* work(value) {
			const nested = yield (function* () {
				return yield Promise.resolve(value);
			})();
			yield undefined;
			return `${this.prefix}-${nested}`;
		}
		await expect(new Interruptible().run(work, context, 7)).resolves.toBe(
			"result-7",
		);
	});

	it("rejects non-generators and errors thrown by generators", async () => {
		await expect(new Interruptible().run(() => null)).rejects.toThrow(
			/generator function/,
		);
		await expect(
			new Interruptible().run(function* () {
				throw new Error("boom");
			}),
		).rejects.toThrow("boom");
	});

	it("interrupt before running is a resolved no-op", async () => {
		await expect(new Interruptible().interrupt()).resolves.toBeUndefined();
	});

	it("stops at the next yield and emits interrupted", async () => {
		let release;
		const gate = new Promise((resolve) => {
			release = resolve;
		});
		const instance = new Interruptible();
		const listener = vi.fn();
		instance.on("interrupted", listener);
		const run = instance.run(function* () {
			yield gate;
			throw new Error("should not continue");
		});
		const interrupted = instance.interrupt();
		release();
		await expect(run).resolves.toBeUndefined();
		await expect(interrupted).resolves.toBeUndefined();
		expect(listener).toHaveBeenCalledOnce();
	});
});
