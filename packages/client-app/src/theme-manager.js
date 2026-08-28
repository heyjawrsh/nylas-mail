/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import path from "node:path";

import _ from "underscore";
import * as _emissary from "emissary";
const EmitterMixin = _emissary.Emitter || _emissary.default?.Emitter;
import { Emitter, Disposable, CompositeDisposable } from "event-kit";
let File = null;
try {
	({ File } = require("pathwatcher"));
} catch (_e) {
	/* optional native */
}
import fs from "fs-plus";
import Q from "q";

import _Package from "./package.js";

// Extended: Handles loading and activating available themes.
//
// An instance of this class is always available as the `NylasEnv.themes` global.
const ThemeManager = (() => {
	class ThemeManager {
		static initClass() {
			EmitterMixin.includeInto(ThemeManager);
		}

		constructor({ packageManager, resourcePath, configDirPath, safeMode }) {
			this.packageManager = packageManager;
			this.resourcePath = resourcePath;
			this.configDirPath = configDirPath;
			this.safeMode = safeMode;
			this.emitter = new Emitter();
			this.styleSheetDisposablesBySourcePath = {};
			this.lessCache = null;
			this.initialLoadComplete = false;
			this.packageManager.registerPackageActivator(this, ["theme"]);
			this.sheetsByStyleElement = new WeakMap();

			const stylesElement = document.head.querySelector("nylas-styles");
			stylesElement.onDidAddStyleElement(this.styleElementAdded.bind(this));
			stylesElement.onDidRemoveStyleElement(
				this.styleElementRemoved.bind(this),
			);
			stylesElement.onDidUpdateStyleElement(
				this.styleElementUpdated.bind(this),
			);
		}

		baseThemeName() {
			return "ui-light";
		}

		watchCoreStyles() {
			console.log("Watching /static and /internal_packages for LESS changes");
			const watchStylesIn = (folder) => {
				const stylePaths = fs.listTreeSync(folder);
				let PathWatcher = null;
				try {
					PathWatcher = require("pathwatcher");
				} catch (_e) {
					return null;
				}
				return (() => {
					const result = [];
					for (var stylePath of Array.from(stylePaths)) {
						if (path.extname(stylePath) !== ".less") {
							continue;
						}
						result.push(
							PathWatcher.watch(stylePath, () => {
								return this.activateThemes();
							}),
						);
					}
					return result;
				})();
			};
			watchStylesIn(`${this.resourcePath}/static`);
			return watchStylesIn(`${this.resourcePath}/internal_packages`);
		}

		styleElementAdded(styleElement) {
			const { sheet } = styleElement;
			this.sheetsByStyleElement.set(styleElement, sheet);
			this.emitter.emit("did-add-stylesheet", sheet);
			return this.emitter.emit("did-change-stylesheets");
		}

		styleElementRemoved(styleElement) {
			const sheet = this.sheetsByStyleElement.get(styleElement);
			this.emitter.emit("did-remove-stylesheet", sheet);
			return this.emitter.emit("did-change-stylesheets");
		}

		styleElementUpdated({ sheet }) {
			this.emitter.emit("did-remove-stylesheet", sheet);
			this.emitter.emit("did-add-stylesheet", sheet);
			return this.emitter.emit("did-change-stylesheets");
		}

		/*
    Section: Event Subscription
    */

		// Essential: Invoke `callback` when style sheet changes associated with
		// updating the list of active themes have completed.
		//
		// * `callback` {Function}
		onDidChangeActiveThemes(callback) {
			return this.emitter.on("did-change-active-themes", callback);
		}

		/*
    Section: Accessing Available Themes
    */

		getAvailableNames() {
			// TODO: Maybe should change to list all the available themes out there?
			return this.getLoadedNames();
		}

		/*
    Section: Accessing Loaded Themes
    */

		// Public: Get an array of all the loaded theme names.
		getLoadedThemeNames() {
			return Array.from(this.getLoadedThemes()).map((theme) => theme.name);
		}

		// Public: Get an array of all the loaded themes.
		getLoadedThemes() {
			return (() => {
				const result = [];
				for (var pack of Array.from(this.packageManager.getLoadedPackages())) {
					if (pack.isTheme()) {
						result.push(pack);
					}
				}
				return result;
			})();
		}

		/*
    Section: Accessing Active Themes
    */

		// Public: Get an array of all the active theme names.
		getActiveThemeNames() {
			return Array.from(this.getActiveThemes()).map((theme) => theme.name);
		}

		// Public: Get an array of all the active themes.
		getActiveThemes() {
			return (() => {
				const result = [];
				for (var pack of Array.from(this.packageManager.getActivePackages())) {
					if (pack.isTheme()) {
						result.push(pack);
					}
				}
				return result;
			})();
		}

		getActiveTheme() {
			// The first element in the array returned by `getActiveNames` themes will
			// actually be the active theme
			return this.getActiveThemes()[0];
		}

		activatePackages() {
			return this.activateThemes();
		}

		/*
    Section: Managing Enabled Themes
    */

		// Public: Get the enabled theme names from the config.
		//
		// Returns an array of theme names in the order that they should be activated.
		getEnabledThemeNames() {
			let left;
			let themeNames =
				(left = NylasEnv.config.get("core.themes")) != null ? left : [];
			if (!_.isArray(themeNames)) {
				themeNames = [themeNames];
			}
			themeNames = themeNames.filter((themeName) => {
				if (themeName && typeof themeName === "string") {
					if (NylasEnv.packages.resolvePackagePath(themeName)) {
						return true;
					}
					console.warn(`Enabled theme '${themeName}' is not installed.`);
				}
				return false;
			});

			// Use a built-in theme any time the configured themes are not
			// available.
			if (themeNames.length === 0) {
				const builtInThemeNames = ["ui-light", "ui-dark"];
				themeNames = _.intersection(themeNames, builtInThemeNames);
				if (themeNames.length === 0) {
					themeNames = ["ui-light"];
				}
			}

			// Reverse so the first (top) theme is loaded after the others. We want
			// the first/top theme to override later themes in the stack.
			return themeNames.reverse();
		}

		// Set the active theme.
		// Because of how theme-manager works, we always need to set the
		// base theme first, and the newly activated theme after it to override the
		// styles. We don't want to have more than 1 theme active at a time, so the
		// array of active themes should always be of size 2.
		//
		// * `theme` {string} - the theme to activate
		setActiveTheme(theme) {
			const base = this.baseThemeName();
			return NylasEnv.config.set("core.themes", _.uniq([base, theme]));
		}

		/*
    Section: Private
    */

		// Resolve and apply the stylesheet specified by the path.
		//
		// This supports both CSS and Less stylsheets.
		//
		// * `stylesheetPath` A {String} path to the stylesheet that can be an absolute
		//   path or a relative path that will be resolved against the load path.
		//
		// Returns a {Disposable} on which `.dispose()` can be called to remove the
		// required stylesheet.
		requireStylesheet(stylesheetPath) {
			let fullPath;
			if ((fullPath = this.resolveStylesheet(stylesheetPath))) {
				const content = this.loadStylesheet(fullPath);
				return this.applyStylesheet(fullPath, content);
			} else {
				throw new Error(`Could not find a file at path '${stylesheetPath}'`);
			}
		}

		loadBaseStylesheets() {
			return this.reloadBaseStylesheets();
		}

		reloadBaseStylesheets() {
			let nativeStylesheetPath;
			this.requireStylesheet("../static/index");
			this.requireStylesheet("../static/email-frame");
			if (
				(nativeStylesheetPath = fs.resolveOnLoadPath(process.platform, [
					"css",
					"less",
				]))
			) {
				return this.requireStylesheet(nativeStylesheetPath);
			}
		}

		stylesheetElementForId(id) {
			return document.head.querySelector(
				`nylas-styles style[source-path="${id}"]`,
			);
		}

		resolveStylesheet(stylesheetPath) {
			if (path.extname(stylesheetPath).length > 0) {
				return fs.resolveOnLoadPath(stylesheetPath);
			} else {
				return fs.resolveOnLoadPath(stylesheetPath, ["css", "less"]);
			}
		}

		loadStylesheet(stylesheetPath, importFallbackVariables) {
			if (path.extname(stylesheetPath) === ".less") {
				return this.loadLessStylesheet(stylesheetPath, importFallbackVariables);
			} else {
				return fs.readFileSync(stylesheetPath, "utf8");
			}
		}

		loadLessStylesheet(lessStylesheetPath, importFallbackVariables) {
			let detail, message;
			if (importFallbackVariables == null) {
				importFallbackVariables = false;
			}
			if (this.lessCache == null) {
				const LessCompileCache = require("./less-compile-cache.js").default;
				this.lessCache = new LessCompileCache({
					configDirPath: this.configDirPath,
					resourcePath: this.resourcePath,
					importPaths: this.getImportPaths(),
				});
			}

			try {
				if (importFallbackVariables) {
					const baseVarImports = `\
@import "variables/ui-variables";\
`;
					const less = fs.readFileSync(lessStylesheetPath, "utf8");
					return this.lessCache.cssForFile(
						lessStylesheetPath,
						[baseVarImports, less].join("\n"),
					);
				} else {
					return this.lessCache.read(lessStylesheetPath);
				}
			} catch (error) {
				if (error.line != null) {
					message = `Error compiling Less stylesheet: \`${lessStylesheetPath}\``;
					detail = `\
Line number: ${error.line}
${error.message}\
`;
				} else {
					message = `Error loading Less stylesheet: \`${lessStylesheetPath}\``;
					detail = error.message;
				}

				console.error(message, { detail, dismissable: true });
				console.error(detail);
				throw error;
			}
		}

		removeStylesheet(stylesheetPath) {
			return this.styleSheetDisposablesBySourcePath[stylesheetPath] != null
				? this.styleSheetDisposablesBySourcePath[stylesheetPath].dispose()
				: undefined;
		}

		applyStylesheet(path, text) {
			return (this.styleSheetDisposablesBySourcePath[path] =
				NylasEnv.styles.addStyleSheet(text, { sourcePath: path }));
		}

		stringToId(string) {
			return string.replace(/\\/g, "/");
		}

		activateThemes() {
			const deferred = Q.defer();

			// NylasEnv.config.observe runs the callback once, then on subsequent changes.
			NylasEnv.config.observe("core.themes", () => {
				this.deactivateThemes();

				// Refreshing the less cache is very expensive (hundreds of ms). It
				// will be refreshed once the promise resolves after packages are
				// activated.

				const promises = [];
				for (var themeName of Array.from(this.getEnabledThemeNames())) {
					if (this.packageManager.resolvePackagePath(themeName)) {
						promises.push(this.packageManager.activatePackage(themeName));
					} else {
						console.warn(
							`Failed to activate theme '${themeName}' because it isn't installed.`,
						);
					}
				}

				return Q.all(promises).then(() => {
					this.addActiveThemeClasses();
					this.refreshLessCache(); // Update cache again now that @getActiveThemes() is populated
					this.reloadBaseStylesheets();
					this.initialLoadComplete = true;
					this.emitter.emit("did-change-active-themes");
					return deferred.resolve();
				});
			});

			return deferred.promise;
		}

		deactivateThemes() {
			this.removeActiveThemeClasses();
			for (var pack of Array.from(this.getActiveThemes())) {
				this.packageManager.deactivatePackage(pack.name);
			}
			return null;
		}

		isInitialLoadComplete() {
			return this.initialLoadComplete;
		}

		addActiveThemeClasses() {
			for (var pack of Array.from(this.getActiveThemes())) {
				document.body.classList.add(`theme-${pack.name}`);
			}
		}

		removeActiveThemeClasses() {
			for (var pack of Array.from(this.getActiveThemes())) {
				document.body.classList.remove(`theme-${pack.name}`);
			}
		}

		refreshLessCache() {
			return this.lessCache != null
				? this.lessCache.setImportPaths(this.getImportPaths())
				: undefined;
		}

		getImportPaths() {
			let themePaths;
			const activeThemes = this.getActiveThemes();
			if (activeThemes.length > 0) {
				themePaths = Array.from(activeThemes)
					.filter((theme) => theme)
					.map((theme) => theme.getStylesheetsPath());
			} else {
				themePaths = [];
				for (var themeName of Array.from(this.getEnabledThemeNames())) {
					var themePath;
					if ((themePath = this.packageManager.resolvePackagePath(themeName))) {
						var deprecatedPath = path.join(themePath, "stylesheets");
						if (fs.isDirectorySync(deprecatedPath)) {
							themePaths.push(deprecatedPath);
						} else {
							themePaths.push(path.join(themePath, "styles"));
						}
					}
				}
			}

			return themePaths.filter((themePath) => fs.isDirectorySync(themePath));
		}
	}
	ThemeManager.initClass();
	return ThemeManager;
})();

export default ThemeManager;
