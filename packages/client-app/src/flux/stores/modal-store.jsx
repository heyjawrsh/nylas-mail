import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Modal } from "nylas-component-kit";
import NylasStore from "nylas-store";

import Actions from "../actions.js";

const CONTAINER_ID = "nylas-modal-container";

function createContainer(id) {
	const element = document.createElement(id);
	document.body.appendChild(element);
	return element;
}

class ModalStore extends NylasStore {
	constructor(containerId = CONTAINER_ID) {
		super();
		this.isOpen = false;
		this.container = createContainer(containerId);
		this.root = createRoot(this.container);
		this.renderSync(<span />);

		this.listenTo(Actions.openModal, this.openModal);
		this.listenTo(Actions.closeModal, this.closeModal);
	}

	// Synchronous commit, like the legacy ReactDOM.render the callers were
	// written against: the content is mounted when this returns.
	renderSync(element) {
		flushSync(() => this.root.render(element));
	}

	isModalOpen = () => {
		return this.isOpen;
	};

	renderModal = (child, props, callback) => {
		const modal = <Modal {...props}>{child}</Modal>;

		this.renderSync(modal);
		this.isOpen = true;
		this.trigger();
		callback();
	};

	openModal = ({ component, height, width }, callback = () => {}) => {
		const props = {
			height: height,
			width: width,
		};

		if (this.isOpen) {
			this.closeModal(() => {
				this.renderModal(component, props, callback);
			});
		} else {
			this.renderModal(component, props, callback);
		}
	};

	closeModal = (callback = () => {}) => {
		this.renderSync(<span />);
		this.isOpen = false;
		this.trigger();
		callback();
	};
}

export default new ModalStore();
