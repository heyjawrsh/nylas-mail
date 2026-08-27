import PropTypes from "prop-types";
const React = require("react");
const ReactDOM = require("react-dom");
const classNames = require("classnames");
const _ = require("underscore");
const MessageParticipants = require("./message-participants");
const MessageItemBody = require("./message-item-body");
const MessageTimestamp = require("./message-timestamp").default;
const MessageControls = require("./message-controls");
const {
	Utils,
	Actions,
	MessageUtils,
	AccountStore,
	MessageBodyProcessor,
	QuotedHTMLTransformer,
	ComponentRegistry,
	FileDownloadStore,
} = require("nylas-exports");
const {
	RetinaImg,
	InjectedComponentSet,
	InjectedComponent,
} = require("nylas-component-kit");
const _TransparentPixel =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNikAQAACIAHF/uBd8AAAAASUVORK5CYII=";

class MessageItem extends React.Component {
	static displayName = "MessageItem";
	static propTypes = {
		thread: PropTypes.object.isRequired,
		message: PropTypes.object.isRequired,
		messages: PropTypes.array.isRequired,
		collapsed: PropTypes.bool,
		onLoad: PropTypes.func,
	};

	constructor(props) {
		super(props);
		for (const name of [
			"componentDidMount",
			"componentDidUpdate",
			"componentWillUnmount",
			"shouldComponentUpdate",
			"render",
			"_renderCollapsed",
			"_renderFull",
			"_renderHeader",
			"_renderFolder",
			"_onClickParticipants",
			"_onClickHeader",
			"_onDownloadAll",
			"_renderDownloadAllButton",
			"_renderAttachments",
			"_renderFooterStatus",
			"_setDetailedHeadersTogglePos",
			"_renderHeaderDetailToggle",
			"_toggleCollapsed",
			"_onDownloadStoreChange",
		]) {
			this[name] = this[name].bind(this);
		}
		const fileIds = this.props.message.fileIds();
		this.state = {
			downloads: FileDownloadStore.getDownloadDataForFiles(fileIds),
			filePreviewPaths: FileDownloadStore.previewPathsForFiles(fileIds),
			detailedHeaders: false,
			detailedHeadersTogglePos: { top: 18 },
		};
	}

	componentDidMount() {
		this._storeUnlisten = FileDownloadStore.listen(this._onDownloadStoreChange);
		return this._setDetailedHeadersTogglePos();
	}
	componentDidUpdate() {
		return this._setDetailedHeadersTogglePos();
	}
	componentWillUnmount() {
		if (this._storeUnlisten) {
			return this._storeUnlisten();
		}
	}
	shouldComponentUpdate(nextProps, nextState) {
		return (
			!Utils.isEqualReact(nextProps, this.props) ||
			!Utils.isEqualReact(nextState, this.state)
		);
	}
	render() {
		return this.props.collapsed ? this._renderCollapsed() : this._renderFull();
	}

	_renderCollapsed() {
		let attachmentIcon = [];
		if (Utils.showIconForAttachments(this.props.message.files)) {
			attachmentIcon = <div className="collapsed-attachment"></div>;
		}
		const from = this.props.message.from;
		return (
			<div className={this.props.className} onClick={this._toggleCollapsed}>
				<div className="message-item-white-wrap">
					<div className="message-item-area">
						<div className="collapsed-from">
							{from != null && from[0] != null
								? from[0].displayName({ compact: true })
								: undefined}
						</div>
						<div className="collapsed-snippet">
							{this.props.message.snippet}
						</div>
						<div className="collapsed-timestamp">
							<MessageTimestamp date={this.props.message.date} />
						</div>
						{attachmentIcon}
					</div>
				</div>
			</div>
		);
	}

	_renderFull() {
		return (
			<div className={this.props.className}>
				<div className="message-item-white-wrap">
					<div className="message-item-area">
						{this._renderHeader()}
						<MessageItemBody
							message={this.props.message}
							downloads={this.state.downloads}
							onLoad={this.props.onLoad}
						/>
						{this._renderAttachments()}
						{this._renderFooterStatus()}
					</div>
				</div>
			</div>
		);
	}

	_renderHeader() {
		const classes = classNames({
			"message-header": true,
			pending: this.props.pending,
		});
		return (
			<header ref="header" className={classes} onClick={this._onClickHeader}>
				<InjectedComponent
					matching={{ role: "MessageHeader" }}
					exposedProps={{
						message: this.props.message,
						thread: this.props.thread,
						messages: this.props.messages,
					}}
				/>
				<div
					className="pending-spinner"
					style={{ position: "absolute", marginTop: -2 }}
				>
					<RetinaImg
						ref="spinner"
						name="sending-spinner.gif"
						mode={RetinaImg.Mode.ContentPreserve}
					/>
				</div>
				<div className="message-header-right">
					<MessageTimestamp
						className="message-time"
						isDetailed={this.state.detailedHeaders}
						date={this.props.message.date}
					/>
					<InjectedComponentSet
						className="message-header-status"
						matching={{ role: "MessageHeaderStatus" }}
						exposedProps={{
							message: this.props.message,
							thread: this.props.thread,
							detailedHeaders: this.state.detailedHeaders,
						}}
					/>
					<MessageControls
						thread={this.props.thread}
						message={this.props.message}
					/>
				</div>
				<MessageParticipants
					from={this.props.message.from}
					onClick={this._onClickParticipants}
					isDetailed={this.state.detailedHeaders}
				/>
				<MessageParticipants
					to={this.props.message.to}
					cc={this.props.message.cc}
					bcc={this.props.message.bcc}
					onClick={this._onClickParticipants}
					isDetailed={this.state.detailedHeaders}
				/>
				{this._renderFolder()}
				{this._renderHeaderDetailToggle()}
			</header>
		);
	}

