/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const React = require("react");
const ReactDOM = require("react-dom");
const classnames = require("classnames");

const {
	MultiselectList,
	FocusContainer,
	EmptyListState,
	FluxContainer,
	SyncingListState,
} = require("nylas-component-kit");

const {
	Actions,
	Utils,
	Thread,
	Category,
	CanvasUtils,
	TaskFactory,
	ChangeStarredTask,
	WorkspaceStore,
	AccountStore,
	CategoryStore,
	ExtensionRegistry,
	FocusedContentStore,
	FocusedPerspectiveStore,
	FolderSyncProgressStore,
} = require("nylas-exports");

const ThreadListColumns = require("./thread-list-columns");
const ThreadListScrollTooltip = require("./thread-list-scroll-tooltip");
const ThreadListStore = require("./thread-list-store");
const ThreadListContextMenu = require("./thread-list-context-menu").default;
const CategoryRemovalTargetRulesets =
	require("./category-removal-target-rulesets").default;

class ThreadList extends React.Component {
	static initClass() {
		ThreadList.displayName = "ThreadList";

		ThreadList.containerRequired = false;
		ThreadList.containerStyles = {
			minWidth: 300,
			maxWidth: 3000,
		};
	}

	constructor(props) {
		this.componentDidMount = this.componentDidMount.bind(this);
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this._reportAppBootTime = this._reportAppBootTime.bind(this);
		this._shift = this._shift.bind(this);
		this._onThreadListDidUpdate = this._onThreadListDidUpdate.bind(this);
		this._onSyncStatusChanged = this._onSyncStatusChanged.bind(this);
		this._onShowContextMenu = this._onShowContextMenu.bind(this);
		this._onDragStart = this._onDragStart.bind(this);
		this._onDragEnd = this._onDragEnd.bind(this);
		this._onResize = this._onResize.bind(this);
		this._onStarItem = this._onStarItem.bind(this);
		this._onSnoozeItem = this._onSnoozeItem.bind(this);
		this._onSetImportant = this._onSetImportant.bind(this);
		this._onSetUnread = this._onSetUnread.bind(this);
		this._onMarkAsSpam = this._onMarkAsSpam.bind(this);
		this._onRemoveFromView = this._onRemoveFromView.bind(this);
		this._onArchiveItem = this._onArchiveItem.bind(this);
		this._onDeleteItem = this._onDeleteItem.bind(this);
		this._onSelectRead = this._onSelectRead.bind(this);
		this._onSelectUnread = this._onSelectUnread.bind(this);
		this._onSelectStarred = this._onSelectStarred.bind(this);
		this._onSelectUnstarred = this._onSelectUnstarred.bind(this);
		this.props = props;
		this.state = {
			style: "unknown",
			syncing: false,
		};
	}

	componentDidMount() {
		this._reportAppBootTime();
		this.unsub = FolderSyncProgressStore.listen(this._onSyncStatusChanged);
		window.addEventListener("resize", this._onResize, true);
		ReactDOM.findDOMNode(this).addEventListener(
			"contextmenu",
			this._onShowContextMenu,
		);
		return this._onResize();
	}

	shouldComponentUpdate(nextProps, nextState) {
		return (
			!Utils.isEqualReact(this.props, nextProps) ||
			!Utils.isEqualReact(this.state, nextState)
		);
	}

	componentWillUnmount() {
		this.unsub();
		window.removeEventListener("resize", this._onResize, true);
		return ReactDOM.findDOMNode(this).removeEventListener(
			"contextmenu",
			this._onShowContextMenu,
		);
	}

	_reportAppBootTime() {
		if (NylasEnv.timer.isPending("app-boot")) {
			return Actions.recordPerfMetric({
				action: "app-boot",
				actionTimeMs: NylasEnv.timer.stop("app-boot"),
				maxValue: 60 * 1000,
			});
		}
	}

	_shift({ offset, afterRunning }) {
		const dataSource = ThreadListStore.dataSource();
		const focusedId = FocusedContentStore.focusedId("thread");
		const focusedIdx = Math.min(
			dataSource.count() - 1,
			Math.max(0, dataSource.indexOfId(focusedId) + offset),
		);
		const item = dataSource.get(focusedIdx);
		afterRunning();
		return Actions.setFocus({ collection: "thread", item });
	}

