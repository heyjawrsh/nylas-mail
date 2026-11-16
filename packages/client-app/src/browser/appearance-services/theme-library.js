import { ipcMain } from "electron";
import { DEFAULT_THEME } from "../../appearance/look-runtime/defaults.js";
import { resolveLook } from "../../appearance/look-runtime/resolve-look.js";
import {
	readBuiltinThemes,
	readThemesFolder,
} from "../appearance-shell/builtin-themes.js";
import { readSignalsSnapshot } from "../appearance-shell/signals.js";

export default class ThemeLibrary {
	constructor({ resourcePath, configDirPath }) {
		this.revision = 0;
		this.themes = Object.fromEntries(
			readBuiltinThemes(resourcePath).map((descriptor) => [
				descriptor.id,
				{ ...descriptor, revision: this.revision },
			]),
		);
		this.defaultSwatch = this.themes[DEFAULT_THEME].swatch;
		this.themesFolder = readThemesFolder(configDirPath);
		ipcMain.handle("get-theme-library", () => ({
			descriptors: this.descriptors(),
			themesFolder: this.themesFolder,
			revision: this.revision,
		}));
	}

	setWindowManager(windowManager) {
		this.windowManager = windowManager;
	}

	descriptors() {
		return Object.values(this.themes);
	}

	publish(descriptor) {
		this.revision += 1;
		const published = { ...descriptor, revision: this.revision };
		this.themes[published.id] = published;
		this.windowManager?.sendToAllWindows("theme-changed", {}, published);
		return published;
	}

	windowLook(config) {
		const signals = readSignalsSnapshot();
		const attributes = resolveLook(config.get("core.appearance"), {}, signals, {
			themes: this.themes,
			styles: ["classic"],
		});
		const variant = attributes["data-variant"];
		const standard = variant.replace(/-hc$/, "");
		const { swatch } = this.themes[attributes["data-theme"]];
		const fallback = this.themes[DEFAULT_THEME].swatch;
		const backgroundColor =
			swatch?.[variant]?.surface ??
			swatch?.[standard]?.surface ??
			fallback?.[variant]?.surface ??
			fallback?.[standard]?.surface ??
			this.defaultSwatch[standard].surface;
		return { signals, attributes, backgroundColor, revision: this.revision };
	}

	repaintWindows(config) {
		if (!this.windowManager) return;
		const { backgroundColor } = this.windowLook(config);
		if (backgroundColor === this.lastBackgroundColor) return;
		// getOpenWindows excludes the hot window; the registry includes every window.
		for (const win of Object.values(this.windowManager._windows)) {
			win.browserWindow.setBackgroundColor(backgroundColor);
		}
		this.lastBackgroundColor = backgroundColor;
	}
}
