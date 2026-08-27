/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import _ from "underscore";
import _Reflux from "reflux";
import AccountStore from "./account-store.js";
import WorkspaceStore from "./workspace-store.js";
import DatabaseStore from "./database-store.js";
const _FocusedPerspectiveStore =
	require("./focused-perspective-store.js").default;
import * as _MailboxPerspectiveNS from "../../mailbox-perspective.js";
const _MailboxPerspective =
	_MailboxPerspectiveNS.default || _MailboxPerspectiveNS;
import Actions from "../actions.js";
import _Thread from "../models/thread.js";
import Model from "../models/model.js";

import RefluxCoffee from "../modules/reflux-coffee.js";

const RC = RefluxCoffee.Listener ? RefluxCoffee : RefluxCoffee.default;
const { Listener, Publisher } = RC;
import CoffeeHelpers from "../coffee-helpers.js";

/*
Public: The FocusedContentStore provides access to the objects currently selected
or otherwise focused in the window. Normally, focus would be maintained internally
by components that show models. The FocusedContentStore makes the concept of
selection public so that you can observe focus changes and trigger your own changes
to focus.

Since {FocusedContentStore} is a Flux-compatible Store, you do not call setters
on it directly. Instead, use {Actions::setFocus} or
{Actions::setCursorPosition} to set focus. The FocusedContentStore observes
these models, changes it's state, and broadcasts to it's observers.

Note: The {FocusedContentStore} triggers when a focused model is changed, even if
it's ID has not. For example, if the user has a {Thread} selected and removes a tag,
{FocusedContentStore} will trigger so you can fetch the new version of the
{Thread}. If you observe the {FocusedContentStore} properly, you should always
have the latest version of the the selected object.

**Standard Collections**:

   - thread
   - file

**Example: Observing the Selected Thread**

```coffeescript
@unsubscribe = FocusedContentStore.listen(@_onFocusChanged, @)

...

* Called when focus has changed, or when the focused model has been modified.
_onFocusChanged: ->
  thread = FocusedContentStore.focused('thread')
  if thread
    console.log("#{thread.subject} is selected!")
  else
    console.log("No thread is selected!")
```

Section: Stores
*/
class FocusedContentStore {
	static initClass() {
		FocusedContentStore.include = CoffeeHelpers.includeModule;

		FocusedContentStore.include(Publisher);
		FocusedContentStore.include(Listener);
	}

	constructor() {
		this.triggerAfterAnimationFrame =
			this.triggerAfterAnimationFrame.bind(this);
		this._resetInstanceVars = this._resetInstanceVars.bind(this);
		this._onAccountsChange = this._onAccountsChange.bind(this);
		this._onFocusKeyboard = this._onFocusKeyboard.bind(this);
		this._onFocus = this._onFocus.bind(this);
		this._onWorkspaceChange = this._onWorkspaceChange.bind(this);
		this._onDataChange = this._onDataChange.bind(this);
		this.focused = this.focused.bind(this);
		this.focusedId = this.focusedId.bind(this);
		this.didFocusUsingClick = this.didFocusUsingClick.bind(this);
		this.keyboardCursor = this.keyboardCursor.bind(this);
		this.keyboardCursorId = this.keyboardCursorId.bind(this);
		this.keyboardCursorEnabled = this.keyboardCursorEnabled.bind(this);
		this._resetInstanceVars();
		this.listenTo(AccountStore, this._onAccountsChange);
		this.listenTo(WorkspaceStore, this._onWorkspaceChange);
		this.listenTo(DatabaseStore, this._onDataChange);
		this.listenTo(Actions.setFocus, this._onFocus);
		this.listenTo(Actions.setCursorPosition, this._onFocusKeyboard);
	}

	triggerAfterAnimationFrame(payload) {
		return window.requestAnimationFrame(() => {
			return this.trigger(payload);
		});
	}

	_resetInstanceVars() {
		this._focused = {};
		this._focusedUsingClick = {};
		this._keyboardCursor = {};
		return (this._keyboardCursorEnabled =
			WorkspaceStore.layoutMode() === "list");
	}

	// Inbound Events

	_onAccountsChange() {
		// Ensure internal consistency by removing any focused items that belong
		// to accounts which no longer exist.
		const changed = [];

		for (var dict of [this._focused, this._keyboardCursor]) {
			for (var collection in dict) {
				var item = dict[collection];
				if (item?.accountId && !AccountStore.accountForId(item.accountId)) {
					delete dict[collection];
					changed.push(collection);
				}
			}
		}

		if (changed.length > 0) {
			return this.trigger({
				impactsCollection(c) {
					return changed.includes(c);
				},
			});
		}
	}

