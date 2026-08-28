/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
import _ from "underscore";
import React from "react";
import ReactDOM from "react-dom";
import classNames from "classnames";
import ListTabular from "./list-tabular.jsx";
import Spinner from "./spinner.jsx";
import { Actions, Utils, WorkspaceStore, AccountStore } from "nylas-exports";
import { KeyCommandsRegion } from "nylas-component-kit";
import { EventEmitter } from "node:events";

import MultiselectListInteractionHandler from "./multiselect-list-interaction-handler.js";
import MultiselectSplitInteractionHandler from "./multiselect-split-interaction-handler.js";

/*
Public: MultiselectList wraps {ListTabular} and makes it easy to present a
{ListDataSource} with selection support. It adds a checkbox column to the columns
you provide, and also handles:

- Command-clicking individual items
- Shift-clicking to select a range
- Using the keyboard to select a range

Section: Component Kit
*/
class MultiselectList extends React.Component {
	static initClass() {
		MultiselectList.displayName = "MultiselectList";

		MultiselectList.propTypes = {
			dataSource: PropTypes.object,
			className: PropTypes.string.isRequired,
			columns: PropTypes.array.isRequired,
			itemPropsProvider: PropTypes.func.isRequired,
			keymapHandlers: PropTypes.object,
			onComponentDidUpdate: PropTypes.func,
		};
	}

	constructor(props) {
		super();
		this.componentDidMount = this.componentDidMount.bind(this);
		this.UNSAFE_componentWillReceiveProps =
			this.UNSAFE_componentWillReceiveProps.bind(this);
		this.componentDidUpdate = this.componentDidUpdate.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this.teardownForProps = this.teardownForProps.bind(this);
		this.setupForProps = this.setupForProps.bind(this);
		this.render = this.render.bind(this);
		this._onClickItem = this._onClickItem.bind(this);
		this._onEnter = this._onEnter.bind(this);
		this._onSelectKeyboardItem = this._onSelectKeyboardItem.bind(this);
		this._onSelectAll = this._onSelectAll.bind(this);
		this._onDeselect = this._onDeselect.bind(this);
		this._onShift = this._onShift.bind(this);
		this._onScrollByPage = this._onScrollByPage.bind(this);
		this._onChange = this._onChange.bind(this);
		this._visible = this._visible.bind(this);
		this._getCheckmarkColumn = this._getCheckmarkColumn.bind(this);
		this._getStateFromStores = this._getStateFromStores.bind(this);
		this.props = props;
		this.state = this._getStateFromStores();
	}

	componentDidMount() {
		return this.setupForProps(this.props);
	}

	UNSAFE_componentWillReceiveProps(newProps) {
		if (_.isEqual(this.props, newProps)) {
			return;
		}
		this.teardownForProps();
		this.setupForProps(newProps);
		return this.setState(this._getStateFromStores(newProps));
	}

	componentDidUpdate(prevProps, _prevState) {
		if (this.props.onComponentDidUpdate) {
			this.props.onComponentDidUpdate();
		}
		if (
			prevProps.focusedId !== this.props.focusedId ||
			prevProps.keyboardCursorId !== this.props.keyboardCursorId
		) {
			let item = ReactDOM.findDOMNode(this).querySelector(".focused");
			if (item == null) {
				item = ReactDOM.findDOMNode(this).querySelector(".keyboard-cursor");
			}
			if (!(item instanceof Node)) {
				return;
			}
			return this.refs.list.scrollTo(item);
		}
	}

	componentWillUnmount() {
		return this.teardownForProps();
	}

	teardownForProps() {
		if (!this.unsubscribers) {
			return;
		}
		return Array.from(this.unsubscribers).map((unsubscribe) => unsubscribe());
	}

	setupForProps(_props) {
		this.unsubscribers = [];
		return this.unsubscribers.push(WorkspaceStore.listen(this._onChange));
	}

	_globalKeymapHandlers() {
		return _.extend({}, this.props.keymapHandlers, {
			"core:focus-item": () => this._onEnter(),
			"core:select-item": () => this._onSelectKeyboardItem(),
			"core:next-item": () => this._onShift(1),
			"core:previous-item": () => this._onShift(-1),
			"core:select-down": () => this._onShift(1, { select: true }),
			"core:select-up": () => this._onShift(-1, { select: true }),
			"core:list-page-up": () => this._onScrollByPage(-1),
			"core:list-page-down": () => this._onScrollByPage(1),
			"core:pop-sheet": () => this._onDeselect(),
			"multiselect-list:select-all": () => this._onSelectAll(),
			"multiselect-list:deselect-all": () => this._onDeselect(),
		});
	}

