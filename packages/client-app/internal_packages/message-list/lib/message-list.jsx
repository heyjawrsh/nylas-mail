import PropTypes from "prop-types";
const _ = require("underscore");
const React = require("react");
const classNames = require("classnames");
const FindInThread = require("./find-in-thread").default;
const MessageItemContainer = require("./message-item-container");
const {
	Utils,
	Actions,
	Message,
	DraftStore,
	MessageStore,
	AccountStore,
	DatabaseStore,
	WorkspaceStore,
	ChangeLabelsTask,
	ComponentRegistry,
	SearchableComponentStore,
	SearchableComponentMaker,
} = require("nylas-exports");
const {
	Spinner,
	RetinaImg,
	MailLabelSet,
	ScrollRegion,
	MailImportantIcon,
	InjectedComponent,
	KeyCommandsRegion,
	InjectedComponentSet,
} = require("nylas-component-kit");
const { domNodeOf } = require("../../../src/components/dom-node.js");

class MessageListScrollTooltip extends React.Component {
	static displayName = "MessageListScrollTooltip";
	static propTypes = {
		viewportCenter: PropTypes.number.isRequired,
		totalHeight: PropTypes.number.isRequired,
	};
	constructor() {
		super(...arguments);
		this.state = {};
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
	}
	// Reads the message offsets during render, before this update's DOM
	// changes, as componentWillMount/ReceiveProps did. It has to run before
	// shouldComponentUpdate, which only compares state.
	static getDerivedStateFromProps(props) {
		const els = document.querySelectorAll(".message-item-wrap");
		let idx = _.findIndex(els, (el) => el.offsetTop > props.viewportCenter);
		if (idx === -1) {
			idx = els.length;
		}
		return { idx, count: els.length };
	}
	shouldComponentUpdate(_newProps, newState) {
		return !_.isEqual(this.state, newState);
	}
	render() {
		return (
			<div className="scroll-tooltip">
				{this.state.idx} of {this.state.count}
			</div>
		);
	}
}

class MessageList extends React.Component {
	static displayName = "MessageList";
	static containerRequired = false;
	static containerStyles = { minWidth: 500, maxWidth: 999999 };

	constructor(props) {
		super(props);
		for (const name of [
			"componentDidMount",
			"componentWillUnmount",
			"shouldComponentUpdate",
			"componentDidUpdate",
			"_getMessageContainer",
			"_focusDraft",
			"_onForward",
			"render",
			"_renderIcons",
			"_renderExpandToggle",
			"_renderPopoutToggle",
			"_renderReplyArea",
			"_lastMessage",
			"_replyType",
			"_onPrintThread",
			"_onPopThreadIn",
			"_onPopoutThread",
			"_onClickReplyArea",
			"_messageElements",
			"_messagesWithMinification",
			"_scrollTo",
			"_onMessageLoaded",
			"_onScrollByPage",
			"_onChange",
			"_getStateFromStores",
		]) {
			this[name] = this[name].bind(this);
		}
		this.state = this._getStateFromStores();
		this.state.minified = true;
		this._messageWrap = React.createRef();
		// Message containers by draft/message clientId, set by callback refs.
		this._messageContainers = {};
		this._messageContainerRefs = {};
		this._draftScrollInProgress = false;
		this.MINIFY_THRESHOLD = 3;
	}

	componentDidMount() {
		this._unsubscribers = [];
		this._unsubscribers.push(MessageStore.listen(this._onChange));
		return this._unsubscribers.push(
			Actions.focusDraft.listen(({ draftClientId }) =>
				Utils.waitFor(() => this._getMessageContainer(draftClientId) != null)
					.then(() =>
						this._focusDraft(this._getMessageContainer(draftClientId)),
					)
					.catch(() => {}),
			),
		);
	}
	componentWillUnmount() {
		return this._unsubscribers.map((unsubscribe) => unsubscribe());
	}
	shouldComponentUpdate(nextProps, nextState) {
		return (
			!Utils.isEqualReact(nextProps, this.props) ||
			!Utils.isEqualReact(nextState, this.state)
		);
	}
	componentDidUpdate(_prevProps, _prevState) {}

