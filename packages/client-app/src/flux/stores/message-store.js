/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const NylasStore = require("nylas-store");
const Actions = require("../actions.js").default;
const Message = require("../models/message.js").default;
const Thread = require("../models/thread.js").default;
const _Utils = require("../models/utils.js");
const DatabaseStore = require("./database-store.js").default;
const FocusedPerspectiveStore =
	require("./focused-perspective-store.js").default;
const FocusedContentStore = require("./focused-content-store.js");
const NylasAPIHelpers = require("../nylas-api-helpers.js");
const ExtensionRegistry = require("../../registries/extension-registry.js");
const { deprecate } = require("../../deprecate-utils.js");
const _async = require("async");
const _ = require("underscore");

const CategoryNamesHiddenByDefault = ["spam", "trash"];

class MessageStore extends NylasStore {
	constructor() {
		super();
		this.itemsExpandedState = this.itemsExpandedState.bind(this);
		this.extensions = this.extensions.bind(this);
		this.registerExtension = this.registerExtension.bind(this);
		this.unregisterExtension = this.unregisterExtension.bind(this);
		this._setStoreDefaults = this._setStoreDefaults.bind(this);
		this._onPerspectiveChanged = this._onPerspectiveChanged.bind(this);
		this._onDataChanged = this._onDataChanged.bind(this);
		this._onFocusChanged = this._onFocusChanged.bind(this);
		this._onApplyFocusChange = this._onApplyFocusChange.bind(this);
		this._onToggleAllMessagesExpanded =
			this._onToggleAllMessagesExpanded.bind(this);
		this._onToggleHiddenMessages = this._onToggleHiddenMessages.bind(this);
		this._onToggleMessageIdExpanded =
			this._onToggleMessageIdExpanded.bind(this);
		this._expandItem = this._expandItem.bind(this);
		this._collapseItem = this._collapseItem.bind(this);
		this._setStoreDefaults();
		this._registerListeners();
	}

	//########## PUBLIC #####################################################

	items() {
		if (this._showingHiddenItems) {
			return this._items;
		}

		const viewing = FocusedPerspectiveStore.current().categoriesSharedName();
		const viewingHiddenCategory = Array.from(
			CategoryNamesHiddenByDefault,
		).includes(viewing);

		if (viewingHiddenCategory) {
			return this._items.filter((item) => {
				const inHidden = _.any(item.categories, (cat) =>
					Array.from(CategoryNamesHiddenByDefault).includes(cat.name),
				);
				return inHidden || item.draft === true;
			});
		} else {
			return this._items.filter((item) => {
				const inHidden = _.any(item.categories, (cat) =>
					Array.from(CategoryNamesHiddenByDefault).includes(cat.name),
				);
				return !inHidden;
			});
		}
	}

	threadId() {
		return this._thread != null ? this._thread.id : undefined;
	}

	thread() {
		return this._thread;
	}

	itemsExpandedState() {
		// ensure that we're always serving up immutable objects.
		// this.state == nextState is always true if we modify objects in place.
		return _.clone(this._itemsExpanded);
	}

	hasCollapsedItems() {
		return _.size(this._itemsExpanded) < this._items.length;
	}

	numberOfHiddenItems() {
		return this._items.length - this.items().length;
	}

	itemClientIds() {
		return _.pluck(this._items, "clientId");
	}

	itemsLoading() {
		return this._itemsLoading;
	}

	/*
  Message Store Extensions
  */

	// Public: Returns the extensions registered with the MessageStore.
	extensions() {
		return ExtensionRegistry.MessageView.extensions();
	}

	// Public: Deprecated, use {ExtensionRegistry.MessageView.register} instead.
	// Registers a new extension with the MessageStore. MessageStore extensions
	// make it possible to customize message body parsing, and will do more in
	// the future.
	//
	// - `ext` A {MessageViewExtension} instance.
	//
	registerExtension(ext) {
		return ExtensionRegistry.MessageView.register(ext);
	}

	// Public: Deprecated, use {ExtensionRegistry.MessageView.unregister} instead.
	// Unregisters the extension provided from the MessageStore.
	//
	// - `ext` A {MessageViewExtension} instance.
	//
	unregisterExtension(ext) {
		return ExtensionRegistry.MessageView.unregister(ext);
	}

	_onExtensionsChanged(_role) {
		const MessageBodyProcessor = require("./message-body-processor.js").default;
		return MessageBodyProcessor.resetCache();
	}

	//########## PRIVATE ####################################################

	_setStoreDefaults() {
		this._items = [];
		this._itemsExpanded = {};
		this._itemsLoading = false;
		this._showingHiddenItems = false;
		return (this._thread = null);
	}

