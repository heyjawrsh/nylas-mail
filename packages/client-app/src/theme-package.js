/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let ThemePackage;
const Q = require('q');
const Package = require('./package');

module.exports =
(ThemePackage = class ThemePackage extends Package {
  getType() { return 'theme'; }

  getStyleSheetPriority() { return 1; }

  enable() {
    return NylasEnv.themes.setActiveTheme(this.name);
  }

  disable() {
    return NylasEnv.config.removeAtKeyPath('core.themes', this.name);
  }

  load() {
    this.measure('loadTime', () => {
      try {
        return this.metadata != null ? this.metadata : (this.metadata = Package.loadMetadata(this.path));
      } catch (error) {
        return console.warn(`Failed to load theme named '${this.name}'`, error.stack != null ? error.stack : error);
      }
    });
    return this;
  }

  activate() {
    if (this.activationDeferred != null) { return this.activationDeferred.promise; }

    this.activationDeferred = Q.defer();
    this.measure('activateTime', () => {
      this.loadStylesheets();
      return this.activateNow();
    });

    return this.activationDeferred.promise;
  }
});
