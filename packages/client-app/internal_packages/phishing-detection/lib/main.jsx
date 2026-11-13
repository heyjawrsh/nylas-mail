import {
	React,
	// The ComponentRegistry manages all React components in N1.
	ComponentRegistry,
	// A `Store` is a Flux component which contains all business logic and data
	// models to be consumed by React components to render markup.
	MessageStore,
} from "nylas-exports";

import { getDomain } from "tldts";

// Notice that this file is `main.cjsx` rather than `main.coffee`. We use the
// `.cjsx` filetype because we use the CJSX DSL to describe markup for React to
// render. Without the CJSX, we could just name this file `main.coffee` instead.
class PhishingIndicator extends React.Component {
	// Adding a displayName to a React component helps for debugging.
	static displayName = "PhishingIndicator";

	constructor() {
		super();
		this.state = {
			message: MessageStore.items()[0],
		};
	}
	componentDidMount() {
		this._unlisten = MessageStore.listen(this._onMessagesChanged);
	}

	componentWillUnmount() {
		if (this._unlisten) {
			this._unlisten();
		}
	}

	_onMessagesChanged = () => {
		this.setState({
			message: MessageStore.items()[0],
		});
	};

	// A React component's `render` method returns a virtual DOM element described
	// in CJSX. `render` is deterministic: with the same input, it will always
	// render the same output. Here, the input is provided by @isPhishingAttempt.
	// `@state` and `@props` are popular inputs as well.
	render() {
		const { message } = this.state;
		if (!message) {
			return <span />;
		}

		const { replyTo, from } = message;
		if (!replyTo?.length || !from?.length) {
			return <span />;
		}

		// This package's strategy to ascertain whether or not the email is a
		// phishing attempt boils down to checking the `replyTo` attributes on
		// `Message` models from `MessageStore`.
		const fromEmail = from[0].email.toLowerCase();
		const replyToEmail = replyTo[0].email.toLowerCase();
		if (!fromEmail || !replyToEmail) {
			return <span />;
		}

		// The registered domains (paypal-secure.net, not mail.paypal-secure.net).
		// getDomain gives null for an empty or invalid host, and that's no warning.
		const fromDomain = getDomain(fromEmail.split("@")[1] || "");
		const replyToDomain = getDomain(replyToEmail.split("@")[1] || "");
		if (fromDomain && replyToDomain && replyToDomain !== fromDomain) {
			return (
				<div className="phishingIndicator">
					<b>This message looks suspicious!</b>
					<div className="description">{`It originates from ${fromEmail} but replies will go to ${replyToEmail}.`}</div>
				</div>
			);
		}

		return <span />;
	}
}

export function activate() {
	ComponentRegistry.register(PhishingIndicator, {
		role: "MessageListHeaders",
	});
}

export function serialize() {}

export function deactivate() {
	ComponentRegistry.unregister(PhishingIndicator);
}
