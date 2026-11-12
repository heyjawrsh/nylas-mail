import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import NylasStore from "nylas-store";
import Actions from "../actions.js";
import FixedPopover from "../../components/fixed-popover.jsx";

const CONTAINER_ID = "nylas-popover-container";

function createContainer(id) {
	const element = document.createElement(id);
	document.body.appendChild(element);
	return element;
}

class PopoverStore extends NylasStore {
	constructor(containerId = CONTAINER_ID) {
		super();
		this.isOpen = false;
		this.container = createContainer(containerId);
		this.root = createRoot(this.container);
		this.renderSync(<span />);

		this.listenTo(Actions.openPopover, this.openPopover);
		this.listenTo(Actions.closePopover, this.closePopover);
	}

	// Synchronous commit, like the legacy ReactDOM.render the callers were
	// written against: the content is mounted when this returns.
	renderSync(element) {
		flushSync(() => this.root.render(element));
	}

	renderPopover = (child, props, callback) => {
		const popover = <FixedPopover {...props}>{child}</FixedPopover>;

		this.renderSync(popover);
		this.isOpen = true;
		this.trigger();
		callback();
	};

	openPopover = (
		element,
		{
			originRect,
			direction,
			fallbackDirection,
			closeOnAppBlur,
			callback = () => {},
		},
	) => {
		const props = {
			direction,
			originRect,
			fallbackDirection,
			closeOnAppBlur,
		};

		if (this.isOpen) {
			this.closePopover(() => {
				this.renderPopover(element, props, callback);
			});
		} else {
			this.renderPopover(element, props, callback);
		}
	};

	closePopover = (callback = () => {}) => {
		this.renderSync(<span />);
		this.isOpen = false;
		this.trigger();
		callback();
	};
}

export default new PopoverStore();
