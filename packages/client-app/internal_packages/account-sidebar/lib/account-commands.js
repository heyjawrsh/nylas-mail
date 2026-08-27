/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const { Actions, MenuHelpers } = require("nylas-exports");

class AccountCommands {
	static initClass() {
		AccountCommands._isSelected = (account, sidebarAccountIds) => {
			if (sidebarAccountIds.length > 1) {
				return account instanceof Array;
			} else if (sidebarAccountIds.length === 1) {
				return (
					(account != null ? account.id : undefined) === sidebarAccountIds[0]
				);
			} else {
				return false;
			}
		};

		AccountCommands.menuItem = (account, idx, param) => {
			if (param == null) {
				param = {};
			}
			const { isSelected, clickHandlers } = param;
			const item = {
				label: account.label != null ? account.label : "All Accounts",
				command: `window:select-account-${idx}`,
				account: true,
			};
			if (isSelected) {
				item.type = "checkbox";
				item.checked = true;
			}
			if (clickHandlers) {
				const accounts = account instanceof Array ? account : [account];
				item.click = AccountCommands._focusAccounts.bind(
					AccountCommands,
					accounts,
				);
				item.accelerator = `CmdOrCtrl+${idx + 1}`;
			}
			return item;
		};

		AccountCommands.menuTemplate = (accounts, sidebarAccountIds, param) => {
			let isSelected;
			if (param == null) {
				param = {};
			}
			const { clickHandlers } = param;
			let template = [];
			const multiAccount = accounts.length > 1;

			if (multiAccount) {
				isSelected = AccountCommands._isSelected(accounts, sidebarAccountIds);
				template = [
					AccountCommands.menuItem(accounts, 0, { isSelected, clickHandlers }),
				];
			}

			template = template.concat(
				accounts.map((account, idx) => {
					// If there's only one account, it should be mapped to command+1, not command+2
					const accIdx = multiAccount ? idx + 1 : idx;
					isSelected = AccountCommands._isSelected(account, sidebarAccountIds);
					return AccountCommands.menuItem(account, accIdx, {
						isSelected,
						clickHandlers,
					});
				}),
			);
			return template;
		};
	}

	static _focusAccounts(accounts) {
		Actions.focusDefaultMailboxPerspectiveForAccounts(accounts);
		if (!NylasEnv.isVisible()) {
			return NylasEnv.show();
		}
	}

	static registerCommands(accounts) {
		if (AccountCommands._commandsDisposable != null) {
			AccountCommands._commandsDisposable.dispose();
		}
		const commands = {};

		const allKey = "window:select-account-0";
		commands[allKey] = AccountCommands._focusAccounts.bind(
			AccountCommands,
			accounts,
		);

		[1, 2, 3, 4, 5, 6, 7, 8].forEach((index) => {
			const account = accounts[index - 1];
			if (!account) {
				return;
			}
			const key = `window:select-account-${index}`;
			return (commands[key] = AccountCommands._focusAccounts.bind(
				AccountCommands,
				[account],
			));
		});

		return (AccountCommands._commandsDisposable = NylasEnv.commands.add(
			document.body,
			commands,
		));
	}

	static registerMenuItems(accounts, sidebarAccountIds) {
		const windowMenu = _.find(
			NylasEnv.menu.template,
			({ label }) => MenuHelpers.normalizeLabel(label) === "Window",
		);
		if (!windowMenu) {
			return;
		}

		const submenu = _.reject(windowMenu.submenu, (item) => item.account);
		if (!submenu) {
			return;
		}

		const idx = _.findIndex(submenu, ({ type }) => type === "separator");
		if (!(idx > 0)) {
			return;
		}

		const template = AccountCommands.menuTemplate(accounts, sidebarAccountIds);
		submenu.splice(idx + 1, 0, ...Array.from(template));
		windowMenu.submenu = submenu;
		return NylasEnv.menu.update();
	}

	static register(accounts, sidebarAccountIds) {
		AccountCommands.registerCommands(accounts);
		return AccountCommands.registerMenuItems(accounts, sidebarAccountIds);
	}
}
AccountCommands.initClass();

module.exports = AccountCommands;
