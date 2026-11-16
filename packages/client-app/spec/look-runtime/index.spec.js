import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ipc = vi.hoisted(() => ({
	on: vi.fn(),
	removeListener: vi.fn(),
	invoke: vi.fn(),
	send: vi.fn(),
}));
vi.mock("electron", () => ({ ipcRenderer: ipc }));
import {
	installLookRuntime,
	BUILTIN_LIBRARY,
} from "../../src/appearance/look-runtime/index.js";
import { applyLookAttributes } from "../../src/appearance/look-runtime/commit-queue.js";
import { resolveLook } from "../../src/appearance/look-runtime/resolve-look";
import {
	DEFAULTS,
	DEFAULT_SIGNALS,
} from "../../src/appearance/look-runtime/defaults";
import * as shell from "../../src/appearance/shell-client.js";

const appearance = (applied = {}, signals = DEFAULT_SIGNALS, revision = 0) => ({
	signals,
	revision,
	attributes: resolveLook(applied, {}, signals, BUILTIN_LIBRARY),
	backgroundColor: "#f6f6f6",
});
const emit = (channel, payload) =>
	ipc.on.mock.calls.findLast(([name]) => name === channel)[1]({}, payload);
const snapshot = (revision = 0) => ({
	revision,
	descriptors: [BUILTIN_LIBRARY.themes.classic],
	themesFolder: { exists: true, writable: true },
});

