import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	atomicWriteFileSync: vi.fn(),
	copySync: vi.fn(),
	existsSync: vi.fn(),
	makeTreeSync: vi.fn(),
	quit: vi.fn(),
	readFileSync: vi.fn(),
	reportError: vi.fn(),
	showMessageBox: vi.fn(),
	unlinkSync: vi.fn(),
	updateSettings: vi.fn(),
	writeFileSync: vi.fn(),
	getAllWindows: vi.fn(),
}));

vi.mock("fs-plus", () => ({
	default: {
		copySync: mocks.copySync,
		existsSync: mocks.existsSync,
		makeTreeSync: mocks.makeTreeSync,
		readFileSync: mocks.readFileSync,
		unlinkSync: mocks.unlinkSync,
		writeFileSync: mocks.writeFileSync,
	},
}));

vi.mock("electron", () => ({
	app: { quit: mocks.quit },
	BrowserWindow: { getAllWindows: mocks.getAllWindows },
	dialog: { showMessageBox: mocks.showMessageBox },
}));

vi.mock("../src/fs-utils.js", () => ({
	default: { atomicWriteFileSync: mocks.atomicWriteFileSync },
	atomicWriteFileSync: mocks.atomicWriteFileSync,
}));

import ConfigPersistenceManager from "../src/browser/config-persistence-manager.js";
import FileListCache from "../src/browser/file-list-cache.js";

const CONFIG_DIR = "/profile";
const CONFIG_PATH = "/profile/config.json";
const RESOURCE_PATH = "/resources";
const TEMPLATE_PATH = "/resources/dot-nylas/config.json";

function createManager(settings = { theme: "dark" }) {
	mocks.existsSync.mockReturnValue(true);
	mocks.readFileSync.mockReturnValue(JSON.stringify({ "*": settings }));
	return new ConfigPersistenceManager({
		configDirPath: CONFIG_DIR,
		resourcePath: RESOURCE_PATH,
	});
}

