import React from "react";
import { domNodeOf } from "../dom-node.js";

function ListensToObservable(
	ComposedComponent,
	{ getObservable, getStateFromObservable },
) {
	return class extends ComposedComponent {
		static displayName = ComposedComponent.displayName;
		static containerRequired = ComposedComponent.containerRequired;
		static containerStyles = ComposedComponent.containerStyles;

		constructor(props) {
			super(props);
			this.state = getStateFromObservable(null, { props });
			this.disposable = null;
			this.observable = getObservable(props);
			this._observedRef = React.createRef();
		}

		// The wrapped component's node, so a measurer or HasTutorialTip that
		// holds this decorator still reaches it.
		getDOMNode() {
			return domNodeOf(this._observedRef.current);
		}

		componentDidMount() {
			this.unmounted = false;
			this.disposable = this.observable.subscribe(this.onObservableChanged);
		}

		UNSAFE_componentWillReceiveProps(nextProps) {
			if (this.disposable) {
				this.disposable.dispose();
			}
			this.observable = getObservable(nextProps);
			this.disposable = this.observable.subscribe(this.onObservableChanged);
		}

		componentWillUnmount() {
			this.unmounted = true;
			this.disposable.dispose();
		}

		onObservableChanged = (data) => {
			if (this.unmounted) return;
			this.setState(getStateFromObservable(data, { props: this.props }));
		};

		render() {
			return (
				<ComposedComponent
					{...this.state}
					{...this.props}
					ref={this._observedRef}
				/>
			);
		}
	};
}

export default ListensToObservable;
