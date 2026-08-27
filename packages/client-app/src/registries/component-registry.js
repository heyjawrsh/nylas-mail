/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require('underscore');

const {Listener, Publisher} = require('../flux/modules/reflux-coffee');
const CoffeeHelpers = require('../flux/coffee-helpers');

const DeprecatedRoles = {
  'thread:BulkAction': 'ThreadActionsToolbarButton',
  'draft:BulkAction': 'DraftActionsToolbarButton',
  'message:Toolbar': 'ThreadActionsToolbarButton',
  'thread:Toolbar': 'ThreadActionsToolbarButton',
};

/*
Public: The ComponentRegistry maintains an index of React components registered
by Nylas packages. Components can use {InjectedComponent} and {InjectedComponentSet}
to dynamically render components registered with the ComponentRegistry.

Section: Stores
*/
class ComponentRegistry {
  static initClass() {
    this.include = CoffeeHelpers.includeModule;
  
    this.include(Publisher);
    this.include(Listener);
  
    // We debounce because a single plugin may activate many components in
    // their `activate` methods. Furthermore, when the window loads several
    // plugins may load in sequence. Plugin loading takes a while (dozens of
    // ms) since javascript is being read and `require` trees are being
    // traversed.
    //
    // Triggering the ComponentRegistry is fairly expensive since many very
    // high-level components (like the <Sheet />) listen and re-render when
    // this triggers.
    //
    // We set the debouce interval to 1 "frame" (16ms) to balance
    // responsiveness and efficient batching.
    this.prototype.triggerDebounced = _.debounce(( function() { return this.trigger(this); }), 16);
  }

  constructor() {
    this.register = this.register.bind(this);
    this.unregister = this.unregister.bind(this);
    this.findComponentByName = this.findComponentByName.bind(this);
    this.findComponentsMatching = this.findComponentsMatching.bind(this);
    this._clear = this._clear.bind(this);
    this.showComponentRegions = this.showComponentRegions.bind(this);
    this._registry = {};
    this._cache = {};
    this._showComponentRegions = false;
  }


  // Public: Register a new component with the Component Registry.
  // Typically, packages call this method from their main `activate` method
  // to extend the Nylas user interface, and call the corresponding `unregister`
  // method in `deactivate`.
  //
  // * `component` {Object} A React Component with a `displayName`
  // * `options` {Object}:
  //
  //   * `role`: (optional) {String} If you want to display your component in a location
  //      desigated by a role, pass the role identifier.
  //
  //   * `modes`: (optional) {Array} If your component should only be displayed
  //      in particular Workspace Modes, pass an array of supported modes.
  //      ('list', 'split', etc.)
  //
  //   * `location`: (optional) {Object} If your component should be displayed in a
  //      column or toolbar, pass the fully qualified location object, such as:
  //      `WorkspaceStore.Location.ThreadList`
  //
  //   Note that for advanced use cases, you can also pass (`modes`, `roles`, `locations`)
  //   with arrays instead of single values.
  //
  // This method is chainable.
  //
  register(component, options) {
    if (component.view != null) {
      return console.warn("Ignoring component trying to register with old CommandRegistry.register syntax");
    }

    if (!options) { throw new Error("ComponentRegistry.register() requires `options` that describe the component"); }
    if (!component) { throw new Error("ComponentRegistry.register() requires `component`, a React component"); }
    if (!component.displayName) { throw new Error("ComponentRegistry.register() requires that your React Component defines a `displayName`"); }

    let {locations, modes, roles} = this._pluralizeDescriptor(options);

    if (!roles && !locations) { throw new Error("ComponentRegistry.register() requires `role` or `location`"); }

    if (this._registry[component.displayName] && (this._registry[component.displayName].component !== component)) {
      throw new Error(`ComponentRegistry.register(): A different component was already registered with the name ${component.displayName}`);
    }

    if (roles) { roles = this._removeDeprecatedRoles(component.displayName, roles); }

    this._cache = {};
    this._registry[component.displayName] = {component, locations, modes, roles};

    // Trigger listeners. It's very important the component registry is debounced.
    // During app launch packages register tons of components and if we re-rendered
    // the entire UI after each registration it takes forever to load the UI.
    this.triggerDebounced();

    // Return `this` for chaining
    return this;
  }