describe("ConfigPersistenceManager", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.errorLogger = { reportError: mocks.reportError };
		global.application = { config: { updateSettings: mocks.updateSettings } };
		mocks.existsSync.mockReturnValue(true);
		mocks.readFileSync.mockReturnValue('{"*":{}}');
		mocks.getAllWindows.mockReturnValue([]);
		mocks.showMessageBox.mockReturnValue(0);
	});

	it("loads settings from the star namespace", () => {
		const manager = createManager({ theme: "light", nested: { value: 2 } });

		expect(manager.settings).toEqual({ theme: "light", nested: { value: 2 } });
		expect(mocks.readFileSync).toHaveBeenCalledWith(CONFIG_PATH);
	});

	it("creates and seeds a missing config directory", () => {
		mocks.existsSync.mockImplementation((path) => path === CONFIG_PATH);
		mocks.readFileSync.mockReturnValue('{"*":{}}');

		new ConfigPersistenceManager({ configDirPath: CONFIG_DIR, resourcePath: RESOURCE_PATH });

		expect(mocks.makeTreeSync).toHaveBeenCalledWith(CONFIG_DIR);
		expect(mocks.copySync).toHaveBeenCalledWith("/resources/dot-nylas", CONFIG_DIR);
	});

	it("copies the template file when config.json is missing", () => {
		mocks.existsSync.mockImplementation((path) => path === CONFIG_DIR);
		mocks.readFileSync
			.mockReturnValueOnce(Buffer.from("template"))
			.mockReturnValueOnce('{"*":{}}');

		new ConfigPersistenceManager({ configDirPath: CONFIG_DIR, resourcePath: RESOURCE_PATH });

		expect(mocks.readFileSync).toHaveBeenNthCalledWith(1, TEMPLATE_PATH);
		expect(mocks.writeFileSync).toHaveBeenCalledWith(CONFIG_PATH, Buffer.from("template"));
	});

	it("publishes loaded settings to the application config", () => {
		createManager({ notifications: true });

		expect(mocks.updateSettings).toHaveBeenCalledWith({ notifications: true });
	});

	it("broadcasts loaded settings to every window", () => {
		const first = { webContents: { id: 1, send: vi.fn() } };
		const second = { webContents: { id: 2, send: vi.fn() } };
		mocks.getAllWindows.mockReturnValue([first, second]);

		createManager({ zoom: 1.25 });

		expect(first.webContents.send).toHaveBeenCalledWith("on-config-reloaded", { zoom: 1.25 });
		expect(second.webContents.send).toHaveBeenCalledWith("on-config-reloaded", { zoom: 1.25 });
	});

	it("omits the source web contents when settings change", () => {
		const source = { webContents: { id: 7, send: vi.fn() } };
		const peer = { webContents: { id: 8, send: vi.fn() } };
		mocks.getAllWindows.mockReturnValue([source, peer]);
		const manager = createManager();
		vi.clearAllMocks();
		mocks.getAllWindows.mockReturnValue([source, peer]);

		manager.setSettings({ theme: "blue" }, 7);

		expect(source.webContents.send).not.toHaveBeenCalled();
		expect(peer.webContents.send).toHaveBeenCalledWith("on-config-reloaded", { theme: "blue" });
	});

	it("saves formatted JSON after replacing settings", () => {
		const manager = createManager();
		mocks.atomicWriteFileSync.mockClear();

		manager.setSettings({ enabled: true }, 4);

		expect(mocks.atomicWriteFileSync).toHaveBeenCalledWith(
			CONFIG_PATH,
			JSON.stringify({ "*": { enabled: true } }, null, 2),
		);
	});

	it("sets a nested raw value and saves it", () => {
		const manager = createManager({ editor: { fontSize: 12 } });
		mocks.atomicWriteFileSync.mockClear();

		manager.setRawValue("editor.fontSize", 16);

		expect(manager.settings.editor.fontSize).toBe(16);
		expect(mocks.atomicWriteFileSync).toHaveBeenCalledOnce();
	});

	it("rejects a false-y raw key path", () => {
		const manager = createManager();

		expect(() => manager.setRawValue("", "value")).toThrow("keyPath must not be false-y");
	});

	it("returns raw settings as compact JSON", () => {
		const manager = createManager({ one: 1, two: false });

		expect(manager.getRawValuesString()).toBe('{"one":1,"two":false}');
	});

	it("rejects reading empty raw settings", () => {
		const manager = createManager({});

		expect(() => manager.getRawValuesString()).toThrow("this.settings is empty");
	});

	it("retries atomic writes until a later attempt succeeds", () => {
		const manager = createManager({ retries: true });
		mocks.atomicWriteFileSync
			.mockImplementationOnce(() => { throw new Error("locked one"); })
			.mockImplementationOnce(() => { throw new Error("locked two"); })
			.mockImplementationOnce(() => { throw new Error("locked three"); })
			.mockImplementationOnce(() => undefined);

		manager.save();

		expect(mocks.atomicWriteFileSync).toHaveBeenCalledTimes(4);
		expect(manager.saveRetries).toBe(0);
		expect(mocks.showMessageBox).not.toHaveBeenCalled();
	});

	it("reports and offers recovery after four failed atomic writes", () => {
		const manager = createManager();
		mocks.atomicWriteFileSync.mockImplementation(() => { throw new Error("disk full"); });

		manager.save();

		// RETRY_SAVES counts recursive retries, so the initial attempt makes four writes total.
		expect(mocks.atomicWriteFileSync).toHaveBeenCalledTimes(4);
		expect(mocks.reportError).toHaveBeenCalledWith(
			expect.objectContaining({ message: "Failed to save config.json: disk full" }),
		);
		expect(mocks.showMessageBox).toHaveBeenCalledWith(expect.objectContaining({
			buttons: ["Okay", "Try again"],
		}));
	});

	it("starts a fresh save cycle when the error dialog requests retry", () => {
		const manager = createManager();
		mocks.showMessageBox.mockReturnValue(1);
		mocks.atomicWriteFileSync
			.mockImplementationOnce(() => { throw new Error("locked"); })
			.mockImplementationOnce(() => { throw new Error("locked"); })
			.mockImplementationOnce(() => { throw new Error("locked"); })
			.mockImplementationOnce(() => { throw new Error("locked"); })
			.mockImplementationOnce(() => undefined);

		manager.save();

		expect(mocks.atomicWriteFileSync).toHaveBeenCalledTimes(5);
		expect(manager.saveRetries).toBe(0);
	});

	it("does not write after the user quits to preserve a load error", () => {
		mocks.readFileSync.mockImplementation(() => { throw new Error("permission denied"); });
		mocks.showMessageBox.mockReturnValue(0);
		const manager = new ConfigPersistenceManager({
			configDirPath: CONFIG_DIR,
			resourcePath: RESOURCE_PATH,
		});

		manager.save();

		expect(mocks.quit).toHaveBeenCalledOnce();
		expect(manager.userWantsToPreserveErrors).toBe(true);
		expect(mocks.atomicWriteFileSync).not.toHaveBeenCalled();
	});
});

describe("FileListCache", () => {
	it("starts with serialized empty image data", () => {
		const cache = new FileListCache();

		expect(cache.imageData).toBe("{}");
		expect(JSON.parse(cache.imageData)).toEqual({});
	});

	it("round-trips serialized image data through the cache", () => {
		const cache = new FileListCache();
		const images = { avatar: "data:image/png;base64,abc" };

		cache.imageData = JSON.stringify(images);

		expect(JSON.parse(cache.imageData)).toEqual(images);
	});

	it("round-trips package paths without sharing them across instances", () => {
		const first = new FileListCache();
		const second = new FileListCache();
		first.packagePaths.push("/packages/inbox");

		expect(first.packagePaths).toEqual(["/packages/inbox"]);
		expect(second.packagePaths).toEqual([]);
	});
});
