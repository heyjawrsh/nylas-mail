/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");

const Utils = require("./flux/models/utils.js");
const TaskFactory = require("./flux/tasks/task-factory.js").default;
const AccountStore = require("./flux/stores/account-store.js").default;
const CategoryStore = require("./flux/stores/category-store.js");
const DatabaseStore = require("./flux/stores/database-store.js").default;
const OutboxStore = require("./flux/stores/outbox-store.js").default;
const ThreadCountsStore = require("./flux/stores/thread-counts-store.js");
const _RecentlyReadStore =
	require("./flux/stores/recently-read-store.js").default;
const MutableQuerySubscription =
	require("./flux/models/mutable-query-subscription.js").default;
const UnreadQuerySubscription =
	require("./flux/models/unread-query-subscription.js").default;
const _Matcher = require("./flux/attributes/matcher.js").default;
const Thread = require("./flux/models/thread.js").default;
const Category = require("./flux/models/category.js").default;
const Actions = require("./flux/actions.js").default;
let ChangeUnreadTask = null;

// This is a class cluster. Subclasses are not for external use!
// https://developer.apple.com/library/ios/documentation/General/Conceptual/CocoaEncyclopedia/ClassClusters/ClassClusters.html

class MailboxPerspective {
	static initClass() {
		MailboxPerspective.forInbox = (accountsOrIds) => {
			return MailboxPerspective.forStandardCategories(accountsOrIds, "inbox");
		};

		MailboxPerspective.fromJSON = (json) => {
			try {
				let categories;
				if (json.type === CategoryMailboxPerspective.name) {
					categories = JSON.parse(
						json.serializedCategories,
						Utils.registeredObjectReviver,
					);
					return MailboxPerspective.forCategories(categories);
				} else if (json.type === UnreadMailboxPerspective.name) {
					categories = JSON.parse(
						json.serializedCategories,
						Utils.registeredObjectReviver,
					);
					return MailboxPerspective.forUnread(categories);
				} else if (json.type === StarredMailboxPerspective.name) {
					return MailboxPerspective.forStarred(json.accountIds);
				} else if (json.type === DraftsMailboxPerspective.name) {
					return MailboxPerspective.forDrafts(json.accountIds);
				} else {
					return MailboxPerspective.forInbox(json.accountIds);
				}
			} catch (error) {
				NylasEnv.reportError(
					new Error(`Could not restore mailbox perspective: ${error}`),
				);
				return null;
			}
		};
	}

	// Factory Methods
	static forNothing() {
		return new EmptyMailboxPerspective();
	}

	static forDrafts(accountsOrIds) {
		return new DraftsMailboxPerspective(accountsOrIds);
	}

	static forCategory(category) {
		if (!category) {
			return MailboxPerspective.forNothing();
		}
		return new CategoryMailboxPerspective([category]);
	}

	static forCategories(categories) {
		if (categories.length === 0) {
			return MailboxPerspective.forNothing();
		}
		return new CategoryMailboxPerspective(categories);
	}

	static forStandardCategories(accountsOrIds, ...names) {
		// TODO this method is broken
		const categories = CategoryStore.getStandardCategories(
			accountsOrIds,
			...Array.from(names),
		);
		return MailboxPerspective.forCategories(categories);
	}

	static forStarred(accountsOrIds) {
		return new StarredMailboxPerspective(accountsOrIds);
	}

	static forUnread(categories) {
		if (categories.length === 0) {
			return MailboxPerspective.forNothing();
		}
		return new UnreadMailboxPerspective(categories);
	}

	// Instance Methods

