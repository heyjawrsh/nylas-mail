/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS104: Avoid inline assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let _error, Package, packagesCache;
const path = require("node:path");

const _ = require("underscore");
const _async = require("async");
const fs = require("fs-plus");
const EmitterMixin = require("emissary").Emitter;
const { Emitter, CompositeDisposable } = require("event-kit");
const Q = require("q");

const ModuleCache = require("./module-cache");

const TaskRegistry = require("./registries/task-registry").default;
const DatabaseObjectRegistry =
	require("./registries/database-object-registry").default;

try {
	let left;
	packagesCache =
		(left = __guard__(require("../package.json"), (x) => x._N1Packages)) != null
			? left
			: {};
} catch (error1) {
	_error = error1;
	packagesCache = {};
}

// Loads and activates a package's main module and resources such as
// stylesheets, keymaps, and menus.
module.exports = Package = (() => {
	Package = class Package {
		static initClass() {
			EmitterMixin.includeInto(Package);

			Package.prototype.keymaps = null;
			Package.prototype.menus = null;
			Package.prototype.stylesheets = null;
			Package.prototype.stylesheetDisposables = null;
			Package.prototype.mainModulePath = null;
			Package.prototype.resolvedMainModulePath = false;
			Package.prototype.mainModule = null;
		}

		static isBundledPackagePath(packagePath) {
			if (NylasEnv.packages.devMode) {
				if (
					!NylasEnv.packages.resourcePath.startsWith(
						`${process.resourcesPath}${path.sep}`,
					)
				) {
					return false;
				}
			}

			if (Package.resourcePathWithTrailingSlash == null) {
				Package.resourcePathWithTrailingSlash = `${NylasEnv.packages.resourcePath}${path.sep}`;
			}
			return packagePath != null
				? packagePath.startsWith(Package.resourcePathWithTrailingSlash)
				: undefined;
		}

		static loadMetadata(packagePath, ignoreErrors) {
			let metadata;
			if (ignoreErrors == null) {
				ignoreErrors = false;
			}
			const packageName = path.basename(packagePath);
			if (Package.isBundledPackagePath(packagePath)) {
				metadata =
					packagesCache[packageName] != null
						? packagesCache[packageName].metadata
						: undefined;
			}
			if (metadata == null) {
				const metadataPath = fs.resolve(path.join(packagePath, "package.json"));
				if (fs.existsSync(metadataPath)) {
					try {
						metadata = JSON.parse(fs.readFileSync(metadataPath));
					} catch (error) {
						if (!ignoreErrors) {
							throw error;
						}
					}
				}
			}
			if (metadata == null) {
				metadata = {};
			}
			metadata.name = packageName;

			if (metadata.stylesheets != null) {
				metadata.styleSheets = metadata.stylesheets;
			}

			return metadata;
		}

		/*
    Section: Construction
    */

		constructor(path1, metadata) {
			this.path = path1;
			this.metadata = metadata;
			this.emitter = new Emitter();
			if (this.metadata == null) {
				this.metadata = Package.loadMetadata(this.path);
			}
			this.bundledPackage = Package.isBundledPackagePath(this.path);
			this.name =
				(this.metadata != null ? this.metadata.name : undefined) != null
					? this.metadata != null
						? this.metadata.name
						: undefined
					: path.basename(this.path);
			this.pluginAppId = this.name;

			this.displayName =
				(this.metadata != null ? this.metadata.displayName : undefined) ||
				this.name;
			ModuleCache.add(this.path, this.metadata);
			this.reset();
			this.declaresNewDatabaseObjects = false;
		}

		// TODO FIXME: Use a unique pluginID instead of just the "name"
		// This needs to be included here to prevent a circular dependency error
		pluginId() {
			return this.pluginAppId != null ? this.pluginAppId : this.name;
		}

		/*
    Section: Event Subscription
    */

		// Essential: Invoke the given callback when all packages have been activated.
		//
		// * `callback` {Function}
		//
		// Returns a {Disposable} on which `.dispose()` can be called to unsubscribe.
		onDidDeactivate(callback) {
			return this.emitter.on("did-deactivate", callback);
		}

		/*
    Section: Instance Methods
    */

		enable() {
			return NylasEnv.config.removeAtKeyPath(
				"core.disabledPackages",
				this.name,
			);
		}

		disable() {
			return NylasEnv.config.pushAtKeyPath("core.disabledPackages", this.name);
		}

		isTheme() {
			return (this.metadata != null ? this.metadata.theme : undefined) != null;
		}

		measure(key, fn) {
			const startTime = Date.now();
			const value = fn();
			this[key] = Date.now() - startTime;
			return value;
		}

		getType() {
			return "nylas";
		}

		getStyleSheetPriority() {
			return 0;
		}

		load() {
			this.measure("loadTime", () => {
				try {
					this.declaresNewDatabaseObjects = false;
					this.loadKeymaps();
					this.loadMenus();
					this.loadStylesheets();
					const mainModule = this.requireMainModule();
					if (!mainModule) {
						return;
					}
					this.registerModelConstructors(mainModule.modelConstructors);
					return this.registerTaskConstructors(mainModule.taskConstructors);
				} catch (error) {
					console.warn(`Failed to load package named '${this.name}'`);
					console.warn(error.stack != null ? error.stack : error);
					return console.error(error.message, error);
				}
			});
			return this;
		}

		registerModelConstructors(constructors) {
			if (constructors == null) {
				constructors = [];
			}
			if (constructors.length > 0) {
				this.declaresNewDatabaseObjects = true;

				return _.each(constructors, (constructor) => {
					const constructorFactory = () => constructor;
					return DatabaseObjectRegistry.register(
						constructor.name,
						constructorFactory,
					);
				});
			}
		}

		registerTaskConstructors(constructors) {
			if (constructors == null) {
				constructors = [];
			}
			return _.each(constructors, (constructor) => {
				const constructorFactory = () => constructor;
				return TaskRegistry.register(constructor.name, constructorFactory);
			});
		}

		reset() {
			this.stylesheets = [];
			this.keymaps = [];
			return (this.menus = []);
		}

		activate() {
			if (this.activationDeferred == null) {
				this.activationDeferred = Q.defer();
				this.measure("activateTime", () => {
					this.activateResources();
					return this.activateNow();
				});
			}

			return Q.all([this.activationDeferred.promise]);
		}

		activateNow() {
			try {
				this.activateConfig();
				this.activateStylesheets();
				if (this.requireMainModule()) {
					let left1;
					const localState =
						(left1 = NylasEnv.packages.getPackageState(this.name)) != null
							? left1
							: {};
					this.mainModule.activate(localState);
					this.mainActivated = true;
				}
			} catch (e) {
				console.error(e.message);
				console.error(e.stack);
				console.warn(
					`Failed to activate package named '${this.name}'`,
					e.stack,
				);
			}

			return this.activationDeferred != null
				? this.activationDeferred.resolve()
				: undefined;
		}

		activateConfig() {
			if (this.configActivated) {
				return;
			}

			this.requireMainModule();
			if (this.mainModule != null) {
				if (
					this.mainModule.config != null &&
					typeof this.mainModule.config === "object"
				) {
					NylasEnv.config.setSchema(this.name, {
						type: "object",
						properties: this.mainModule.config,
					});
				} else if (
					this.mainModule.configDefaults != null &&
					typeof this.mainModule.configDefaults === "object"
				) {
					NylasEnv.config.setDefaults(
						this.name,
						this.mainModule.configDefaults,
					);
				}
				if (typeof this.mainModule.activateConfig === "function") {
					this.mainModule.activateConfig();
				}
			}
			return (this.configActivated = true);
		}

		activateStylesheets() {
			if (this.stylesheetsActivated) {
				return;
			}

			this.stylesheetDisposables = new CompositeDisposable();

			const priority = this.getStyleSheetPriority();
			for (var [sourcePath, source] of Array.from(this.stylesheets)) {
				var context, match;
				if ((match = path.basename(sourcePath).match(/[^.]*\.([^.]*)\./))) {
					context = match[1];
				} else {
					context = undefined;
				}

				this.stylesheetDisposables.add(
					NylasEnv.styles.addStyleSheet(source, {
						sourcePath,
						priority,
						context,
					}),
				);
			}
			return (this.stylesheetsActivated = true);
		}

		activateResources() {
			let keymapPath;
			let map;
			this.activationDisposables = new CompositeDisposable();
			for ([keymapPath, map] of Array.from(this.keymaps)) {
				this.activationDisposables.add(
					NylasEnv.keymaps.loadKeymap(keymapPath, map),
				);
			}
			return (() => {
				let _menuPath;
				const result = [];
				for ([_menuPath, map] of Array.from(this.menus)) {
					if (map.menu != null) {
						result.push(
							this.activationDisposables.add(NylasEnv.menu.add(map.menu)),
						);
					}
				}
				return result;
			})();
		}

		loadKeymaps() {
			let keymapPath;
			try {
				if (this.bundledPackage && packagesCache[this.name] != null) {
					return (this.keymaps = (() => {
						const result = [];
						for (keymapPath in packagesCache[this.name].keymaps) {
							var keymapObject = packagesCache[this.name].keymaps[keymapPath];
							result.push([
								`${NylasEnv.packages.resourcePath}${path.sep}${keymapPath}`,
								keymapObject,
							]);
						}
						return result;
					})());
				} else {
					return (this.keymaps = this.getKeymapPaths().map((keymapPath) => {
						let left1;
						return [
							keymapPath,
							(left1 = JSON.parse(fs.readFileSync(keymapPath))) != null
								? left1
								: {},
						];
					}));
				}
			} catch (e) {
				return console.error(
					`Error reading keymaps for package '${this.name}': ${e.message}`,
					e.stack,
				);
			}
		}

		loadMenus() {
			let menuPath;
			try {
				if (this.bundledPackage && packagesCache[this.name] != null) {
					this.menus = (() => {
						const result = [];
						for (menuPath in packagesCache[this.name].menus) {
							var menuObject = packagesCache[this.name].menus[menuPath];
							result.push([
								`${NylasEnv.packages.resourcePath}${path.sep}${menuPath}`,
								menuObject,
							]);
						}
						return result;
					})();
				} else {
					this.menus = this.getMenuPaths().map((menuPath) => {
						let left1;
						return [
							menuPath,
							(left1 = JSON.parse(fs.readFileSync(menuPath))) != null
								? left1
								: {},
						];
					});
				}
			} catch (e) {
				console.error(
					`Error reading menus for package '${this.name}': ${e.message}`,
					e.stack,
				);
			}

			return (() => {
				let menuObj;
				const result1 = [];
				for ([menuPath, menuObj] of Array.from(this.menus)) {
					result1.push(
						Array.from(menuObj.menu).map(
							(menuItem) => (menuItem.isOptional = this.metadata.isOptional),
						),
					);
				}
				return result1;
			})();
		}

		getKeymapPaths() {
			const keymapsDirPath = path.join(this.path, "keymaps");
			if (this.metadata.keymaps) {
				return this.metadata.keymaps.map((name) =>
					fs.resolve(keymapsDirPath, name, ["json", ""]),
				);
			} else {
				return fs.listSync(keymapsDirPath, ["json"]);
			}
		}

		getMenuPaths() {
			const menusDirPath = path.join(this.path, "menus");
			if (this.metadata.menus) {
				return this.metadata.menus.map((name) =>
					fs.resolve(menusDirPath, name, ["json", ""]),
				);
			} else {
				return fs.listSync(menusDirPath, ["json"]);
			}
		}

		loadStylesheets() {
			return (this.stylesheets = this.getStylesheetPaths().map(
				(stylesheetPath) => [
					stylesheetPath,
					NylasEnv.themes.loadStylesheet(stylesheetPath, true),
				],
			));
		}

		getStylesheetsPath() {
			if (fs.isDirectorySync(path.join(this.path, "stylesheets"))) {
				return path.join(this.path, "stylesheets");
			} else {
				return path.join(this.path, "styles");
			}
		}

		getStylesheetPaths() {
			let indexStylesheet;
			const stylesheetDirPath = this.getStylesheetsPath();
			if (this.metadata.mainStyleSheet) {
				return [fs.resolve(this.path, this.metadata.mainStyleSheet)];
			} else if (this.metadata.styleSheets) {
				return this.metadata.styleSheets.map((name) =>
					fs.resolve(stylesheetDirPath, name, ["css", "less", ""]),
				);
			} else if (
				(indexStylesheet = fs.resolve(this.path, "index", ["css", "less"]))
			) {
				return [indexStylesheet];
			} else {
				return _.filter(
					fs.listSync(stylesheetDirPath, ["css", "less"]),
					(file) => path.basename(file)[0] !== ".",
				);
			}
		}

		serialize() {
			if (this.mainActivated) {
				try {
					return __guardMethod__(this.mainModule, "serialize", (o) =>
						o.serialize(),
					);
				} catch (e) {
					return console.error(
						`Error serializing package '${this.name}'`,
						e.stack,
					);
				}
			}
		}

		deactivate() {
			if (this.activationDeferred != null) {
				this.activationDeferred.reject();
			}
			this.activationDeferred = null;
			this.deactivateResources();
			this.deactivateConfig();
			if (this.mainActivated) {
				try {
					__guardMethod__(this.mainModule, "deactivate", (o) => o.deactivate());
				} catch (e) {
					console.error(`Error deactivating package '${this.name}'`, e.stack);
				}
			}
			this.emit("deactivated");
			return this.emitter.emit("did-deactivate");
		}

		deactivateConfig() {
			__guardMethod__(this.mainModule, "deactivateConfig", (o) =>
				o.deactivateConfig(),
			);
			return (this.configActivated = false);
		}

		deactivateResources() {
			if (this.stylesheetDisposables != null) {
				this.stylesheetDisposables.dispose();
			}
			if (this.activationDisposables != null) {
				this.activationDisposables.dispose();
			}
			return (this.stylesheetsActivated = false);
		}

		reloadStylesheets() {
			const _oldSheets = _.clone(this.stylesheets);
			this.loadStylesheets();
			if (this.stylesheetDisposables != null) {
				this.stylesheetDisposables.dispose();
			}
			this.stylesheetDisposables = new CompositeDisposable();
			this.stylesheetsActivated = false;
			return this.activateStylesheets();
		}

		requireMainModule() {
			if (this.mainModule != null) {
				return this.mainModule;
			}
			if (!this.isCompatible()) {
				console.warn(`\
Failed to require the main module of '${this.name}' because it requires an incompatible native module.
Run \`apm rebuild\` in the package directory to resolve.\
`);
				return;
			}
			const mainModulePath = this.getMainModulePath();
			if (fs.isFileSync(mainModulePath)) {
				this.mainModule = require(mainModulePath);
			}
			return this.mainModule;
		}

		getMainModulePath() {
			if (this.resolvedMainModulePath) {
				return this.mainModulePath;
			}
			this.resolvedMainModulePath = true;

			if (this.bundledPackage && packagesCache[this.name] != null) {
				if (packagesCache[this.name].main) {
					this.mainModulePath = `${NylasEnv.packages.resourcePath}${path.sep}${packagesCache[this.name].main}`;
					return (this.mainModulePath = fs.resolveExtension(
						this.mainModulePath,
						["", ...Array.from(Object.keys(require.extensions))],
					));
				} else {
					return (this.mainModulePath = null);
				}
			} else {
				const mainModulePath = this.metadata.main
					? path.join(this.path, this.metadata.main)
					: path.join(this.path, "index");
				return (this.mainModulePath = fs.resolveExtension(mainModulePath, [
					"",
					...Array.from(Object.keys(require.extensions)),
				]));
			}
		}

		isNativeModule(modulePath) {
			try {
				return (
					fs.listSync(path.join(modulePath, "build", "Release"), [".node"])
						.length > 0
				);
			} catch (_error) {
				return false;
			}
		}

		// Get an array of all the native modules that this package depends on.
		// This will recurse through all dependencies.
		getNativeModuleDependencyPaths() {
			const nativeModulePaths = [];

			var traversePath = (nodeModulesPath) => {
				try {
					return (() => {
						const result = [];
						for (var modulePath of Array.from(fs.listSync(nodeModulesPath))) {
							if (this.isNativeModule(modulePath)) {
								nativeModulePaths.push(modulePath);
							}
							result.push(traversePath(path.join(modulePath, "node_modules")));
						}
						return result;
					})();
				} catch (_error2) {}
			};

			traversePath(path.join(this.path, "node_modules"));
			return nativeModulePaths;
		}

		// Get the incompatible native modules that this package depends on.
		// This recurses through all dependencies and requires all modules that
		// contain a `.node` file.
		//
		// This information is cached in local storage on a per package/version basis
		// to minimize the impact on startup time.
		getIncompatibleNativeModules() {
			let incompatibleNativeModules;
			const localStorageKey = `installed-packages:${this.name}:${this.metadata.version}`;
			if (!NylasEnv.inDevMode()) {
				try {
					let left1;
					({ incompatibleNativeModules } =
						(left1 = JSON.parse(
							global.localStorage.getItem(localStorageKey),
						)) != null
							? left1
							: {});
				} catch (_error2) {}
				if (incompatibleNativeModules != null) {
					return incompatibleNativeModules;
				}
			}

			incompatibleNativeModules = [];
			for (var nativeModulePath of Array.from(
				this.getNativeModuleDependencyPaths(),
			)) {
				var version;
				try {
					require(nativeModulePath);
				} catch (error) {
					try {
						({ version } = nodeRequire(`${nativeModulePath}/package.json`));
					} catch (_error3) {}
					incompatibleNativeModules.push({
						path: nativeModulePath,
						name: path.basename(nativeModulePath),
						version,
						error: error.message,
					});
				}
			}

			global.localStorage.setItem(
				localStorageKey,
				JSON.stringify({ incompatibleNativeModules }),
			);
			return incompatibleNativeModules;
		}

		// Public: Is this package compatible with this version of N1?
		//
		// Incompatible packages cannot be activated. This will include packages
		// installed to ~/.nylas-mail/packages that were built against node 0.11.10 but
		// now need to be upgrade to node 0.11.13.
		//
		// Returns a {Boolean}, true if compatible, false if incompatible.
		isCompatible() {
			let packageMain;
			if (this.compatible != null) {
				return this.compatible;
			}

			if (
				this.path.indexOf(
					path.join(NylasEnv.packages.resourcePath, "node_modules") + path.sep,
				) === 0
			) {
				// Bundled packages are always considered compatible
				return (this.compatible = true);
			} else if ((packageMain = this.getMainModulePath())) {
				this.incompatibleModules = this.getIncompatibleNativeModules();
				return (this.compatible = this.incompatibleModules.length === 0);
			} else {
				return (this.compatible = true);
			}
		}
	};
	Package.initClass();
	return Package;
})();

function __guard__(value, transform) {
	return typeof value !== "undefined" && value !== null
		? transform(value)
		: undefined;
}
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
