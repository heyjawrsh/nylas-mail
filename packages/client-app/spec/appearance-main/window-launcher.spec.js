import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

// Bundles are build output, absent in worktrees. Only resolve the path; never boot it.
const hooks = registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier.endsWith("/secondary-window-bootstrap.bundle.js")) {
			return {
				url: pathToFileURL(
					path.resolve("spec/appearance-main/window-launcher.spec.js"),
				).href,
				shortCircuit: true,
			};
		}
		return nextResolve(specifier, context);
	},
});
afterAll(() => hooks.deregister());
vi.mock("../../src/browser/nylas-window.js", () => ({
	default: class NylasWindow {
		constructor(options) {
			this.options = options;
			this.windowKey = options.windowKey || "hot";
			this.browserWindow = { setBackgroundColor: vi.fn(), on: vi.fn() };
		}
		loadSettings() {
			return this.options;
		}
		setLoadSettings = vi.fn((settings) => {
			this.options = settings;
		});
		showWhenLoaded = vi.fn();
	},
}));

import WindowLauncher from "../../src/browser/window-launcher.js";
import WindowManager from "../../src/browser/window-manager.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

function setup(specMode = false) {
	let mode = "light";
	const config = { get: () => ({ mode }) };
	const themeLibrary = {
		windowLook: vi.fn(() => ({
			attributes: { "data-variant": mode },
			backgroundColor: mode === "light" ? "#f6f6f6" : "#333539",
			signals: { revision: 0 },
			revision: 0,
		})),
	};
	const onCreatedHotWindow = vi.fn();
	const launcher = new WindowLauncher({
		config,
		themeLibrary,
		onCreatedHotWindow,
		specMode,
	});
	return {
		launcher,
		config,
		themeLibrary,
		onCreatedHotWindow,
		dark: () => {
			mode = "dark";
		},
	};
}

describe("window appearance at launch", () => {
	it("resolves the preloaded hot window before it is registered", () => {
		const { launcher, themeLibrary, config, onCreatedHotWindow } = setup();
		expect(themeLibrary.windowLook).toHaveBeenCalledWith(config);
		expect(launcher.hotWindow.options).toMatchObject({
			packageLoadingDeferred: true,
			appearance: {
				attributes: { "data-variant": "light" },
				backgroundColor: "#f6f6f6",
			},
		});
		expect(onCreatedHotWindow).toHaveBeenCalledWith(launcher.hotWindow);
	});

	it("resolves every cold window, overriding stale caller appearance", () => {
		const { launcher, dark } = setup(true);
		dark();
		const win = launcher.newWindow({
			coldStartOnly: true,
			windowType: "work",
			hidden: true,
			appearance: { backgroundColor: "old" },
		});
		expect(win.options.appearance.backgroundColor).toBe("#333539");
	});

	it("refreshes appearance and background before populating a reused hot window", () => {
		const { launcher, dark } = setup();
		const hot = launcher.hotWindow;
		dark();
		const win = launcher.newWindow({ windowType: "composer" });
		expect(win).toBe(hot);
		expect(win.setLoadSettings).toHaveBeenCalledWith(
			expect.objectContaining({
				windowType: "composer",
				packageLoadingDeferred: true,
				appearance: expect.objectContaining({ backgroundColor: "#333539" }),
			}),
		);
		expect(win.browserWindow.setBackgroundColor).toHaveBeenCalledWith(
			"#333539",
		);
		expect(
			win.browserWindow.setBackgroundColor.mock.invocationCallOrder[0],
		).toBeLessThan(win.setLoadSettings.mock.invocationCallOrder[0]);
		vi.runOnlyPendingTimers();
		expect(launcher.hotWindow).not.toBe(win);
		expect(launcher.hotWindow.options.appearance.backgroundColor).toBe(
			"#333539",
		);
	});

	it("passes the supplied library through WindowManager before creating its hot window", () => {
		const { themeLibrary, config } = setup(true);
		vi.stubGlobal("application", {
			applicationMenu: { addWindow: vi.fn() },
		});
		const manager = new WindowManager({ config, themeLibrary });
		expect(manager.windowLauncher.themeLibrary).toBe(themeLibrary);
		expect(
			manager.windowLauncher.hotWindow.options.appearance.backgroundColor,
		).toBe("#f6f6f6");
		expect(Object.values(manager._windows)).toContain(
			manager.windowLauncher.hotWindow,
		);
	});
});
