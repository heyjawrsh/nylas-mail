import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ quit: vi.fn(), once: vi.fn() }));

vi.mock("electron", () => ({
	app: { quit: mocks.quit, once: mocks.once },
}));

// This target is CommonJS and constructs its singleton at require time. Vitest's
// default interop exposes that singleton as the default export.
import updater from "../src/browser/windows-updater-squirrel-adapter.js";

describe("WindowsUpdaterSquirrelAdapter CommonJS interop", () => {
	afterEach(() => {
		updater.removeAllListeners();
		delete updater.updateUrl;
		vi.restoreAllMocks();
	});

	it("exposes the singleton through the default export", () => {
		expect(updater).toEqual(expect.objectContaining({
			setFeedURL: expect.any(Function),
			downloadAndInstallUpdate: expect.any(Function),
		}));
	});

	it("stores the feed URL", () => {
		updater.setFeedURL("https://updates.example.test/releases");
		expect(updater.updateUrl).toBe("https://updates.example.test/releases");
	});

	it("reports whether the bundled Squirrel updater exists", () => {
		// The test runtime has no adjacent Update.exe; this exercises default CJS interop.
		expect(updater.supportsUpdates()).toBe(false);
	});

	it("requires a feed URL before checking for updates", () => {
		expect(() => updater.downloadAndInstallUpdate()).toThrow("Update URL is not set");
	});

	it("emits checking and unavailable when Squirrel is absent", () => {
		const checking = vi.fn();
		const unavailable = vi.fn();
		updater.on("checking-for-update", checking);
		updater.on("update-not-available", unavailable);
		updater.setFeedURL("https://updates.example.test/releases");
		updater.downloadAndInstallUpdate();
		expect(checking).toHaveBeenCalledOnce();
		expect(unavailable).toHaveBeenCalledOnce();
	});

	it("logs instead of restarting when Squirrel is absent", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		updater.restartN1();
		expect(error).toHaveBeenCalledWith("SquirrelUpdate does not exist");
		expect(mocks.quit).not.toHaveBeenCalled();
	});
});