	_keymapHandlers() {
		return {
			"core:remove-from-view": () => {
				return this._onRemoveFromView();
			},
			"core:gmail-remove-from-view": () => {
				return this._onRemoveFromView(CategoryRemovalTargetRulesets.Gmail);
			},
			"core:archive-item": this._onArchiveItem,
			"core:delete-item": this._onDeleteItem,
			"core:star-item": this._onStarItem,
			"core:snooze-item": this._onSnoozeItem,
			"core:mark-important": () => this._onSetImportant(true),
			"core:mark-unimportant": () => this._onSetImportant(false),
			"core:mark-as-unread": () => this._onSetUnread(true),
			"core:mark-as-read": () => this._onSetUnread(false),
			"core:report-as-spam": () => this._onMarkAsSpam(false),
			"core:remove-and-previous": () => {
				return this._shift({
					offset: -1,
					afterRunning: this._onRemoveFromView,
				});
			},
			"core:remove-and-next": () => {
				return this._shift({ offset: 1, afterRunning: this._onRemoveFromView });
			},
			"thread-list:select-read": this._onSelectRead,
			"thread-list:select-unread": this._onSelectUnread,
			"thread-list:select-starred": this._onSelectStarred,
			"thread-list:select-unstarred": this._onSelectUnstarred,
		};
	}

	_getFooter() {
		if (!this.state.syncing) {
			return null;
		}
		if (ThreadListStore.dataSource().count() <= 0) {
			return null;
		}
		return React.createElement(SyncingListState, null);
	}

	render() {
		let columns, itemHeight;
		if (this.state.style === "wide") {
			columns = ThreadListColumns.Wide;
			itemHeight = 36;
		} else {
			columns = ThreadListColumns.Narrow;
			itemHeight = 85;
		}

		return React.createElement(
			FluxContainer,
			{
				footer: this._getFooter(),
				stores: [ThreadListStore],
				getStateFromStores() {
					return { dataSource: ThreadListStore.dataSource() };
				},
			},
			React.createElement(
				FocusContainer,
				{ collection: "thread" },
				React.createElement(MultiselectList, {
					ref: "list",
					draggable: true,
					columns: columns,
					itemPropsProvider: this._threadPropsProvider,
					itemHeight: itemHeight,
					className: `thread-list thread-list-${this.state.style}`,
					scrollTooltipComponent: ThreadListScrollTooltip,
					EmptyComponent: EmptyListState,
					keymapHandlers: this._keymapHandlers(),
					onDoubleClick(thread) {
						return Actions.popoutThread(thread);
					},
					onDragStart: this._onDragStart,
					onDragEnd: this._onDragEnd,
					onComponentDidUpdate: this._onThreadListDidUpdate,
				}),
			),
		);
	}

	_onThreadListDidUpdate() {
		const dataSource = ThreadListStore.dataSource();
		const threads = dataSource.itemsCurrentlyInView();
		return Actions.threadListDidUpdate(threads);
	}

