/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import React from "react";
import ReactCSSTransitionGroup from "./components/css-transition-group-compat.jsx";
import Sheet from "./sheet.jsx";
import Toolbar from "./sheet-toolbar.jsx";
import Flexbox from "./components/flexbox.jsx";
import _RetinaImg from "./components/retina-img.jsx";
import InjectedComponentSet from "./components/injected-component-set.jsx";
import _ from "underscore";

import { Actions, ComponentRegistry, WorkspaceStore } from "nylas-exports";

var SheetContainer = (() => {
	let _displayName;
	SheetContainer = class SheetContainer extends React.Component {
		static initClass() {
			_displayName = "SheetContainer";
		}

		constructor(props) {
			super(props);
			this._toolbarRefs = {};
			this.componentDidMount = this.componentDidMount.bind(this);
			this.componentWillUnmount = this.componentWillUnmount.bind(this);
			this.render = this.render.bind(this);
			this._toolbarContainerElement = this._toolbarContainerElement.bind(this);
			this._toolbarElements = this._toolbarElements.bind(this);
			this._sheetElements = this._sheetElements.bind(this);
			this._onColumnSizeChanged = this._onColumnSizeChanged.bind(this);
			this._onStoreChange = this._onStoreChange.bind(this);
			this._getStateFromStores = this._getStateFromStores.bind(this);
			this.state = this._getStateFromStores();
		}

		componentDidMount() {
			return (this.unsubscribe = WorkspaceStore.listen(this._onStoreChange));
		}

		componentWillUnmount() {
			if (this.unsubscribe) {
				return this.unsubscribe();
			}
		}

		render() {
			const totalSheets = this.state.stack.length;
			const topSheet = this.state.stack[totalSheets - 1];

			if (!topSheet) {
				return React.createElement("div", null);
			}

			const sheetElements = this._sheetElements();

			return React.createElement(
				Flexbox,
				{
					direction: "column",
					className: `layout-mode-${this.state.mode}`,
					style: { overflow: "hidden" },
				},
				this._toolbarContainerElement(),

				React.createElement(
					"div",
					{ name: "Header", style: { order: 1, zIndex: 2 } },
					React.createElement(InjectedComponentSet, {
						matching: {
							locations: [topSheet.Header, WorkspaceStore.Sheet.Global.Header],
						},
						direction: "column",
						id: topSheet.id,
					}),
				),

				React.createElement(
					"div",
					{
						name: "Center",
						style: { order: 2, flex: 1, position: "relative", zIndex: 1 },
					},
					sheetElements[0],
					React.createElement(
						ReactCSSTransitionGroup,
						{
							transitionLeaveTimeout: 125,
							transitionEnterTimeout: 125,
							transitionName: "sheet-stack",
						},
						sheetElements.slice(1),
					),
				),

				React.createElement(
					"div",
					{ name: "Footer", style: { order: 3, zIndex: 4 } },
					React.createElement(InjectedComponentSet, {
						matching: {
							locations: [topSheet.Footer, WorkspaceStore.Sheet.Global.Footer],
						},
						direction: "column",
						id: topSheet.id,
					}),
				),
			);
		}

		_toolbarContainerElement() {
			const { toolbar } = NylasEnv.getLoadSettings();
			if (!toolbar) {
				return [];
			}

			const toolbarElements = this._toolbarElements();
			return React.createElement(
				"div",
				{
					name: "Toolbar",
					style: { order: 0, zIndex: 3 },
					className: "sheet-toolbar",
				},
				toolbarElements[0],
				React.createElement(
					ReactCSSTransitionGroup,
					{
						transitionLeaveTimeout: 125,
						transitionEnterTimeout: 125,
						transitionName: "opacity-125ms",
					},
					toolbarElements.slice(1),
				),
			);
		}

		_toolbarElements() {
			return this.state.stack.map((sheet, index) =>
				React.createElement(Toolbar, {
					data: sheet,
					ref: (el) => {
						this._toolbarRefs[index] = el;
					},
					key: `${index}:${sheet.id}:toolbar`,
					depth: index,
				}),
			);
		}

		_sheetElements() {
			return this.state.stack.map((sheet, index) => {
				return React.createElement(Sheet, {
					data: sheet,
					depth: index,
					key: `${index}:${sheet.id}`,
					onColumnSizeChanged: this._onColumnSizeChanged,
				});
			});
		}

		_onColumnSizeChanged(sheet) {
			const toolbar = this._toolbarRefs[sheet.props.depth];
			if (toolbar != null) {
				toolbar.recomputeLayout();
			}
			return window.dispatchEvent(new Event("resize"));
		}

		_onStoreChange() {
			return this.setState(this._getStateFromStores());
		}

		_getStateFromStores() {
			return {
				stack: WorkspaceStore.sheetStack(),
				mode: WorkspaceStore.layoutMode(),
			};
		}
	};
	SheetContainer.initClass();
	return SheetContainer;
})();

export default SheetContainer;
