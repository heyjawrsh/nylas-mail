/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let NylasWindow;
const { BrowserWindow, app, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const url = require("node:url");
const _ = require("underscore");
const { EventEmitter } = require("node:events");

let WindowIconPath = null;
let idNum = 0;

module.exports = NylasWindow = (() => {
	NylasWindow = class NylasWindow {
		static initClass() {
			_.extend(NylasWindow.prototype, EventEmitter.prototype);

			NylasWindow.includeShellLoadTime = true;

			NylasWindow.prototype.browserWindow = null;
			NylasWindow.prototype.loaded = null;
			NylasWindow.prototype.isSpec = null;
		}

		constructor(settings) {
			let frame, height, pathToOpen, resizable, title, toolbar, width;
			this.updateLoadSettings = this.updateLoadSettings.bind(this);
			if (settings == null) {
				settings = {};
			}
			({
				frame,
				title,
				width,
				height,
				toolbar,
				resizable,
				pathToOpen,
				isSpec: this.isSpec,
				devMode: this.devMode,
				benchmarkMode: this.benchmarkMode,
				windowKey: this.windowKey,
				safeMode: this.safeMode,
				neverClose: this.neverClose,
				mainWindow: this.mainWindow,
				windowType: this.windowType,
				resourcePath: this.resourcePath,
				exitWhenDone: this.exitWhenDone,
				configDirPath: this.configDirPath,
			} = settings);

			if (!this.windowKey) {
				this.windowKey = `${this.windowType}-${idNum}`;
				idNum += 1;
			}

			// Normalize to make sure drive letter case is consistent on Windows
			if (this.resourcePath) {
				this.resourcePath = path.normalize(this.resourcePath);
			}

			const browserWindowOptions = {
				show: false,
				title: title != null ? title : "Nylas Mail",
				frame,
				width,
				height,
				resizable,
				webPreferences: {
					directWrite: true,
				},
				autoHideMenuBar: true,
			};

			if (this.neverClose) {
				// Prevents DOM timers from being suspended when the main window is hidden.
				// Means there's not an awkward catch-up when you re-show the main window.
				// TODO
				// This option is no longer working according to
				// https://github.com/atom/electron/issues/3225
				// Look into using option --disable-renderer-backgrounding
				browserWindowOptions.webPreferences.pageVisibility = true;
			}

			// Don't set icon on Windows so the exe's ico will be used as window and
			// taskbar's icon. See https://github.com/atom/atom/issues/4811 for more.
			if (process.platform === "linux") {
				if (!WindowIconPath) {
					WindowIconPath = path.resolve(__dirname, "..", "..", "nylas.png");
					if (!fs.existsSync(WindowIconPath)) {
						WindowIconPath = path.resolve(
							__dirname,
							"..",
							"..",
							"build",
							"resources",
							"nylas.png",
						);
					}
				}
				browserWindowOptions.icon = WindowIconPath;
			}

			this.browserWindow = new BrowserWindow(browserWindowOptions);
			this.browserWindow.updateLoadSettings = this.updateLoadSettings;

			this.handleEvents();

			const loadSettings = _.extend({}, settings);
			if (loadSettings.windowState == null) {
				loadSettings.windowState = "{}";
			}
			loadSettings.appVersion = app.getVersion();
			loadSettings.resourcePath = this.resourcePath;
			if (loadSettings.devMode == null) {
				loadSettings.devMode = false;
			}
			if (loadSettings.benchmarkMode == null) {
				loadSettings.benchmarkMode = false;
			}
			if (loadSettings.safeMode == null) {
				loadSettings.safeMode = false;
			}
			if (loadSettings.mainWindow == null) {
				loadSettings.mainWindow = this.mainWindow;
			}
			if (loadSettings.windowType == null) {
				loadSettings.windowType = "default";
			}

			// Only send to the first non-spec window created
			if (this.constructor.includeShellLoadTime && !this.isSpec) {
				this.constructor.includeShellLoadTime = false;
				if (loadSettings.shellLoadTime == null) {
					loadSettings.shellLoadTime = Date.now() - global.shellStartTime;
				}
			}

			loadSettings.initialPath = pathToOpen;
			if (
				__guardMethod__(fs.statSyncNoException(pathToOpen), "isFile", (o) =>
					o.isFile(),
				)
			) {
				loadSettings.initialPath = path.dirname(pathToOpen);
			}

			this.browserWindow.loadSettings = loadSettings;

			this.browserWindow.once("window:loaded", () => {
				this.loaded = true;
				if (this.mainWindow) {
					this.browserWindow.setResizable(true);
				}
				if (this.browserWindow.loadSettingsChangedSinceGetURL) {
					this.browserWindow.webContents.send(
						"load-settings-changed",
						this.browserWindow.loadSettings,
					);
				}
				return this.emit("window:loaded");
			});

			this.browserWindow.loadURL(this.getURL(loadSettings));
			if (this.isSpec) {
				this.browserWindow.focusOnWebView();
			}
		}

		updateLoadSettings(newSettings) {
			if (newSettings == null) {
				newSettings = {};
			}
			this.loaded = true;
			return this.setLoadSettings(
				Object.assign({}, this.browserWindow.loadSettings, newSettings),
			);
		}

		loadSettings() {
			return this.browserWindow.loadSettings;
		}

		// This gets called when we want to turn a WindowLauncher.EMPTY_WINDOW
		// into a new kind of custom popout window.
		//
		// The windowType will change which will cause a new set of plugins to
		// load.
		setLoadSettings(loadSettings) {
			this.browserWindow.loadSettings = loadSettings;
			this.browserWindow.loadSettingsChangedSinceGetURL = true;
			return this.browserWindow.webContents.send(
				"load-settings-changed",
				loadSettings,
			);
		}

		getURL(loadSettingsObj) {
			// Ignore the windowState when passing loadSettings via URL, since it could
			// be quite large.
			const loadSettings = _.clone(loadSettingsObj);
			delete loadSettings["windowState"];

			this.browserWindow.loadSettingsChangedSinceGetURL = false;

			return url.format({
				protocol: "file",
				pathname: `${this.resourcePath}/static/index.html`,
				slashes: true,
				query: { loadSettings: JSON.stringify(loadSettings) },
			});
		}

		handleEvents() {
			// Also see logic in `NylasEnv::onBeforeUnload` and
			// `WindowEventHandler::AddUnloadCallback`. Classes like the DraftStore
			// and ActionBridge intercept the closing of windows and perform
			// action.
			//
			// This uses the DOM's `beforeunload` event.
			this.browserWindow.on("close", (event) => {
				if (this.neverClose && !global.application.isQuitting()) {
					// For neverClose windows (like the main window) simply hide and
					// take out of full screen.
					event.preventDefault();
					if (this.browserWindow.isFullScreen()) {
						this.browserWindow.once("leave-full-screen", () => {
							return this.browserWindow.hide();
						});
						this.browserWindow.setFullScreen(false);
					} else {
						this.browserWindow.hide();
					}

					// HOWEVER! If the neverClose window is the last window open, and
					// it looks like there's no windows actually quit the application
					// on Linux & Windows.
					if (!this.isSpec) {
						return global.application.windowManager.quitWinLinuxIfNoWindows();
					}
				}
			});

			this.browserWindow.on("scroll-touch-begin", () => {
				return this.browserWindow.webContents.send("scroll-touch-begin");
			});

			this.browserWindow.on("scroll-touch-end", () => {
				return this.browserWindow.webContents.send("scroll-touch-end");
			});

			this.browserWindow.on("focus", () => {
				return this.browserWindow.webContents.send("browser-window-focus");
			});

			this.browserWindow.on("blur", () => {
				return this.browserWindow.webContents.send("browser-window-blur");
			});

			this.browserWindow.webContents.on("will-navigate", (event, url) => {
				return event.preventDefault();
			});

			this.browserWindow.webContents.on(
				"new-window",
				(event, url, frameName, disposition) => {
					return event.preventDefault();
				},
			);

			this.browserWindow.on("unresponsive", () => {
				if (this.isSpec) {
					return;
				}
				if (!this.loaded) {
					return;
				}

				const chosen = dialog.showMessageBox(this.browserWindow, {
					type: "warning",
					buttons: ["Close", "Keep Waiting"],
					message: "Nylas Mail is not responding",
					detail: "Would you like to force close it or keep waiting?",
				});
				if (chosen === 0) {
					return this.browserWindow.destroy();
				}
			});

			this.browserWindow.webContents.on("crashed", (event, killed) => {
				if (killed) {
					// Killed means that the app is exiting and the browser window is being
					// forceably cleaned up. Carry on, do not try to reload the window.
					this.browserWindow.destroy();
					return;
				}

				if (this.exitWhenDone) {
					app.exit(100);
				}

				if (this.neverClose) {
					return this.browserWindow.reload();
				} else {
					const chosen = dialog.showMessageBox(this.browserWindow, {
						type: "warning",
						buttons: ["Close Window", "Reload", "Keep It Open"],
						message: "Nylas Mail has crashed",
						detail: "Please restart Nylas Mail.",
					});
					switch (chosen) {
						case 0:
							return this.browserWindow.destroy();
						case 1:
							return this.browserWindow.reload();
					}
				}
			});

			if (this.isSpec) {
				// Workaround for https://github.com/atom/electron/issues/380
				// Don't focus the window when it is being blurred during close or
				// else the app will crash on Windows.
				if (process.platform === "win32") {
					this.browserWindow.on("close", () => {
						return (this.isWindowClosing = true);
					});
				}

				// Spec window's web view should always have focus
				return this.browserWindow.on("blur", () => {
					if (!this.isWindowClosing) {
						return this.browserWindow.focusOnWebView();
					}
				});
			}
		}

		sendMessage(message, detail) {
			return this.waitForLoad(() => {
				return this.browserWindow.webContents.send(message, detail);
			});
		}

		sendCommand(command, ...args) {
			if (this.isSpecWindow()) {
				if (!global.application.sendCommandToFirstResponder(command)) {
					switch (command) {
						case "window:reload":
							return this.reload();
						case "window:toggle-dev-tools":
							return this.toggleDevTools();
						case "window:close":
							return this.close();
					}
				}
			} else if (this.isWebViewFocused()) {
				return this.sendCommandToBrowserWindow(command, ...Array.from(args));
			} else {
				if (!global.application.sendCommandToFirstResponder(command)) {
					return this.sendCommandToBrowserWindow(command, ...Array.from(args));
				}
			}
		}

		sendCommandToBrowserWindow(command, ...args) {
			return this.browserWindow.webContents.send(
				"command",
				command,
				...Array.from(args),
			);
		}

		getDimensions() {
			const [x, y] = Array.from(this.browserWindow.getPosition());
			const [width, height] = Array.from(this.browserWindow.getSize());
			return { x, y, width, height };
		}

		close() {
			return this.browserWindow.close();
		}

		hide() {
			return this.browserWindow.hide();
		}

		show() {
			return this.browserWindow.show();
		}

		showWhenLoaded() {
			return this.waitForLoad(() => {
				this.show();
				return this.focus();
			});
		}

		waitForLoad(fn) {
			if (this.loaded) {
				return fn();
			} else {
				return this.once("window:loaded", fn);
			}
		}

		focus() {
			return this.browserWindow.focus();
		}

		minimize() {
			return this.browserWindow.minimize();
		}

		maximize() {
			return this.browserWindow.maximize();
		}

		restore() {
			return this.browserWindow.restore();
		}

		isFocused() {
			return this.browserWindow.isFocused();
		}

		isMinimized() {
			return this.browserWindow.isMinimized();
		}

		isVisible() {
			return this.browserWindow.isVisible();
		}

		isLoaded() {
			return this.loaded;
		}

		isWebViewFocused() {
			return this.browserWindow.isWebViewFocused();
		}

		isSpecWindow() {
			return this.isSpec;
		}

		reload() {
			return this.browserWindow.reload();
		}

		toggleDevTools() {
			return this.browserWindow.toggleDevTools();
		}
	};
	NylasWindow.initClass();
	return NylasWindow;
})();

function __guardMethod__(obj, methodName, transform) {
	if (
		typeof obj !== "undefined" &&
		obj !== null &&
		typeof obj[methodName] === "function"
	) {
		return transform(obj, methodName);
	} else {
		return undefined;
	}
}
