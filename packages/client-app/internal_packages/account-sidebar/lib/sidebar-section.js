/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const {
	Actions,
	SyncbackCategoryTask,
	DestroyCategoryTask,
	CategoryStore,
	Category,
	ExtensionRegistry,
	RegExpUtils,
} = require("nylas-exports");
const SidebarItem = require("./sidebar-item");
const SidebarActions = require("./sidebar-actions");

const isSectionCollapsed = (title) => {
	if (NylasEnv.savedState.sidebarKeysCollapsed[title] !== undefined) {
		return NylasEnv.savedState.sidebarKeysCollapsed[title];
	} else {
		return false;
	}
};

const toggleSectionCollapsed = (section) => {
	if (!section) {
		return;
	}
	return SidebarActions.setKeyCollapsed(
		section.title,
		!isSectionCollapsed(section.title),
	);
};

class SidebarSection {
	static empty(title) {
		return {
			title,
			items: [],
		};
	}

	static standardSectionForAccount(account) {
		if (!account) {
			throw new Error("standardSectionForAccount: You must pass an account.");
		}

		const cats = CategoryStore.standardCategories(account);
		if (cats.length === 0) {
			return SidebarSection.empty(account.label);
		}

		const items = _.reject(cats, (cat) => cat.name === "drafts").map((cat) =>
			SidebarItem.forCategories([cat], { editable: false, deletable: false }),
		);

		const unreadItem = SidebarItem.forUnread([account.id]);
		const starredItem = SidebarItem.forStarred([account.id]);
		const draftsItem = SidebarItem.forDrafts([account.id]);
		const snoozedItem = SidebarItem.forSnoozed([account.id]);

		const extensionItems = ExtensionRegistry.AccountSidebar.extensions()
			.filter((ext) => ext.sidebarItem != null)
			.map((ext) => ext.sidebarItem([account.id]))
			.map(({ id, name, iconName, perspective }) => {
				return SidebarItem.forPerspective(id, perspective, { name, iconName });
			});

		// Order correctly: Inbox, Unread, Starred, rest... , Drafts
		items.splice(
			1,
			0,
			unreadItem,
			starredItem,
			snoozedItem,
			...Array.from(extensionItems),
		);
		items.push(draftsItem);

		return {
			title: account.label,
			items,
		};
	}

	static standardSectionForAccounts(accounts) {
		let children;
		if (!accounts || accounts.length === 0) {
			return SidebarSection.empty("All Accounts");
		}
		if (CategoryStore.categories().length === 0) {
			return SidebarSection.empty("All Accounts");
		}
		if (accounts.length === 1) {
			return SidebarSection.standardSectionForAccount(accounts[0]);
		}

		const standardNames = [
			"inbox",
			"important",
			"sent",
			["archive", "all"],
			"spam",
			"trash",
		];
		const items = [];

		for (var names of Array.from(standardNames)) {
			names = Array.isArray(names) ? names : [names];
			var categories = CategoryStore.getStandardCategories(
				accounts,
				...Array.from(names),
			);
			if (categories.length === 0) {
				continue;
			}

			children = [];
			accounts.forEach((acc) => {
				const cat = _.first(
					_.compact(
						names.map((name) => CategoryStore.getStandardCategory(acc, name)),
					),
				);
				if (!cat) {
					return;
				}
				return children.push(
					SidebarItem.forCategories([cat], {
						name: acc.label,
						editable: false,
						deletable: false,
					}),
				);
			});

			items.push(
				SidebarItem.forCategories(categories, {
					children,
					editable: false,
					deletable: false,
				}),
			);
		}

		const accountIds = _.pluck(accounts, "id");

		const starredItem = SidebarItem.forStarred(accountIds, {
			children: accounts.map((acc) =>
				SidebarItem.forStarred([acc.id], { name: acc.label }),
			),
		});
		const unreadItem = SidebarItem.forUnread(accountIds, {
			children: accounts.map((acc) =>
				SidebarItem.forUnread([acc.id], { name: acc.label }),
			),
		});
		const draftsItem = SidebarItem.forDrafts(accountIds, {
			children: accounts.map((acc) =>
				SidebarItem.forDrafts([acc.id], { name: acc.label }),
			),
		});
		const snoozedItem = SidebarItem.forSnoozed(accountIds, {
			children: accounts.map((acc) =>
				SidebarItem.forSnoozed([acc.id], { name: acc.label }),
			),
		});

		const extensionItems = ExtensionRegistry.AccountSidebar.extensions()
			.filter((ext) => ext.sidebarItem != null)
			.map((ext) => {
				const { id, name, iconName, perspective } = ext.sidebarItem(accountIds);
				return SidebarItem.forPerspective(id, perspective, {
					name,
					iconName,
					children: accounts.map((acc) => {
						const subItem = ext.sidebarItem([acc.id]);
						return SidebarItem.forPerspective(
							subItem.id + `-${acc.id}`,
							subItem.perspective,
							{ name: acc.label, iconName: subItem.iconName },
						);
					}),
				});
			});

		// Order correctly: Inbox, Unread, Starred, rest... , Drafts
		items.splice(
			1,
			0,
			unreadItem,
			starredItem,
			snoozedItem,
			...Array.from(extensionItems),
		);
		items.push(draftsItem);

		return {
			title: "All Accounts",
			items,
		};
	}

	static forUserCategories(account, param) {
		let category, onCollapseToggled;
		if (param == null) {
			param = {};
		}
		let { title, collapsible } = param;
		if (!account) {
			return;
		}
		// Compute hierarchy for user categories using known "path" separators
		// NOTE: This code uses the fact that userCategoryItems is a sorted set, eg:
		//
		// Inbox
		// Inbox.FolderA
		// Inbox.FolderA.FolderB
		// Inbox.FolderB
		//
		const items = [];
		const seenItems = {};
		for (category of Array.from(CategoryStore.userCategories(account))) {
			// https://regex101.com/r/jK8cC2/1
			var item, parentKey;
			var re = RegExpUtils.subcategorySplitRegex();
			var itemKey = category.displayName.replace(re, "/");

			var parent = null;
			var parentComponents = itemKey.split("/");
			for (var i = parentComponents.length; i >= 1; i--) {
				parentKey = parentComponents.slice(0, i).join("/");
				parent = seenItems[parentKey];
				if (parent) {
					break;
				}
			}

			if (parent) {
				var itemDisplayName = category.displayName.substr(parentKey.length + 1);
				item = SidebarItem.forCategories([category], { name: itemDisplayName });
				parent.children.push(item);
			} else {
				item = SidebarItem.forCategories([category]);
				items.push(item);
			}
			seenItems[itemKey] = item;
		}

		if (title == null) {
			title = account.categoryLabel();
		}
		const collapsed = isSectionCollapsed(title);
		if (collapsible) {
			onCollapseToggled = toggleSectionCollapsed;
		}

		return {
			title,
			iconName: account.categoryIcon(),
			items,
			collapsed,
			onCollapseToggled,
			onItemCreated(displayName) {
				if (!displayName) {
					return;
				}
				category = new Category({
					displayName,
					accountId: account.id,
				});
				return Actions.queueTask(new SyncbackCategoryTask({ category }));
			},
		};
	}
}

module.exports = SidebarSection;
