/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let PackageManager;
const path = require('path');
const url = require('url');

const _ = require('underscore');
const {ipcRenderer, remote} = require('electron');
const EmitterMixin = require('emissary').Emitter;
const {Emitter} = require('event-kit');
const fs = require('fs-plus');
const Q = require('q');

const Actions = require('./flux/actions').default;
const Package = require('./package');
const ThemePackage = require('./theme-package');
const DatabaseStore = require('./flux/stores/database-store').default;
const APMWrapper = require('./apm-wrapper');

let basePackagePaths = null;

// Extended: Package manager for coordinating the lifecycle of Nylas Mail packages.
//
// An instance of this class is always available as the `NylasEnv.packages` global.
//
// Packages can be loaded, activated, and deactivated, and unloaded:
//  * Loading a package reads and parses the package's metadata and resources
//    such as keymaps, menus, stylesheets, etc.
//  * Activating a package registers the loaded resources and calls `activate()`
//    on the package's main module.
//  * Deactivating a package unregisters the package's resources  and calls
//    `deactivate()` on the package's main module.
//  * Unloading a package removes it completely from the package manager.
//
// Packages can be enabled/disabled via the `core.disabledPackages` config
// settings and also by calling `enablePackage()/disablePackage()`.
//
// Section: NylasEnv
module.exports =
(PackageManager = (function() {
  PackageManager = class PackageManager {
    static initClass() {
      EmitterMixin.includeInto(this);
    }

    constructor({configDirPath, devMode, safeMode, resourcePath, specMode}) {
      this.pluginIdFor = this.pluginIdFor.bind(this);
      this._onChangePluginState = this._onChangePluginState.bind(this);
      this._notifyPluginsChanged = this._notifyPluginsChanged.bind(this);
      this._resolvePluginIdFor = this._resolvePluginIdFor.bind(this);
      this._onPluginsChanged = this._onPluginsChanged.bind(this);
      this.devMode = devMode;
      this.resourcePath = resourcePath;
      this.specMode = specMode;
      this.emitter = new Emitter;
      this.onPluginsChanged = _.debounce(this._onPluginsChanged, 200);
      this.packageDirPaths = [];
      if (this.specMode) {
        this.packageDirPaths.push(path.join(this.resourcePath, "spec", "fixtures", "packages"));
      } else {
        this.packageDirPaths.push(path.join(this.resourcePath, "internal_packages"));
        if (!safeMode) {
          if (this.devMode) {
            this.packageDirPaths.push(path.join(configDirPath, "dev", "packages"));
          }
          this.packageDirPaths.push(path.join(configDirPath, "packages"));
        }
      }

      this.loadedPackages = {};
      this.cachedPackagePluginIds = {};
      this.packagesWithDatabaseObjects = [];
      this.activePackages = {};
      this.packageStates = {};

      this.packageActivators = [];
      this.registerPackageActivator(this, ['nylas']);

      ipcRenderer.on("changePluginStateFromUrl", this._onChangePluginState);
    }


    pluginIdFor(packageName) {
      const env = NylasEnv.config.get("env");
      const cacheKey = `${packageName}:${env}`;

      if (this.cachedPackagePluginIds[cacheKey] === undefined) {
        this.cachedPackagePluginIds[cacheKey] = this._resolvePluginIdFor(packageName, env);
      }
      return this.cachedPackagePluginIds[cacheKey];
    }

    _onChangePluginState(event, urlToOpen) {
      let left;
      if (urlToOpen == null) { urlToOpen = ""; }
      const {query} = url.parse(urlToOpen, true);
      let disabled = (left = NylasEnv.config.get('core.disabledPackages')) != null ? left : [];
      const turnedOn = [];
      const turnedOff = [];
      for (var name in query) {
        var state = query[name];
        if (/-displayName/gi.test(name)) { continue; }
        var displayName = query[`${name}-displayName`] != null ? query[`${name}-displayName`] : name;
        if ((state === "off") && !Array.from(disabled).includes(name)) {
          turnedOff.push(displayName);
          if (!Array.from(disabled).includes(name)) { disabled.push(name); }
        } else if (state === "on") {
          turnedOn.push(displayName);
          disabled = _.without(disabled, name);
        }
      }
      NylasEnv.config.set('core.disabledPackages', disabled);
      if (NylasEnv.isMainWindow()) { NylasEnv.focus(); }
      if (turnedOn.length > 0) { this._notifyPluginsChanged(turnedOn, "enabled"); }
      if (turnedOff.length > 0) { return this._notifyPluginsChanged(turnedOff, "disabled"); }
    }

    _notifyPluginsChanged(names, dir) {
      if (names.length >= 2) {
        const last = names[names.length - 1];
        names[names.length - 1] = `and ${last}`;
      }
      const has = names.length === 1 ? "has" : "have";
      const pluginText = names.length === 1 ? "Plugin" : "Plugins";
      return setTimeout(() => {
        return remote.dialog.showMessageBox(remote.getCurrentWindow(), {
          type: 'info',
          message: `${pluginText} ${dir}`,
          detail: `${names.join(", ")} ${has} been ${dir}`,
          buttons: ['Thanks'],
        });
      }
      , 500);
    }

    _resolvePluginIdFor(packageName, env) {
      let metadata = this.loadedPackages[packageName] != null ? this.loadedPackages[packageName].metadata : undefined;

      if (!metadata) {
        const packagePath = this.resolvePackagePath(packageName);
        if (!packagePath) { return null; }
        metadata = Package.loadMetadata(packagePath);
      }

      if (metadata) { return metadata.name; }
      return null;
    }

    /*
    Section: Event Subscription
    */

    // Public: Invoke the given callback when all packages have been loaded.
    //
    // * `callback` {Function}
    //
    // Returns a {Disposable} on which `.dispose()` can be called to unsubscribe.
    onDidLoadInitialPackages(callback) {
      return this.emitter.on('did-load-initial-packages', callback);
    }

    // Public: Invoke the given callback when all packages have been activated.
    //
    // * `callback` {Function}
    //
    // Returns a {Disposable} on which `.dispose()` can be called to unsubscribe.
    onDidActivateInitialPackages(callback) {
      return this.emitter.on('did-activate-initial-packages', callback);
    }

    // Public: Invoke the given callback when a package is activated.
    //
    // * `callback` A {Function} to be invoked when a package is activated.
    //   * `package` The {Package} that was activated.
    //
    // Returns a {Disposable} on which `.dispose()` can be called to unsubscribe.
    onDidActivatePackage(callback) {
      return this.emitter.on('did-activate-package', callback);
    }

    // Public: Invoke the given callback when a package is deactivated.
    //
    // * `callback` A {Function} to be invoked when a package is deactivated.
    //   * `package` The {Package} that was deactivated.
    //
    // Returns a {Disposable} on which `.dispose()` can be called to unsubscribe.
    onDidDeactivatePackage(callback) {
      return this.emitter.on('did-deactivate-package', callback);
    }

    // Public: Invoke the given callback when a package is loaded.
    //
    // * `callback` A {Function} to be invoked when a package is loaded.
    //   * `package` The {Package} that was loaded.
    //
    // Returns a {Disposable} on which `.dispose()` can be called to unsubscribe.
    onDidLoadPackage(callback) {
      return this.emitter.on('did-load-package', callback);
    }

    // Public: Invoke the given callback when a package is unloaded.
    //
    // * `callback` A {Function} to be invoked when a package is unloaded.
    //   * `package` The {Package} that was unloaded.
    //
    // Returns a {Disposable} on which `.dispose()` can be called to unsubscribe.
    onDidUnloadPackage(callback) {
      return this.emitter.on('did-unload-package', callback);
    }

    /*
    Section: Package system data
    */

    // Public: Get the path to the apm command.
    //
    // Return a {String} file path to apm.
    getApmPath() {
      if (this.apmPath != null) { return this.apmPath; }

      let commandName = 'apm';
      if (process.platform === 'win32') { commandName += '.cmd'; }

      this.apmPath = path.join(process.resourcesPath, 'apm', 'bin', commandName);
      if (!fs.isFileSync(this.apmPath)) {
        this.apmPath = path.join(this.resourcePath, 'apm', 'bin', commandName);
      }
      if (!fs.isFileSync(this.apmPath)) {
        this.apmPath = path.join(this.resourcePath, 'apm', 'node_modules', 'atom-package-manager', 'bin', commandName);
      }
      return this.apmPath;
    }

    // Public: Get the paths being used to look for packages.
    //
    // Returns an {Array} of {String} directory paths.
    getPackageDirPaths() {
      return _.clone(this.packageDirPaths);
    }

    /*
    Section: General package data
    */

    // Public: Resolve the given package name to a path on disk.
    //
    // * `name` - The {String} package name.
    //
    // Return a {String} folder path or undefined if it could not be resolved.
    resolvePackagePath(name) {
      let packagePath = fs.resolve(...Array.from(this.packageDirPaths), name);
      if (fs.isDirectorySync(packagePath)) { return packagePath; }

      packagePath = path.join(this.resourcePath, 'node_modules', name);
      if (this.hasNylasEngine(packagePath)) { return packagePath; }
    }

    // Public: Is the package with the given name bundled with Nylas?
    //
    // * `name` - The {String} package name.
    //
    // Returns a {Boolean}.
    isBundledPackage(name) {
      return this.getPackageDependencies().hasOwnProperty(name);
    }

    /*
    Section: Enabling and disabling packages
    */

    // Public: Enable the package with the given name.
    //
    // Returns the {Package} that was enabled or null if it isn't loaded.
    enablePackage(name) {
      const pack = this.loadPackage(name);
      if (pack != null) {
        pack.enable();
      }
      return pack;
    }

    // Public: Disable the package with the given name.
    //
    // Returns the {Package} that was disabled or null if it isn't loaded.
    disablePackage(name) {
      const pack = this.loadPackage(name);
      if (pack != null) {
        pack.disable();
      }
      return pack;
    }

    // Public: Is the package with the given name disabled?
    //
    // * `name` - The {String} package name.
    //
    // Returns a {Boolean}.
    isPackageDisabled(name) {
      let left;
      return _.include((left = NylasEnv.config.get('core.disabledPackages')) != null ? left : [], name);
    }

    /*
    Section: Accessing active packages
    */

    // Public: Get an {Array} of all the active {Package}s.
    getActivePackages() {
      return _.values(this.activePackages);
    }

    // Public: Get the active {Package} with the given name.
    //
    // * `name` - The {String} package name.
    //
    // Returns a {Package} or undefined.
    getActivePackage(name) {
      return this.activePackages[name];
    }

    // Public: Is the {Package} with the given name active?
    //
    // * `name` - The {String} package name.
    //
    // Returns a {Boolean}.
    isPackageActive(name) {
      return (this.getActivePackage(name) != null);
    }

    /*
    Section: Accessing loaded packages
    */

    // Public: Get an {Array} of all the loaded {Package}s
    getLoadedPackages() {
      return _.values(this.loadedPackages);
    }

    // Get packages for a certain package type
    //
    // * `types` an {Array} of {String}s like ['nylas', 'my-package'].
    getLoadedPackagesForTypes(types) {
      return (() => {
        const result = [];
        for (var pack of Array.from(this.getLoadedPackages())) {           var needle;
        if ((needle = pack.getType(), Array.from(types).includes(needle))) {
            result.push(pack);
          }
        }
        return result;
      })();
    }

    // Public: Get the loaded {Package} with the given name.
    //
    // * `name` - The {String} package name.
    //
    // Returns a {Package} or undefined.
    getLoadedPackage(name) {
      return this.loadedPackages[name];
    }

    // Public: Gets the root paths of all loaded packages.
    //
    // Useful when determining if an error originated from a package.
    getPluginIdsByPathBase() {
      const pluginIdsByPathBase = {};
      for (var name in this.loadedPackages) {
        var id;
        var pack = this.loadedPackages[name];
        var pathBase = _.last(pack.path.split("/"));

        if (pack.pluginId() && (pack.pluginId() !== name)) {
          id = `${name}-${pack.pluginId()}`;
        } else {
          id = pack.pluginId();
        }

        pluginIdsByPathBase[pathBase] = id;
      }
      return pluginIdsByPathBase;
    }

    // Public: Is the package with the given name loaded?
    //
    // * `name` - The {String} package name.
    //
    // Returns a {Boolean}.
    isPackageLoaded(name) {
      return (this.getLoadedPackage(name) != null);
    }

    /*
    Section: Accessing available packages
    */

    // Public: Get an {Array} of {String}s of all the available package paths.
    //
    // If the optional windowType is passed, it will only load packages
    // that declare that windowType in their package.json
    getAvailablePackagePaths(windowType) {
      let packagePath;
      let packagePaths = [];

      const loadPackagesWhenNoTypesSpecified = windowType === 'default';

      if (basePackagePaths == null) { let left;
      basePackagePaths = (left = NylasEnv.fileListCache().basePackagePaths) != null ? left : []; }
      if (basePackagePaths.length === 0) {
        for (var packageDirPath of Array.from(this.packageDirPaths)) {
          for (packagePath of Array.from(fs.listSync(packageDirPath))) {
            // Ignore files in package directory
            if (!fs.isDirectorySync(packagePath)) { continue; }
            // Ignore .git in package directory
            if (path.basename(packagePath)[0] === '.') { continue; }
            packagePaths.push(packagePath);
          }
        }
        basePackagePaths = packagePaths;
        const cache = NylasEnv.fileListCache();
        cache.basePackagePaths = basePackagePaths;
      } else {
        packagePaths = basePackagePaths;
      }

      if (windowType) {
        packagePaths = _.filter(packagePaths, function(packagePath) {
          try {
            let left1;
            const metadata = (left1 = Package.loadMetadata(packagePath)) != null ? left1 : {};

            if (!(metadata.engines != null ? metadata.engines.nylas : undefined)) {
              console.error(`INVALID PACKAGE: Your package at ${packagePath} does not have a properly formatted \`package.json\`. You must include an {'engines': {'nylas': version}} property`);
            }

            const {windowTypes} = metadata;
            if (windowTypes) {
              return (windowTypes[windowType] != null) || (windowTypes["all"] != null);
            } else if (loadPackagesWhenNoTypesSpecified) {
              return true;
            }
            return false;
          } catch (error) {
            return false;
          }
        });
      }

      const packagesPath = path.join(this.resourcePath, 'node_modules');
      const object = this.getPackageDependencies();
      for (var packageName in object) {
        var packageVersion = object[packageName];
        packagePath = path.join(packagesPath, packageName);
        if (fs.isDirectorySync(packagePath)) { packagePaths.push(packagePath); }
      }

      return _.uniq(packagePaths);
    }

    // Public: Get an {Array} of {String}s of all the available package names.
    getAvailablePackageNames() {
      return _.uniq(_.map(this.getAvailablePackagePaths(), packagePath => path.basename(packagePath)));
    }

    // Public: Get an {Array} of {String}s of all the available package metadata.
    getAvailablePackageMetadata() {
      const packages = [];
      for (var packagePath of Array.from(this.getAvailablePackagePaths())) {
        var left;
        var name = path.basename(packagePath);
        var metadata = (left = __guard__(this.getLoadedPackage(name), x => x.metadata)) != null ? left : Package.loadMetadata(packagePath, true);
        packages.push(metadata);
      }
      return packages;
    }

    installPackageFromPath(packageSourceDir, callback) {
      let json;
      const jsonPath = path.join(packageSourceDir, 'package.json');
      if (!fs.existsSync(jsonPath)) {
        return callback(new Error(`The folder you selected doesn't look like a valid N1 plugin. All N1 plugins must have a package.json file in the top level of the folder. Check the contents of ${packageSourceDir} and try again.`), null);
      }

      try {
        json = JSON.parse(fs.readFileSync(jsonPath));
      } catch (e) {
        return callback(e, null);
      }

      if (!json.name) {
        return callback(new Error("The package.json file must contain a valid `name` value."), null);
      }

      const packagesDir = path.join(NylasEnv.getConfigDirPath(), 'packages');
      const packageName = json.name;
      const packageTargetDir = path.join(packagesDir, packageName);

      return fs.makeTree(packagesDir, err => {
        if (err) { return callback(err, null); }

        return fs.exists(packageTargetDir, packageAlreadyExists => {
          if (packageAlreadyExists) {
            return callback(new Error(`A package named '${packageName}' is already installed in ~/.nylas-mail/packages.`), null);
          }

          fs.copySync(packageSourceDir, packageTargetDir);

          const apm = new APMWrapper();
          return apm.installDependenciesInPackageDirectory(packageTargetDir, err => {
            if (err) { return callback(err, packageTargetDir); }
            this.enablePackage(packageTargetDir);
            this.activatePackage(packageName);
            return callback(null, packageName);
          });
        });
      });
    }

    /*
    Section: Private
    */

    getPackageState(name) {
      return this.packageStates[name];
    }

    setPackageState(name, state) {
      return this.packageStates[name] = state;
    }

    getPackageDependencies() {
      if (this.packageDependencies == null) {
        try {
          let left;
          const metadataPath = path.join(this.resourcePath, 'package.json');
          ({packageDependencies: this.packageDependencies} = (left = JSON.parse(fs.readFileSync(metadataPath))) != null ? left : {});
        } catch (error) {}
        if (this.packageDependencies == null) { this.packageDependencies = {}; }
      }

      return this.packageDependencies;
    }

    hasNylasEngine(packagePath) {
      const metadata = Package.loadMetadata(packagePath, true);
      return (__guard__(metadata != null ? metadata.engines : undefined, x => x.nylas) != null);
    }

    unobserveDisabledPackages() {
      if (this.disabledPackagesSubscription != null) {
        this.disabledPackagesSubscription.dispose();
      }
      return this.disabledPackagesSubscription = null;
    }

    observeDisabledPackages() {
      return this.disabledPackagesSubscription != null ? this.disabledPackagesSubscription : (this.disabledPackagesSubscription = NylasEnv.config.onDidChange('core.disabledPackages', ({newValue, oldValue}) => {
        let packageName;
        const packagesToEnable = _.difference(oldValue, newValue);
        const packagesToDisable = _.difference(newValue, oldValue);

        for (packageName of Array.from(packagesToDisable)) { if (this.getActivePackage(packageName)) { this.deactivatePackage(packageName); } }

        for (packageName of Array.from(packagesToEnable)) {
          this.loadPackage(packageName);
        }

        this.refreshDatabaseSchema();

        for (packageName of Array.from(packagesToEnable)) {
          this.activatePackage(packageName);
        }

        return null;
      }));
    }

    // This lets us report the active plugins in the main window (since plugins
    // are window-specific). Useful for letting the worker window know what
    // plugins are installed in the main window.
    _onPluginsChanged() {
      if (!NylasEnv.isMainWindow()) { return; }
      // All active plugins, core optional, core required, and 3rd party
      const activePluginNames = this.getActivePackages().map(p => p.name);

      // Only active 3rd party plugins
      const activeThirdPartyPluginNames = this.getActivePackages().filter(p => ((p.path != null ? p.path.indexOf('internal_packages') : undefined) === -1) &&
      ((p.path != null ? p.path.indexOf('nylas-private') : undefined) === -1)).map(p => p.name);

      // Only active core optional, and core required plugins
      const activeCorePluginNames = _.difference(activePluginNames, activeThirdPartyPluginNames);

      // All plugins (3rd party and core optional) that have the {optional: true}
      // flag.  If it's an internal_packages core package, it'll show up in
      // preferences.
      const optionalPluginNames = this.getAvailablePackageMetadata()
        .filter(({isOptional}) => isOptional)
        .map(p => p.name);

      const activeCoreOptionalPluginNames = _.intersection(activeCorePluginNames, optionalPluginNames);

      return Actions.notifyPluginsChanged({
        allActivePluginNames: activePluginNames,
        coreActivePluginNames: activeCoreOptionalPluginNames,
        thirdPartyActivePluginNames: activeThirdPartyPluginNames
      });
    }

    // If a windowType is passed, we'll only load packages who declare that
    // windowType as `true` in their package.json file.
    loadPackages(windowType) {
      let packagePaths = this.getAvailablePackagePaths(windowType);

      packagePaths = packagePaths.filter(packagePath => !this.isPackageDisabled(path.basename(packagePath)));
      packagePaths = _.uniq(packagePaths, packagePath => path.basename(packagePath));
      for (var packagePath of Array.from(packagePaths)) { this.loadPackage(packagePath); }
      this.emit('loaded');
      return this.emitter.emit('did-load-initial-packages');
    }

    loadPackage(nameOrPath) {
      let pack, packagePath;
      if (pack = this.getLoadedPackage(nameOrPath)) { return pack; }

      if (packagePath = this.resolvePackagePath(nameOrPath)) {
        const name = path.basename(nameOrPath);
        if (pack = this.getLoadedPackage(name)) { return pack; }

        try {
          let left;
          const metadata = (left = Package.loadMetadata(packagePath)) != null ? left : {};
          if (metadata.theme) {
            pack = new ThemePackage(packagePath, metadata);
          } else {
            pack = new Package(packagePath, metadata);
          }

          if (metadata.supportedEnvs && !metadata.supportedEnvs.includes(NylasEnv.config.get('env'))) {
            return null;
          }

          pack.load();
          if (pack.declaresNewDatabaseObjects) {
            this.packagesWithDatabaseObjects.push(pack);
          }
          this.loadedPackages[pack.name] = pack;
          this.emitter.emit('did-load-package', pack);
          this.onPluginsChanged();
          return pack;
        } catch (error) {
          console.warn(`Failed to load package.json '${path.basename(packagePath)}'`);
          console.warn(error.stack != null ? error.stack : error);
        }
      } else {
        console.warn(`Could not resolve '${nameOrPath}' to a package path`);
      }
      return null;
    }

    unloadPackages() {
      for (var name of Array.from(Object.keys(this.loadedPackages))) { this.unloadPackage(name); }
      return null;
    }

    unloadPackage(name) {
      let pack;
      if (this.isPackageActive(name)) {
        throw new Error(`Tried to unload active package '${name}'`);
      }

      if (pack = this.getLoadedPackage(name)) {
        delete this.loadedPackages[pack.name];
        this.emitter.emit('did-unload-package', pack);
        return this.onPluginsChanged();
      } else {
        throw new Error(`No loaded package for name '${name}'`);
      }
    }

    // Activate all the packages that should be activated.
    activate() {
      let promises = [];
      for (var [activator, types] of Array.from(this.packageActivators)) {
        var packages = this.getLoadedPackagesForTypes(types);
        promises = promises.concat(activator.activatePackages(packages));
      }
      return Q.all(promises).then(() => {
        this.emit('activated');
        return this.emitter.emit('did-activate-initial-packages');
      });
    }

    // another type of package manager can handle other package types.
    // See ThemeManager
    registerPackageActivator(activator, types) {
      return this.packageActivators.push([activator, types]);
    }

    activatePackages(packages) {
      const promises = [];
      NylasEnv.config.transact(() => {
        let pack;
        for (pack of Array.from(packages)) {
          this.loadPackage(pack.name);
        }

        const setupPromise = this.refreshDatabaseSchema();

        return (() => {
          const result = [];
          for (pack of Array.from(packages)) {
            var promise = this.activatePackage(pack.name, setupPromise);
            result.push(promises.push(promise));
          }
          return result;
        })();
      });
      this.observeDisabledPackages();
      return promises;
    }

    // When packages load they can declare new DatabaseObjects that need to
    // be setup in the Database. It's important that the Database starts
    // getting setup before packages activate so any DB queries in the
    // `activate` methods get properly queued then executed.
    //
    // When a package with database-altering changes loads, it will put an
    // entry in `packagesWithDatabaseObjects`.
    refreshDatabaseSchema() {
      if (this.packagesWithDatabaseObjects.length > 0) {
        return DatabaseStore.refreshDatabaseSchema().then(() => {
          return this.packagesWithDatabaseObjects = [];
      });
      }
      return Promise.resolve();
    }

    // Activate a single package by name
    activatePackage(name, setupPromise) {
      let pack;
      if (setupPromise == null) { setupPromise = Promise.resolve(); }
      if ((pack = this.getActivePackage(name))) {
        return Q(pack);
      } else if ((pack = this.loadPackage(name))) {
        return setupPromise.then(() => {
          return pack.activate().then(() => {
            this.activePackages[pack.name] = pack;
            this.emitter.emit('did-activate-package', pack);
            this.onPluginsChanged();
            return pack;
          });
        });
      } else {
        return Q.reject(new Error(`Failed to load package '${name}'`));
      }
    }

    // Deactivate all packages
    deactivatePackages() {
      NylasEnv.config.transact(() => {
        return Array.from(this.getLoadedPackages()).map((pack) => this.deactivatePackage(pack.name));
      });
      return this.unobserveDisabledPackages();
    }

    // Deactivate the package with the given name
    deactivatePackage(name) {
      const pack = this.getLoadedPackage(name);
      if (this.isPackageActive(name)) {
        let state;
        if (state = typeof pack.serialize === 'function' ? pack.serialize() : undefined) { this.setPackageState(pack.name, state); }
      }
      pack.deactivate();
      delete this.activePackages[pack.name];
      this.emitter.emit('did-deactivate-package', pack);
      return this.onPluginsChanged();
    }
  };
  PackageManager.initClass();
  return PackageManager;
})());

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}