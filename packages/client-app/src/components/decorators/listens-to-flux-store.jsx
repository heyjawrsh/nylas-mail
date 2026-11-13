/* eslint no-prototype-builtins: 0 */
import { Component, createRef } from "react";

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
			this.state = getStateFromStores(props);
		}

		componentDidMount() {
			stores.forEach((store) => {
				this._unlisteners.push(
					store.listen(() => {
						this.setState(getStateFromStores(this.props));
					}),
				);
			});
		}

		UNSAFE_componentWillReceiveProps(nextProps) {
			this.setState(getStateFromStores(nextProps));
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
				...this.state,
			};
			return <ComposedComponent ref={this.composedRef} {...props} />;
		}
	};
}

export default ListensToFluxStore;
