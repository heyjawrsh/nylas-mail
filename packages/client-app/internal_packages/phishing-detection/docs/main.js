/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
// # Phishing Detection
//
// This is a simple package to notify N1 users if an email is a potential
// phishing scam.

// You can access N1 dependencies by requiring 'nylas-exports'
const {
	React,
	// The ComponentRegistry manages all React components in N1.
	ComponentRegistry,
	// A `Store` is a Flux component which contains all business logic and data
	// models to be consumed by React components to render markup.
	MessageStore,
} = require("nylas-exports");

// Notice that this file is `main.cjsx` rather than `main.coffee`. We use the
// `.cjsx` filetype because we use the CJSX DSL to describe markup for React to
// render. Without the CJSX, we could just name this file `main.coffee` instead.
class PhishingIndicator extends React.Component {
	constructor(...args) {
		this.render = this.render.bind(this);
		this.isPhishingAttempt = this.isPhishingAttempt.bind(this);
		super(...args);
	}

	static initClass() {
		// Adding a @displayName to a React component helps for debugging.
		PhishingIndicator.displayName = "PhishingIndicator";

		// @propTypes is an object which validates the datatypes of properties that
		// this React component can receive.
		PhishingIndicator.propTypes = { thread: PropTypes.object.isRequired };
	}

	// A React component's `render` method returns a virtual DOM element described
	// in CJSX. `render` is deterministic: with the same input, it will always
	// render the same output. Here, the input is provided by @isPhishingAttempt.
	// `@state` and `@props` are popular inputs as well.
	render() {
		// Our inputs for the virtual DOM to render come from @isPhishingAttempt.
		const [from, reply_to] = Array.from(this.isPhishingAttempt());

		// We add some more application logic to decide how to render.
		if (from !== null && reply_to !== null) {
			return React.createElement(
				"div",
				{ className: "phishingIndicator" },
				React.createElement("b", null, "This message looks suspicious!"),
				React.createElement(
					"p",
					null,
					"It originates from ",
					from,
					" but replies will go to ",
					reply_to,
					".",
				),
			);

			// If you don't want a React component to render anything at all, then your
			// `render` method should return `null` or `undefined`.
		} else {
			return null;
		}
	}

	isPhishingAttempt() {
		// In this package, the MessageStore is the source of our data which will be
		// the input for the `render` function. @isPhishingAttempt is performing some
		// domain-specific application logic to prepare the data for `render`.
		const message = MessageStore.items()[0];

		// This package's strategy to ascertain whether or not the email is a
		// phishing attempt boils down to checking the `replyTo` attributes on
		// `Message` models from `MessageStore`.
		if (message.replyTo != null && message.replyTo.length !== 0) {
			// The `from` and `replyTo` attributes on `Message` models both refer to
			// arrays of `Contact` models, which in turn have `email` attributes.
			const from = message.from[0].email;
			const reply_to = message.replyTo[0].email;

			// This is our core logic for our whole package! If the `from` and
			// `replyTo` emails are different, then we want to show a phishing warning.
			if (reply_to !== from) {
				return [from, reply_to];
			}
		}

		return [null, null];
	}
}
PhishingIndicator.initClass();

module.exports = {
	// Activate is called when the package is loaded. If your package previously
	// saved state using `serialize` it is provided.
	activate(state) {
		// This is a good time to tell the `ComponentRegistry` to insert our
		// React component into the `'MessageListHeaders'` part of the application.
		this.state = state;
		return ComponentRegistry.register(PhishingIndicator, {
			role: "MessageListHeaders",
		});
	},

	// Serialize is called when your package is about to be unmounted.
	// You can return a state object that will be passed back to your package
	// when it is re-activated.
	serialize() {},

	// This **optional** method is called when the window is shutting down,
	// or when your package is being updated or disabled. If your package is
	// watching any files, holding external resources, providing commands or
	// subscribing to events, release them here.
	deactivate() {
		return ComponentRegistry.unregister(PhishingIndicator);
	},
};