	_threadPropsProvider(item) {
		let left;
		let classes = classnames({
			unread: item.unread,
		});
		classes += ExtensionRegistry.ThreadList.extensions()
			.filter((ext) => ext.cssClassNamesForThreadListItem != null)
			.reduce(
				(prev, ext) => `${prev} ${ext.cssClassNamesForThreadListItem(item)}`,
				" ",
			);

		const props = { className: classes };

		// TODO this swiping logic needs some serious cleanup
		props.shouldEnableSwipe = () => {
			const perspective = FocusedPerspectiveStore.current();
			const tasks = perspective.tasksForRemovingItems(
				[item],
				CategoryRemovalTargetRulesets.Default,
				"Swipe",
			);
			return tasks.length > 0;
		};

		props.onSwipeRightClass = () => {
			const perspective = FocusedPerspectiveStore.current();
			const tasks = perspective.tasksForRemovingItems(
				[item],
				CategoryRemovalTargetRulesets.Default,
				"Swipe",
			);
			if (tasks.length === 0) {
				return null;
			}

			const task = tasks[0];
			const name =
				task instanceof ChangeStarredTask
					? "unstar"
					: task.categoriesToAdd().length === 1
						? task.categoriesToAdd()[0].name
						: "remove";

			return `swipe-${name}`;
		};

		props.onSwipeRight = (callback) => {
			const perspective = FocusedPerspectiveStore.current();
			const tasks = perspective.tasksForRemovingItems(
				[item],
				CategoryRemovalTargetRulesets.Default,
				"Swipe",
			);
			if (tasks.length === 0) {
				callback(false);
				return;
			}
			Actions.removeThreadsFromView({
				threads: [item],
				source: "Swipe",
				ruleset: CategoryRemovalTargetRulesets.Default,
			});
			Actions.closePopover();
			return callback(true);
		};

		const disabledPackages =
			(left = NylasEnv.config.get("core.disabledPackages")) != null ? left : [];
		if (Array.from(disabledPackages).includes("thread-snooze")) {
			return props;
		}

		if (FocusedPerspectiveStore.current().isInbox()) {
			props.onSwipeLeftClass = "swipe-snooze";
			props.onSwipeCenter = () => {
				return Actions.closePopover();
			};
			props.onSwipeLeft = (callback) => {
				// TODO this should be grabbed from elsewhere
				const SnoozePopover =
					require("../../thread-snooze/lib/snooze-popover").default;

				const element = document.querySelector(`[data-item-id="${item.id}"]`);
				const originRect = element.getBoundingClientRect();
				return Actions.openPopover(
					React.createElement(SnoozePopover, {
						threads: [item],
						swipeCallback: callback,
					}),
					{ originRect, direction: "right", fallbackDirection: "down" },
				);
			};
		}

		return props;
	}

	_targetItemsForMouseEvent(event) {
		let needle;
		const itemThreadId = this.refs.list.itemIdAtPoint(
			event.clientX,
			event.clientY,
		);
		if (!itemThreadId) {
			return null;
		}

		const dataSource = ThreadListStore.dataSource();
		if (
			((needle = itemThreadId),
			Array.from(dataSource.selection.ids()).includes(needle))
		) {
			return {
				threadIds: dataSource.selection.ids(),
				accountIds: _.uniq(_.pluck(dataSource.selection.items(), "accountId")),
			};
		} else {
			const thread = dataSource.getById(itemThreadId);
			if (!thread) {
				return null;
			}
			return {
				threadIds: [thread.id],
				accountIds: [thread.accountId],
			};
		}
	}

	_onSyncStatusChanged() {
		const syncing = FocusedPerspectiveStore.current().hasSyncingCategories();
		return this.setState({ syncing });
	}

	_onShowContextMenu(event) {
		const data = this._targetItemsForMouseEvent(event);
		if (!data) {
			event.preventDefault();
			return;
		}
		return new ThreadListContextMenu(data).displayMenu();
	}

	_onDragStart(event) {
		const data = this._targetItemsForMouseEvent(event);
		if (!data) {
			event.preventDefault();
			return;
		}

		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.dragEffect = "move";

		const canvas = CanvasUtils.canvasWithThreadDragImage(data.threadIds.length);
		event.dataTransfer.setDragImage(canvas, 10, 10);
		event.dataTransfer.setData("nylas-threads-data", JSON.stringify(data));
		event.dataTransfer.setData(
			`nylas-accounts=${data.accountIds.join(",")}`,
			"1",
		);
	}

	_onDragEnd(_event) {}

	_onResize(_event) {
		const current = this.state.style;
		const desired =
			ReactDOM.findDOMNode(this).offsetWidth < 540 ? "narrow" : "wide";
		if (current !== desired) {
			return this.setState({ style: desired });
		}
	}

	_threadsForKeyboardAction() {
		if (!ThreadListStore.dataSource()) {
			return null;
		}
		const focused = FocusedContentStore.focused("thread");
		if (focused) {
			return [focused];
		} else if (ThreadListStore.dataSource().selection.count() > 0) {
			return ThreadListStore.dataSource().selection.items();
		} else {
			return null;
		}
	}

	_onStarItem() {
		const threads = this._threadsForKeyboardAction();
		if (!threads) {
			return;
		}
		return Actions.toggleStarredThreads({
			threads,
			source: "Keyboard Shortcut",
		});
	}