	_globalMenuItems() {
		const toggleExpandedLabel = this.state.hasCollapsedItems
			? "Expand"
			: "Collapse";
		return [
			{
				label: "Thread",
				submenu: [
					{
						label: `${toggleExpandedLabel} conversation`,
						command: "message-list:toggle-expanded",
						position: "endof=view-actions",
					},
				],
			},
		];
	}
	_globalKeymapHandlers() {
		const handlers = {
			"core:reply": () =>
				Actions.composeReply({
					thread: this.state.currentThread,
					message: this._lastMessage(),
					type: "reply",
					behavior: "prefer-existing",
				}),
			"core:reply-all": () =>
				Actions.composeReply({
					thread: this.state.currentThread,
					message: this._lastMessage(),
					type: "reply-all",
					behavior: "prefer-existing",
				}),
			"core:forward": () => this._onForward(),
			"core:print-thread": () => this._onPrintThread(),
			"core:messages-page-up": () => this._onScrollByPage(-1),
			"core:messages-page-down": () => this._onScrollByPage(1),
		};
		if (this.state.canCollapse) {
			handlers["message-list:toggle-expanded"] = () =>
				this._onToggleAllMessagesExpanded();
		}
		return handlers;
	}
	_getMessageContainer(clientId) {
		return this._messageContainers[clientId];
	}
	// One stable callback per clientId, so React doesn't detach and reattach
	// the ref on every render.
	_messageContainerRef(clientId) {
		if (!this._messageContainerRefs[clientId]) {
			this._messageContainerRefs[clientId] = (container) => {
				if (container) {
					this._messageContainers[clientId] = container;
				} else {
					delete this._messageContainers[clientId];
					delete this._messageContainerRefs[clientId];
				}
			};
		}
		return this._messageContainerRefs[clientId];
	}
	_focusDraft(draftElement) {
		this._draftScrollInProgress = true;
		try {
			draftElement.focus();
			return this._messageWrap.current.scrollTo(draftElement, {
				position: ScrollRegion.ScrollPosition.Top,
				settle: true,
				done: () => {
					this._draftScrollInProgress = false;
				},
			});
		} catch (err) {
			// done() never comes, so don't leave _scrollTo blocked.
			this._draftScrollInProgress = false;
			throw err;
		}
	}
	// The root node, for SearchableComponentMaker's search region.
	_setRoot = (value) => {
		this._root = value;
	};

	getDOMNode() {
		return this._root?.getDOMNode
			? this._root.getDOMNode()
			: this._root || null;
	}

	_onForward() {
		if (this.state.currentThread) {
			return Actions.composeForward({ thread: this.state.currentThread });
		}
	}