	constructor(accountIds) {
		this.toJSON = this.toJSON.bind(this);
		this.isEqual = this.isEqual.bind(this);
		this.isInbox = this.isInbox.bind(this);
		this.isSent = this.isSent.bind(this);
		this.isTrash = this.isTrash.bind(this);
		this.isSpam = this.isSpam.bind(this);
		this.isArchive = this.isArchive.bind(this);
		this.emptyMessage = this.emptyMessage.bind(this);
		this.categories = this.categories.bind(this);
		this.hasSyncingCategories = this.hasSyncingCategories.bind(this);
		this.categoriesSharedName = this.categoriesSharedName.bind(this);
		this.category = this.category.bind(this);
		this.threads = this.threads.bind(this);
		this.unreadCount = this.unreadCount.bind(this);
		this.canReceiveThreadsFromAccountIds =
			this.canReceiveThreadsFromAccountIds.bind(this);
		this.receiveThreads = this.receiveThreads.bind(this);
		this.canArchiveThreads = this.canArchiveThreads.bind(this);
		this.canTrashThreads = this.canTrashThreads.bind(this);
		this.canMoveThreadsTo = this.canMoveThreadsTo.bind(this);
		this.tasksForRemovingItems = this.tasksForRemovingItems.bind(this);
		this.accountIds = accountIds;
		if (
			!Array.isArray(this.accountIds) ||
			!_.every(this.accountIds, (aid) => {
				return typeof aid === "string" || typeof aid === "number";
			})
		) {
			throw new Error(
				`${this.constructor.name}: You must provide an array of string \`accountIds\``,
			);
		}
		this;
	}

	toJSON() {
		return { accountIds: this.accountIds, type: this.constructor.name };
	}

	isEqual(other) {
		if (!other || this.constructor !== other.constructor) {
			return false;
		}
		if (other.name !== this.name) {
			return false;
		}
		if (!_.isEqual(this.accountIds, other.accountIds)) {
			return false;
		}
		return true;
	}

	isInbox() {
		return this.categoriesSharedName() === "inbox";
	}

	isSent() {
		return this.categoriesSharedName() === "sent";
	}

	isTrash() {
		return this.categoriesSharedName() === "trash";
	}

	isSpam() {
		return this.categoriesSharedName() === "spam";
	}

	isArchive() {
		return false;
	}

	emptyMessage() {
		return "No Messages";
	}

	categories() {
		return [];
	}

	// overwritten in CategoryMailboxPerspective
	hasSyncingCategories() {
		return false;
	}

	categoriesSharedName() {
		if (this._categoriesSharedName == null) {
			this._categoriesSharedName = Category.categoriesSharedName(
				this.categories(),
			);
		}
		return this._categoriesSharedName;
	}

	category() {
		if (this.categories().length !== 1) {
			return null;
		}
		return this.categories()[0];
	}

	threads() {
		throw new Error("threads: Not implemented in base class.");
	}

	unreadCount() {
		return 0;
	}

	// Public:
	// - accountIds {Array} Array of unique account ids associated with the threads
	// that want to be included in this perspective
	//
	// Returns true if the accountIds are part of the current ids, or false
	// otherwise. This means that it checks if I am attempting to move threads
	// between the same set of accounts:
	//
	// E.g.:
	// perpective = Starred for accountIds: a1, a2
	// thread1 has accountId a3
	// thread2 has accountId a2
	//
	// perspective.canReceiveThreadsFromAccountIds([a2, a3]) -> false -> I cant move those threads to Starred
	// perspective.canReceiveThreadsFromAccountIds([a2]) -> true -> I can move that thread to # Starred
	canReceiveThreadsFromAccountIds(accountIds) {
		if (!accountIds || !(accountIds.length > 0)) {
			return false;
		}
		const areIncomingIdsInCurrent =
			_.difference(accountIds, this.accountIds).length === 0;
		return areIncomingIdsInCurrent;
	}

	receiveThreads(_threadIds) {
		throw new Error("receiveThreads: Not implemented in base class.");
	}

	canArchiveThreads(threads) {
		if (this.isArchive()) {
			return false;
		}
		const accounts = AccountStore.accountsForItems(threads);
		return _.every(accounts, (acc) => acc.canArchiveThreads());
	}

	canTrashThreads(threads) {
		return this.canMoveThreadsTo(threads, "trash");
	}