	_renderFolder() {
		if (!this.state.detailedHeaders) {
			return [];
		}
		const acct = AccountStore.accountForId(this.props.message.accountId);
		const acctUsesFolders = acct?.usesFolders();
		const folder =
			this.props.message.categories != null
				? this.props.message.categories[0]
				: undefined;
		if (!(folder && acctUsesFolders)) {
			return;
		}
		return (
			<div className="header-row">
				<div className="header-label">Folder:&nbsp;</div>
				<div className="header-name">{folder.displayName}</div>
			</div>
		);
	}

	_onClickParticipants(e) {
		let el = e.target;
		while (el !== e.currentTarget) {
			if (Array.from(el.classList).includes("collapsed-participants")) {
				this.setState({ detailedHeaders: true });
				e.stopPropagation();
				return;
			}
			el = el.parentElement;
		}
	}
	_onClickHeader(e) {
		if (this.state.detailedHeaders) {
			return;
		}
		let el = e.target;
		while (el !== e.currentTarget) {
			if (Array.from(el.classList).includes("message-header-right")) {
				return;
			}
			if (Array.from(el.classList).includes("collapsed-participants")) {
				return;
			}
			el = el.parentElement;
		}
		return this._toggleCollapsed();
	}

	_onDownloadAll() {
		return Actions.fetchAndSaveAllFiles(this.props.message.files);
	}
	_renderDownloadAllButton() {
		return (
			<div className="download-all">
				<div className="attachment-number">
					<RetinaImg
						name="ic-attachments-all-clippy.png"
						mode={RetinaImg.Mode.ContentIsMask}
					/>
					<span>{this.props.message.files.length} attachments</span>
				</div>
				<div className="separator">-</div>
				<div className="download-all-action" onClick={this._onDownloadAll}>
					<RetinaImg
						name="ic-attachments-download-all.png"
						mode={RetinaImg.Mode.ContentIsMask}
					/>
					<span>Download all</span>
				</div>
			</div>
		);
	}
	_renderAttachments() {
		const files = (
			this.props.message.files != null ? this.props.message.files : []
		).filter((f) => this._isRealFile(f));
		const messageClientId = this.props.message.clientId;
		const { filePreviewPaths, downloads } = this.state;
		if (files.length > 0) {
			return (
				<div>
					{files.length > 1 ? this._renderDownloadAllButton() : undefined}
					<div className="attachments-area">
						<InjectedComponent
							matching={{ role: "MessageAttachments" }}
							exposedProps={{
								files,
								downloads,
								filePreviewPaths,
								messageClientId,
								canRemoveAttachments: false,
							}}
						/>
					</div>
				</div>
			);
		}
		return <div />;
	}
	_renderFooterStatus() {
		return (
			<InjectedComponentSet
				className="message-footer-status"
				matching={{ role: "MessageFooterStatus" }}
				exposedProps={{
					message: this.props.message,
					thread: this.props.thread,
					detailedHeaders: this.state.detailedHeaders,
				}}
			/>
		);
	}

	_setDetailedHeadersTogglePos() {
		const header = ReactDOM.findDOMNode(this.refs.header);
		if (!header) {
			return;
		}
		const fromNode = header.querySelector(
			".participant-name.from-contact,.participant-primary",
		);
		if (!fromNode) {
			return;
		}
		const fromRect = fromNode.getBoundingClientRect();
		const topPos = Math.floor(fromNode.offsetTop + fromRect.height / 2 - 10);
		if (topPos !== this.state.detailedHeadersTogglePos.top) {
			return this.setState({ detailedHeadersTogglePos: { top: topPos } });
		}
	}
	_renderHeaderDetailToggle() {
		if (this.props.pending) {
			return null;
		}
		const { top } = this.state.detailedHeadersTogglePos;
		if (this.state.detailedHeaders) {
			return (
				<div
					className="header-toggle-control"
					style={{ top, left: "-14px" }}
					onClick={(e) => {
						this.setState({ detailedHeaders: false });
						return e.stopPropagation();
					}}
				>
					<RetinaImg
						name="message-disclosure-triangle-active.png"
						mode={RetinaImg.Mode.ContentIsMask}
					/>
				</div>
			);
		}
		return (
			<div
				className="header-toggle-control inactive"
				style={{ top }}
				onClick={(e) => {
					this.setState({ detailedHeaders: true });
					return e.stopPropagation();
				}}
			>
				<RetinaImg
					name="message-disclosure-triangle.png"
					mode={RetinaImg.Mode.ContentIsMask}
				/>
			</div>
		);
	}
	_toggleCollapsed() {
		if (!this.props.isLastMsg) {
			return Actions.toggleMessageIdExpanded(this.props.message.id);
		}
	}
	_isRealFile(file) {
		const hasCIDInBody =
			file.contentId != null &&
			(this.props.message.body != null
				? this.props.message.body.indexOf(file.contentId)
				: undefined) > 0;
		return !hasCIDInBody;
	}
	_onDownloadStoreChange() {
		const fileIds = this.props.message.fileIds();
		return this.setState({
			downloads: FileDownloadStore.getDownloadDataForFiles(fileIds),
			filePreviewPaths: FileDownloadStore.previewPathsForFiles(fileIds),
		});
	}
}

module.exports = MessageItem;
