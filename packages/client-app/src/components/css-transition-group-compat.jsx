import React, { Component } from "react";
import PropTypes from "prop-types";
import { TransitionGroup, CSSTransition } from "react-transition-group";
import { domNodeOf } from "./dom-node.js";

/**
 * Compat wrapper preserving the legacy `react-addons-css-transition-group`
 * API (single child + transitionName/Enter|LeaveTimeout props) on top of the
 * maintained react-transition-group v4. Ported 2026; call sites unchanged.
 */
export default class ReactCSSTransitionGroup extends Component {
	static propTypes = {
		transitionName: PropTypes.string.isRequired,
		transitionEnterTimeout: PropTypes.number,
		transitionLeaveTimeout: PropTypes.number,
		transitionAppearTimeout: PropTypes.number,
		transitionEnter: PropTypes.bool,
		transitionLeave: PropTypes.bool,
		transitionAppear: PropTypes.bool,
		className: PropTypes.string,
		component: PropTypes.any,
		children: PropTypes.node,
	};

	_containerRef = React.createRef();

	// The group's own container node, so an outer group can animate this one
	// as its child.
	getDOMNode() {
		return domNodeOf(this._containerRef.current);
	}

	render() {
		const {
			transitionName,
			transitionEnterTimeout,
			transitionLeaveTimeout,
			transitionAppearTimeout,
			transitionEnter = true,
			transitionLeave = true,
			transitionAppear = false,
			className,
			component = "span",
			children,
			...rest
		} = this.props;

		const child =
			React.Children.count(children) === 1
				? React.Children.toArray(children)[0]
				: null;

		const transitionProps = {
			in: true,
			appear: transitionAppear,
			enter: transitionEnter,
			exit: transitionLeave,
			timeout: {
				enter: transitionEnterTimeout || 0,
				exit: transitionLeaveTimeout || 0,
				appear: transitionAppearTimeout || transitionEnterTimeout || 0,
			},
			classNames: transitionName,
		};

		// react-transition-group looks up the DOM node through a react-dom API
		// that React 19 removed unless it gets a nodeRef, so every child gets
		// one. A DOM child carries the ref itself. A component child hands
		// over its root node through getDOMNode() (see dom-node.js).
		let transitionChild = child;
		if (child) {
			const entry = this._entryFor(child);
			transitionProps.nodeRef = entry.nodeRef;
			transitionChild = React.cloneElement(child, { ref: entry.ref });
		}

		const containerProps =
			component === null
				? { component: null }
				: {
						component: RefContainer,
						containerAs: component,
						containerRef: this._containerRef,
					};

		return (
			<TransitionGroup className={className} {...containerProps} {...rest}>
				{child ? (
					<CSSTransition key={child.key} {...transitionProps}>
						{transitionChild}
					</CSSTransition>
				) : null}
			</TransitionGroup>
		);
	}

	// One entry per child key: the ref given to the child, and the nodeRef
	// given to CSSTransition, which resolves to the child's DOM node.
	_entryFor(child) {
		if (!this._entries) {
			this._entries = new Map();
		}
		const { key } = child;
		let entry = this._entries.get(key);
		if (!entry) {
			entry = { value: null, childRef: null };
			entry.ref = (value) => {
				entry.value = value;
				setRef(entry.childRef, value);
			};
			entry.nodeRef = {
				get current() {
					// A child with no node to hand over still gets a node, so the
					// transition skips its classes rather than throwing.
					return domNodeOf(entry.value) || detachedNode();
				},
			};
			this._entries.set(key, entry);
		}
		// Keep any ref the caller put on the child working.
		entry.childRef = child.props.ref ?? null;
		return entry;
	}
}

// TransitionGroup's container, rendered with a ref for getDOMNode().
function RefContainer({ containerAs: As, containerRef, ...rest }) {
	return <As ref={containerRef} {...rest} />;
}

function setRef(ref, value) {
	if (typeof ref === "function") {
		ref(value);
	} else if (ref && typeof ref === "object") {
		ref.current = value;
	}
}

let _detachedNode = null;
function detachedNode() {
	if (!_detachedNode) {
		_detachedNode = document.createElement("span");
	}
	return _detachedNode;
}
