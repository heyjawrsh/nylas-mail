const {
	MailboxPerspective,
	ComponentRegistry,
	ExtensionRegistry,
	WorkspaceStore,
	DatabaseStore,
	Actions,
	Thread,
} = require("nylas-exports");
const MessageList = require("./message-list");
const MessageListHiddenMessagesToggle =
	require("./message-list-hidden-messages-toggle").default;
const SidebarPluginContainer = require("./sidebar-plugin-container");
const SidebarParticipantPicker =
	require("./sidebar-participant-picker").default;

module.exports = {
	activate() {
		if (NylasEnv.isMainWindow()) {
			ComponentRegistry.register(MessageList, {
				location: WorkspaceStore.Location.MessageList,
			});
			ComponentRegistry.register(SidebarParticipantPicker, {
				location: WorkspaceStore.Location.MessageListSidebar,
			});
			ComponentRegistry.register(SidebarPluginContainer, {
				location: WorkspaceStore.Location.MessageListSidebar,
			});
			return ComponentRegistry.register(MessageListHiddenMessagesToggle, {
				role: "MessageListHeaders",
			});
		} else {
			const { threadId, perspectiveJSON } = NylasEnv.getWindowProps();
			ComponentRegistry.register(MessageList, {
				location: WorkspaceStore.Location.Center,
			});
			DatabaseStore.find(Thread, threadId).then((thread) =>
				Actions.setFocus({ collection: "thread", item: thread }),
			);
			Actions.focusMailboxPerspective(
				MailboxPerspective.fromJSON(perspectiveJSON),
			);
			return ComponentRegistry.register(MessageListHiddenMessagesToggle, {
				role: "MessageListHeaders",
			});
		}
	},

	deactivate() {
		ComponentRegistry.unregister(MessageList);
		ComponentRegistry.unregister(SidebarPluginContainer);
		return ComponentRegistry.unregister(SidebarParticipantPicker);
	},
};
