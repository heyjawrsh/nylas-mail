import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAllWindows: vi.fn(() => []) }));
vi.mock("electron", () => ({
	app: {},
	dialog: {},
	BrowserWindow: { getAllWindows: mocks.getAllWindows },
}));
vi.mock("fs-plus", () => ({
	default: {
		existsSync: () => true,
		readFileSync: () => '{"*":{}}',
	},
}));
vi.mock("../../src/fs-utils.js", () => ({
	default: { atomicWriteFileSync: vi.fn() },
	atomicWriteFileSync: vi.fn(),
}));

import { atomicWriteFileSync } from "../../src/fs-utils.js";
import ConfigPersistenceManager from "../../src/browser/config-persistence-manager.js";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it("repaints after updating main config, including the source window", () => {
	const config = { updateSettings: vi.fn() };
	const themeLibrary = { repaintWindows: vi.fn() };
	vi.stubGlobal("application", { config, themeLibrary });
	const manager = new ConfigPersistenceManager({
		configDirPath: "/profile",
		resourcePath: "/resources",
	});
	const source = { webContents: { id: 1, send: vi.fn() } };
	const peer = { webContents: { id: 2, send: vi.fn() } };
	mocks.getAllWindows.mockReturnValue([source, peer]);
	vi.clearAllMocks();
	manager.setSettings(
		{ core: { appearance: { mode: "dark" }, themes: ["unchanged"] } },
		1,
	);
	expect(config.updateSettings).toHaveBeenCalledWith(manager.settings);
	expect(themeLibrary.repaintWindows).toHaveBeenCalledExactlyOnceWith(config);
	expect(config.updateSettings.mock.invocationCallOrder[0]).toBeLessThan(
		themeLibrary.repaintWindows.mock.invocationCallOrder[0],
	);
	expect(source.webContents.send).not.toHaveBeenCalled();
	expect(peer.webContents.send).toHaveBeenCalledWith(
		"on-config-reloaded",
		manager.settings,
	);
	expect(manager.settings.core.themes).toEqual(["unchanged"]);
});

it.each(["setSettings", "setRawValue"])(
	"still broadcasts and saves %s when repaint fails",
	(method) => {
		const config = { updateSettings: vi.fn() };
		const failure = new Error("background failed");
		const themeLibrary = {
			repaintWindows: vi.fn(() => {
				throw failure;
			}),
		};
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.stubGlobal("application", { config, themeLibrary });
		const manager = new ConfigPersistenceManager({
			configDirPath: "/profile",
			resourcePath: "/resources",
		});
		const source = { webContents: { id: 1, send: vi.fn() } };
		const peer = { webContents: { id: 2, send: vi.fn() } };
		mocks.getAllWindows.mockReturnValue([source, peer]);
		vi.clearAllMocks();
		const settings = { core: { appearance: { mode: "dark" } } };
		if (method === "setSettings") manager.setSettings(settings, 1);
		else manager.setRawValue("core.appearance.mode", "dark", 1);
		expect(error).toHaveBeenCalledExactlyOnceWith(
			"Could not repaint window backgrounds",
			failure,
		);
		expect(config.updateSettings).toHaveBeenCalledWith(settings);
		expect(source.webContents.send).not.toHaveBeenCalled();
		expect(peer.webContents.send).toHaveBeenCalledExactlyOnceWith(
			"on-config-reloaded",
			settings,
		);
		expect(atomicWriteFileSync).toHaveBeenCalledExactlyOnceWith(
			"/profile/config.json",
			JSON.stringify({ "*": settings }, null, 2),
		);
	},
);
