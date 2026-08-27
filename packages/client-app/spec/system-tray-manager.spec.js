import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	buildFromTemplate: vi.fn((template) => ({ template })),
	createEmpty: vi.fn(() => ({ kind: "empty" })),
	createFromPath: vi.fn((iconPath) => ({
		iconPath,
		setTemplateImage: vi.fn(),
	})),
	trays: [],
}));

vi.mock("electron", () => ({
	Menu: { buildFromTemplate: mocks.buildFromTemplate },
	Tray: class Tray {
		constructor(icon) {
			this.icon = icon;
			this.setToolTip = vi.fn();
			this.addListener = vi.fn();
			this.removeListener = vi.fn();
			this.setContextMenu = vi.fn();
			this.setImage = vi.fn();
			this.destroy = vi.fn();
			mocks.trays.push(this);
		}
	},
	nativeImage: {
		createEmpty: mocks.createEmpty,
		createFromPath: mocks.createFromPath,
	},
}));

import SystemTrayManager from "../src/browser/system-tray-manager.js";

function makeApplication(enabled = true) {
	let changeHandler;
	return {
		emit: vi.fn(),
		config: {
			get: vi.fn(() => enabled),
			onDidChange: vi.fn((key, handler) => { changeHandler = handler; }),
		},
		changeSystemTray(value) { changeHandler({ newValue: value }); },
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.trays.length = 0;
});

describe("SystemTrayManager", () => {
	it("creates an enabled tray with an empty initial icon", () => {
		const manager = new SystemTrayManager("linux", makeApplication());
		expect(mocks.createEmpty).toHaveBeenCalledOnce();
		expect(manager._tray.icon).toEqual({ kind: "empty" });
	});

	it("does not create a disabled tray", () => {
		const manager = new SystemTrayManager("linux", makeApplication(false));
		expect(manager._tray).toBeNull();
		expect(mocks.trays).toHaveLength(0);
	});

	it("builds a non-Windows menu with Open Inbox first", () => {
		new SystemTrayManager("linux", makeApplication());
		const template = mocks.buildFromTemplate.mock.calls[0][0];
		expect(template.map((item) => item.label || item.type)).toEqual([
			"Open Inbox", "New Message", "Preferences", "separator", "Quit Nylas Mail",
		]);
	});

	it("omits Open Inbox from the Windows menu", () => {
		new SystemTrayManager("win32", makeApplication());
		const template = mocks.buildFromTemplate.mock.calls[0][0];
		expect(template.map((item) => item.label || item.type)).toEqual([
			"New Message", "Preferences", "separator", "Quit Nylas Mail",
		]);
	});

	it("emits the command selected from each menu item", () => {
		const application = makeApplication();
		new SystemTrayManager("linux", application);
		const template = mocks.buildFromTemplate.mock.calls[0][0];
		template.filter((item) => item.click).forEach((item) => item.click());
		expect(application.emit.mock.calls.map(([event]) => event)).toEqual([
			"application:show-main-window",
			"application:new-message",
			"application:open-preferences",
			"application:quit",
		]);
	});

	it("opens the main window when a non-macOS tray is clicked", () => {
		const application = makeApplication();
		const manager = new SystemTrayManager("linux", application);
		manager._onClick();
		expect(application.emit).toHaveBeenCalledWith("application:show-main-window");
	});

	it("does nothing when a macOS tray is clicked", () => {
		const application = makeApplication();
		const manager = new SystemTrayManager("darwin", application);
		manager._onClick();
		expect(application.emit).not.toHaveBeenCalled();
	});

	it("updates the icon, tooltip, and template-image flag", () => {
		const manager = new SystemTrayManager("darwin", makeApplication());
		manager.updateTraySettings("/icons/tray.png", "12", true);
		const icon = mocks.createFromPath.mock.results[0].value;
		expect(icon.setTemplateImage).toHaveBeenCalledWith(true);
		expect(manager._tray.setImage).toHaveBeenCalledWith(icon);
		expect(manager._tray.setToolTip).toHaveBeenLastCalledWith("12 unread messages");
	});

	it("uses an empty tooltip for no unread count", () => {
		const manager = new SystemTrayManager("linux", makeApplication());
		manager.updateTraySettings("/icons/tray.png", "", false);
		expect(manager._tray.setToolTip).toHaveBeenLastCalledWith("");
	});

	it("does not update the native tray when settings are unchanged", () => {
		const manager = new SystemTrayManager("linux", makeApplication());
		manager.updateTraySettings("/icons/tray.png", "2", false);
		vi.clearAllMocks();
		manager.updateTraySettings("/icons/tray.png", "2", true);
		// Actual behavior keys only on path and unread text, not isTemplateImg.
		expect(mocks.createFromPath).not.toHaveBeenCalled();
		expect(manager._tray.setImage).not.toHaveBeenCalled();
	});

	it("destroys and recreates the tray as config changes", () => {
		const application = makeApplication();
		const manager = new SystemTrayManager("linux", application);
		const firstTray = manager._tray;
		application.changeSystemTray(false);
		expect(firstTray.destroy).toHaveBeenCalledOnce();
		expect(manager._tray).toBeNull();
		application.changeSystemTray(true);
		expect(manager._tray).not.toBe(firstTray);
	});

	it("removes the exact click listener before destruction", () => {
		const manager = new SystemTrayManager("linux", makeApplication());
		const tray = manager._tray;
		manager.destroyTray();
		expect(tray.removeListener).toHaveBeenCalledWith("click", manager._onClick);
	});
});
