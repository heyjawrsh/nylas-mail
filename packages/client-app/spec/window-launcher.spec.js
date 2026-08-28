import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	class FakeNylasWindow {
		constructor(options) {
			this.options = options; this.settings = { ...options }; this.browserWindow = { setBounds: vi.fn(), setSize: vi.fn(), destroy: vi.fn() };
			this.loadSettings = vi.fn(() => this.settings); this.setLoadSettings = vi.fn((value) => { this.settings = value; }); this.showWhenLoaded = vi.fn();
			m.instances.push(this);
		}
	}
	return { instances: [], FakeNylasWindow, resolve: vi.fn((id) => `/resolved/${id}`) };
});

vi.mock("node:module", () => {
	const createRequire = () => Object.assign(vi.fn(), { resolve: m.resolve });
	return { default: { createRequire }, createRequire };
});
vi.mock("../src/browser/nylas-window.js", () => ({ default: m.FakeNylasWindow }));

const { default: WindowLauncher } = await import("../src/browser/window-launcher.js");
const makeLauncher = (overrides = {}) => new WindowLauncher({ devMode: true, benchmarkMode: false, safeMode: true, specMode: true, resourcePath: "/app", configDirPath: "/config", onCreatedHotWindow: vi.fn(), config: {}, ...overrides });

describe("WindowLauncher", () => {
	beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); m.instances.length = 0; });

	it("builds reusable default window options", () => { const launcher = makeLauncher(); expect(launcher.defaultWindowOpts).toMatchObject({ hidden: false, toolbar: true, devMode: true, safeMode: true, benchmarkMode: false, resizable: true, windowType: "emptyWindow", resourcePath: "/app", configDirPath: "/config" }); });
	it("resolves the secondary-window bootstrap script", () => { const launcher = makeLauncher(); expect(launcher.defaultWindowOpts.bootstrapScript).toContain("secondary-window-bootstrap.bundle.js"); });
	it("does not prewarm a window in spec mode", () => { makeLauncher(); expect(m.instances).toHaveLength(0); });
	it("prewarms a window outside spec mode", () => { makeLauncher({ specMode: false }); expect(m.instances).toHaveLength(1); });
	it("reports each newly created hot window", () => { const callback = vi.fn(); const launcher = makeLauncher({ onCreatedHotWindow: callback }); launcher.createHotWindow(); expect(callback).toHaveBeenCalledWith(m.instances[0]); });

	it("marks hot windows for deferred package loading", () => { const launcher = makeLauncher(); launcher.createHotWindow(); expect(m.instances[0].options.packageLoadingDeferred).toBe(true); });
	it("uses a cold window for a different bootstrap script", () => { const launcher = makeLauncher(); expect(launcher._mustUseColdWindow({ ...launcher.defaultWindowOpts, bootstrapScript: "/other.js" })).toBe(true); });
	it("uses a cold window for a different frame style", () => { const launcher = makeLauncher(); expect(launcher._mustUseColdWindow({ ...launcher.defaultWindowOpts, frame: !launcher.defaultWindowOpts.frame })).toBe(true); });
	it("honors an explicit cold-start request", () => { const launcher = makeLauncher(); expect(launcher._mustUseColdWindow({ ...launcher.defaultWindowOpts, coldStartOnly: true })).toBe(true); });
	it("reuses a hot window when immutable options match", () => { const launcher = makeLauncher(); launcher.createHotWindow(); const hot = launcher.hotWindow; expect(launcher.newWindow({ windowType: "composer" })).toBe(hot); });

	it("requires a window type when populating a hot window", () => { const launcher = makeLauncher(); launcher.createHotWindow(); expect(() => launcher.newWindow({})).toThrow("Must specify a windowType"); });
	it("assigns the requested key and type to a reused window", () => { const launcher = makeLauncher(); launcher.createHotWindow(); const win = launcher.newWindow({ windowType: "composer", windowKey: "compose-7" }); expect([win.windowKey, win.windowType]).toEqual(["compose-7", "composer"]); });
	it("restores supplied bounds on a reused window", () => { const launcher = makeLauncher(); launcher.createHotWindow(); const bounds = { x: 5, y: 10, width: 700, height: 500 }; const win = launcher.newWindow({ windowType: "thread", bounds }); expect(win.browserWindow.setBounds).toHaveBeenCalledWith(bounds); });
	it("restores supplied size on a reused window", () => { const launcher = makeLauncher(); launcher.createHotWindow(); const win = launcher.newWindow({ windowType: "thread", width: 700, height: 500 }); expect(win.browserWindow.setSize).toHaveBeenCalledWith(700, 500); });
	it("does not resize unless both dimensions are present", () => { const launcher = makeLauncher(); launcher.createHotWindow(); const win = launcher.newWindow({ windowType: "thread", width: 700 }); expect(win.browserWindow.setSize).not.toHaveBeenCalled(); });
	it("passes merged defaults to the reused renderer", () => { const launcher = makeLauncher(); launcher.createHotWindow(); const win = launcher.newWindow({ windowType: "composer" }); expect(win.setLoadSettings).toHaveBeenCalledWith(expect.objectContaining({ devMode: true, safeMode: true, windowType: "composer" })); });

	it("shows ordinary windows when loaded", () => { const launcher = makeLauncher(); launcher.createHotWindow(); const win = launcher.newWindow({ windowType: "composer" }); expect(win.showWhenLoaded).toHaveBeenCalledOnce(); });
	it("keeps hidden windows hidden", () => { const launcher = makeLauncher(); launcher.createHotWindow(); const win = launcher.newWindow({ windowType: "composer", hidden: true }); expect(win.showWhenLoaded).not.toHaveBeenCalled(); });
	it("keeps background-initialized windows hidden", () => { const launcher = makeLauncher(); launcher.createHotWindow(); const win = launcher.newWindow({ windowType: "composer", initializeInBackground: true }); expect(win.showWhenLoaded).not.toHaveBeenCalled(); });
	it("schedules replacement of a consumed hot window", () => { const launcher = makeLauncher(); launcher.createHotWindow(); launcher.newWindow({ windowType: "composer" }); expect(m.instances).toHaveLength(1); vi.runAllTimers(); expect(m.instances).toHaveLength(2); });
	it("destroys the prewarmed window during cleanup", () => { const launcher = makeLauncher(); launcher.createHotWindow(); const hot = launcher.hotWindow; launcher.cleanupBeforeAppQuit(); expect(hot.browserWindow.destroy).toHaveBeenCalledOnce(); expect(launcher.hotWindow).toBeNull(); });
	it("cleanup is safe before a hot window exists", () => { const launcher = makeLauncher(); expect(() => launcher.cleanupBeforeAppQuit()).not.toThrow(); });
});