	_onFocusKeyboard({ collection, item }) {
		if (item && !(item instanceof Model)) {
			throw new Error("focusKeyboard() requires a Model or null");
		}
		if (!collection) {
			throw new Error("focusKeyboard() requires a collection");
		}
		if (
			(this._keyboardCursor[collection] != null
				? this._keyboardCursor[collection].id
				: undefined) === (item != null ? item.id : undefined)
		) {
			return;
		}

		this._keyboardCursor[collection] = item;
		return this.triggerAfterAnimationFrame({
			impactsCollection(c) {
				return c === collection;
			},
		});
	}

	_onFocus({ collection, item, usingClick }) {
		if (item && !(item instanceof Model)) {
			throw new Error("focus() requires a Model or null");
		}
		if (!collection) {
			throw new Error("focus() requires a collection");
		}
		if (
			(this._focused[collection] != null
				? this._focused[collection].id
				: undefined) === (item != null ? item.id : undefined)
		) {
			return;
		}

		if (collection === "thread" && item) {
			NylasEnv.timer.start(`select-thread-${item.id}`);
		}

		this._focused[collection] = item;
		this._focusedUsingClick[collection] = usingClick;
		if (item) {
			this._keyboardCursor[collection] = item;
		}
		return this.triggerAfterAnimationFrame({
			impactsCollection(c) {
				return c === collection;
			},
		});
	}

	_onWorkspaceChange() {
		const keyboardCursorEnabled = WorkspaceStore.layoutMode() === "list";

		if (keyboardCursorEnabled !== this._keyboardCursorEnabled) {
			let collection, item;
			this._keyboardCursorEnabled = keyboardCursorEnabled;

			if (keyboardCursorEnabled) {
				for (collection in this._focused) {
					item = this._focused[collection];
					this._keyboardCursor[collection] = item;
				}
				this._focused = {};
			} else {
				for (collection in this._keyboardCursor) {
					item = this._keyboardCursor[collection];
					this._onFocus({ collection, item });
				}
			}
		}

		return this.trigger({
			impactsCollection() {
				return true;
			},
		});
	}

	_onDataChange(change) {
		// If one of the objects we're storing in our focused or keyboard cursor
		// dictionaries has changed, we need to let our observers know, since they
		// may now be holding on to outdated data.
		if (!change?.objectClass) {
			return;
		}

		const touched = [];

		for (var data of [this._focused, this._keyboardCursor]) {
			for (var key in data) {
				var val = data[key];
				if (!val || val.constructor.name !== change.objectClass) {
					continue;
				}
				for (var obj of Array.from(change.objects)) {
					if (val.id === obj.id) {
						if (change.type === "unpersist") {
							data[key] = null;
						} else {
							data[key] = obj;
						}
						touched.push(key);
					}
				}
			}
		}

		if (touched.length > 0) {
			return this.trigger({
				impactsCollection(c) {
					return Array.from(touched).includes(c);
				},
			});
		}
	}

	// Public Methods

	/*
  Public: Returns the focused {Model} in the collection specified,
  or undefined if no item is focused.

  - `collection` The {String} name of a collection. Standard collections are
    listed above.
  */
	focused(collection) {
		return this._focused[collection];
	}

	/*
  Public: Returns the ID of the focused {Model} in the collection specified,
  or undefined if no item is focused.

  - `collection` The {String} name of a collection. Standard collections are
    listed above.
  */
	focusedId(collection) {
		return this._focused[collection] != null
			? this._focused[collection].id
			: undefined;
	}

	/*
  Public: Returns true if the item for the collection was focused via a click or
  false otherwise.

  - `collection` The {String} name of a collection. Standard collections are
    listed above.
  */
	didFocusUsingClick(collection) {
		return this._focusedUsingClick[collection] != null
			? this._focusedUsingClick[collection]
			: false;
	}

	/*
  Public: Returns the {Model} the keyboard is currently focused on
  in the collection specified. Keyboard focus is not always separate from
  primary focus (selection). You can use {::keyboardCursorEnabled} to determine
  whether keyboard focus is enabled.

  - `collection` The {String} name of a collection. Standard collections are
    listed above.
  */
	keyboardCursor(collection) {
		return this._keyboardCursor[collection];
	}

	/*
  Public: Returns the ID of the {Model} the keyboard is currently focused on
  in the collection specified. Keyboard focus is not always separate from
  primary focus (selection). You can use {::keyboardCursorEnabled} to determine
  whether keyboard focus is enabled.

  - `collection` The {String} name of a collection. Standard collections are
    listed above.
  */
	keyboardCursorId(collection) {
		return this._keyboardCursor[collection] != null
			? this._keyboardCursor[collection].id
			: undefined;
	}

	/*
  Public: Returns a {Boolean} - `true` if the keyboard cursor concept applies in
  the current {WorkspaceStore} layout mode. The keyboard cursor is currently only
  enabled in `list` mode.
  */
	keyboardCursorEnabled() {
		return this._keyboardCursorEnabled;
	}
}
FocusedContentStore.initClass();

module.exports = new FocusedContentStore();