	_onSnoozeItem() {
		let left;
		const disabledPackages =
			(left = NylasEnv.config.get("core.disabledPackages")) != null ? left : [];
		if (Array.from(disabledPackages).includes("thread-snooze")) {
			return;
		}

		const threads = this._threadsForKeyboardAction();
		if (!threads) {
			return;
		}
		// TODO this should be grabbed from elsewhere
		const SnoozePopover =
			require("../../thread-snooze/lib/snooze-popover").default;

		const element = document.querySelector(".snooze-button.btn.btn-toolbar");
		if (!element) {
			return;
		}
		const originRect = element.getBoundingClientRect();
		return Actions.openPopover(
			React.createElement(SnoozePopover, {
				threads: threads,
			}),
			{ originRect, direction: "down" },
		);
	}

	_onSetImportant(important) {
		let tasks;
		const threads = this._threadsForKeyboardAction();
		if (!threads) {
			return;
		}
		if (!NylasEnv.config.get("core.workspace.showImportant")) {
			return;
		}

		if (important) {
			tasks = TaskFactory.tasksForApplyingCategories({
				source: "Keyboard Shortcut",
				threads,
				categoriesToRemove(_accountId) {
					return [];
				},
				categoriesToAdd(accountId) {
					return [CategoryStore.getStandardCategory(accountId, "important")];
				},
			});
		} else {
			tasks = TaskFactory.tasksForApplyingCategories({
				source: "Keyboard Shortcut",
				threads,
				categoriesToRemove(accountId) {
					important = CategoryStore.getStandardCategory(accountId, "important");
					if (important) {
						return [important];
					}
					return [];
				},
			});
		}

		return Actions.queueTasks(tasks);
	}

	_onSetUnread(unread) {
		const threads = this._threadsForKeyboardAction();
		if (!threads) {
			return;
		}
		Actions.setUnreadThreads({ threads, unread, source: "Keyboard Shortcut" });
		return Actions.popSheet();
	}

	_onMarkAsSpam() {
		const threads = this._threadsForKeyboardAction();
		if (!threads) {
			return;
		}
		return Actions.markAsSpamThreads({
			source: "Keyboard Shortcut",
			threads,
		});
	}

	_onRemoveFromView(ruleset) {
		if (ruleset == null) {
			ruleset = CategoryRemovalTargetRulesets.Default;
		}
		const threads = this._threadsForKeyboardAction();
		if (!threads) {
			return;
		}
		Actions.removeThreadsFromView({
			threads,
			ruleset,
			source: "Keyboard Shortcut",
		});
		return Actions.popSheet();
	}

	_onArchiveItem() {
		const threads = this._threadsForKeyboardAction();
		if (!threads) {
			return;
		}
		Actions.archiveThreads({ threads, source: "Keyboard Shortcut" });
		return Actions.popSheet();
	}

	_onDeleteItem() {
		const threads = this._threadsForKeyboardAction();
		if (threads) {
			Actions.trashThreads({
				source: "Keyboard Shortcut",
				threads,
			});
		}
		return Actions.popSheet();
	}

	_onSelectRead() {
		const dataSource = ThreadListStore.dataSource();
		const items = dataSource.itemsCurrentlyInViewMatching(
			(item) => !item.unread,
		);
		return this.refs.list.handler().onSelect(items);
	}

	_onSelectUnread() {
		const dataSource = ThreadListStore.dataSource();
		const items = dataSource.itemsCurrentlyInViewMatching(
			(item) => item.unread,
		);
		return this.refs.list.handler().onSelect(items);
	}

	_onSelectStarred() {
		const dataSource = ThreadListStore.dataSource();
		const items = dataSource.itemsCurrentlyInViewMatching(
			(item) => item.starred,
		);
		return this.refs.list.handler().onSelect(items);
	}

	_onSelectUnstarred() {
		const dataSource = ThreadListStore.dataSource();
		const items = dataSource.itemsCurrentlyInViewMatching(
			(item) => !item.starred,
		);
		return this.refs.list.handler().onSelect(items);
	}
}
ThreadList.initClass();

module.exports = ThreadList;
