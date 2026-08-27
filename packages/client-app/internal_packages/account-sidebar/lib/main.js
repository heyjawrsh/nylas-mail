/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _React = require("react");
const AccountSidebar = require("./components/account-sidebar");
const { ComponentRegistry, WorkspaceStore } = require("nylas-exports");

module.exports = {
	item: null, // The DOM item the main React component renders into

	activate(state) {
		this.state = state;
		return ComponentRegistry.register(AccountSidebar, {
			location: WorkspaceStore.Location.RootSidebar,
		});
	},

	deactivate(state) {
		this.state = state;
		return ComponentRegistry.unregister(AccountSidebar);
	},
};
