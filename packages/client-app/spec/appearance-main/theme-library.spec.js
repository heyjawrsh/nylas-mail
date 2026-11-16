import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({
	ipcMain: { handle: vi.fn() },
	nativeTheme: { shouldUseDarkColors: false },
	app: {},
}));
vi.mock("electron", () => electron);

import ThemeLibrary from "../../src/browser/appearance-services/theme-library.js";
import { readThemesFolder } from "../../src/browser/appearance-shell/builtin-themes.js";
import { readSignalsSnapshot } from "../../src/browser/appearance-shell/signals.js";
import { DEFAULT_SIGNALS } from "../../src/appearance/look-runtime/defaults.js";
import WindowManager from "../../src/browser/window-manager.js";

const classic = JSON.parse(
	fs.readFileSync(
		path.resolve("static/themes/classic.descriptor.json"),
		"utf8",
	),
);
const css =
	'[data-look][data-theme="classic"][data-variant="light"] { --surface-app: #f6f6f6; }';
let resourcePath;
let configDirPath;
let library;
const configFor = (appearance) => ({
	get: vi.fn(() => appearance),
	set: vi.fn(),
});

beforeEach(() => {
	electron.ipcMain.handle.mockClear();
	electron.nativeTheme.shouldUseDarkColors = false;
	resourcePath = fs.mkdtempSync(path.join(os.tmpdir(), "nylas-appearance-"));
	configDirPath = path.join(resourcePath, "profile");
	const directory = path.join(resourcePath, "static", "themes");
	fs.mkdirSync(directory, { recursive: true });
	fs.writeFileSync(
		path.join(directory, "classic.descriptor.json"),
		JSON.stringify(classic),
	);
	fs.writeFileSync(path.join(directory, "classic.css"), css);
	library = new ThemeLibrary({ resourcePath, configDirPath });
});

afterEach(() => {
	vi.restoreAllMocks();
	fs.rmSync(resourcePath, { recursive: true, force: true });
});

describe("ThemeLibrary", () => {
	it("loads built-in metadata and CSS synchronously and serves the invoke snapshot", () => {
		expect(library.descriptors()).toEqual([{ ...classic, css }]);
		const [channel, invoke] = electron.ipcMain.handle.mock.calls[0];
		expect(channel).toBe("get-theme-library");
		expect(invoke()).toEqual({
			descriptors: [{ ...classic, css }],
			themesFolder: {
				path: path.join(configDirPath, "themes"),
				exists: false,
				writable: false,
			},
			revision: 0,
		});
		expect(fs.existsSync(configDirPath)).toBe(false);
	});

	it("publishes monotonic revisions and sends the descriptor through the real manager signature", () => {
		const send = vi.fn();
		const manager = Object.create(WindowManager.prototype);
		manager._windows = { hot: { browserWindow: { webContents: { send } } } };
		library.setWindowManager(manager);
		const first = library.publish({ ...classic, css, revision: 500 });
		const second = library.publish({
			...classic,
			css: "updated",
			revision: -1,
		});
		expect(first.revision).toBe(1);
		expect(second.revision).toBe(2);
		expect(send.mock.calls).toEqual([
			["theme-changed", first],
			["theme-changed", second],
		]);
		expect(library.descriptors()).toEqual([second]);
		expect(electron.ipcMain.handle.mock.calls[0][1]()).toMatchObject({
			revision: 2,
			descriptors: [second],
		});
		expect(classic.revision).toBe(0);
	});

	it("can publish before a window manager exists", () => {
		expect(library.publish({ ...classic, css }).revision).toBe(1);
		expect(() => library.repaintWindows(configFor())).not.toThrow();
	});

	it("resolves absent config to Classic light without writing config", () => {
		const config = configFor();
		expect(library.windowLook(config)).toEqual({
			signals: DEFAULT_SIGNALS,
			attributes: {
				"data-look": "",
				"data-theme": "classic",
				"data-variant": "light",
				"data-style": "classic",
				"data-density": "comfortable",
				"data-text-size": "100",
				"data-font": "theme",
			},
			backgroundColor: classic.swatch.light.surface,
			revision: 0,
		});
		expect(config.get).toHaveBeenCalledWith("core.appearance");
		expect(config.set).not.toHaveBeenCalled();
	});

	it("uses dark surface for explicit dark mode and Auto on a dark OS", () => {
		expect(
			library.windowLook(configFor({ mode: "dark" })).backgroundColor,
		).toBe(classic.swatch.dark.surface);
		electron.nativeTheme.shouldUseDarkColors = true;
		expect(library.windowLook(configFor())).toMatchObject({
			attributes: { "data-variant": "dark" },
			backgroundColor: classic.swatch.dark.surface,
		});
		expect(readSignalsSnapshot()).toEqual({
			...DEFAULT_SIGNALS,
			colorScheme: "dark",
			revision: 0,
		});
	});

	it.each(["light", "dark"])(
		"falls back to the standard %s swatch when an hc surface is missing",
		(mode) => {
			library.publish({
				...classic,
				variants: ["light", "dark", "light-hc", "dark-hc"],
				css,
			});
			expect(
				library.windowLook(configFor({ mode, increaseContrast: "on" })),
			).toMatchObject({
				attributes: {
					"data-variant": `${mode}-hc`,
					"data-increased-contrast": "",
				},
				backgroundColor: classic.swatch[mode].surface,
				revision: 1,
			});
		},
	);

	it("uses an hc surface when present", () => {
		library.publish({
			...classic,
			variants: ["light", "dark", "light-hc"],
			swatch: { ...classic.swatch, "light-hc": { surface: "#fff" } },
			css,
		});
		expect(
			library.windowLook(configFor({ increaseContrast: "on" })).backgroundColor,
		).toBe("#fff");
	});

	it("repaints visible, hidden work and hot windows", () => {
		const windows = Object.fromEntries(
			["main", "work", "hot"].map((key) => [
				key,
				{
					browserWindow: { setBackgroundColor: vi.fn() },
				},
			]),
		);
		library.setWindowManager({ _windows: windows });
		library.repaintWindows(configFor({ mode: "dark" }));
		for (const win of Object.values(windows)) {
			expect(
				win.browserWindow.setBackgroundColor,
			).toHaveBeenCalledExactlyOnceWith(classic.swatch.dark.surface);
		}
	});
});

describe("themes folder state", () => {
	it("reports an existing writable directory without creating it", () => {
		const folder = path.join(configDirPath, "themes");
		fs.mkdirSync(folder, { recursive: true });
		expect(readThemesFolder(configDirPath)).toEqual({
			path: folder,
			exists: true,
			writable: true,
		});
	});

	it("reports access failures as unwritable", () => {
		fs.mkdirSync(path.join(configDirPath, "themes"), { recursive: true });
		vi.spyOn(fs, "accessSync").mockImplementation(() => {
			throw new Error("EACCES");
		});
		expect(readThemesFolder(configDirPath)).toMatchObject({
			exists: true,
			writable: false,
		});
	});
});