	_registerListeners() {
		this.listenTo(ExtensionRegistry.MessageView, this._onExtensionsChanged);
		this.listenTo(DatabaseStore, this._onDataChanged);
		this.listenTo(FocusedContentStore, this._onFocusChanged);
		this.listenTo(
			Actions.toggleMessageIdExpanded,
			this._onToggleMessageIdExpanded,
		);
		this.listenTo(
			Actions.toggleAllMessagesExpanded,
			this._onToggleAllMessagesExpanded,
		);
		this.listenTo(Actions.toggleHiddenMessages, this._onToggleHiddenMessages);
		this.listenTo(FocusedPerspectiveStore, this._onPerspectiveChanged);
		this.listenTo(Actions.popoutThread, this._onPopoutThread);
		return this.listenTo(
			Actions.focusThreadMainWindow,
			this._onFocusThreadMainWindow,
		);
	}

	_onPerspectiveChanged() {
		return this.trigger();
	}

	_onDataChanged(change) {
		if (!this._thread) {
			return;
		}

		if (change.objectClass === Message.name) {
			const inDisplayedThread = _.some(
				change.objects,
				(obj) => obj.threadId === this._thread.id,
			);
			if (!inDisplayedThread) {
				return;
			}

			if (change.objects.length === 1 && change.objects[0].draft === true) {
				const item = change.objects[0];
				const itemIndex = _.findIndex(
					this._items,
					(msg) => msg.id === item.id || msg.clientId === item.clientId,
				);

				if (change.type === "persist" && itemIndex === -1) {
					this._items = []
						.concat(this._items, [item])
						.filter((m) => !m.isHidden());
					this._items = this._sortItemsForDisplay(this._items);
					this._expandItemsToDefault();
					this.trigger();
					return;
				}

				if (change.type === "unpersist" && itemIndex !== -1) {
					this._items = [].concat(this._items).filter((m) => !m.isHidden());
					this._items.splice(itemIndex, 1);
					this._expandItemsToDefault();
					this.trigger();
					return;
				}
			}

			this._fetchFromCache();
		}

		if (change.objectClass === Thread.name) {
			const updatedThread = _.find(
				change.objects,
				(obj) => obj.id === this._thread.id,
			);
			if (updatedThread) {
				this._thread = updatedThread;
				return this._fetchFromCache();
			}
		}
	}

	_onFocusChanged(change) {
		if (!change.impactsCollection("thread")) {
			return;
		}

		// This implements a debounce that fires on the leading and trailing edge.
		//
		// If we haven't changed focus in the last 100ms, do it immediately. This means
		// there is no delay when moving to the next thread, deselecting a thread, etc.
		//
		// If we have changed focus in the last 100ms, wait for focus changes to
		// stop arriving for 100msec before applying. This means that flying
		// through threads doesn't cause is to make a zillion queries for messages.
		//
		if (!this._onFocusChangedTimer) {
			this._onApplyFocusChange();
		} else {
			clearTimeout(this._onFocusChangedTimer);
		}

		return (this._onFocusChangedTimer = setTimeout(() => {
			this._onFocusChangedTimer = null;
			return this._onApplyFocusChange();
		}, 100));
	}

	_onApplyFocusChange() {
		const focused = FocusedContentStore.focused("thread");
		if (
			(this._thread != null ? this._thread.id : undefined) ===
			(focused != null ? focused.id : undefined)
		) {
			return;
		}

		this._thread = focused;
		this._items = [];
		this._itemsLoading = true;
		this._showingHiddenItems = false;
		this._itemsExpanded = {};
		this.trigger();

		return this._fetchFromCache();
	}

	_markAsRead() {
		// Mark the thread as read if necessary. Make sure it's still the
		// current thread after the timeout.
		//
		// Override canBeUndone to return false so that we don't see undo
		// prompts (since this is a passive action vs. a user-triggered
		// action.)
		if (!this._thread) {
			return;
		}
		if (this._lastLoadedThreadId === this._thread.id) {
			return;
		}
		this._lastLoadedThreadId = this._thread.id;

		if (this._thread.unread) {
			const markAsReadDelay = NylasEnv.config.get(
				"core.reading.markAsReadDelay",
			);
			const markAsReadId = this._thread.id;
			if (markAsReadDelay < 0) {
				return;
			}

			return setTimeout(() => {
				if (
					markAsReadId !==
						(this._thread != null ? this._thread.id : undefined) ||
					!this._thread.unread
				) {
					return;
				}
				return Actions.setUnreadThreads({
					threads: [this._thread],
					source: "Thread Selected",
					canBeUndone: false,
					unread: false,
				});
			}, markAsReadDelay);
		}
	}

	_onToggleAllMessagesExpanded() {
		if (this.hasCollapsedItems()) {
			this._items.forEach(this._expandItem);
		} else {
			// Do not collapse the latest message, i.e. the last one
			this._items.slice(0, -1).forEach(this._collapseItem);
		}
		return this.trigger();
	}

	_onToggleHiddenMessages() {
		this._showingHiddenItems = !this._showingHiddenItems;
		this._expandItemsToDefault();
		this._fetchExpandedAttachments(this._items);
		return this.trigger();
	}

