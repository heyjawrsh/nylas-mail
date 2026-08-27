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
const _ = require("underscore");
const UnsafeComponent = require("./unsafe-component.jsx");
const Flexbox = require("./flexbox.jsx").default;
import InjectedComponentLabel from "./injected-component-label.jsx";
const {
	Utils,
	Actions,
	WorkspaceStore,
	ComponentRegistry,
} = require("nylas-exports");

/*
Public: InjectedComponent makes it easy to include a set of dynamically registered
components inside of your React render method. Rather than explicitly render
an array of buttons, for example, you can use InjectedComponentSet:

```coffee
<InjectedComponentSet className="message-actions"
                  matching={role: 'ThreadActionButton'}
                  exposedProps={thread:@props.thread, message:@props.message}>
```

InjectedComponentSet will look up components registered for the location you provide,
render them inside a {Flexbox} and pass them `exposedProps`. By default, all injected
children are rendered inside {UnsafeComponent} wrappers to prevent third-party code
from throwing exceptions that break React renders.

InjectedComponentSet monitors the ComponentRegistry for changes. If a new component
is registered into the location you provide, InjectedComponentSet will re-render.

If no matching components is found, the InjectedComponent renders an empty span.

Section: Component Kit
*/
class InjectedComponentSet extends React.Component {
	static initClass() {
		InjectedComponentSet.displayName = "InjectedComponentSet";

		/*
    Public: React `props` supported by InjectedComponentSet:
  
     - `matching` Pass an {Object} with ComponentRegistry descriptors
        This set of descriptors is provided to {ComponentRegistry::findComponentsForDescriptor}
        to retrieve components for display.
     - `matchLimit` (optional) A {Number} that indicates the max number of matching elements to render
     - `className` (optional) A {String} class name for the containing element.
     - `children` (optional) Any React elements rendered inside the InjectedComponentSet
        will always be displayed.
     - `onComponentsDidRender` Callback that will be called when the injected component set
        is successfully rendered onto the DOM.
     - `exposedProps` (optional) An {Object} with props that will be passed to each
        item rendered into the set.
     - `containersRequired` (optional). Pass false to optionally remove the containers
        placed around injected components to isolate them from the rest of the app.
  
     -  Any other props you provide, such as `direction`, `data-column`, etc.
        will be applied to the {Flexbox} rendered by the InjectedComponentSet.
    */
		InjectedComponentSet.propTypes = {
			matching: PropTypes.object.isRequired,
			children: PropTypes.array,
			className: PropTypes.string,
			matchLimit: PropTypes.number,
			exposedProps: PropTypes.object,
			containersRequired: PropTypes.bool,
			onComponentsDidRender: PropTypes.func,
		};

		InjectedComponentSet.defaultProps = {
			direction: "row",
			containersRequired: true,
			onComponentsDidRender() {},
		};
	}

	constructor(props) {
		super();
		this.componentDidMount = this.componentDidMount.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this.UNSAFE_componentWillReceiveProps =
			this.UNSAFE_componentWillReceiveProps.bind(this);
		this.componentDidUpdate = this.componentDidUpdate.bind(this);
		this.render = this.render.bind(this);
		this._onComponentDidRender = this._onComponentDidRender.bind(this);
		this._getStateFromStores = this._getStateFromStores.bind(this);
		this.props = props;
		this.state = this._getStateFromStores();
		this._renderedComponents = new Set();
	}

	componentDidMount() {
		this._componentUnlistener = ComponentRegistry.listen(() => {
			return this.setState(this._getStateFromStores());
		});
		if (this.props.containersRequired === false) {
			return this.props.onComponentsDidRender();
		}
	}

	componentWillUnmount() {
		if (this._componentUnlistener) {
			return this._componentUnlistener();
		}
	}

	UNSAFE_componentWillReceiveProps(newProps) {
		if (
			newProps.location !==
			(this.props != null ? this.props.location : undefined)
		) {
			return this.setState(this._getStateFromStores(newProps));
		}
	}

	componentDidUpdate() {
		if (this.props.containersRequired === false) {
			return this.props.onComponentsDidRender();
		}
	}

	render() {
		this._renderedComponents = new Set();
		const flexboxProps = Utils.fastOmit(
			this.props,
			Object.keys(this.constructor.propTypes),
		);
		let flexboxClassName =
			this.props.className != null ? this.props.className : "";
		const exposedProps =
			this.props.exposedProps != null ? this.props.exposedProps : {};

		const elements = this.state.components.map((Component) => {
			if (
				this.props.containersRequired === false ||
				Component.containerRequired === false
			) {
				return React.createElement(
					Component,
					Object.assign({ key: Component.displayName }, exposedProps),
				);
			} else {
				return React.createElement(
					UnsafeComponent,
					Object.assign(
						{
							key: Component.displayName,
							component: Component,
							onComponentDidRender: this._onComponentDidRender.bind(
								this,
								Component.displayName,
							),
						},
						exposedProps,
					),
				);
			}
		});

		if (this.state.visible) {
			flexboxClassName += " registered-region-visible";
			elements.splice(
				0,
				0,
				React.createElement(
					InjectedComponentLabel,
					Object.assign(
						{ key: "_label", matching: this.props.matching },
						exposedProps,
					),
				),
			);
			elements.push(
				React.createElement("span", {
					key: "_clear",
					style: { clear: "both" },
				}),
			);
		}

		return React.createElement(
			Flexbox,
			Object.assign({ className: flexboxClassName }, flexboxProps),
			elements,
			this.props.children != null ? this.props.children : [],
		);
	}

	_onComponentDidRender(componentName) {
		this._renderedComponents.add(componentName);
		if (this._renderedComponents.size === this.state.components.length) {
			return this.props.onComponentsDidRender();
		}
	}

	_getStateFromStores(props) {
		if (props == null) {
			({ props } = this);
		}
		const limit = props.matchLimit;

		return {
			components: ComponentRegistry.findComponentsMatching(
				this.props.matching,
			).slice(0, limit),
			visible: ComponentRegistry.showComponentRegions(),
		};
	}
}
InjectedComponentSet.initClass();

module.exports = InjectedComponentSet;