	render() {
		if (!this.state.currentThread) {
			return <span ref={this._setRoot} />;
		}
		const wrapClass = classNames({
			"messages-wrap": true,
			ready: !this.state.loading,
		});
		const messageListClass = classNames({
			"message-list": true,
			"height-fix": SearchableComponentStore.searchTerm !== null,
		});
		return (
			<KeyCommandsRegion
				ref={this._setRoot}
				globalHandlers={this._globalKeymapHandlers()}
				globalMenuItems={this._globalMenuItems()}
			>
				<FindInThread />
				<div className={messageListClass} id="message-list">
					<ScrollRegion
						tabIndex="-1"
						className={wrapClass}
						scrollbarTickProvider={SearchableComponentStore}
						scrollTooltipComponent={MessageListScrollTooltip}
						ref={this._messageWrap}
					>
						{this._renderSubject()}
						<div className="headers" style={{ position: "relative" }}>
							<InjectedComponentSet
								className="message-list-headers"
								matching={{ role: "MessageListHeaders" }}
								exposedProps={{
									thread: this.state.currentThread,
									messages: this.state.messages,
								}}
								direction="column"
							/>
						</div>
						{this._messageElements()}
					</ScrollRegion>
					<Spinner visible={this.state.loading} />
				</div>
			</KeyCommandsRegion>
		);
	}
	_renderSubject() {
		let subject = this.state.currentThread.subject;
		if (!subject || subject.length === 0) {
			subject = "(No Subject)";
		}
		return (
			<div className="message-subject-wrap">
				<MailImportantIcon thread={this.state.currentThread} />
				<div style={{ flex: 1 }}>
					<span className="message-subject">{subject}</span>
					<MailLabelSet
						removable={true}
						messages={this.state.messages}
						thread={this.state.currentThread}
						includeCurrentCategories={true}
					/>
				</div>
				{this._renderIcons()}
			</div>
		);
	}
	_renderIcons() {
		return (
			<div className="message-icons-wrap">
				{this._renderExpandToggle()}
				<div onClick={this._onPrintThread}>
					<RetinaImg
						name="print.png"
						title="Print Thread"
						mode={RetinaImg.Mode.ContentIsMask}
					/>
				</div>
				{this._renderPopoutToggle()}
			</div>
		);
	}
	_renderExpandToggle() {
		if (!this.state.canCollapse) {
			return <span />;
		}
		if (this.state.hasCollapsedItems) {
			return (
				<div onClick={this._onToggleAllMessagesExpanded}>
					<RetinaImg
						name="expand.png"
						title="Expand All"
						mode={RetinaImg.Mode.ContentIsMask}
					/>
				</div>
			);
		}
		return (
			<div onClick={this._onToggleAllMessagesExpanded}>
				<RetinaImg
					name="collapse.png"
					title="Collapse All"
					mode={RetinaImg.Mode.ContentIsMask}
				/>
			</div>
		);
	}
	_renderPopoutToggle() {
		return NylasEnv.isThreadWindow() ? (
			<div onClick={this._onPopThreadIn}>
				<RetinaImg
					name="thread-popin.png"
					title="Pop thread in"
					mode={RetinaImg.Mode.ContentIsMask}
				/>
			</div>
		) : (
			<div onClick={this._onPopoutThread}>
				<RetinaImg
					name="thread-popout.png"
					title="Popout thread"
					mode={RetinaImg.Mode.ContentIsMask}
				/>
			</div>
		);
	}
	_renderReplyArea() {
		return (
			<div
				className="footer-reply-area-wrap"
				onClick={this._onClickReplyArea}
				key="reply-area"
			>
				<div className="footer-reply-area">
					<RetinaImg
						name={`${this._replyType()}-footer.png`}
						mode={RetinaImg.Mode.ContentIsMask}
					/>
					<span className="reply-text">Write a reply…</span>
				</div>
			</div>
		);
	}
	_lastMessage() {
		return _.last(
			_.filter(
				this.state.messages != null ? this.state.messages : [],
				(m) => !m.draft,
			),
		);
	}
	_replyType() {
		const defaultReplyType = NylasEnv.config.get(
			"core.sending.defaultReplyType",
		);
		const lastMessage = this._lastMessage();
		if (!lastMessage) {
			return "reply";
		}
		return lastMessage.canReplyAll() && defaultReplyType === "reply-all"
			? "reply-all"
			: "reply";
	}
	_onToggleAllMessagesExpanded() {
		return Actions.toggleAllMessagesExpanded();
	}
	_onPrintThread() {
		const node = this.getDOMNode();
		return Actions.printThread(this.state.currentThread, node.innerHTML);
	}
	_onPopThreadIn() {
		if (!this.state.currentThread) {
			return;
		}
		Actions.focusThreadMainWindow(this.state.currentThread);
		return NylasEnv.close();
	}
	_onPopoutThread() {
		if (!this.state.currentThread) {
			return;
		}
		Actions.popoutThread(this.state.currentThread);
		return Actions.popSheet();
	}
	_onClickReplyArea() {
		if (this.state.currentThread) {
			return Actions.composeReply({
				thread: this.state.currentThread,
				message: this._lastMessage(),
				type: this._replyType(),
				behavior: "prefer-existing-if-pristine",
			});
		}
	}

