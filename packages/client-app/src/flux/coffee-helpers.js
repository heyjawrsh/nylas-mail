'use strict';

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let CoffeeHelpers;
const _ = require('underscore');

module.exports = (CoffeeHelpers = {
  // This copied out CoffeeScript
  includeModule(mixin) {
    let tmpSuper;
    if (!mixin) {
      return (() => { throw new Error('Supplied mixin was not found'); })();
    }

    if (!_) {
      return (() => { throw new Error('Underscore was not found'); })();
    }

    if (_.isFunction(mixin)) { mixin = mixin.prototype; }

    // Make a copy of the superclass with the same constructor and use it
    // instead of adding functions directly to the superclass.
    if (this.__super__) {
      tmpSuper = _.extend({}, this.__super__);
      tmpSuper.constructor = this.__super__.constructor;
    }

    this.__super__ = tmpSuper || {};

    // Copy function over to prototype and the new intermediate superclass.
    for (var methodName in mixin) {
      var funct = mixin[methodName];
      if (!['included'].includes(methodName)) {
        this.__super__[methodName] = funct;

        if (!this.prototype.hasOwnProperty(methodName)) {
          this.prototype[methodName] = funct;
        }
      }
    }

    if (mixin.included != null) {
      mixin.included.apply(this);
    }
    return this;
  },

  // Allows the root objects to extend other objects as class methods via the
  // object.
  extendModule(module) {
    if ((module == null)) {
      console.warn("The module you are trying to extend does not exist. Ensure you have put it on this page's manifest.");
    }

    if (_.isFunction(module)) { module = module(); }

    for (var key in module) { var value = module[key]; this[key] = value; }
    return this;
  },

  // Allows the root objects to include other objects as instance methods via
  // the prototype
  simpleInclude(module) {
    if ((module == null)) {
      console.warn("The module you are trying to include does not exist. Ensure you have put it on this page's manifest.");
    }

    if (_.isFunction(module)) { module = module(); }

    for (var key in module) { var value = module[key]; this.prototype[key] = value; }
    return this;
  },

  // This should be called as the first item from the constructor of an
  // object.
  //
  // You can optionally pass a refernce to a super's prototype.
  boundInclude(module, _super) {
    if ((module == null)) {
      console.warn("The module you are trying to include does not exist. Ensure you have put it on this page's manifest.");
      return;
    }

    if (!_.isFunction(module)) {
      console.warn("To do a scoped include the Module must be a function instead of a plain old javascript object thereby allowing `this` to be bound properly.");
      return;
    }

    const object = module.call(this, _super);
    for (var key in object) {
      var value = object[key];
      if (this[key] == null) { this[key] = value; }
    }
    return this;
  }
});
