/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const {ComponentRegistry, WorkspaceStore} = require('nylas-exports');
const EventHeader = require("./event-header");

module.exports = {
  activate(state) {
    if (state == null) { state = {}; }
    this.state = state;
    return ComponentRegistry.register(EventHeader,
      {role: 'message:BodyHeader'});
  },

  deactivate() {
    return ComponentRegistry.unregister(EventHeader);
  },

  serialize() { return this.state; }
};
