import PropTypes from "prop-types";
const React = require("react");
const classNames = require("classnames");
const MessageItem = require("./message-item");
const {
	Utils,
	DraftStore,
	ComponentRegistry,
	MessageStore,
} = require("nylas-exports");
const { domNodeOf } = require("../../../src/components/dom-node.js");

class MessageItemContainer extends React.Component {
	static displayName = "MessageItemContainer";
	static propTypes = {
		thread: PropTypes.object.isRequired,
		message: PropTypes.object.isRequired,
		messages: PropTypes.array.isRequired,
		collapsed: PropTypes.bool,
		isLastMsg: PropTypes.bool,
		isBeforeReplyArea: PropTypes.bool,
		scrollTo: PropTypes.func,
		onLoad: PropTypes.func,
	};

	constructor(props) {
		super(props);
		this.componentDidMount = this.componentDidMount.bind(this);
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this.focus = this.focus.bind(this);
		this.render = this.render.bind(this);
		this._renderMessage = this._renderMessage.bind(this);
		this._renderComposer = this._renderComposer.bind(this);
		this._classNames = this._classNames.bind(this);
		this._onSendingStateChanged = this._onSendingStateChanged.bind(this);
		this._message = React.createRef();
		this.state = {
			...this._getStateFromStores(),
			prevMessage: props.message,
		};
	}

	// Before render: isSending picks the composer or the message, and a frame
	// of the wrong one would mount it.
	static getDerivedStateFromProps(props, state) {
		if (props.message === state.prevMessage) {
			return null;
		}
		return {
			isSending: DraftStore.isSendingDraft(props.message.clientId),
			prevMessage: props.message,
		};
	}
	componentDidMount() {
		if (this.props.message.draft) {
			this._unlisten = DraftStore.listen(this._onSendingStateChanged);
		}
	}
	shouldComponentUpdate(nextProps, nextState) {
		return (
			!Utils.isEqualReact(nextProps, this.props) ||
			!Utils.isEqualReact(nextState, this.state)
		);
	}
	componentWillUnmount() {
		if (this._unlisten) {
			return this._unlisten();
		}
	}
	focus() {
		return this._message.current.focus();
	}

	// The message item's or the inline composer's node.
	getDOMNode() {
		return domNodeOf(this._message.current);
	}

	render() {
		if (this.state.isSending) {
			return this._renderMessage({ pending: true });
		}
		if (this.props.message.draft) {
			return this._renderComposer();
		}
		return this._renderMessage({ pending: false });
	}

	_renderMessage({ pending }) {
		return (
			<MessageItem
				ref={this._message}
				pending={pending}
				thread={this.props.thread}
				message={this.props.message}
				messages={this.props.messages}
				className={this._classNames()}
				collapsed={this.props.collapsed}
				isLastMsg={this.props.isLastMsg}
				onLoad={this.props.onLoad}
			/>
		);
	}
	_renderComposer() {
		const Composer = ComponentRegistry.findComponentsMatching({
			role: "Composer",
		})[0];
		if (!Composer) {
			return <span></span>;
		}
		return (
			<Composer
				ref={this._message}
				draftClientId={this.props.message.clientId}
				className={this._classNames()}
				mode="inline"
				threadId={this.props.thread.id}
				scrollTo={this.props.scrollTo}
			/>
		);
	}
	_classNames() {
		return classNames({
			draft: this.props.message.draft,
			unread: this.props.message.unread,
			collapsed: this.props.collapsed,
			"message-item-wrap": true,
			"before-reply-area": this.props.isBeforeReplyArea,
		});
	}
	_onSendingStateChanged(draftClientId) {
		if (draftClientId === this.props.message.clientId) {
			return this.setState(this._getStateFromStores());
		}
	}
	_getStateFromStores(props = this.props) {
		return { isSending: DraftStore.isSendingDraft(props.message.clientId) };
	}
}

module.exports = MessageItemContainer;