  unregister(component) {
    if (_.isString(component)) {
      throw new Error("ComponentRegistry.unregister() must be called with a component.");
    }
    this._cache = {};
    delete this._registry[component.displayName];
    return this.triggerDebounced();
  }

  // Public: Retrieve the registry entry for a given name.
  //
  // - `name`: The {String} name of the registered component to retrieve.
  //
  // Returns a {React.Component}
  //
  findComponentByName(name) {
    return (this._registry[name] != null ? this._registry[name].component : undefined);
  }

  /*
  Public: Retrieve all of the registry entries matching a given descriptor.

  ```coffee
    ComponentRegistry.findComponentsMatching({
      role: 'Composer:ActionButton'
    })

    ComponentRegistry.findComponentsMatching({
      location: WorkspaceStore.Location.RootSidebar.Toolbar
    })
  ```

  - `descriptor`: An {Object} that specifies set of components using the
    available keys below.

    * `mode`: (optional) {String} Components that specifically list modes
       will only be returned if they include this mode.

    * `role`: (optional) {String} Only return components that have registered
       for this role.

    * `location`: (optional) {Object} Only return components that have registered
       for this location.

    Note that for advanced use cases, you can also pass (`modes`, `roles`, `locations`)
    with arrays instead of single values.

  Returns an {Array} of {React.Component} objects
  */
  findComponentsMatching(descriptor) {
    if ((descriptor == null)) {
      throw new Error("ComponentRegistry.findComponentsMatching called without descriptor");
    }

    const {locations, modes, roles} = this._pluralizeDescriptor(descriptor);

    if (!locations && !modes && !roles) {
      throw new Error("ComponentRegistry.findComponentsMatching called with an empty descriptor");
    }

    const cacheKey = JSON.stringify({locations, modes, roles});
    if (this._cache[cacheKey]) { return [].concat(this._cache[cacheKey]); }

    // Made into a convenience function because default
    // values (`[]`) are necessary and it was getting messy.
    const overlaps = function(entry, search) {
      if (entry == null) { entry = []; }
      if (search == null) { search = []; }
      return _.intersection(entry, search).length > 0;
    };

    let entries = _.values(this._registry);
    entries = _.filter(entries, function(entry) {
      if (modes && entry.modes && !overlaps(modes, entry.modes)) {
        return false;
      }
      if (locations && !overlaps(locations, entry.locations)) {
        return false;
      }
      if (roles && !overlaps(roles, entry.roles)) {
        return false;
      }
      return true;
    });

    const results = _.map(entries, entry => entry.component);
    this._cache[cacheKey] = results;

    return [].concat(results);
  }

  _removeDeprecatedRoles(displayName, roles) {
    const newRoles = _.clone(roles);
    roles.forEach(function(role, idx) {
      if (role in DeprecatedRoles) {
        const instead = DeprecatedRoles[role];
        console.warn(`Deprecation warning! The role \`${role}\` has been deprecated. \
Register \`${displayName}\` for the role \`${instead}\` instead.`);
        return newRoles.splice(idx, 1, instead);
      }
    });
    return newRoles;
  }

  _pluralizeDescriptor(descriptor) {
    let {locations, modes, roles} = descriptor;
    if (descriptor.mode) { modes = [descriptor.mode]; }
    if (descriptor.role) { roles = [descriptor.role]; }
    if (descriptor.location) { locations = [descriptor.location]; }
    return {locations, modes, roles};
  }

  _clear() {
    this._cache = {};
    return this._registry = {};
  }

  // Showing Component Regions

  toggleComponentRegions() {
    this._showComponentRegions = !this._showComponentRegions;
    return this.trigger(this);
  }

  showComponentRegions() {
    return this._showComponentRegions;
  }
}
ComponentRegistry.initClass();


module.exports = new ComponentRegistry();
