/* eslint no-prototype-builtins: 0 */
import { Component } from "react";

function ListensToFluxStore(ComposedComponent, { stores, getStateFromStores }) {
	return class extends Component {
		static displayName = ComposedComponent.displayName;

		static containerRequired = false;

		static propTypes = ComposedComponent.propTypes;

		constructor(props) {
			super(props);
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
			// React 19: string refs removed. Nothing consumes this ref — drop it
			// (getWrappedInstance never existed here).
			return <ComposedComponent {...props} />;
		}
	};
}

export default ListensToFluxStore;