	_messageElements() {
		const elements = [];
		const last = _.last(this.state.messages);
		const hasReplyArea = !(last != null ? last.draft : undefined);
		const messages = this._messagesWithMinification(this.state.messages);
		messages.forEach((message, idx) => {
			if (message.type === "minifiedBundle") {
				elements.push(this._renderMinifiedBundle(message));
				return;
			}
			const collapsed = !this.state.messagesExpandedState[message.id];
			const isLastMsg = messages.length - 1 === idx;
			const isBeforeReplyArea = isLastMsg && hasReplyArea;
			elements.push(
				<MessageItemContainer
					key={message.clientId}
					ref={this._messageContainerRef(message.clientId)}
					thread={this.state.currentThread}
					message={message}
					messages={this.state.messages}
					collapsed={collapsed}
					isLastMsg={isLastMsg}
					isBeforeReplyArea={isBeforeReplyArea}
					scrollTo={this._scrollTo}
					onLoad={this._onMessageLoaded}
				/>,
			);
		});
		if (hasReplyArea) {
			elements.push(this._renderReplyArea());
		}
		return elements;
	}
	_renderMinifiedBundle(bundle) {
		const BUNDLE_HEIGHT = 36;
		const lines = bundle.messages.slice(0, 10);
		const h = Math.round(BUNDLE_HEIGHT / lines.length);
		return (
			<div
				className="minified-bundle"
				onClick={() => this.setState({ minified: false })}
				key={Utils.generateTempId()}
			>
				<div className="num-messages">
					{bundle.messages.length} older messages
				</div>
				<div className="msg-lines" style={{ height: h * lines.length }}>
					{lines.map((msg, i) => (
						<div
							key={msg.id}
							style={{ height: h * 2, top: -h * i }}
							className="msg-line"
						></div>
					))}
				</div>
			</div>
		);
	}
	_messagesWithMinification(messages = []) {
		if (!this.state.minified) {
			return messages;
		}
		messages = _.clone(messages);
		const minifyRanges = [];
		let consecutiveCollapsed = 0;
		messages.forEach((message, idx) => {
			if (idx === 0) {
				return;
			}
			const expandState = this.state.messagesExpandedState[message.id];
			if (!expandState) {
				consecutiveCollapsed += 1;
			} else {
				const minifyOffset = expandState === "default" ? 1 : 0;
				if (consecutiveCollapsed >= this.MINIFY_THRESHOLD + minifyOffset) {
					minifyRanges.push({
						start: idx - consecutiveCollapsed,
						length: consecutiveCollapsed - minifyOffset,
					});
				}
				consecutiveCollapsed = 0;
			}
		});
		let indexOffset = 0;
		for (const range of minifyRanges) {
			const start = range.start - indexOffset;
			const minified = {
				type: "minifiedBundle",
				messages: messages.slice(start, start + range.length),
			};
			messages.splice(start, range.length, minified);
			indexOffset += range.length - 1;
		}
		return messages;
	}
	_scrollTo({ clientId, rect, position } = {}) {
		if (this._draftScrollInProgress) {
			return;
		}
		if (clientId) {
			const messageElement = this._getMessageContainer(clientId);
			if (!messageElement) {
				return;
			}
			const pos =
				position != null ? position : ScrollRegion.ScrollPosition.Visible;
			return this._messageWrap.current.scrollTo(messageElement, {
				position: pos,
			});
		} else if (rect) {
			return this._messageWrap.current.scrollToRect(rect, {
				position: ScrollRegion.ScrollPosition.CenterIfInvisible,
			});
		}
		throw new Error("onChildScrollRequest: expected clientId or rect");
	}
	_onMessageLoaded() {
		if (this.state.currentThread) {
			const timerKey = `select-thread-${this.state.currentThread.id}`;
			if (NylasEnv.timer.isPending(timerKey)) {
				const actionTimeMs = NylasEnv.timer.stop(timerKey);
				const messageCount = (this.state.messages || []).length;
				return Actions.recordPerfMetric({
					sample: 0.1,
					action: "select-thread",
					actionTimeMs,
					messageCount,
				});
			}
		}
	}
	_onScrollByPage(direction) {
		const messageWrap = this._messageWrap.current;
		const height = domNodeOf(messageWrap).clientHeight;
		return (messageWrap.scrollTop += height * direction);
	}
	_onChange() {
		const newState = this._getStateFromStores();
		if (
			(this.state.currentThread != null
				? this.state.currentThread.id
				: undefined) !==
			(newState.currentThread != null ? newState.currentThread.id : undefined)
		) {
			newState.minified = true;
		}
		return this.setState(newState);
	}
	_getStateFromStores() {
		return {
			messages: MessageStore.items() != null ? MessageStore.items() : [],
			messagesExpandedState: MessageStore.itemsExpandedState(),
			canCollapse: MessageStore.items().length > 1,
			hasCollapsedItems: MessageStore.hasCollapsedItems(),
			currentThread: MessageStore.thread(),
			loading: MessageStore.itemsLoading(),
		};
	}
}

module.exports = SearchableComponentMaker.extend(MessageList);
