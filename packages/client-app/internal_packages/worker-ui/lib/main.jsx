/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const React = require("react");
const { ComponentRegistry, WorkspaceStore } = require("nylas-exports");
const DeveloperBar = require("./developer-bar");

module.exports = {
	item: null,

	activate(state) {
		if (state == null) {
			state = {};
		}
		this.state = state;
		WorkspaceStore.defineSheet("Main", { root: true }, { popout: ["Center"] });

		return ComponentRegistry.register(DeveloperBar, {
			location: WorkspaceStore.Location.Center,
		});
	},

	deactivate() {
		return ComponentRegistry.unregister(DeveloperBar);
	},
};