	canMoveThreadsTo(threads, standardCategoryName) {
		if (this.categoriesSharedName() === standardCategoryName) {
			return false;
		}
		return _.every(
			AccountStore.accountsForItems(threads),
			(acc) =>
				CategoryStore.getStandardCategory(acc, standardCategoryName) != null,
		);
	}

	tasksForRemovingItems(threads) {
		if (!Array.isArray(threads)) {
			throw new Error(
				"tasksForRemovingItems: you must pass an array of threads or thread ids",
			);
		}
		return [];
	}
}
MailboxPerspective.initClass();

class DraftsMailboxPerspective extends MailboxPerspective {
	constructor(accountIds) {
		this.threads = this.threads.bind(this);
		this.unreadCount = this.unreadCount.bind(this);
		this.canReceiveThreadsFromAccountIds =
			this.canReceiveThreadsFromAccountIds.bind(this);
		this.accountIds = accountIds;
		super(this.accountIds);
		this.name = "Drafts";
		this.iconName = "drafts.png";
		this.drafts = true; // The DraftListStore looks for this
		this;
	}

	threads() {
		return null;
	}

	unreadCount() {
		let count = 0;
		for (var aid of Array.from(this.accountIds)) {
			count += OutboxStore.itemsForAccount(aid).length;
		}
		return count;
	}

	canReceiveThreadsFromAccountIds() {
		return false;
	}
}

class StarredMailboxPerspective extends MailboxPerspective {
	constructor(accountIds) {
		this.threads = this.threads.bind(this);
		this.canReceiveThreadsFromAccountIds =
			this.canReceiveThreadsFromAccountIds.bind(this);
		this.receiveThreads = this.receiveThreads.bind(this);
		this.tasksForRemovingItems = this.tasksForRemovingItems.bind(this);
		this.accountIds = accountIds;
		super(this.accountIds);
		this.name = "Starred";
		this.iconName = "starred.png";
		this;
	}

	threads() {
		const query = DatabaseStore.findAll(Thread)
			.where([
				Thread.attributes.starred.equal(true),
				Thread.attributes.inAllMail.equal(true),
			])
			.limit(0);

		// Adding a "account_id IN (a,b,c)" clause to our query can result in a full
		// table scan. Don't add the where clause if we know we want results from all.
		if (this.accountIds.length < AccountStore.accounts().length) {
			query.where(Thread.attributes.accountId.in(this.accountIds));
		}

		return new MutableQuerySubscription(query, { emitResultSet: true });
	}

	canReceiveThreadsFromAccountIds() {
		return super.canReceiveThreadsFromAccountIds(...arguments);
	}

	receiveThreads(threadIds) {
		const ChangeStarredTask =
			require("./flux/tasks/change-starred-task.js").default;
		const task = new ChangeStarredTask({
			threads: threadIds,
			starred: true,
			source: "Dragged Into List",
		});
		return Actions.queueTask(task);
	}

	tasksForRemovingItems(threads, _ruleset, source) {
		const task = TaskFactory.taskForInvertingStarred({
			threads,
			source: source || "Removed From List",
		});
		return [task];
	}
}

class EmptyMailboxPerspective extends MailboxPerspective {
	constructor() {
		super([]);
		this.threads = this.threads.bind(this);
		this.canReceiveThreadsFromAccountIds =
			this.canReceiveThreadsFromAccountIds.bind(this);
		this.accountIds = [];
	}

	threads() {
		// We need a Thread query that will not return any results and take no time.
		// We use lastMessageReceivedTimestamp because it is the first column on an
		// index so this returns zero items nearly instantly. In the future, we might
		// want to make a Query.forNothing() to go along with MailboxPerspective.forNothing()
		const query = DatabaseStore.findAll(Thread)
			.where({ lastMessageReceivedTimestamp: -1 })
			.limit(0);
		return new MutableQuerySubscription(query, { emitResultSet: true });
	}

	canReceiveThreadsFromAccountIds() {
		return false;
	}
}

