/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const React = require("react");
const _ = require("underscore");
const { Actions, ComponentRegistry, WorkspaceStore } = require("nylas-exports");
const RetinaImg = require("./components/retina-img").default;
const Flexbox = require("./components/flexbox").default;
const InjectedComponentSet = require("./components/injected-component-set");
const ResizableRegion = require("./components/resizable-region");

const FLEX = 10000;

class Sheet extends React.Component {
	static initClass() {
		Sheet.displayName = "Sheet";

		Sheet.propTypes = {
			data: PropTypes.object.isRequired,
			depth: PropTypes.number.isRequired,
			onColumnSizeChanged: PropTypes.func,
		};

		Sheet.defaultProps = { onColumnSizeChanged() {} };

		Sheet.childContextTypes = { sheetDepth: PropTypes.number };
	}

	getChildContext() {
		return { sheetDepth: this.props.depth };
	}

	constructor(props) {
		this.getChildContext = this.getChildContext.bind(this);
		this.componentDidMount = this.componentDidMount.bind(this);
		this.componentDidUpdate = this.componentDidUpdate.bind(this);
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this.render = this.render.bind(this);
		this._columnFlexboxElements = this._columnFlexboxElements.bind(this);
		this._onColumnResize = this._onColumnResize.bind(this);
		this._getStateFromStores = this._getStateFromStores.bind(this);
		this._pop = this._pop.bind(this);
		this.props = props;
		this.state = this._getStateFromStores();
	}

	componentDidMount() {
		if (this.unlisteners == null) {
			this.unlisteners = [];
		}
		this.unlisteners.push(
			ComponentRegistry.listen((event) => {
				return this.setState(this._getStateFromStores());
			}),
		);
		return this.unlisteners.push(
			WorkspaceStore.listen((event) => {
				return this.setState(this._getStateFromStores());
			}),
		);
	}

	componentDidUpdate() {
		this.props.onColumnSizeChanged(this);
		let minWidth = 0;
		for (var col of Array.from(this.state.columns)) {
			minWidth += col.minWidth;
		}
		return NylasEnv.setMinimumWidth(minWidth);
	}

	shouldComponentUpdate(nextProps, nextState) {
		return (
			!_.isEqual(nextProps, this.props) || !_.isEqual(nextState, this.state)
		);
	}

	componentWillUnmount() {
		return Array.from(this.unlisteners).map((unlisten) => unlisten());
	}

	render() {
		const style = {
			position: "absolute",
			width: "100%",
			height: "100%",
			zIndex: 1,
		};

		// Note - setting the z-index of the sheet is important, even though it's
		// always 1. Assigning a z-index creates a "stacking context" in the browser,
		// so z-indexes inside the sheet are relative to each other, but something in
		// one sheet cannot be on top of something in another sheet.
		// http://philipwalton.com/articles/what-no-one-told-you-about-z-index/

		return React.createElement(
			"div",
			{
				name: "Sheet",
				style: style,
				className: `sheet mode-${this.state.mode}`,
				"data-id": this.props.data.id,
			},
			React.createElement(
				Flexbox,
				{ direction: "row", style: { overflow: "hidden" } },
				this._columnFlexboxElements(),
			),
		);
	}

	_columnFlexboxElements() {
		return this.state.columns.map((column, idx) => {
			const { maxWidth, minWidth, handle, location, width } = column;
			if (minWidth !== maxWidth && maxWidth < FLEX) {
				return React.createElement(
					ResizableRegion,
					{
						key: `${this.props.data.id}:${idx}`,
						name: `${this.props.data.id}:${idx}`,
						className: `column-${location.id}`,
						style: { height: "100%" },
						"data-column": idx,
						onResize: this._onColumnResize.bind(this, column),
						initialWidth: width,
						minWidth: minWidth,
						maxWidth: maxWidth,
						handle: handle,
					},
					React.createElement(InjectedComponentSet, {
						direction: "column",
						matching: { location, mode: this.state.mode },
					}),
				);
			} else {
				const style = {
					height: "100%",
					minWidth,
					overflow: "hidden",
				};
				if (maxWidth < FLEX) {
					style.width = maxWidth;
				} else {
					style.flex = 1;
				}
				return React.createElement(InjectedComponentSet, {
					direction: "column",
					key: `${this.props.data.id}:${idx}`,
					name: `${this.props.data.id}:${idx}`,
					className: `column-${location.id}`,
					"data-column": idx,
					style: style,
					matching: { location, mode: this.state.mode },
				});
			}
		});
	}

	_onColumnResize(column, width) {
		NylasEnv.storeColumnWidth({ id: column.location.id, width });
		return this.props.onColumnSizeChanged(this);
	}

	_getStateFromStores() {
		let maxWidth;
		const state = {
			mode: WorkspaceStore.layoutMode(),
			columns: [],
		};

		let widest = -1;
		let widestWidth = -1;

		if (
			(this.props.data != null
				? this.props.data.columns[state.mode]
				: undefined) != null
		) {
			for (
				let idx = 0;
				idx < this.props.data.columns[state.mode].length;
				idx++
			) {
				var location = this.props.data.columns[state.mode][idx];
				if (WorkspaceStore.isLocationHidden(location)) {
					continue;
				}
				var entries = ComponentRegistry.findComponentsMatching({
					location,
					mode: state.mode,
				});
				maxWidth = _.reduce(
					entries,
					(m, component) =>
						Math.min(
							(component.containerStyles != null
								? component.containerStyles.maxWidth
								: undefined) != null
								? component.containerStyles != null
									? component.containerStyles.maxWidth
									: undefined
								: 10000,
							m,
						),
					10000,
				);
				var minWidth = _.reduce(
					entries,
					(m, component) =>
						Math.max(
							(component.containerStyles != null
								? component.containerStyles.minWidth
								: undefined) != null
								? component.containerStyles != null
									? component.containerStyles.minWidth
									: undefined
								: 0,
							m,
						),
					0,
				);
				var width = NylasEnv.getColumnWidth(location.id);
				var col = { maxWidth, minWidth, location, width };
				state.columns.push(col);

				if (maxWidth > widestWidth) {
					widestWidth = maxWidth;
					widest = idx;
				}
			}
		}

		if (state.columns.length > 0) {
			// Once we've accumulated all the React components for the columns,
			// ensure that at least one column has a huge max-width so that the columns
			// expand to fill the window. This may make items in the column unhappy, but
			// we pick the column with the highest max-width so the effect is minimal.
			let i;
			let end;
			let end1;
			state.columns[widest].maxWidth = FLEX;

			// Assign flexible edges based on whether items are to the left or right
			// of the flexible column (which has no edges)
			for (i = 0, end = widest - 1; i <= end; i++) {
				state.columns[i].handle = ResizableRegion.Handle.Right;
			}
			for (i = widest, end1 = state.columns.length - 1; i <= end1; i++) {
				state.columns[i].handle = ResizableRegion.Handle.Left;
			}
		}
		return state;
	}

	_pop() {
		return Actions.popSheet();
	}
}
Sheet.initClass();

module.exports = Sheet;
