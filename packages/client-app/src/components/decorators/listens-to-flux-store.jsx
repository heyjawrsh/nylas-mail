/* eslint no-prototype-builtins: 0 */
import { Component, createRef } from "react";
import shallowEqual from "../shallow-equal.js";

function ListensToFluxStore(ComposedComponent, { stores, getStateFromStores }) {
	return class extends Component {
		static displayName = ComposedComponent.displayName;

		static containerRequired = false;

		static propTypes = ComposedComponent.propTypes;

		constructor(props) {
			super(props);
			// The wrapped instance, for wrappers that expose its methods (the
			// composer's send button exposes primarySend through it).
			this.composedRef = createRef();
			this._unlisteners = [];
			// storeState is what the wrapped component gets; prevProps lets
			// getDerivedStateFromProps re-derive only when the props change.
			this.state = { storeState: getStateFromStores(props), prevProps: props };
		}

		// Derived here, not in componentDidUpdate, so the wrapped component never
		// renders a frame of state derived from the old props.
		static getDerivedStateFromProps(props, state) {
			if (shallowEqual(props, state.prevProps)) return null;
			return { storeState: getStateFromStores(props), prevProps: props };
		}

		componentDidMount() {
			stores.forEach((store) => {
				this._unlisteners.push(
					store.listen(() => {
						this.setState({ storeState: getStateFromStores(this.props) });
					}),
				);
			});
		}

		componentWillUnmount() {
			for (const unlisten of this._unlisteners) {
				unlisten();
			}
			this._unlisteners = [];
		}

		render() {
			const props = {
				...this.props,
				...this.state.storeState,
			};
			return <ComposedComponent ref={this.composedRef} {...props} />;
		}
	};
}

export default ListensToFluxStore;
