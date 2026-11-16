import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

// Run the CommonJS constructor with a shell double, preserving URL and hot-window logic.
function loadWindow() {
	const filename = path.resolve("src/browser/nylas-window.js");
	const realRequire = createRequire(filename);
	class BrowserWindow extends EventEmitter {
		constructor(options) {
			super();
			this.options = options;
			this.webContents = { send: vi.fn(), on: vi.fn() };
		}
		loadURL = vi.fn();
	}
	const require = (id) => {
		if (id === "electron")
			return { BrowserWindow, app: { getVersion: () => "test" } };
		if (id === "@electron/remote/main") return { enable() {} };
		if (id === "fs-plus")
			return { statSyncNoException: () => null, existsSync: () => true };
		return realRequire(id);
	};
	const module = { exports: {} };
	new Function(
		"require",
		"module",
		"__dirname",
		fs.readFileSync(filename, "utf8"),
	)(require, module, path.dirname(filename));
	return module.exports;
}

describe("NylasWindow appearance", () => {
	it("sets the first-frame surface and serializes the resolved look into load settings", () => {
		const NylasWindow = loadWindow();
		const appearance = {
			attributes: { "data-look": "", "data-variant": "dark" },
			backgroundColor: "#333539",
			signals: { revision: 0 },
			revision: 2,
		};
		const win = new NylasWindow({
			resourcePath: "/resources",
			windowType: "composer",
			appearance,
		});
		expect(win.browserWindow.options.backgroundColor).toBe(
			appearance.backgroundColor,
		);
		expect(win.loadSettings().appearance).toEqual(appearance);
		const url = new URL(win.browserWindow.loadURL.mock.calls[0][0]);
		expect(JSON.parse(url.searchParams.get("loadSettings")).appearance).toEqual(
			appearance,
		);
		expect(JSON.parse(url.searchParams.get("loadSettings"))).not.toHaveProperty(
			"windowState",
		);
	});

	it("preserves the delayed hot-window load-settings replay", () => {
		const NylasWindow = loadWindow();
		const win = new NylasWindow({
			resourcePath: "/resources",
			packageLoadingDeferred: true,
		});
		const settings = {
			...win.loadSettings(),
			appearance: { backgroundColor: "#333539" },
		};
		win.setLoadSettings(settings);
		expect(win.browserWindow.loadSettingsChangedSinceGetURL).toBe(true);
		win.browserWindow.emit("window:loaded");
		expect(win.browserWindow.webContents.send).toHaveBeenLastCalledWith(
			"load-settings-changed",
			settings,
		);
		expect(win.loadSettings().packageLoadingDeferred).toBe(true);
	});
});
