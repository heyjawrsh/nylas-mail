// The main-process crash reporter start in Application#handleEvents: dumps
// stay local, with no upload and no submit URL (heyjawrsh/nylas-mail#8).
import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const on = () => vi.fn();
	return {
		appOn: on(),
		ipcOn: on(),
		ipcHandle: on(),
		powerOn: on(),
		crashStart: vi.fn(),
	};
});

vi.mock("electron", () => {
	const electron = {
		BrowserWindow: { fromWebContents: vi.fn() },
		Menu: { sendActionToFirstResponder: vi.fn() },
		app: { on: m.appOn, quit: vi.fn() },
		ipcMain: { on: m.ipcOn, handle: m.ipcHandle },
		dialog: {},
		powerMonitor: { on: m.powerOn },
		crashReporter: { start: m.crashStart },
	};
	return { default: electron, ...electron };
});

const { stub } = vi.hoisted(() => ({ stub: () => ({ default: class {} }) }));
vi.mock("fs-plus", () => ({ default: {} }));
vi.mock("../src/browser/global-timer.js", stub);
vi.mock("../src/browser/window-manager.js", stub);
vi.mock("../src/browser/file-list-cache.js", stub);
vi.mock("../src/browser/database-reader.js", stub);
vi.mock("../src/browser/config-migrator.js", stub);
vi.mock("../src/browser/application-menu.js", stub);
vi.mock("../src/browser/system-tray-manager.js", stub);
vi.mock("../src/default-client-helper.js", stub);
vi.mock("../src/browser/nylas-protocol-handler.js", stub);
vi.mock("../src/browser/package-migration-manager.js", stub);
vi.mock("../src/browser/config-persistence-manager.js", stub);
vi.mock("../src/browser/prevent-legacy-n1-migration.js", () => ({
	default: vi.fn(),
}));

const { default: Application } = await import("../src/browser/application.js");

describe("Application crash reporter start", () => {
	it("starts on app ready with uploads off and no submit URL", () => {
		new Application().handleEvents();
		const ready = m.appOn.mock.calls.find(([event]) => event === "ready");
		expect(ready).toBeDefined();
		expect(m.crashStart).not.toHaveBeenCalled();

		ready[1]();
		expect(m.crashStart).toHaveBeenCalledTimes(1);
		expect(m.crashStart.mock.calls[0][0]).toStrictEqual({
			productName: "Nylas Mail",
			uploadToServer: false,
		});
	});
});
