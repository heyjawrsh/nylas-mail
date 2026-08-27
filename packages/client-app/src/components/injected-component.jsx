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
const ReactDOM = require("react-dom");
const _ = require("underscore");
const UnsafeComponent = require("./unsafe-component");
const InjectedComponentLabel = require("./injected-component-label").default;

const { Actions, WorkspaceStore, ComponentRegistry } = require("nylas-exports");

/*
Public: InjectedComponent makes it easy to include dynamically registered
components inside of your React render method. Rather than explicitly render
a component, such as a `<Composer>`, you can use InjectedComponent:

```coffee
<InjectedComponent matching={role:"Composer"} exposedProps={draftClientId:123} />
```

InjectedComponent will look up the component registered with that role in the
{ComponentRegistry} and render it, passing the exposedProps (`draftClientId={123}`) along.

InjectedComponent monitors the ComponentRegistry for changes. If a new component
is registered that matches the descriptor you provide, InjectedComponent will refresh.

If no matching component is found, the InjectedComponent renders an empty div.

Section: Component Kit
*/
class InjectedComponent extends React.Component {
	static initClass() {
		InjectedComponent.displayName = "InjectedComponent";

		/*
    Public: React `props` supported by InjectedComponent:
  
     - `matching` Pass an {Object} with ComponentRegistry descriptors.
        This set of descriptors is provided to {ComponentRegistry::findComponentsForDescriptor}
        to retrieve the component that will be displayed.
  
     - `onComponentDidRender` (optional) Callback that will be called when the injected component
        is successfully rendered onto the DOM.
  
     - `className` (optional) A {String} class name for the containing element.
  
     - `exposedProps` (optional) An {Object} with props that will be passed to each
        item rendered into the set.
  
     - `fallback` (optional) A {Component} to default to in case there are no matching
       components in the ComponentRegistry
  
     - `requiredMethods` (options) An {Array} with a list of methods that should be
       implemented by the registered component instance. If these are not implemented,
       an error will be thrown.
  
    */
		InjectedComponent.propTypes = {
			matching: PropTypes.object.isRequired,
			className: PropTypes.string,
			exposedProps: PropTypes.object,
			fallback: PropTypes.func,
			onComponentDidRender: PropTypes.func,
			style: PropTypes.object,
			requiredMethods: PropTypes.arrayOf(PropTypes.string),
			onComponentDidChange: PropTypes.func,
		};

		InjectedComponent.defaultProps = {
			style: {},
			exposedProps: {},
			requiredMethods: [],
			onComponentDidRender() {},
			onComponentDidChange() {},
		};
	}

	constructor(props) {
		this.componentDidMount = this.componentDidMount.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this.UNSAFE_componentWillReceiveProps =
			this.UNSAFE_componentWillReceiveProps.bind(this);
		this.componentDidUpdate = this.componentDidUpdate.bind(this);
		this.render = this.render.bind(this);
		this.focus = this.focus.bind(this);
		this.blur = this.blur.bind(this);
		this._runInnerDOMMethod = this._runInnerDOMMethod.bind(this);
		this._setRequiredMethods = this._setRequiredMethods.bind(this);
		this._verifyRequiredMethods = this._verifyRequiredMethods.bind(this);
		this._getStateFromStores = this._getStateFromStores.bind(this);
		this.props = props;
		this.state = this._getStateFromStores();
		this._verifyRequiredMethods();
		this._setRequiredMethods(this.props.requiredMethods);
	}

	componentDidMount() {
		this._componentUnlistener = ComponentRegistry.listen(() => {
			return this.setState(this._getStateFromStores());
		});
		if (
			(this.state.component != null
				? this.state.component.containerRequired
				: undefined) === false
		) {
			this.props.onComponentDidRender();
			return this.props.onComponentDidChange();
		}
	}

	componentWillUnmount() {
		if (this._componentUnlistener) {
			return this._componentUnlistener();
		}
	}

	UNSAFE_componentWillReceiveProps(newProps) {
		if (
			!_.isEqual(
				newProps.matching,
				this.props != null ? this.props.matching : undefined,
			)
		) {
			return this.setState(this._getStateFromStores(newProps));
		}
	}

