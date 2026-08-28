import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const clone = (value) => {
		if (Array.isArray(value)) return value.map(clone);
		if (value && typeof value === "object") {
			return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
		}
		return value;
	};
	const buildItems = (template) => template.map((item) => ({
		...item,
		submenu: item.submenu ? { items: buildItems(item.submenu) } : undefined,
	}));
	return {
		appQuit: vi.fn(),
		buildFromTemplate: vi.fn((template) => ({ items: buildItems(template), template })),
		deepClone: vi.fn(clone),
		focusedWindow: vi.fn(),
		setApplicationMenu: vi.fn(),
	};
});

const electron = vi.hoisted(() => ({
	BrowserWindow: { getFocusedWindow: mocks.focusedWindow },
	Menu: {
		buildFromTemplate: mocks.buildFromTemplate,
		setApplicationMenu: mocks.setApplicationMenu,
	},
	MenuItem: class MenuItem {},
	app: { quit: mocks.appQuit },
}));

// application-menu is CommonJS, so expose both require() and ESM interop shapes.
vi.mock("electron", () => ({ default: electron, ...electron }));
vi.mock("../src/flux/models/utils.js", () => ({
	default: { deepClone: mocks.deepClone },
	deepClone: mocks.deepClone,
}));

import * as ApplicationMenuInterop from "../src/browser/application-menu.js";

const ApplicationMenu = ApplicationMenuInterop.default;

function makeWindow({ title = "Inbox", windowType = "default", fullscreen = false } = {}) {
	const handlers = {};
	return {
		windowType,
		loadSettings: vi.fn(() => ({ title })),
		show: vi.fn(),
		focus: vi.fn(),
		isFullScreen: vi.fn(() => fullscreen),
		on: vi.fn((event, handler) => { handlers[event] = handler; }),
		once: vi.fn((event, handler) => { handlers[event] = handler; }),
		removeListener: vi.fn(),
		emitLocal(event) { return handlers[event]?.(); },
	};
}

function makeMenu(version = "2.1.0", windows = []) {
	global.application = {
		devMode: false,
		sendCommand: vi.fn(),
		windowManager: { getOpenWindows: vi.fn(() => windows) },
	};
	return new ApplicationMenu(version);
}

beforeEach(() => {
	vi.clearAllMocks();
	global.application = undefined;
});

describe("ApplicationMenu CommonJS interop", () => {
	it("loads the CommonJS export through the default interop", () => {
		expect(typeof ApplicationMenuInterop.default).toBe("function");
	});
});

describe("ApplicationMenu template builders", () => {
	it("builds the default N1 menu with expected labels", () => {
		const template = makeMenu().getDefaultTemplate();
		expect(template[0].label).toBe("N1");
		expect(template[0].submenu.map(({ label }) => label)).toEqual([
			"Check for Update", "Reload", "Close Window", "Toggle Dev Tools", "Quit",
		]);
	});

	it("assigns the default command accelerators", () => {
		const items = makeMenu().getDefaultTemplate()[0].submenu;
		expect(items.slice(1).map(({ accelerator }) => accelerator)).toEqual([
			"CmdOrCtrl+R", "CmdOrCtrl+Shift+W", "CmdOrCtrl+Alt+I", "CmdOrCtrl+Q",
		]);
	});

	it("marks the update item with auto-update metadata", () => {
		expect(makeMenu().getDefaultTemplate()[0].submenu[0].metadata).toEqual({ autoUpdate: true });
	});

	it("translates command fixtures recursively", () => {
		const menu = makeMenu();
		const template = [{ label: "Message", submenu: [{ label: "Archive", command: "message:archive" }] }];
		expect(menu.translateTemplate(template, { "message:archive": ["mod+shift+a"] })).toBe(template);
		expect(template[0].submenu[0]).toMatchObject({
			label: "Archive", command: "message:archive", accelerator: "CmdOrCtrl+Shift+A",
			metadata: { windowSpecific: true },
		});
	});

	it("leaves application commands enabled outside a window", () => {
		const template = [{ label: "Dev", command: "application:toggle-dev" }];
		makeMenu().translateTemplate(template, {});
		expect(template[0].metadata.windowSpecific).toBeUndefined();
		expect(template[0].accelerator).toBeNull();
	});

	it("dispatches translated commands with their arguments", () => {
		const template = [{ label: "Move", command: "message:move", args: { to: "archive" } }];
		makeMenu().translateTemplate(template, {});
		template[0].click();
		expect(global.application.sendCommand).toHaveBeenCalledWith("message:move", { to: "archive" });
	});

	it("uses only the first configured keystroke", () => {
		expect(makeMenu().acceleratorForCommand("message:send", {
			"message:send": ["mod+enter", "mod+s"],
		})).toBe("CmdOrCtrl+ENTER");
	});

	it("normalizes function keys and modifier names", () => {
		const menu = makeMenu();
		expect(menu.acceleratorForCommand("view:one", { "view:one": ["ctrl+alt+f11"] })).toBe("Ctrl+Alt+F11");
	});

	it("returns null when a command has no keystroke", () => {
		expect(makeMenu().acceleratorForCommand("message:none", {})).toBeNull();
	});

	it("flattens nested template fixtures in display order", () => {
		const child = { label: "Child" };
		const parent = { label: "Parent", submenu: [child] };
		expect(makeMenu().flattenMenuTemplate([parent, { label: "Last" }]).map(({ label }) => label))
			.toEqual(["Parent", "Child", "Last"]);
	});

	it("replaces the VERSION placeholder", () => {
		const template = [{ label: "Help", submenu: [{ label: "VERSION" }] }];
		makeMenu("9.4.1").extendTemplateWithVersion(template);
		expect(template[0].submenu[0].label).toBe("Version 9.4.1");
	});

	it("adds open windows before the window-list marker", () => {
		const window = makeWindow({ title: "Search", windowType: "default" });
		const template = [{ label: "Window", submenu: [
			{ role: "minimize" }, { id: "window-list-separator", type: "separator" },
		] }];
		makeMenu("2.1.0", [window]).extendTemplateWithWindowMenu(template);
		expect(template[0].submenu.map(({ label, role, type }) => label || role || type)).toEqual([
			"minimize", "separator", "Search", "separator",
		]);
		expect(template[0].submenu[2].accelerator).toBe("CmdOrCtrl+0");
	});

	it("falls back to Window when a window has no title", () => {
		const template = [{ label: "Window", submenu: [{ id: "window-list-separator" }] }];
		makeMenu("2.1.0", [makeWindow({ title: "" })]).extendTemplateWithWindowMenu(template);
		expect(template[0].submenu[1].label).toBe("Window");
	});

	it("shows and focuses a selected window", () => {
		const window = makeWindow();
		const template = [{ label: "Window", submenu: [{ id: "window-list-separator" }] }];
		makeMenu("2.1.0", [window]).extendTemplateWithWindowMenu(template);
		template[0].submenu[1].click();
		expect(window.show).toHaveBeenCalledOnce();
		expect(window.focus).toHaveBeenCalledOnce();
	});


});
