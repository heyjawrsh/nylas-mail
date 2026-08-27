/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
const React = require("react");
const ReactDOM = require("react-dom");
const { Utils } = require("nylas-exports");
const _ = require("underscore");

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
	constructor(...args) {
		this.componentDidMount = this.componentDidMount.bind(this);
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
		this.componentDidUpdate = this.componentDidUpdate.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this.render = this.render.bind(this);
		this.renderInjected = this.renderInjected.bind(this);
		this.unmountInjected = this.unmountInjected.bind(this);
		this.focus = this.focus.bind(this);
		this.blur = this.blur.bind(this);
		this._runInjectedDOMMethod = this._runInjectedDOMMethod.bind(this);
		super(...args);
	}

	static initClass() {
		UnsafeComponent.displayName = "UnsafeComponent";

		/*
    Public: React `props` supported by UnsafeComponent:
  
     - `component` The {React.Component} to display. All other props will be
       passed on to this component.
    */
		UnsafeComponent.propTypes = {
			component: PropTypes.func.isRequired,
			onComponentDidRender: PropTypes.func,
		};

		UnsafeComponent.defaultProps = { onComponentDidRender() {} };
	}

	componentDidMount() {
		return this.renderInjected();
	}

	shouldComponentUpdate(nextProps, nextState) {
		return (
			!Utils.isEqualReact(nextProps, this.props) ||
			!Utils.isEqualReact(nextState, this.state)
		);
	}

	componentDidUpdate() {
		return this.renderInjected();
	}

	componentWillUnmount() {
		return this.unmountInjected();
	}

	render() {
		return React.createElement("div", {
			name: "unsafe-component-wrapper",
			style:
				this.props.component != null
					? this.props.component.containerStyles
					: undefined,
		});
	}

	renderInjected() {
		let props;
		const node = ReactDOM.findDOMNode(this);
		let element = null;
		try {
			props = Utils.fastOmit(
				this.props,
				Object.keys(this.constructor.propTypes),
			);
			const Component = this.props.component;
			element = React.createElement(
				Component,
				Object.assign({ key: name }, props),
			);
			return (this.injected = ReactDOM.render(
				element,
				node,
				this.props.onComponentDidRender,
			));
		} catch (err) {
			if (NylasEnv.inDevMode()) {
				let { stack } = err;
				let stackEnd = stack.indexOf("react/lib/");
				if (stackEnd > 0) {
					stackEnd = stack.lastIndexOf("\n", stackEnd);
					stack = stack.substr(0, stackEnd);
				}

				element = React.createElement(
					"div",
					{ className: "unsafe-component-exception" },
					React.createElement(
						"div",
						{ className: "message" },
						this.props.component.displayName,
						" could not be displayed.",
					),
					React.createElement("div", { className: "trace" }, stack),
				);
			} else {
				//# TODO
				// Add some sort of notification code here that lets us know when
				// production builds are having issues!
				//
				element = React.createElement("div", null);

				this.injected = ReactDOM.render(element, node);
			}
			return NylasEnv.reportError(err);
		}
	}

	unmountInjected() {
		try {
			const node = ReactDOM.findDOMNode(this);
			return ReactDOM.unmountComponentAtNode(node);
		} catch (_err) {}
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
		let target = null;
		if (this.injected?.[method]) {
			target = this.injected;
		} else if (this.injected) {
			target = ReactDOM.findDOMNode(this.injected);
		} else {
			target = ReactDOM.findDOMNode(this);
		}

		return typeof target[method] === "function" ? target[method]() : undefined;
	}
}
UnsafeComponent.initClass();

module.exports = UnsafeComponent;