describe("window look sources", () => {
	let env;
	let runtime;
	let receiveSnapshot;
	let configChanged;
	beforeEach(() => {
		vi.clearAllMocks();
		ipc.invoke.mockImplementation(
			() =>
				new Promise((resolve) => {
					receiveSnapshot = resolve;
				}),
		);
		const initial = appearance({ mode: "dark" });
		applyLookAttributes(document.documentElement, initial.attributes);
		env = {
			getLoadSettings: () => ({
				appearance: initial,
				packageLoadingDeferred: true,
			}),
			config: {
				get: vi.fn(() => undefined),
				set: vi.fn(),
				onDidChange: vi.fn((_key, callback) => {
					configChanged = callback;
					return { dispose: vi.fn() };
				}),
			},
		};
		runtime = installLookRuntime(env);
	});
	afterEach(async () => {
		receiveSnapshot(snapshot());
		await runtime.ready;
		runtime.dispose();
		vi.restoreAllMocks();
	});

	it("subscribes before invoke, installs once, and preserves main's first paint", async () => {
		expect(ipc.on.mock.invocationCallOrder[0]).toBeLessThan(
			ipc.invoke.mock.invocationCallOrder[0],
		);
		expect(ipc.invoke).toHaveBeenCalledWith("get-theme-library");
		expect(installLookRuntime(env)).toBe(runtime);
		expect(ipc.invoke).toHaveBeenCalledTimes(1);
		expect(runtime.current["data-variant"]).toBe("dark");
		expect(document.documentElement.getAttribute("data-variant")).toBe("dark");
		receiveSnapshot(snapshot());
		await runtime.ready;
		expect(runtime.current["data-variant"]).toBe("light");
		expect(env.config.set).not.toHaveBeenCalled();
	});

	it("accepts an equal-revision initial snapshot with descriptors", async () => {
		await configChanged({ newValue: { theme: "test" } });
		receiveSnapshot({
			...snapshot(),
			descriptors: [
				...snapshot().descriptors,
				{ id: "test", status: "ok", variants: ["light", "dark"] },
			],
		});
		await runtime.ready;
		expect(runtime.current["data-theme"]).toBe("test");
	});

	it("drops stale and duplicate events and a snapshot older than an event", async () => {
		await configChanged({ newValue: { theme: "test" } });
		const changed = vi.fn();
		runtime.onLookChanged(changed);
		await emit("theme-changed", {
			id: "test",
			status: "ok",
			revision: 3,
			variants: ["light", "dark"],
		});
		expect(runtime.current["data-theme"]).toBe("test");
		await emit("theme-changed", {
			id: "test",
			status: "unavailable",
			revision: 2,
		});
		await emit("theme-changed", {
			id: "test",
			status: "unavailable",
			revision: 3,
		});
		receiveSnapshot(snapshot(1));
		await runtime.ready;
		expect(runtime.current["data-theme"]).toBe("test");
		expect(changed).toHaveBeenCalledTimes(1);
		await emit("theme-changed", {
			id: "test",
			status: "unavailable",
			revision: 4,
		});
		expect(runtime.current["data-theme"]).toBe("classic");
		expect(env.config.set).not.toHaveBeenCalled();
	});

	it("applies config events including key removal without writing config or listening to reload IPC", async () => {
		expect(env.config.onDidChange).toHaveBeenCalledWith(
			"core.appearance",
			expect.any(Function),
		);
		await configChanged({
			newValue: { ...DEFAULTS, mode: "light", density: "compact" },
		});
		expect(runtime.current).toMatchObject({
			"data-variant": "light",
			"data-density": "compact",
		});
		await configChanged({ newValue: undefined });
		expect(runtime.current).toMatchObject({
			"data-variant": "light",
			"data-density": "comfortable",
		});
		expect(ipc.on.mock.calls.map(([channel]) => channel)).not.toContain(
			"on-config-reloaded",
		);
		expect(env.config.set).not.toHaveBeenCalled();
	});

	it("commits hot-window signals through the queue while taking applied values from config", async () => {
		const applied = {
			mode: "light",
			density: "compact",
			increaseContrast: "on",
			textSize: 1.25,
		};
		await configChanged({ newValue: applied });
		const next = appearance(
			applied,
			{ ...DEFAULT_SIGNALS, reducedMotion: true },
			5,
		);
		const changed = vi.fn();
		runtime.onLookChanged(changed);
		const done = emit("load-settings-changed", {
			appearance: next,
			windowType: "composer",
		});
		for (const [key, value] of Object.entries(next.attributes))
			expect(document.documentElement.getAttribute(key)).toBe(value);
		await done;
		expect(runtime.current).toEqual(next.attributes);
		expect(ipc.send).toHaveBeenLastCalledWith(
			"set-window-chrome",
			next.attributes,
		);
		expect(changed).toHaveBeenCalledWith(next.attributes);
		receiveSnapshot(snapshot(1));
		await runtime.ready;
		expect(runtime.current).toEqual(next.attributes);
	});

	it("keeps initial config's unknown theme and Auto/system values through stale composer load settings", async () => {
		receiveSnapshot(snapshot());
		await runtime.ready;
		runtime.dispose();
		const applied = { ...DEFAULTS, theme: "nope" };
		env.config.get.mockReturnValue(applied);
		runtime = installLookRuntime(env);
		expect(env.config.get).toHaveBeenCalledWith("core.appearance");
		receiveSnapshot(snapshot());
		await runtime.ready;
		expect(runtime.current).toMatchObject({
			"data-theme": "classic",
			"data-variant": "light",
		});
		await emit("load-settings-changed", {
			appearance: env.getLoadSettings().appearance,
			windowType: "composer",
		});
		expect(runtime.current).toMatchObject({
			"data-theme": "classic",
			"data-variant": "light",
		});
		await emit("theme-changed", {
			id: "nope",
			status: "ok",
			revision: 1,
			variants: ["light", "dark", "dark-hc"],
		});
		expect(runtime.current["data-theme"]).toBe("nope");
		await emit("load-settings-changed", {
			appearance: {
				signals: { ...DEFAULT_SIGNALS, colorScheme: "dark", contrast: "more" },
			},
		});
		expect(runtime.current).toMatchObject({
			"data-theme": "nope",
			"data-variant": "dark-hc",
			"data-increased-contrast": "",
		});
		expect(env.config.set).not.toHaveBeenCalled();
	});

	it("load-settings revisions do not suppress library events or the snapshot", async () => {
		await configChanged({ newValue: { theme: "test" } });
		await emit("load-settings-changed", {
			appearance: appearance({}, DEFAULT_SIGNALS, 50),
		});
		receiveSnapshot({
			...snapshot(1),
			descriptors: [...snapshot().descriptors, { id: "test", status: "ok" }],
		});
		await runtime.ready;
		expect(runtime.current["data-theme"]).toBe("test");
		await emit("theme-changed", {
			id: "test",
			status: "unavailable",
			revision: 2,
		});
		expect(runtime.current["data-theme"]).toBe("classic");
	});

	it("commits queued theme and config updates together without losing either", async () => {
		let release;
		const gate = new Promise((resolve) => {
			release = resolve;
		});
		const subscription = runtime.beforeFlush(() => gate);
		const first = configChanged({ newValue: { mode: "dark" } });
		const event = emit("theme-changed", {
			id: "test",
			status: "ok",
			revision: 1,
		});
		const config = configChanged({
			newValue: { theme: "test", mode: "light" },
		});
		release();
		await Promise.all([first, event, config]);
		expect(runtime.current).toMatchObject({
			"data-theme": "test",
			"data-variant": "light",
		});
		subscription.dispose();
	});

	it("keeps local errors handled so a later config event still commits", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		ipc.send.mockImplementationOnce(() => {
			throw new Error("chrome failed");
		});
		await configChanged({ newValue: { mode: "light" } });
		expect(error).toHaveBeenCalledWith(
			"Could not update window look",
			expect.any(Error),
		);
		await configChanged({ newValue: { mode: "dark" } });
		expect(runtime.current["data-variant"]).toBe("dark");
	});

	it("disposes IPC subscriptions with their exact listeners", () => {
		const callback = vi.fn();
		const subscription = shell.onThemeChanged(callback);
		const listener = ipc.on.mock.lastCall[1];
		listener({}, { revision: 8 });
		expect(callback).toHaveBeenCalledWith({ revision: 8 });
		subscription.dispose();
		expect(ipc.removeListener).toHaveBeenCalledWith("theme-changed", listener);
	});
});