class CategoryMailboxPerspective extends MailboxPerspective {
	constructor(_categories) {
		this.toJSON = this.toJSON.bind(this);
		this.isEqual = this.isEqual.bind(this);
		this.threads = this.threads.bind(this);
		this.unreadCount = this.unreadCount.bind(this);
		this.categories = this.categories.bind(this);
		this.hasSyncingCategories = this.hasSyncingCategories.bind(this);
		this.isArchive = this.isArchive.bind(this);
		this.canReceiveThreadsFromAccountIds =
			this.canReceiveThreadsFromAccountIds.bind(this);
		this.receiveThreads = this.receiveThreads.bind(this);
		this.tasksForRemovingItems = this.tasksForRemovingItems.bind(this);
		this._categories = _categories;
		super(_.uniq(_.pluck(this._categories, "accountId")));

		if (this._categories.length === 0) {
			throw new Error(
				"CategoryMailboxPerspective: You must provide at least one category.",
			);
		}

		// Note: We pick the display name and icon assuming that you won't create a
		// perspective with Inbox and Sent or anything crazy like that... todo?
		this.name = this._categories[0].displayName;
		if (this._categories[0].name) {
			this.iconName = `${this._categories[0].name}.png`;
		} else {
			const account = AccountStore.accountForId(this.accountIds[0]);
			this.iconName = "folder.png";
			if (account) {
				this.iconName = account.categoryIcon();
			}
		}
		this;
	}

	toJSON() {
		const json = super.toJSON(...arguments);
		json.serializedCategories = JSON.stringify(
			this._categories,
			Utils.registeredObjectReplacer,
		);
		return json;
	}

	isEqual(other) {
		return (
			super.isEqual(other) &&
			_.isEqual(
				_.pluck(this.categories(), "id"),
				_.pluck(other.categories(), "id"),
			)
		);
	}

	threads() {
		let needle;
		const query = DatabaseStore.findAll(Thread)
			.where([
				Thread.attributes.categories.containsAny(
					_.pluck(this.categories(), "id"),
				),
			])
			.limit(0);

		if (this.isSent()) {
			query.order(Thread.attributes.lastMessageSentTimestamp.descending());
		}

		if (
			((needle = this.categoriesSharedName()),
			!["spam", "trash"].includes(needle))
		) {
			query.where({ inAllMail: true });
		}

		if (
			this._categories.length > 1 &&
			this.accountIds.length < this._categories.length
		) {
			// The user has multiple categories in the same account selected, which
			// means our result set could contain multiple copies of the same threads
			// (since we do an inner join) and we need SELECT DISTINCT. Note that this
			// can be /much/ slower and we shouldn't do it if we know we don't need it.
			query.distinct();
		}

		return new MutableQuerySubscription(query, { emitResultSet: true });
	}

	unreadCount() {
		let sum = 0;
		for (var cat of Array.from(this._categories)) {
			sum += ThreadCountsStore.unreadCountForCategoryId(cat.id);
		}
		return sum;
	}

	categories() {
		return this._categories;
	}

	hasSyncingCategories() {
		for (var cat of Array.from(this._categories)) {
			if (!cat.isSyncComplete()) {
				return true;
			}
		}
		return false;
	}

	isArchive() {
		return _.every(this._categories, (cat) => cat.isArchive());
	}

	canReceiveThreadsFromAccountIds() {
		return (
			super.canReceiveThreadsFromAccountIds(...arguments) &&
			!_.any(this._categories, (c) => c.isLockedCategory())
		);
	}

	receiveThreads(threadIds) {
		const FocusedPerspectiveStore =
			require("./flux/stores/focused-perspective-store.js").default;
		const current = FocusedPerspectiveStore.current();

		// This assumes that the we don't have more than one category per accountId
		// attached to this perspective
		return DatabaseStore.modelify(Thread, threadIds).then((threads) => {
			const tasks = TaskFactory.tasksForApplyingCategories({
				source: "Dragged Into List",
				threads,
				categoriesToRemove(accountId) {
					let needle;
					if (
						((needle = current.categoriesSharedName()),
						Array.from(Category.LockedCategoryNames).includes(needle))
					) {
						return [];
					}
					return _.filter(current.categories(), _.matcher({ accountId }));
				},
				categoriesToAdd: (accountId) => [
					_.findWhere(this._categories, { accountId }),
				],
			});
			return Actions.queueTasks(tasks);
		});
	}