	componentDidUpdate(prevProps, prevState) {
		this._setRequiredMethods(this.props.requiredMethods);
		if (
			(this.state.component != null
				? this.state.component.containerRequired
				: undefined) === false
		) {
			this.props.onComponentDidRender();
			if (this.state.component !== prevState.component) {
				return this.props.onComponentDidChange();
			}
		}
	}

	render() {
		let element;
		if (!this.state.component) {
			return React.createElement("div", null);
		}

		const exposedProps = Object.assign({}, this.props.exposedProps, {
			fallback: this.props.fallback,
		});
		let className = this.props.className != null ? this.props.className : "";
		if (this.state.visible) {
			className += " registered-region-visible";
		}

		const Component = this.state.component;
		if (Component.containerRequired === false) {
			const privateProps = {
				key: Component.displayName,
			};
			if (React.Component.isPrototypeOf(Component)) {
				privateProps.ref = "inner";
			}
			element = React.createElement(
				Component,
				Object.assign({}, privateProps, exposedProps),
			);
		} else {
			element = React.createElement(
				UnsafeComponent,
				Object.assign(
					{
						ref: "inner",
						style: this.props.style,
						className: className,
						key: Component.displayName,
						component: Component,
						onComponentDidRender: this.props.onComponentDidRender,
					},
					exposedProps,
				),
			);
		}

		if (this.state.visible) {
			return React.createElement(
				"div",
				{ className: className, style: this.props.style },
				element,
				React.createElement(
					InjectedComponentLabel,
					Object.assign({ matching: this.props.matching }, exposedProps),
				),
				React.createElement("span", { style: { clear: "both" } }),
			);
		} else {
			return React.createElement(
				"div",
				{ className: className, style: this.props.style },
				element,
			);
		}
	}

	focus() {
		return this._runInnerDOMMethod("focus");
	}

	blur() {
		return this._runInnerDOMMethod("blur");
	}

	// Private: Attempts to run the DOM method, ie 'focus', on
	// 1. Any implementation provided by the inner component
	// 2. Any native implementation provided by the DOM
	// 3. Ourselves, so that the method always has /some/ effect.
	//
	_runInnerDOMMethod(method, ...args) {
		let target = null;
		if (
			this.refs.inner instanceof UnsafeComponent &&
			this.refs.inner.injected[method] != null
		) {
			target = this.refs.inner.injected;
		} else if (this.refs.inner && this.refs.inner[method] != null) {
			target = this.refs.inner;
		} else if (this.refs.inner) {
			target = ReactDOM.findDOMNode(this.refs.inner);
		} else {
			target = ReactDOM.findDOMNode(this);
		}

		if (target[method]) {
			return target[method].bind(target)(...Array.from(args || []));
		}
	}

	_setRequiredMethods(methods) {
		return methods.forEach((method) => {
			return Object.defineProperty(this, method, {
				configurable: true,
				enumerable: true,
				value: (...args) => {
					return this._runInnerDOMMethod(method, ...Array.from(args));
				},
			});
		});
	}

	_verifyRequiredMethods() {
		if (this.state.component != null) {
			const { component } = this.state;
			return this.props.requiredMethods.forEach((method) => {
				const isMethodDefined = component.prototype[method] != null;
				if (!isMethodDefined) {
					throw new Error(
						`${component.name} must implement method \`${method}\` when registering \
for ${JSON.stringify(this.props.matching)}`,
					);
				}
			});
		}
	}

	_getStateFromStores(props) {
		if (props == null) {
			({ props } = this);
		}

		const components = ComponentRegistry.findComponentsMatching(props.matching);
		if (components.length > 1) {
			console.warn(`There are multiple components available for \
${JSON.stringify(props.matching)}. <InjectedComponent> is \
only rendering the first one.`);
		}
		const component =
			components.length === 0 ? this.props.fallback : components[0];

		return {
			component,
			visible: ComponentRegistry.showComponentRegions(),
		};
	}
}
InjectedComponent.initClass();

module.exports = InjectedComponent;
