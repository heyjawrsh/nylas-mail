import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLookRuntime, applyLookAttributes } from "../../src/appearance/look-runtime/commit-queue.js";
import { resolveLook } from "../../src/appearance/look-runtime/resolve-look";
import { DEFAULT_SIGNALS } from "../../src/appearance/look-runtime/defaults";
import classic from "../../static/themes/classic.descriptor.json";

const deferred = () => {
	let resolve;
	let reject;
	const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
};

describe("look commit queue", () => {
	let root;
	let runtime;
	let shell;
	let flush;
	beforeEach(() => {
		root = document.createElement("section");
		document.body.appendChild(root);
		const state = { applied: {}, signals: DEFAULT_SIGNALS, library: { themes: { classic }, styles: ["classic"] } };
		applyLookAttributes(root, resolveLook(state.applied, {}, state.signals, state.library));
		shell = { setWindowChrome: vi.fn() };
		flush = vi.fn();
		runtime = createLookRuntime({ root, state, shell, flush });
	});
	afterEach(() => {
		root.remove();
		vi.restoreAllMocks();
		delete document.fonts;
		delete document.startViewTransition;
	});

	it("serialises commits and coalesces all pending callers with latest values", async () => {
		const gate = deferred();
		flush.mockImplementationOnce(() => gate.promise);
		const changed = vi.fn();
		runtime.onLookChanged(changed);
		const first = runtime.commit({ applied: { mode: "dark" } });
		const second = runtime.commit({ applied: { density: "compact", mode: "light" } });
		const third = runtime.commit({ applied: { density: "spacious" } });
		const fourth = runtime.commit({ signals: { reducedMotion: true } });
		expect(root.getAttribute("data-variant")).toBe("dark");
		expect(flush).toHaveBeenCalledTimes(1);
		expect(shell.setWindowChrome).not.toHaveBeenCalled();
		gate.resolve();
		const [a, b, c, d] = await Promise.all([first, second, third, fourth]);
		expect(a["data-variant"]).toBe("dark");
		expect(b).toEqual(c);
		expect(c).toEqual(d);
		expect(d).toMatchObject({ "data-variant": "light", "data-density": "spacious", "data-reduced-motion": "" });
		expect(flush).toHaveBeenCalledTimes(2);
		expect(changed).toHaveBeenCalledTimes(2);
		expect(runtime.current).toBe(d);
	});

	it("rejects only the failing batch and continues with pending changes", async () => {
		const gate = deferred();
		flush.mockImplementationOnce(() => gate.promise);
		const first = runtime.commit({ applied: { mode: "dark" } });
		const failed = expect(first).rejects.toThrow("flush failed");
		const next = runtime.commit({ applied: { density: "compact" } });
		gate.reject(new Error("flush failed"));
		await failed;
		await expect(next).resolves.toMatchObject({ "data-variant": "dark", "data-density": "compact" });
		expect(shell.setWindowChrome).toHaveBeenCalledTimes(1);
	});

	it("rejects every caller in a failed coalesced batch and accepts later work", async () => {
		const gate = deferred();
		flush.mockImplementationOnce(() => gate.promise).mockImplementationOnce(() => { throw new Error("bad batch"); });
		const first = runtime.commit({});
		const second = runtime.commit({ applied: { mode: "dark" } });
		const third = runtime.commit({ applied: { density: "compact" } });
		const failures = Promise.all([expect(second).rejects.toThrow("bad batch"), expect(third).rejects.toThrow("bad batch")]);
		gate.resolve();
		await first;
		await failures;
		await expect(runtime.commit({ applied: { mode: "light" } })).resolves.toMatchObject({ "data-density": "compact" });
	});

	it("changes only differing attributes and removes absent flags without touching other attributes", async () => {
		root.setAttribute("dir", "rtl");
		root.setAttribute("data-reflow", "narrow");
		const set = vi.spyOn(root, "setAttribute");
		const remove = vi.spyOn(root, "removeAttribute");
		await runtime.commit({});
		expect(set).not.toHaveBeenCalled();
		expect(remove).not.toHaveBeenCalled();
		await runtime.commit({ applied: { increaseContrast: "on" }, signals: { reducedMotion: true, reducedTransparency: true } });
		expect(set.mock.calls.map(([name]) => name)).toEqual(["data-increased-contrast", "data-reduced-motion", "data-reduced-transparency"]);
		await runtime.commit({ signals: { forcedColors: true } });
		expect(root.hasAttribute("data-increased-contrast")).toBe(false);
		expect(root.hasAttribute("data-forced-colors")).toBe(true);
		await runtime.commit({ applied: { increaseContrast: "off" }, signals: DEFAULT_SIGNALS });
		for (const flag of ["data-increased-contrast", "data-forced-colors", "data-reduced-motion", "data-reduced-transparency"]) expect(root.hasAttribute(flag)).toBe(false);
		expect(root.getAttribute("dir")).toBe("rtl");
		expect(root.getAttribute("data-reflow")).toBe("narrow");
	});

	it("awaits fonts, then hooks, flush, chrome and look-changed before resolving", async () => {
		const font = deferred();
		const hook = deferred();
		const order = [];
		Object.defineProperty(document, "fonts", { configurable: true, value: { load: vi.fn(() => { order.push("font"); return font.promise; }) } });
		root.style.font = '18px "Test Font"';
		runtime.beforeFlush(async (attrs) => { expect(attrs["data-font"]).toBe("custom"); order.push("hook"); await hook.promise; });
		flush.mockImplementation(() => order.push("flush"));
		shell.setWindowChrome.mockImplementation(() => order.push("chrome"));
		runtime.onLookChanged(() => order.push("look-changed"));
		const done = runtime.commit({ applied: { font: "custom" } }).then(() => order.push("resolved"));
		expect(root.getAttribute("data-font")).toBe("custom");
		expect(document.fonts.load).toHaveBeenCalledWith(expect.stringContaining("Test Font"));
		expect(order).toEqual(["font"]);
		font.resolve();
		await Promise.resolve();
		expect(order).toEqual(["font", "hook"]);
		hook.resolve();
		await done;
		expect(order).toEqual(["font", "hook", "flush", "chrome", "look-changed", "resolved"]);
		await runtime.commit({ applied: { mode: "dark" } });
		expect(document.fonts.load).toHaveBeenCalledTimes(1);
	});

	it("disposes hook and look-changed subscriptions", async () => {
		const hook = vi.fn(); const listener = vi.fn();
		runtime.beforeFlush(hook).dispose();
		runtime.onLookChanged(listener).dispose();
		await runtime.commit({});
		expect(hook).not.toHaveBeenCalled();
		expect(listener).not.toHaveBeenCalled();
	});

	it("waits for transition completion before starting queued work", async () => {
		const animation = deferred();
		document.startViewTransition = vi.fn((update) => ({ ready: Promise.resolve(), updateCallbackDone: update(), finished: animation.promise }));
		const first = runtime.commit({ applied: { mode: "dark" } }, { transition: true });
		const next = runtime.commit({ applied: { mode: "light" } });
		await vi.waitFor(() => expect(shell.setWindowChrome).toHaveBeenCalledTimes(1));
		expect(root.getAttribute("data-variant")).toBe("dark");
		animation.resolve();
		await Promise.all([first, next]);
		expect(document.startViewTransition).toHaveBeenCalledTimes(1);
		expect(root.getAttribute("data-variant")).toBe("light");
	});

	it("bypasses transitions for reduced motion and tolerates browsers without the API", async () => {
		await runtime.commit({ applied: { mode: "dark" } }, { transition: true });
		document.startViewTransition = vi.fn();
		await runtime.commit({ signals: { reducedMotion: true } }, { transition: true });
		expect(document.startViewTransition).not.toHaveBeenCalled();
	});

	it("uses React flushSync by default", async () => {
		const defaultRuntime = createLookRuntime({ root, state: { applied: {}, signals: DEFAULT_SIGNALS }, shell });
		await expect(defaultRuntime.commit({ applied: { mode: "dark" } })).resolves.toMatchObject({ "data-variant": "dark" });
	});
});
