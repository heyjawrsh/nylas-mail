import React from "react";
import PropTypes from "prop-types";
import { Utils } from "nylas-exports";
import shallowEqual from "./shallow-equal.js";

const sameStores = (a = [], b = []) =>
	a.length === b.length && a.every((store, i) => store === b[i]);

class FluxContainer extends React.Component {
	static displayName = "FluxContainer";
	static propTypes = {
		children: PropTypes.element,
		stores: PropTypes.array.isRequired,
		getStateFromStores: PropTypes.func.isRequired,
	};

	constructor(props) {
		super(props);
		this._unlisteners = [];
		// storeState goes to the child; prevProps lets getDerivedStateFromProps
		// re-derive only when the props change.
		this.state = { storeState: props.getStateFromStores(), prevProps: props };
	}

	// Derived before render so the child never gets a frame of stale state.
	// Merged like the old setState, so keys a new result leaves out persist.
	static getDerivedStateFromProps(props, state) {
		if (shallowEqual(props, state.prevProps)) return null;
		return {
			storeState: { ...state.storeState, ...props.getStateFromStores() },
			prevProps: props,
		};
	}

	componentDidMount() {
		this.setupListeners();
	}

	componentDidUpdate(prevProps) {
		if (!sameStores(prevProps.stores, this.props.stores)) {
			this.setupListeners();
		}
	}

	componentWillUnmount() {
		for (const unlisten of this._unlisteners) {
			unlisten();
		}
		this._unlisteners = [];
	}

	setupListeners() {
		for (const unlisten of this._unlisteners) {
			unlisten();
		}

		// Reads this.props at call time, so a new getStateFromStores is used
		// without re-subscribing.
		this._unlisteners = this.props.stores.map((store) => {
			return store.listen(() =>
				this.setState((state) => ({
					storeState: {
						...state.storeState,
						...this.props.getStateFromStores(),
					},
				})),
			);
		});
	}

	render() {
		const otherProps = Utils.fastOmit(
			this.props,
			Object.keys(this.constructor.propTypes),
		);
		return React.cloneElement(
			this.props.children,
			Object.assign({}, otherProps, this.state.storeState),
		);
	}
}

export default FluxContainer;
