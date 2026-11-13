import _ from "underscore";
import { React } from "nylas-exports";
import { InjectedComponentSet } from "nylas-component-kit";
import { domNodeOf } from "../../../src/components/dom-node.js";

const ROLE = "RootSidebar:Notifications";

export default class NotifWrapper extends React.Component {
	static displayName = "NotifWrapper";

	_set = React.createRef();

	getDOMNode() {
		return domNodeOf(this._set.current);
	}

	componentDidMount() {
		this.observer = new MutationObserver(this.update);
		this.observer.observe(this.getDOMNode(), { childList: true });
		this.update(); // Necessary if notifications are already mounted
	}

	componentWillUnmount() {
		this.observer.disconnect();
	}

	update = () => {
		const className = "highest-priority";
		const node = this.getDOMNode();

		const oldHighestPriorityElems = node.querySelectorAll(`.${className}`);
		for (const oldElem of oldHighestPriorityElems) {
			oldElem.classList.remove(className);
		}

		const elemsWithPriority = node.querySelectorAll("[data-priority]");
		if (elemsWithPriority.length === 0) {
			return;
		}

		const highestPriorityElem = _.max(elemsWithPriority, (elem) =>
			parseInt(elem.dataset.priority, 10),
		);

		highestPriorityElem.classList.add(className);
	};

	render() {
		return (
			<InjectedComponentSet
				ref={this._set}
				className="notifications"
				matching={{ role: ROLE }}
				direction="column"
				containersRequired={false}
			/>
		);
	}
}
