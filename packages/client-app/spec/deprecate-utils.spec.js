import { describe, it, expect, vi, beforeEach } from "vitest";
import DeprecateUtils from "../src/deprecate-utils.js";

describe("DeprecateUtils", () => {
	beforeEach(() => {
		globalThis.NylasEnv = {
			inDevMode: () => true,
			inSpecMode: () => false,
		};
	});

	it("parseStack strips frames down to location strings", () => {
		const stack = DeprecateUtils.parseStack(
			"Error: wat\n    at Object.foo (/app/src/x.js:10:5)\n    at /app/src/y.js:2:1",
		);
		expect(stack[0]).toContain("/app/src/x.js:10:5");
		expect(stack[1]).toBe("/app/src/y.js:2:1");
	});

	it("warn only prints when the condition holds", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		DeprecateUtils.warn(false, "nope");
		expect(warn).not.toHaveBeenCalled();
		DeprecateUtils.warn(true, "yep");
		expect(warn).toHaveBeenCalledWith("yep");
		warn.mockRestore();
	});

	it("deprecate wraps the function and warns exactly once in dev mode", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const ctx = {};
		const fn = (a, b) => a + b;
		const wrapped = DeprecateUtils.deprecate("oldName", "newName", ctx, fn);
		expect(wrapped(1, 2)).toBe(3);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toContain("oldName is deprecated");
		wrapped(3, 4);
		expect(warn).toHaveBeenCalledTimes(1); // only once per site
		warn.mockRestore();
	});

	it("deprecate returns the original function in spec mode", () => {
		globalThis.NylasEnv = { inDevMode: () => true, inSpecMode: () => true };
		const fn = () => "ok";
		expect(DeprecateUtils.deprecate("a", "b", null, fn)).toBe(fn);
	});
});
