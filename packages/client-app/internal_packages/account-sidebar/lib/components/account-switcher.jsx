/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import { ipcRenderer, remote } from "electron";
import PropTypes from "prop-types";
import React from "react";
import { Actions } from "nylas-exports";
import { RetinaImg } from "nylas-component-kit";
import AccountCommands from "../account-commands";

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
		return ipcRenderer.send("command", "application:add-account", {
			source: "Sidebar",
		});
	}

	_onManageAccounts() {
		Actions.switchPreferencesTab("Accounts");
		return Actions.openPreferences();
	}

	_onShowMenu() {
		const { Menu } = remote || {};
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

export default AccountSwitcher;
