import _ from "underscore";
import React from "react";
import PropTypes from "prop-types";
import Utils from "../../flux/models/utils.js";
import CustomContenteditableComponents from "./custom-contenteditable-components.js";
import { IgnoreMutationClassName } from "../contenteditable/contenteditable.jsx";
import { ANCHOR_CLASS, IMG_SRC } from "./anchor-constants.js";

const MUTATION_CONFIG = {
	subtree: true,
	childList: true,
	attributes: true,
	characterData: true,
	attributeOldValue: true,
	characterDataOldValue: true,
};

export default class OverlaidComponents extends React.Component {
	static displayName = "OverlaidComponents";

	static propTypes = {
		children: PropTypes.node,
		className: PropTypes.string,
		exposedProps: PropTypes.object,
	};

	static defaultProps = {
		children: false,
		exposedProps: {},
	};

	static WRAP_CLASS = "n1-overlaid-component-wrap";

	static propsToDOMAttr(props) {
		return JSON.stringify(props).replace(/"/g, "&quot;");
	}

	static buildAnchorTag(
		componentKey,
		props = {},
		existingId = null,
		style = "",
	) {
		const overlayId = existingId || Utils.generateTempId();
		let className = `${IgnoreMutationClassName} ${ANCHOR_CLASS}`;
		if (props.className) {
			className = `${className} ${props.className}`;
		}
		const propsStr = OverlaidComponents.propsToDOMAttr(props);
		return {
			anchorId: overlayId,
			anchorTag:
				`<img class="${className}" src="${IMG_SRC}" data-overlay-id="${overlayId}" ` +
				`data-component-props="${propsStr}" data-component-key="${componentKey}" ` +
				`style="${style}">`,
		};
	}

	constructor(props) {
		super(props);
		this._overlaidComponentsRef = React.createRef();
		this._anchorContainerRef = React.createRef();
		this._nodeRefs = {
			overlaidComponents: this._overlaidComponentsRef,
			anchorContainer: this._anchorContainerRef,
		};
		this.state = {
			anchorRectIds: [],
			previewMode: false,
		};
		this._anchorData = {};
		this._overlayData = {};
		this.observeOverlays = new MutationObserver(this._updateAnchors);
		this.observeAnchors = new MutationObserver(this._updateOverlays);
	}

	componentDidMount() {
		this._updateAnchors();
		this._updateOverlays();
		this._setupMutationObservers();
	}

	// Disconnect before React touches the DOM, so the update's own mutations
	// don't reach the observers. componentDidUpdate reconnects them.
	getSnapshotBeforeUpdate() {
		this._teardownMutationObservers();
		return null;
	}

	componentDidUpdate() {
		this._updateAnchors();
		this._updateOverlays();
		this._setupMutationObservers();
	}

	componentWillUnmount() {
		this._teardownMutationObservers();
	}

	_setupMutationObservers() {
		this.observeOverlays.disconnect();
		this.observeOverlays.observe(
			this._overlaidComponentsRef.current,
			MUTATION_CONFIG,
		);
		this.observeAnchors.disconnect();
		this.observeAnchors.observe(
			this._anchorContainerRef.current,
			MUTATION_CONFIG,
		);
	}

	_teardownMutationObservers() {
		this.observeOverlays.disconnect();
		this.observeAnchors.disconnect();
	}

	_updateAnchors = () => {
		this._teardownMutationObservers();
		const lastRects = _.clone(this._overlayData);
		this._overlayData = this._dataFromNodes({
			root: this._overlaidComponentsRef.current,
			selector: `.${OverlaidComponents.WRAP_CLASS}`,
			dataFields: [],
		});
		if (_.isEqual(lastRects, this._overlayData)) {
			return;
		}
		this._adjustNodes("anchorContainer", this._overlayData, [
			"width",
			"height",
		]);
		this._setupMutationObservers();
	};

	_updateOverlays = () => {
		this._teardownMutationObservers();
		const lastRects = _.clone(this._anchorData);
		this._anchorData = this._dataFromNodes({
			root: this._anchorContainerRef.current,
			selector: `.${ANCHOR_CLASS}`,
			dataFields: ["componentProps", "componentKey"],
		});
		if (_.isEqual(lastRects, this._anchorData)) {
			return;
		}
		this._adjustNodes("overlaidComponents", this._anchorData, ["top", "left"]);
		this._setupMutationObservers();
		if (!_.isEqual(this.state.anchorRectIds, Object.keys(this._anchorData))) {
			this.setState({ anchorRectIds: Object.keys(this._anchorData) });
		}
	};

	_adjustNodes(ref, rects, dims) {
		const root = this._nodeRefs[ref].current;
		for (const id of Object.keys(rects)) {
			const node = root.querySelector(`[data-overlay-id=${id}]`);
			if (!node) {
				continue;
			}
			for (const dim of dims) {
				const dimVal = rects[id][dim];
				node.style[dim] = `${dimVal}px`;
			}
		}
	}

	_dataFromNodes({ root, selector, dataFields }) {
		const updatedRegistry = {};
		const nodes = Array.from(root.querySelectorAll(selector));
		if (nodes.length === 0) {
			return updatedRegistry;
		}
		const rootRect = root.getBoundingClientRect();
		for (const node of nodes) {
			const id = node.dataset.overlayId;
			const rawRect = node.getBoundingClientRect();
			const adjustedRect = {
				left: rawRect.left - rootRect.left,
				top: rawRect.top - rootRect.top,
				width: rawRect.width,
				height: rawRect.height,
			};
			updatedRegistry[id] = adjustedRect;
			for (const field of dataFields) {
				updatedRegistry[id][field] = node.dataset[field];
			}
		}
		return updatedRegistry;
	}

	_onTogglePreview = () => {
		this.setState({ previewMode: !this.state.previewMode });
	};

	_renderPreviewToggle() {
		let msg = "Preview as recipient";
		if (this.state.previewMode) {
			msg = "Return to editor";
		}
		return (
			<a className="toggle-preview" onClick={this._onTogglePreview}>
				{msg}
			</a>
		);
	}

	_renderOverlaidComponents() {
		const els = [];
		let previewToggleVisible = false;

		for (const id of this.state.anchorRectIds) {
			const data = this._anchorData[id];
			if (!data) {
				throw new Error(`No mounted rect for ${id}`);
			}

			const style = { left: data.left, top: data.top, position: "absolute" };
			const component = CustomContenteditableComponents.get(data.componentKey);

			if (!component) {
				// It's possible that the plugin with that will register this
				// componentKey hasn't loaded yet. This is common in popout
				// composers where 3rd party plugins are loaded later.
				continue;
			}

			const supportsPreviewWithinEditor =
				component.supportsPreviewWithinEditor !== false;
			const props = Object.assign(
				{},
				this.props.exposedProps,
				JSON.parse(data.componentProps),
				{ isPreview: supportsPreviewWithinEditor && this.state.previewMode },
			);

			previewToggleVisible =
				previewToggleVisible || supportsPreviewWithinEditor;

			els.push(
				<span
					key={id}
					className={OverlaidComponents.WRAP_CLASS}
					style={style}
					data-overlay-id={id}
				>
					{React.createElement(component, props)}
				</span>,
			);
		}

		const toggle = previewToggleVisible ? this._renderPreviewToggle() : false;

		return (
			<div ref={this._overlaidComponentsRef} className="overlaid-components">
				{toggle}
				{els}
			</div>
		);
	}

	render() {
		const { className } = this.props;
		return (
			<div
				className={`overlaid-components-wrap ${className || ""}`}
				style={{ position: "relative" }}
			>
				<div className="anchor-container" ref={this._anchorContainerRef}>
					{this.props.children}
				</div>
				{this._renderOverlaidComponents()}
			</div>
		);
	}
}
