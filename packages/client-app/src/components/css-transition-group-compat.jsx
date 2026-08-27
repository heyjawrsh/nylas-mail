import React, { Component } from "react";
import PropTypes from "prop-types";
import { TransitionGroup, CSSTransition } from "react-transition-group";

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
			...(child ? { key: child.key } : {}),
		};

		return (
			<TransitionGroup className={className} component={component} {...rest}>
				{child ? (
					<CSSTransition {...transitionProps}>{child}</CSSTransition>
				) : null}
			</TransitionGroup>
		);
	}
}
