/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let ApplicationMenu;
const { BrowserWindow, Menu, MenuItem, app } = require("electron");
const _ = require("underscore");
const Utils = require("../flux/models/utils.js");

// Used to manage the global application menu.
//
// It's created by {Application} upon instantiation and used to add, remove
// and maintain the state of all menu items.
module.exports = ApplicationMenu = class ApplicationMenu {
	constructor(version) {
		this.version = version;
		this.windowTemplates = new WeakMap();
		this.setActiveTemplate(this.getDefaultTemplate());
	}

	// Public: Updates the entire menu with the given keybindings.
	//
	// window - The BrowserWindow this menu template is associated with.
	// template - The Object which describes the menu to display.
	// keystrokesByCommand - An Object where the keys are commands and the values
	//                       are Arrays containing the keystroke.
	update(window, template, keystrokesByCommand) {
		this.translateTemplate(template, keystrokesByCommand);
		this.windowTemplates.set(window, template);
		if (window === this.lastFocusedWindow) {
			return this.setActiveTemplate(template);
		}
	}

	setActiveTemplate(template) {
		if (!_.isEqual(template, this.activeTemplate)) {
			this.activeTemplate = template;
			return this.rebuildMenuWithActiveTemplate();
		}
	}

	rebuildMenuWithActiveTemplate() {
		const fullTemplate = Utils.deepClone(this.activeTemplate);
		this.extendTemplateWithVersion(fullTemplate);
		this.extendTemplateWithWindowMenu(fullTemplate);

		this.menu = Menu.buildFromTemplate(fullTemplate);
		Menu.setApplicationMenu(this.menu);

		this.updateFullscreenMenuItem(
			this.lastFocusedWindow != null
				? this.lastFocusedWindow.isFullScreen()
				: undefined,
		);
		return this.updateDevModeItem();
	}

	// Register a BrowserWindow with this application menu.
	addWindow(window) {
		if (this.lastFocusedWindow == null) {
			this.lastFocusedWindow = window;
		}

		const focusHandler = () => {
			let template;
			this.lastFocusedWindow = window;
			if ((template = this.windowTemplates.get(window))) {
				return this.setActiveTemplate(template);
			}
		};

		window.on("focus", focusHandler);
		window.on("enter-full-screen", focusHandler);
		window.on("leave-full-screen", focusHandler);
		window.once("closed", () => {
			if (window === this.lastFocusedWindow) {
				this.lastFocusedWindow = null;
			}
			this.windowTemplates.delete(window);
			this.rebuildMenuWithActiveTemplate();
			window.removeListener("focus", focusHandler);
			window.removeListener("enter-full-screen", focusHandler);
			return window.removeListener("leave-full-screen", focusHandler);
		});

		this.rebuildMenuWithActiveTemplate();
		return this.enableWindowSpecificItems(true);
	}

	// Flattens the given menu and submenu items into an single Array.
	//
	// menu - A complete menu configuration object for electron's menu API.
	//
	// Returns an Array of native menu items.
	flattenMenuItems(menu) {
		let items = [];
		const object = menu.items || {};
		for (var index in object) {
			var item = object[index];
			items.push(item);
			if (item.submenu) {
				items = items.concat(this.flattenMenuItems(item.submenu));
			}
		}
		return items;
	}

	// Flattens the given menu template into an single Array.
	//
	// template - An object describing the menu item.
	//
	// Returns an Array of native menu items.
	flattenMenuTemplate(template) {
		let items = [];
		for (var item of Array.from(template)) {
			items.push(item);
			if (item.submenu) {
				items = items.concat(this.flattenMenuTemplate(item.submenu));
			}
		}
		return items;
	}

	// Public: Used to make all window related menu items are active.
	//
	// enable - If true enables all window specific items, if false disables all
	//          window specific items.
	enableWindowSpecificItems(enable) {
		return (() => {
			const result = [];
			for (var item of Array.from(this.flattenMenuItems(this.menu))) {
				if (
					item.metadata != null ? item.metadata["windowSpecific"] : undefined
				) {
					result.push((item.enabled = enable));
				} else {
					result.push(undefined);
				}
			}
			return result;
		})();
	}

	// Replaces VERSION with the current version.
	extendTemplateWithVersion(template) {
		let item;
		if (
			(item = _.find(
				this.flattenMenuTemplate(template),
				({ label }) => label === "VERSION",
			))
		) {
			return (item.label = `Version ${this.version}`);
		}
	}

	extendTemplateWithWindowMenu(template) {
		const windowMenu = _.find(template, ({ label }) => label === "Window");
		if (!windowMenu) {
			return;
		}
		const idx = _.findIndex(
			windowMenu.submenu,
			({ id }) => id === "window-list-separator",
		);

		let workShortcut = "CmdOrCtrl+alt+w";
		if (process.platform === "win32") {
			workShortcut = "ctrl+shift+w";
		}

		const accelerators = {
			default: "CmdOrCtrl+0",
			work: workShortcut,
		};
		const windows = global.application.windowManager.getOpenWindows();
		const windowsItems = windows.map((w) => ({
			label: w.loadSettings().title || "Window",
			accelerator: accelerators[w.windowType],
			click() {
				w.show();
				return w.focus();
			},
		}));
		return windowMenu.submenu.splice(
			idx,
			0,
			{ type: "separator" },
			...Array.from(windowsItems),
		);
	}

	updateFullscreenMenuItem(fullscreen) {
		const enterItem = _.find(
			this.flattenMenuItems(this.menu),
			({ label }) => label === "Enter Full Screen",
		);
		const exitItem = _.find(
			this.flattenMenuItems(this.menu),
			({ label }) => label === "Exit Full Screen",
		);
		if (!enterItem || !exitItem) {
			return;
		}
		enterItem.visible = !fullscreen;
		return (exitItem.visible = fullscreen);
	}

	updateDevModeItem() {
		const devModeItem = _.find(
			this.flattenMenuItems(this.menu),
			({ command }) => command === "application:toggle-dev",
		);
		return devModeItem != null
			? (devModeItem.checked = global.application.devMode)
			: undefined;
	}

	// Default list of menu items.
	//
	// Returns an Array of menu item Objects.
	getDefaultTemplate() {
		return [
			{
				label: "N1",
				submenu: [
					{ label: "Check for Update", metadata: { autoUpdate: true } },
					{
						label: "Reload",
						accelerator: "CmdOrCtrl+R",
						click: () =>
							__guard__(BrowserWindow.getFocusedWindow(), (x) => x.reload()),
					},
					{
						label: "Close Window",
						accelerator: "CmdOrCtrl+Shift+W",
						click: () =>
							__guard__(BrowserWindow.getFocusedWindow(), (x) => x.close()),
					},
					{
						label: "Toggle Dev Tools",
						accelerator: "CmdOrCtrl+Alt+I",
						click: () =>
							__guard__(BrowserWindow.getFocusedWindow(), (x) =>
								x.toggleDevTools(),
							),
					},
					{
						label: "Quit",
						accelerator: "CmdOrCtrl+Q",
						click() {
							return app.quit();
						},
					},
				],
			},
		];
	}

	// Combines a menu template with the appropriate keystroke.
	//
	// template - An Object conforming to electron's menu api but lacking
	//            accelerator and click properties.
	// keystrokesByCommand - An Object where the keys are commands and the values
	//                       are Arrays containing the keystroke.
	//
	// Returns a complete menu configuration object for electron's menu API.
	translateTemplate(template, keystrokesByCommand) {
		template.forEach((item) => {
			if (item.metadata == null) {
				item.metadata = {};
			}
			if (item.command) {
				item.accelerator = this.acceleratorForCommand(
					item.command,
					keystrokesByCommand,
				);
				item.click = () =>
					global.application.sendCommand(item.command, item.args);
				if (!/^application:/.test(item.command)) {
					item.metadata["windowSpecific"] = true;
				}
			}
			if (item.submenu) {
				return this.translateTemplate(item.submenu, keystrokesByCommand);
			}
		});
		return template;
	}

	// Determine the accelerator for a given command.
	//
	// command - The name of the command.
	// keystrokesByCommand - An Object where the keys are commands and the values
	//                       are Arrays containing the keystroke.
	//
	// Returns a String containing the keystroke in a format that can be interpreted
	//   by Electron to provide nice icons where available.
	acceleratorForCommand(command, keystrokesByCommand) {
		let firstKeystroke =
			keystrokesByCommand[command] != null
				? keystrokesByCommand[command][0]
				: undefined;
		if (!firstKeystroke) {
			return null;
		}

		if (/f\d+/.test(firstKeystroke)) {
			firstKeystroke = firstKeystroke.toUpperCase();
		}

		let modifiers = firstKeystroke.split("+");
		const key = modifiers.pop();

		modifiers = modifiers.map((modifier) =>
			modifier
				.replace(/shift/gi, "Shift")
				.replace(/command/gi, "Command")
				.replace(/mod/gi, "CmdOrCtrl")
				.replace(/ctrl/gi, "Ctrl")
				.replace(/alt/gi, "Alt"),
		);

		const keys = modifiers.concat([key.toUpperCase()]);
		return keys.join("+");
	}
};

function __guard__(value, transform) {
	return typeof value !== "undefined" && value !== null
		? transform(value)
		: undefined;
}