	render() {
		// IMPORTANT: DO NOT pass inline functions as props. _.isEqual thinks these
		// are "different", and will re-render everything. Instead, declare them with ?=,
		// pass a reference. (Alternatively, ignore these in children's shouldComponentUpdate.)
		//
		// BAD:   onSelect={ (item) -> Actions.focusThread(item) }
		// GOOD:  onSelect={@_onSelectItem}
		//
		const otherProps = Utils.fastOmit(
			this.props,
			Object.keys(this.constructor.propTypes),
		);

		let { className } = this.props;
		if (this.props.dataSource && this.state.handler) {
			className += ` ${this.state.handler.cssClass()}`;

			if (this.itemPropsProvider == null) {
				this.itemPropsProvider = (item, idx) => {
					let nextSelected;
					const selectedIds = this.props.dataSource.selection.ids();
					const selected = Array.from(selectedIds).includes(item.id);
					if (!selected) {
						const nextId = __guard__(
							this.props.dataSource.get(idx + 1),
							(x) => x.id,
						);
						nextSelected = Array.from(selectedIds).includes(nextId);
					}

					const props = this.props.itemPropsProvider(item, idx);
					if (props.className == null) {
						props.className = "";
					}
					props.className +=
						" " +
						classNames({
							selected: selected,
							"next-is-selected": !selected && nextSelected,
							focused:
								this.state.handler.shouldShowFocus() &&
								item.id === this.props.focusedId,
							"keyboard-cursor":
								this.state.handler.shouldShowKeyboardCursor() &&
								item.id === this.props.keyboardCursorId,
						});
					props["data-item-id"] = item.id;
					return props;
				};
			}

			return React.createElement(
				KeyCommandsRegion,
				{ globalHandlers: this._globalKeymapHandlers(), className: className },
				React.createElement(
					ListTabular,
					Object.assign(
						{
							ref: "list",
							columns: this.state.computedColumns,
							dataSource: this.props.dataSource,
							itemPropsProvider: this.itemPropsProvider,
							onSelect: this._onClickItem,
							onComponentDidUpdate: this.props.onComponentDidUpdate,
						},
						otherProps,
					),
				),
			);
		} else {
			return React.createElement(
				"div",
				Object.assign({ className: className }, otherProps),
				React.createElement(Spinner, { visible: true }),
			);
		}
	}

	_onClickItem(item, event) {
		if (!this.state.handler) {
			return;
		}
		if (event.metaKey || event.ctrlKey) {
			return this.state.handler.onMetaClick(item);
		} else if (event.shiftKey) {
			return this.state.handler.onShiftClick(item);
		} else {
			return this.state.handler.onClick(item);
		}
	}

	_onEnter() {
		if (!this.state.handler) {
			return;
		}
		return this.state.handler.onEnter();
	}

	_onSelectKeyboardItem() {
		if (!this.state.handler) {
			return;
		}
		return this.state.handler.onSelectKeyboardItem();
	}

	_onSelectAll() {
		if (!this.state.handler) {
			return;
		}
		const items = this.props.dataSource.itemsCurrentlyInViewMatching(
			() => true,
		);
		return this.state.handler.onSelect(items);
	}

	_onDeselect() {
		if (!this._visible() || !this.state.handler) {
			return;
		}
		return this.state.handler.onDeselect();
	}

	_onShift(delta, options) {
		if (options == null) {
			options = {};
		}
		if (!this.state.handler) {
			return;
		}
		return this.state.handler.onShift(delta, options);
	}

	_onScrollByPage(delta) {
		return this.refs.list.scrollByPage(delta);
	}

	_onChange() {
		return this.setState(this._getStateFromStores());
	}

	_visible() {
		if (this.state.layoutMode) {
			return WorkspaceStore.topSheet().root;
		} else {
			return true;
		}
	}

	_getCheckmarkColumn() {
		return new ListTabular.Column({
			name: "Check",
			resolver: (item) => {
				const toggle = (event) => {
					if (event.shiftKey) {
						this.state.handler.onShiftClick(item);
					} else {
						this.state.handler.onMetaClick(item);
					}
					return event.stopPropagation();
				};
				return React.createElement(
					"div",
					{ className: "checkmark", onClick: toggle },
					React.createElement("div", { className: "inner" }),
				);
			},
		});
	}

	_getStateFromStores(props) {
		let computedColumns, handler;
		if (props == null) {
			({ props } = this);
		}
		const state = this.state != null ? this.state : {};

		const layoutMode = WorkspaceStore.layoutMode();

		// Do we need to re-compute columns? Don't do this unless we really have to,
		// it will cause a re-render of the entire ListTabular. To know whether our
		// computed columns are still valid, we store the original columns in our state
		// along with the computed ones.
		if (props.columns !== state.columns || layoutMode !== state.layoutMode) {
			computedColumns = [].concat(props.columns);
			if (layoutMode === "list") {
				computedColumns.splice(0, 0, this._getCheckmarkColumn());
			}
		} else {
			({ computedColumns } = state);
		}

		if (layoutMode === "list") {
			handler = new MultiselectListInteractionHandler(props);
		} else {
			handler = new MultiselectSplitInteractionHandler(props);
		}

		return {
			handler,
			columns: props.columns,
			computedColumns,
			layoutMode,
		};
	}

	// Public Methods

	handler() {
		return this.state.handler;
	}

	itemIdAtPoint(x, y) {
		const item = document.elementFromPoint(x, y).closest("[data-item-id]");
		if (!item) {
			return null;
		}
		return item.dataset.itemId;
	}
}
MultiselectList.initClass();

export default MultiselectList;

function __guard__(value, transform) {
	return typeof value !== "undefined" && value !== null
		? transform(value)
		: undefined;
}