	_onToggleMessageIdExpanded(id) {
		const item = _.findWhere(this._items, { id });
		if (!item) {
			return;
		}

		if (this._itemsExpanded[id]) {
			this._collapseItem(item);
		} else {
			this._expandItem(item);
		}
		return this.trigger();
	}

	_expandItem(item) {
		this._itemsExpanded[item.id] = "explicit";
		return this._fetchExpandedAttachments([item]);
	}

	_collapseItem(item) {
		return delete this._itemsExpanded[item.id];
	}

	_fetchFromCache(options) {
		if (options == null) {
			options = {};
		}
		if (!this._thread) {
			return;
		}

		const loadedThreadId = this._thread.id;

		const query = DatabaseStore.findAll(Message);
		query.where({ threadId: loadedThreadId });
		query.include(Message.attributes.body);
		return query.then((items) => {
			// Check to make sure that our thread is still the thread we were
			// loading items for. Necessary because this takes a while.
			if (
				loadedThreadId !== (this._thread != null ? this._thread.id : undefined)
			) {
				return;
			}

			let loaded = true;

			this._items = items.filter((m) => !m.isHidden());
			this._items = this._sortItemsForDisplay(this._items);

			// If no items were returned, attempt to load messages via the API. If items
			// are returned, this will trigger a refresh here.
			if (this._items.length === 0) {
				this._fetchMessages();
				loaded = false;
			}

			this._expandItemsToDefault();

			// Download the attachments on expanded messages.
			this._fetchExpandedAttachments(this._items);

			// Normally, we would trigger often and let the view's
			// shouldComponentUpdate decide whether to re-render, but if we
			// know we're not ready, don't even bother.  Trigger once at start
			// and once when ready. Many third-party stores will observe
			// MessageStore and they'll be stupid and re-render constantly.
			if (loaded) {
				this._itemsLoading = false;
				this._markAsRead();
				return this.trigger(this);
			}
		});
	}

	_fetchExpandedAttachments(items) {
		const policy = NylasEnv.config.get("core.attachments.downloadPolicy");
		if (policy === "manually") {
			return;
		}

		return (() => {
			const result = [];
			for (var item of Array.from(items)) {
				if (!this._itemsExpanded[item.id]) {
					continue;
				}
				result.push(
					Array.from(item.files).map((file) => Actions.fetchFile(file)),
				);
			}
			return result;
		})();
	}

	// Expand all unread messages, all drafts, and the last message
	_expandItemsToDefault() {
		const visibleItems = this.items();
		return (() => {
			const result = [];
			for (let idx = 0; idx < visibleItems.length; idx++) {
				var item = visibleItems[idx];
				if (item.unread || item.draft || idx === visibleItems.length - 1) {
					result.push((this._itemsExpanded[item.id] = "default"));
				} else {
					result.push(undefined);
				}
			}
			return result;
		})();
	}

	_fetchMessages() {
		return NylasAPIHelpers.getCollection(this._thread.accountId, "messages", {
			thread_id: this._thread.id,
		});
	}

	_sortItemsForDisplay(items) {
		// Re-sort items in the list so that drafts appear after the message that
		// they are in reply to, when possible. First, identify all the drafts
		// with a replyToMessageId and remove them
		let index, item;
		const itemsInReplyTo = [];
		for (index = items.length - 1; index >= 0; index--) {
			item = items[index];
			if (item.draft && item.replyToMessageId) {
				itemsInReplyTo.push(item);
				items.splice(index, 1);
			}
		}

		// For each item with the reply header, re-inset it into the list after
		// the message which it was in reply to. If we can't find it, put it at the end.
		for (item of Array.from(itemsInReplyTo)) {
			for (index = 0; index < items.length; index++) {
				var other = items[index];
				if (item.replyToMessageId === other.id) {
					items.splice(index + 1, 0, item);
					item = null;
					break;
				}
			}
			if (item) {
				items.push(item);
			}
		}

		return items;
	}

	_onPopoutThread(thread) {
		return NylasEnv.newWindow({
			title: false, // MessageList already displays the thread subject
			hidden: false,
			windowKey: `thread-${thread.id}`,
			windowType: "thread-popout",
			windowProps: {
				threadId: thread.id,
				perspectiveJSON: FocusedPerspectiveStore.current().toJSON(),
			},
		});
	}

	_onFocusThreadMainWindow(thread) {
		if (NylasEnv.isMainWindow()) {
			Actions.setFocus({ collection: "thread", item: thread });
			return NylasEnv.focus();
		}
	}
}

const store = new MessageStore();
store.registerExtension = deprecate(
	"MessageStore.registerExtension",
	"ExtensionRegistry.MessageView.register",
	store,
	store.registerExtension,
);
store.unregisterExtension = deprecate(
	"MessageStore.unregisterExtension",
	"ExtensionRegistry.MessageView.unregister",
	store,
	store.unregisterExtension,
);
store.CategoryNamesHiddenByDefault = CategoryNamesHiddenByDefault;

module.exports = store;
