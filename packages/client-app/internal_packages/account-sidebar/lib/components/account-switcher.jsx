/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
const React = require("react");
const { Actions } = require("nylas-exports");
const { RetinaImg } = require("nylas-component-kit");
const AccountCommands = require("../account-commands");

class AccountSwitcher extends React.Component {
	constructor(...args) {
		super(...args);
		this._makeMenuTemplate = this._makeMenuTemplate.bind(this);
		this._onAddAccount = this._onAddAccount.bind(this);
		this._onManageAccounts = this._onManageAccounts.bind(this);
		this._onShowMenu = this._onShowMenu.bind(this);
		this.render = this.render.bind(this);
	}

	static initClass() {
		AccountSwitcher.displayName = "AccountSwitcher";

		AccountSwitcher.propTypes = {
			accounts: PropTypes.array.isRequired,
			sidebarAccountIds: PropTypes.array.isRequired,
		};
	}

	_makeMenuTemplate() {
		let template = AccountCommands.menuTemplate(
			this.props.accounts,
			this.props.sidebarAccountIds,
			{ clickHandlers: true },
		);
		template = template.concat([
			{ type: "separator" },
			{ label: "Add Account...", click: this._onAddAccount },
			{ label: "Manage Accounts...", click: this._onManageAccounts },
		]);
		return template;
	}

	// Handlers

	_onAddAccount() {
		const ipc = require("electron").ipcRenderer;
		return ipc.send("command", "application:add-account", {
			source: "Sidebar",
		});
	}

	_onManageAccounts() {
		Actions.switchPreferencesTab("Accounts");
		return Actions.openPreferences();
	}

	_onShowMenu() {
		const { remote } = require("electron");
		const { Menu } = remote;
		const menu = Menu.buildFromTemplate(this._makeMenuTemplate());
		return menu.popup();
	}

	render() {
		return (
			<div className="account-switcher" onMouseDown={this._onShowMenu}>
				<RetinaImg
					style={{ width: 13, height: 14 }}
					name="account-switcher-dropdown.png"
					mode={RetinaImg.Mode.ContentDark}
				/>
			</div>
		);
	}
}
AccountSwitcher.initClass();

module.exports = AccountSwitcher;