	// Public:
	// Returns the tasks for removing threads from this perspective and moving them
	// to a given target/destination based on a {RemovalTargetRuleset}.
	//
	// A RemovalTargetRuleset for categories is a map that represents the
	// target/destination Category when removing threads from another given
	// category, i.e., when removing them the current CategoryPerspective.
	// Rulesets are of the form:
	//
	//   [categoryName] -> function(accountId): Category
	//
	// Keys correspond to category names, e.g.`{'inbox', 'trash',...}`, which
	// correspond to the name of the categories associated with the current perspective
	// Values are functions with the following signature:
	//
	//   `function(accountId): Category`
	//
	// If the value of the category name of the current perspective is null instead
	// of a function, this method will return an empty array of tasks
	//
	// RemovalRulesets should also contain a key `other`, that is meant to be used
	// when a key cannot be found for the current category name
	//
	// Example:
	// perspective.tasksForRemovingItems(
	//   threads,
	//   {
	//     # Move to trash if the current perspective is inbox
	//     inbox: (accountId) -> CategoryStore.getTrashCategory(accountId),
	//
	//     # Do nothing if the current perspective is trash
	//     trash: null,
	//   }
	// )
	//
	tasksForRemovingItems(threads, ruleset, source) {
		if (threads.length === 0) {
			return [];
		}
		if (!ruleset) {
			throw new Error(
				"tasksForRemovingItems: you must pass a ruleset object to determine the destination of the threads",
			);
		}

		const name = this.isArchive()
			? // TODO this is an awful hack
				"archive"
			: this.categoriesSharedName();

		if (ruleset[name] === null) {
			return [];
		}

		return TaskFactory.tasksForApplyingCategories({
			source: source || "Removed From List",
			threads,
			categoriesToRemove: (accountId) => {
				// Remove all categories from this perspective that match the accountId
				return _.filter(this._categories, _.matcher({ accountId }));
			},
			categoriesToAdd: (accId) => {
				const category = (
					ruleset[name] != null ? ruleset[name] : ruleset.other
				)(accId);
				if (category) {
					return [category];
				} else {
					return [];
				}
			},
		});
	}
}

class UnreadMailboxPerspective extends CategoryMailboxPerspective {
	constructor(categories) {
		this.threads = this.threads.bind(this);
		this.unreadCount = this.unreadCount.bind(this);
		this.receiveThreads = this.receiveThreads.bind(this);
		this.tasksForRemovingItems = this.tasksForRemovingItems.bind(this);
		super(categories);
		this.name = "Unread";
		this.iconName = "unread.png";
		this;
	}

	threads() {
		return new UnreadQuerySubscription(_.pluck(this.categories(), "id"));
	}

	unreadCount() {
		return 0;
	}

	receiveThreads(threadIds) {
		super.receiveThreads(threadIds);
		if (ChangeUnreadTask == null) {
			ChangeUnreadTask = require("./flux/tasks/change-unread-task.js").default;
		}
		const task = new ChangeUnreadTask({
			threads: threadIds,
			unread: true,
			source: "Dragged Into List",
		});
		return Actions.queueTask(task);
	}

	tasksForRemovingItems(threads, ruleset, source) {
		if (ChangeUnreadTask == null) {
			ChangeUnreadTask = require("./flux/tasks/change-unread-task.js").default;
		}
		const tasks = super.tasksForRemovingItems(threads, ruleset);
		tasks.push(
			new ChangeUnreadTask({
				threads,
				unread: false,
				source: source || "Removed From List",
			}),
		);
		return tasks;
	}
}

module.exports = MailboxPerspective;
