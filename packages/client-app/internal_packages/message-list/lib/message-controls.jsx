import PropTypes from "prop-types";
const React = require("react");
const { remote } = require("electron");
const {
	Actions,
	NylasAPI,
	NylasAPIRequest,
	AccountStore,
} = require("nylas-exports");
const { RetinaImg, ButtonDropdown, Menu } = require("nylas-component-kit");

class MessageControls extends React.Component {
	static displayName = "MessageControls";
	static propTypes = {
		thread: PropTypes.object.isRequired,
		message: PropTypes.object.isRequired,
	};

	constructor(props) {
		super(props);
		this.render = this.render.bind(this);
		this._account = this._account.bind(this);
		this._onReply = this._onReply.bind(this);
		this._onReplyAll = this._onReplyAll.bind(this);
		this._onForward = this._onForward.bind(this);
		this._onShowActionsMenu = this._onShowActionsMenu.bind(this);
		this._onShowOriginal = this._onShowOriginal.bind(this);
		this._onLogData = this._onLogData.bind(this);
		this._onCopyToClipboard = this._onCopyToClipboard.bind(this);
	}

	render() {
		const items = this._items();
		return (
			<div className="message-actions-wrap">
				<ButtonDropdown
					primaryItem={
						<RetinaImg
							name={items[0].image}
							mode={RetinaImg.Mode.ContentIsMask}
						/>
					}
					primaryTitle={items[0].name}
					primaryClick={items[0].select}
					closeOnMenuClick={true}
					menu={this._dropdownMenu(items.slice(1))}
				/>
				<div
					className="message-actions-ellipsis"
					onClick={this._onShowActionsMenu}
				>
					<RetinaImg
						name="message-actions-ellipsis.png"
						mode={RetinaImg.Mode.ContentIsMask}
					/>
				</div>
			</div>
		);
	}

	_items() {
		const reply = {
			name: "Reply",
			image: "ic-dropdown-reply.png",
			select: this._onReply,
		};
		const replyAll = {
			name: "Reply All",
			image: "ic-dropdown-replyall.png",
			select: this._onReplyAll,
		};
		const forward = {
			name: "Forward",
			image: "ic-dropdown-forward.png",
			select: this._onForward,
		};
		if (this.props.message.canReplyAll()) {
			const defaultReplyType = NylasEnv.config.get(
				"core.sending.defaultReplyType",
			);
			return defaultReplyType === "reply-all"
				? [replyAll, reply, forward]
				: [reply, replyAll, forward];
		}
		return [reply, forward];
	}

	_account() {
		return AccountStore.accountForId(this.props.message.accountId);
	}

	_dropdownMenu(items) {
		const itemContent = (item) => (
			<span>
				<RetinaImg name={item.image} mode={RetinaImg.Mode.ContentIsMask} />
				&nbsp;&nbsp;{item.name}
			</span>
		);
		return (
			<Menu
				items={items}
				itemKey={(item) => item.name}
				itemContent={itemContent}
				onSelect={(item) => item.select()}
			/>
		);
	}

	_onReply() {
		const { thread, message } = this.props;
		return Actions.composeReply({
			thread,
			message,
			type: "reply",
			behavior: "prefer-existing-if-pristine",
		});
	}
	_onReplyAll() {
		const { thread, message } = this.props;
		return Actions.composeReply({
			thread,
			message,
			type: "reply-all",
			behavior: "prefer-existing-if-pristine",
		});
	}
	_onForward() {
		const { thread, message } = this.props;
		return Actions.composeForward({ thread, message });
	}

	_onShowActionsMenu() {
		const SystemMenu = remote.Menu;
		const SystemMenuItem = remote.MenuItem;
		const menu = new SystemMenu();
		menu.append(
			new SystemMenuItem({ label: "Log Data", click: () => this._onLogData() }),
		);
		menu.append(
			new SystemMenuItem({
				label: "Show Original",
				click: () => this._onShowOriginal(),
			}),
		);
		menu.append(
			new SystemMenuItem({
				label: "Copy Debug Info to Clipboard",
				click: () => this._onCopyToClipboard(),
			}),
		);
		return menu.popup(remote.getCurrentWindow());
	}

	_onShowOriginal() {
		const fs = require("node:fs");
		const path = require("node:path");
		const BrowserWindow = remote.BrowserWindow;
		const app = remote.app;
		const tmpfile = path.join(app.getPath("temp"), this.props.message.id);
		const request = new NylasAPIRequest({
			api: NylasAPI,
			options: {
				headers: { Accept: "message/rfc822" },
				path: `/messages/${this.props.message.id}`,
				accountId: this.props.message.accountId,
				json: false,
			},
		});
		return request.run().then((body) =>
			fs.writeFile(tmpfile, body, () => {
				const window = new BrowserWindow({
					width: 800,
					height: 600,
					title: `${this.props.message.subject} - RFC822`,
				});
				return window.loadURL(`file://${tmpfile}`);
			}),
		);
	}

	_onLogData() {
		console.log(this.props.message);
		window.__message = this.props.message;
		window.__thread = this.props.thread;
		return console.log(
			"Also now available in window.__message and window.__thread",
		);
	}

	_onCopyToClipboard() {
		const clipboard = require("electron").clipboard;
		const data =
			`AccountID: ${this.props.message.accountId}\n` +
			`Message ID: ${this.props.message.serverId}\n` +
			`Message Metadata: ${JSON.stringify(this.props.message.pluginMetadata, null, "  ")}\n` +
			`Thread ID: ${this.props.thread.serverId}\n` +
			`Thread Metadata: ${JSON.stringify(this.props.thread.pluginMetadata, null, "  ")}\n`;
		return clipboard.writeText(data);
	}
}

module.exports = MessageControls;
