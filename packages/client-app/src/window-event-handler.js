/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let WindowEventHandler;
const path = require("path");
const _ = require("underscore");
const { Disposable } = require("event-kit");
let { shell, ipcRenderer, remote } = require("electron");
const fs = require("fs-plus");
const url = require("url");

// Handles low-level events related to the window.
module.exports = WindowEventHandler = class WindowEventHandler {
	constructor() {
		this.unloadCallbacks = [];

		_.defer(() => {
			return this.showDevModeMessages();
		});

		ipcRenderer.on("browser-window-focus", () => {
			document.body.classList.remove("is-blurred");
			return window.dispatchEvent(new Event("browser-window-focus"));
		});

		ipcRenderer.on("browser-window-blur", () => {
			document.body.classList.add("is-blurred");
			return window.dispatchEvent(new Event("browser-window-blur"));
		});

		ipcRenderer.on("command", (event, command, ...args) =>
			NylasEnv.commands.dispatch(command, args[0]),
		);

		ipcRenderer.on("scroll-touch-begin", () =>
			window.dispatchEvent(new Event("scroll-touch-begin")),
		);

		ipcRenderer.on("scroll-touch-end", () =>
			window.dispatchEvent(new Event("scroll-touch-end")),
		);

		window.onbeforeunload = () => {
			if (NylasEnv.inSpecMode()) {
				return undefined;
			}
			// Don't hide the window here if we don't want the renderer process to be
			// throttled in case more work needs to be done before closing

			// In Electron, returning any value other than undefined cancels the close.
			if (this.runUnloadCallbacks()) {
				// Good to go! Window will be closing...
				NylasEnv.storeWindowDimensions();
				NylasEnv.saveStateAndUnloadWindow();
				return undefined;
			}
			return false;
		};

		NylasEnv.commands.add(document.body, "window:toggle-full-screen", () =>
			NylasEnv.toggleFullScreen(),
		);

		NylasEnv.commands.add(document.body, "window:close", () =>
			NylasEnv.close(),
		);

		NylasEnv.commands.add(document.body, "window:reload", () => {
			return NylasEnv.reload();
		});

		NylasEnv.commands.add(document.body, "window:toggle-dev-tools", () =>
			NylasEnv.toggleDevTools(),
		);

		NylasEnv.commands.add(document.body, "window:open-errorlogger-logs", () =>
			NylasEnv.errorLogger.openLogs(),
		);

		NylasEnv.commands.add(
			document.body,
			"window:toggle-component-regions",
			() => {
				const ComponentRegistry = require("./registries/component-registry");
				return ComponentRegistry.toggleComponentRegions();
			},
		);

		const { webContents } = NylasEnv.getCurrentWindow();
		NylasEnv.commands.add(document.body, "core:copy", () => webContents.copy());
		NylasEnv.commands.add(document.body, "core:cut", () => webContents.cut());
		NylasEnv.commands.add(document.body, "core:paste", () =>
			webContents.paste(),
		);
		NylasEnv.commands.add(document.body, "core:paste-and-match-style", () =>
			webContents.pasteAndMatchStyle(),
		);
		NylasEnv.commands.add(document.body, "core:undo", () => webContents.undo());
		NylasEnv.commands.add(document.body, "core:redo", () => webContents.redo());
		NylasEnv.commands.add(document.body, "core:select-all", () =>
			webContents.selectAll(),
		);

		// "Pinch to zoom" on the Mac gets translated by the system into a
		// "scroll with ctrl key down". To prevent the page from zooming in,
		// prevent default when the ctrlKey is detected.
		document.addEventListener("mousewheel", () => {
			if (event.ctrlKey) {
				return event.preventDefault();
			}
		});

		document.addEventListener("drop", this.onDrop);

		document.addEventListener("dragover", this.onDragOver);

		document.addEventListener("click", (event) => {
			if (event.target.closest("[href]")) {
				return this.openLink(event);
			}
		});

		document.addEventListener("contextmenu", (event) => {
			if (event.target.nodeName === "INPUT") {
				return this.openContextualMenuForInput(event);
			}
		});

		// Prevent form submits from changing the current window's URL
		document.addEventListener("submit", (event) => {
			if (event.target.nodeName === "FORM") {
				event.preventDefault();
				return this.openContextualMenuForInput(event);
			}
		});
	}

	addUnloadCallback(callback) {
		return this.unloadCallbacks.push(callback);
	}

	removeUnloadCallback(callback) {
		return (this.unloadCallbacks = this.unloadCallbacks.filter(
			(cb) => cb !== callback,
		));
	}

	runUnloadCallbacks() {
		let hasReturned = false;

		let unloadCallbacksRunning = 0;
		const unloadCallbackComplete = () => {
			unloadCallbacksRunning -= 1;
			if (unloadCallbacksRunning === 0 && hasReturned) {
				return this.runUnloadFinished();
			}
		};

		for (var callback of Array.from(this.unloadCallbacks)) {
			var returnValue = callback(unloadCallbackComplete);
			if (returnValue === false) {
				unloadCallbacksRunning += 1;
			} else if (returnValue !== true) {
				console.warn(
					`You registered an \`onBeforeUnload\` callback that does not return either exactly \`true\` or \`false\`. It returned ${returnValue}`,
					callback,
				);
			}
		}

		// In Electron, returning false cancels the close.
		hasReturned = true;
		return unloadCallbacksRunning === 0;
	}

	runUnloadFinished() {
		({ remote } = require("electron"));
		return _.defer(() => {
			if (remote.getGlobal("application").isQuitting()) {
				return remote.app.quit();
			} else if (NylasEnv.isReloading) {
				NylasEnv.isReloading = false;
				return NylasEnv.reload();
			} else {
				return NylasEnv.close();
			}
		});
	}

	// Important: even though we don't do anything here, we need to catch the
	// drop event to prevent the browser from navigating the to the "url" of the
	// file and completely leaving the app.
	onDrop(event) {
		event.preventDefault();
		return event.stopPropagation();
	}

	onDragOver(event) {
		event.preventDefault();
		return event.stopPropagation();
	}

	resolveHref(el) {
		if (!el) {
			return null;
		}
		const closestHrefEl = el.closest("[href]");
		if (closestHrefEl) {
			return closestHrefEl.getAttribute("href");
		}
		return null;
	}

	openLink({ href, target, currentTarget, metaKey }) {
		if (!href) {
			href = this.resolveHref(target || currentTarget);
		}
		if (!href) {
			return;
		}

		if (target != null ? target.closest(".no-open-link-events") : undefined) {
			return;
		}

		const { protocol } = url.parse(href);
		if (!protocol) {
			return;
		}

		if (["mailto:", "nylas:"].includes(protocol)) {
			// We sometimes get mailto URIs that are not escaped properly, or have been only partially escaped.
			// (T1927) Be sure to escape them once, and completely, before we try to open them. This logic
			// *might* apply to http/https as well but it's unclear.
			href = encodeURI(decodeURI(href));
			remote.getGlobal("application").openUrl(href);
		} else if (["http:", "https:", "tel:"].includes(protocol)) {
			shell.openExternal(href, { activate: !metaKey });
		}
	}

	openContextualMenuForInput(event) {
		let wordEnd, wordStart;
		event.preventDefault();

		if (
			![
				"text",
				"password",
				"email",
				"number",
				"range",
				"search",
				"tel",
				"url",
			].includes(event.target.type)
		) {
			return;
		}
		const hasSelectedText =
			event.target.selectionStart !== event.target.selectionEnd;

		if (hasSelectedText) {
			wordStart = event.target.selectionStart;
			wordEnd = event.target.selectionEnd;
		} else {
			wordStart = event.target.value.lastIndexOf(
				" ",
				event.target.selectionStart,
			);
			if (wordStart === -1) {
				wordStart = 0;
			}
			wordEnd = event.target.value.indexOf(" ", event.target.selectionStart);
			if (wordEnd === -1) {
				wordEnd = event.target.value.length;
			}
		}
		const word = event.target.value.substr(wordStart, wordEnd - wordStart);

		({ remote } = require("electron"));
		const { Menu, MenuItem } = remote;
		const menu = new Menu();

		const Spellchecker = require("./spellchecker").default;
		Spellchecker.appendSpellingItemsToMenu({
			menu,
			word,
			onCorrect: (correction) => {
				const insertionPoint = wordStart + correction.length;
				event.target.value = event.target.value.replace(word, correction);
				return event.target.setSelectionRange(insertionPoint, insertionPoint);
			},
		});

		menu.append(
			new MenuItem({
				label: "Cut",
				enabled: hasSelectedText,
				click: () => document.execCommand("cut"),
			}),
		);
		menu.append(
			new MenuItem({
				label: "Copy",
				enabled: hasSelectedText,
				click: () => document.execCommand("copy"),
			}),
		);
		menu.append(
			new MenuItem({
				label: "Paste",
				click: () => document.execCommand("paste"),
			}),
		);
		return menu.popup(remote.getCurrentWindow());
	}

	showDevModeMessages() {
		if (!NylasEnv.isMainWindow()) {
			return;
		}

		if (!NylasEnv.inDevMode()) {
			return console.log(
				`%c Welcome to Nylas Mail! If you're exploring the source or building a \
plugin, you should enable debug flags. It's slower, but \
gives you better exceptions, the debug version of React, \
and more. Choose %c Developer > Run with Debug Flags %c \
from the menu. Also, check out https://nylas.github.io/N1/docs/ \
for documentation and sample code!`,
				"background-color: antiquewhite;",
				"background-color: antiquewhite; font-weight:bold;",
				"background-color: antiquewhite; font-weight:normal;",
			);
		}
	}
};
