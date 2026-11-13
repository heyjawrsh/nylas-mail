import _ from "underscore";
import React from "react";
import { domNodeOf } from "../dom-node.js";

const FOCUSABLE_SELECTOR = "input, textarea, [contenteditable], [tabIndex]";

function AutoFocuses(
	ComposedComponent,
	{ onMount = true, onUpdate = true } = {},
) {
	return class extends ComposedComponent {
		static displayName = ComposedComponent.displayName;
		static containerRequired = ComposedComponent.containerRequired;
		static containerStyles = ComposedComponent.containerStyles;

		// A ref to the rendered ComposedComponent, which hands over its root
		// node through getDOMNode(), since React 19 can't look it up.
		_autoFocusTargetRef = React.createRef();

		getDOMNode() {
			return domNodeOf(this._autoFocusTargetRef.current);
		}

		componentDidMount() {
			this.mounted = true;
			if (onMount) {
				this.focusElementWithTabIndex();
			}
		}

		componentWillUnmount() {
			this.mounted = false;
		}

		componentDidUpdate() {
			if (onUpdate) {
				this.focusElementWithTabIndex();
			}
		}

		isFocusable(currentNode = this.getDOMNode()) {
			currentNode.focus();
			return document.activeElement === currentNode;
		}

		focusElementWithTabIndex = () => {
			if (!this.mounted) {
				return;
			}
			// Automatically focus the element inside us with the lowest tab index
			const currentNode = this.getDOMNode();
			if (!currentNode || currentNode.contains(document.activeElement)) {
				return;
			}

			if (this.isFocusable(currentNode)) {
				currentNode.focus();
				return;
			}

			// _.sortBy ranks in ascending numerical order.
			const focusable = currentNode.querySelectorAll(FOCUSABLE_SELECTOR);
			const matches = _.sortBy(focusable, (node) => {
				if (node.tabIndex > 0) {
					return node.tabIndex;
				} else if (node.nodeName === "INPUT") {
					return 1000000;
				}
				return 1000001;
			});
			if (matches[0]) {
				matches[0].focus();
			}
		};

		render() {
			return (
				<ComposedComponent
					{...this.props}
					ref={this._autoFocusTargetRef}
					focusElementWithTabIndex={this.focusElementWithTabIndex}
				/>
			);
		}
	};
}

export default AutoFocuses;
