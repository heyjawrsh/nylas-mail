// @vitest-environment node
// The renderer bundle's banner seeds a placeholder NylasEnv for the stores
// built while the bundle evaluates (scripts/build-renderer.js).
import { describe, expect, it, vi } from "vitest";
import { BANNER, RELATIVE_NODE_REQUIRE } from "../scripts/build-renderer.js";

const runBanner = (savedSettings) => {
	const window = { location: { search: "?loadSettings=%7B%22windowType%22%3A%22default%22%7D" } };
	const getRawValuesString = vi.fn(() => {
		if (savedSettings === null) throw new Error("this.settings is empty");
		return JSON.stringify(savedSettings);
	});
	const require = vi.fn((name) => {
		if (name !== "@electron/remote") throw new Error(`unexpected require ${name}`);
		return { getGlobal: () => ({ configPersistenceManager: { getRawValuesString } }) };
	});
	new Function("window", "require", BANNER)(window, require);
	return { window, getRawValuesString };
};

describe("placeholder NylasEnv config", () => {
	it("answers get() from the saved settings, so AccountStore sees the accounts", () => {
		const { window } = runBanner({ nylas: { accounts: [{ id: "a1" }], accountsVersion: 1 } });
		expect(window.NylasEnv.config.get("nylas.accounts")).toEqual([{ id: "a1" }]);
		expect(window.NylasEnv.config.get("nylas.accountsVersion")).toBe(1);
	});

	it("answers null for a missing key", () => {
		const { window } = runBanner({ nylas: {} });
		expect(window.NylasEnv.config.get("nylas.accounts")).toBeNull();
		expect(window.NylasEnv.config.get("core.workspace.mode")).toBeNull();
	});

	it("reads the main process's settings once", () => {
		const { window, getRawValuesString } = runBanner({ a: 1, b: 2 });
		window.NylasEnv.config.get("a");
		window.NylasEnv.config.get("b");
		expect(getRawValuesString).toHaveBeenCalledOnce();
	});

	it("hands out copies, so a store can't change the cached settings", () => {
		const { window } = runBanner({ nylas: { accounts: [{ id: "a1" }] } });
		window.NylasEnv.config.get("nylas.accounts").push({ id: "x" });
		expect(window.NylasEnv.config.get("nylas.accounts")).toEqual([{ id: "a1" }]);
	});

	it("falls back to null when the main process has no settings", () => {
		const { window } = runBanner(null);
		expect(window.NylasEnv.config.get("nylas.accounts")).toBeNull();
	});

	it("records onDidChange and observe subscriptions for the real env to replay", () => {
		const { window } = runBanner({});
		const changed = vi.fn();
		const observed = vi.fn();
		window.NylasEnv.config.onDidChange("nylas.accountsVersion", changed);
		window.NylasEnv.config.observe("core.themes", observed);
		expect(observed).toHaveBeenCalledWith(undefined);
		expect(window.__nylasEarlyConfigSubscriptions).toMatchObject([
			{ method: "onDidChange", args: ["nylas.accountsVersion", changed], disposed: false },
			{ method: "observe", args: ["core.themes", observed], disposed: false },
		]);
	});

	it("marks a disposed subscription and disposes its replayed one", () => {
		const { window } = runBanner({});
		const sub = window.NylasEnv.config.onDidChange("a", vi.fn());
		const [record] = window.__nylasEarlyConfigSubscriptions;
		record.real = { dispose: vi.fn() };
		sub.dispose();
		expect(record.disposed).toBe(true);
		expect(record.real.dispose).toHaveBeenCalledOnce();
	});
});

describe("relative nodeRequire rewrite", () => {
	const rewrite = (source) =>
		source.replace(RELATIVE_NODE_REQUIRE, (_call, args) => `require${args}`);

	it("rewrites a one-line relative nodeRequire", () => {
		expect(rewrite('nodeRequire("./a.js").default')).toBe('require("./a.js").default');
	});

	it("rewrites a wrapped call with the formatter's trailing comma", () => {
		const source = 'nodeRequire(\n\t"./folder-sync-progress-store.js",\n).default';
		expect(rewrite(source)).toBe('require(\n\t"./folder-sync-progress-store.js",\n).default');
	});

	it("leaves bare module names alone", () => {
		expect(rewrite('nodeRequire("keytar")')).toBe('nodeRequire("keytar")');
	});
});
