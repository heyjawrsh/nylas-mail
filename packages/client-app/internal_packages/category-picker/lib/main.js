/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const CategoryPicker = require("./category-picker");

const {ComponentRegistry,
 WorkspaceStore} = require('nylas-exports');

module.exports = {
  activate(state) {
    if (state == null) { state = {}; }
    this.state = state;
    return ComponentRegistry.register(CategoryPicker,
      {role: 'ThreadActionsToolbarButton'});
  },

  deactivate() {
    return ComponentRegistry.unregister(CategoryPicker);
  }
};
