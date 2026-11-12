/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
import React from "react";
import { createRoot } from "react-dom/client";
import { Utils } from "nylas-exports";

const isClassComponent = (Component) =>
	Boolean(Component?.prototype?.isReactComponent);

// Calls `onDidRender` after the injected tree under it commits, on mount and
// on every re-render, like the old `ReactDOM.render` callback.
class InjectedRenderNotifier extends React.Component {
	static displayName = "InjectedRenderNotifier";

	componentDidMount() {
		this.props.onDidRender();
	}

	componentDidUpdate() {
		this.props.onDidRender();
	}

	render() {
		return this.props.children;
	}
}

// Dev-mode panel shown in place of a plugin that failed to render.
const exceptionPanel = (displayName, error) => {
	let stack = error?.stack || String(error);
	let stackEnd = stack.indexOf("react/lib/");
	if (stackEnd > 0) {
		stackEnd = stack.lastIndexOf("\n", stackEnd);
		stack = stack.substr(0, stackEnd);
	}
	return React.createElement(
		"div",
		{ className: "unsafe-component-exception" },
		React.createElement(
			"div",
			{ className: "message" },
			displayName,
			" could not be displayed.",
		),
		React.createElement("div", { className: "trace" }, stack),
	);
};

// Dev shows the exception panel, production an empty div.
const failedElement = (displayName, error) =>
	NylasEnv.inDevMode()
		? exceptionPanel(displayName, error)
		: React.createElement("div", null);

// Catches a throwing plugin inside the injected root and reports it once. A
// later render with different children tries the plugin again.
class InjectedErrorBoundary extends React.Component {
	static displayName = "InjectedErrorBoundary";

	constructor(props) {
		super(props);
		// `failedChildren` is undefined until the render after a catch records
		// the children that threw.
		this.state = { error: null, failedChildren: undefined };
	}

	static getDerivedStateFromError(error) {
		return { error, failedChildren: undefined };
	}

	static getDerivedStateFromProps(props, state) {
		if (!state.error) {
			return null;
		}
		if (state.failedChildren === undefined) {
			return { failedChildren: props.children };
		}
		if (props.children !== state.failedChildren) {
			return { error: null, failedChildren: undefined };
		}
		return null;
	}

	componentDidCatch(error) {
		NylasEnv.reportError(error);
	}

	render() {
		const { error } = this.state;
		return error
			? failedElement(this.props.displayName, error)
			: this.props.children;
	}
}

/*
Public: Renders a component provided via the `component` prop, and ensures that
failures in the component's code do not cause state inconsistencies elsewhere in
the application. This component is used by {InjectedComponent} and
{InjectedComponentSet} to isolate third party code that could be buggy.

Occasionally, having your component wrapped in {UnsafeComponent} can cause style
issues. For example, in a Flexbox, the `div.unsafe-component-wrapper` will cause
your `flex` and `order` values to be one level too deep. For these scenarios,
UnsafeComponent looks for `containerStyles` on your React component and attaches
them to the wrapper div:

```coffee
class MyComponent extends React.Component
  @displayName: 'MyComponent'
  @containerStyles:
    flex: 1
    order: 2
```

Section: Component Kit
*/

class UnsafeComponent extends React.Component {
	static displayName = "UnsafeComponent";

	/*
  Public: React `props` supported by UnsafeComponent:

   - `component` The {React.Component} to display. All other props will be
     passed on to this component.
  */
	static propTypes = {
		component: PropTypes.func.isRequired,
		onComponentDidRender: PropTypes.func,
	};

	static defaultProps = { onComponentDidRender() {} };

	constructor(...args) {
		super(...args);
		this._wrapperRef = React.createRef();
		this._root = null;
		this.injected = null;
		this._onInjectedRef = (instance) => {
			this.injected = instance;
		};
		this._onInjectedDidRender = () => {
			this.props.onComponentDidRender();
		};
	}

	componentDidMount() {
		// One root per wrapper, reused on every update.
		this._root = createRoot(this._wrapperRef.current);
		this.renderInjected();
	}

	shouldComponentUpdate(nextProps, nextState) {
		return (
			!Utils.isEqualReact(nextProps, this.props) ||
			!Utils.isEqualReact(nextState, this.state)
		);
	}

	componentDidUpdate() {
		this.renderInjected();
	}

	componentWillUnmount() {
		this.unmountInjected();
	}

	render() {
		return React.createElement("div", {
			name: "unsafe-component-wrapper",
			ref: this._wrapperRef,
			style:
				this.props.component != null
					? this.props.component.containerStyles
					: undefined,
		});
	}

	renderInjected() {
		if (!this._root) {
			return;
		}
		const Component = this.props.component;
		let element;
		try {
			const props = Utils.fastOmit(
				this.props,
				Object.keys(this.constructor.propTypes),
			);
			// Only class components hand back an instance, as ReactDOM.render did.
			if (isClassComponent(Component)) {
				props.ref = this._onInjectedRef;
			} else {
				this.injected = null;
			}
			element = React.createElement(
				InjectedErrorBoundary,
				{ displayName: Component?.displayName },
				React.createElement(
					InjectedRenderNotifier,
					{ onDidRender: this._onInjectedDidRender },
					React.createElement(Component, props),
				),
			);
		} catch (err) {
			NylasEnv.reportError(err);
			element = failedElement(Component?.displayName, err);
		}
		// Schedules, never flushes: safe inside this component's commit.
		this._root.render(element);
	}

	unmountInjected() {
		const root = this._root;
		this._root = null;
		this.injected = null;
		if (!root) {
			return;
		}
		// Unmounting a root during another root's commit makes React warn about
		// synchronously unmounting while rendering, so defer it a microtask.
		queueMicrotask(() => {
			try {
				root.unmount();
			} catch (_err) {}
		});
	}

	focus() {
		return this._runInjectedDOMMethod("focus");
	}

	blur() {
		return this._runInjectedDOMMethod("blur");
	}

	// Private: Attempts to run the DOM method, ie 'focus', on
	// 1. Any implementation provided by the inner component
	// 2. Any native implementation provided by the DOM
	// 3. Ourselves, so that the method always has /some/ effect.
	//
	_runInjectedDOMMethod(method) {
		const wrapper = this._wrapperRef.current;
		let target = null;
		if (this.injected?.[method]) {
			target = this.injected;
		} else if (this.injected && wrapper?.firstElementChild) {
			// The injected component's own top-level node.
			target = wrapper.firstElementChild;
		} else {
			target = wrapper;
		}

		return typeof target?.[method] === "function"
			? target[method]()
			: undefined;
	}
}

export default UnsafeComponent;
