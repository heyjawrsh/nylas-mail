/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const NylasStore = require("nylas-store");

const {
	Rx,
	Thread,
	Message,
	Actions,
	DatabaseStore,
	WorkspaceStore,
	FocusedContentStore,
	TaskQueueStatusStore,
	FocusedPerspectiveStore,
} = require("nylas-exports");
const { ListTabular } = require("nylas-component-kit");

const ThreadListDataSource = require("./thread-list-data-source").default;

class ThreadListStore extends NylasStore {
	constructor() {
		super();
		this.dataSource = this.dataSource.bind(this);
		this.createListDataSource = this.createListDataSource.bind(this);
		this.selectionObservable = this.selectionObservable.bind(this);
		this._onPerspectiveChanged = this._onPerspectiveChanged.bind(this);
		this._onDataChanged = this._onDataChanged.bind(this);
		this.listenTo(FocusedPerspectiveStore, this._onPerspectiveChanged);
		this.createListDataSource();
	}

	dataSource() {
		return this._dataSource;
	}

	createListDataSource() {
		if (typeof this._dataSourceUnlisten === "function") {
			this._dataSourceUnlisten();
		}
		this._dataSource = null;

		const threadsSubscription = FocusedPerspectiveStore.current().threads();
		if (threadsSubscription) {
			this._dataSource = new ThreadListDataSource(threadsSubscription);
			this._dataSourceUnlisten = this._dataSource.listen(
				this._onDataChanged,
				this,
			);
		} else {
			this._dataSource = new ListTabular.DataSource.Empty();
		}

		this.trigger(this);
		return Actions.setFocus({ collection: "thread", item: null });
	}

	selectionObservable() {
		return Rx.Observable.fromListSelection(this);
	}

	// Inbound Events

	_onPerspectiveChanged() {
		return this.createListDataSource();
	}

	_onDataChanged(param) {
		// This code keeps the focus and keyboard cursor in sync with the thread list.
		// When the thread list changes, it looks to see if the focused thread is gone,
		// or no longer matches the query criteria and advances the focus to the next
		// thread.

		// This means that removing a thread from view in any way causes selection
		// to advance to the adjacent thread. Nice and declarative.

		if (param == null) {
			param = {};
		}
		const { previous, next } = param;
		if (previous && next) {
			const focused = FocusedContentStore.focused("thread");
			const keyboard = FocusedContentStore.keyboardCursor("thread");
			const viewModeAutofocuses =
				WorkspaceStore.layoutMode() === "split" ||
				WorkspaceStore.topSheet().root === true;
			const matchers = __guard__(next.query(), (x) => x.matchers());

			const focusedIndex = focused ? previous.offsetOfId(focused.id) : -1;
			const keyboardIndex = keyboard ? previous.offsetOfId(keyboard.id) : -1;

			const nextItemFromIndex = (i) => {
				let nextIndex;
				if (
					i > 0 &&
					(__guard__(next.modelAtOffset(i - 1), (x1) => x1.unread) ||
						i >= next.count())
				) {
					nextIndex = i - 1;
				} else {
					nextIndex = i;
				}

				// May return null if no thread is loaded at the next index
				return next.modelAtOffset(nextIndex);
			};

			const notInSet = (model) => {
				if (matchers) {
					return model.matches(matchers) === false;
				} else {
					return next.offsetOfId(model.id) === -1;
				}
			};

			if (viewModeAutofocuses && focused && notInSet(focused)) {
				Actions.setFocus({
					collection: "thread",
					item: nextItemFromIndex(focusedIndex),
				});
			}

			if (keyboard && notInSet(keyboard)) {
				return Actions.setCursorPosition({
					collection: "thread",
					item: nextItemFromIndex(keyboardIndex),
				});
			}
		}
	}
}

module.exports = new ThreadListStore();

function __guard__(value, transform) {
	return typeof value !== "undefined" && value !== null
		? transform(value)
		: undefined;
}
