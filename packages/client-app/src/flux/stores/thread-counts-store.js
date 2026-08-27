/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const NylasStore = require("nylas-store");
const DatabaseStore = require("./database-store.js").default;
const Thread = require("../models/thread.js").default;

/*
Are running two nested SELECT statements really the best option? Yup.
For a performance assessment of these queries and other options, see:
https://gist.github.com/bengotow/c8b5cd8989c9149ded56

Note: SUM(unread) works because unread is represented as an int: 0 or 1.
*/

const ReadCountsQuery = () => "SELECT * FROM `ThreadCounts`";

const SetCountsQuery = () => `\
REPLACE INTO \`ThreadCounts\` (category_id, unread, total)
SELECT
\`ThreadCategory\`.\`value\` as category_id,
SUM(\`ThreadCategory\`.\`unread\`) as unread,
COUNT(*) as total
FROM \`ThreadCategory\`
WHERE
\`ThreadCategory\`.in_all_mail = 1
GROUP BY \`ThreadCategory\`.\`value\`;\
`;

const UpdateCountsQuery = (objectIds, operator) => {
	const objectIdsString = `'${objectIds.join("','")}'`;
	return `\
REPLACE INTO \`ThreadCounts\` (category_id, unread, total)
SELECT
  \`ThreadCategory\`.\`value\` as category_id,
  COALESCE((SELECT unread FROM \`ThreadCounts\` WHERE category_id = \`ThreadCategory\`.\`value\`), 0) ${operator} SUM(\`ThreadCategory\`.\`unread\`) as unread,
  COALESCE((SELECT total  FROM \`ThreadCounts\` WHERE category_id = \`ThreadCategory\`.\`value\`), 0) ${operator} COUNT(*) as total
FROM \`ThreadCategory\`
WHERE
  \`ThreadCategory\`.id IN (${objectIdsString}) AND
  \`ThreadCategory\`.in_all_mail = 1
GROUP BY \`ThreadCategory\`.\`value\`\
`;
};

class CategoryDatabaseMutationObserver {
	constructor() {
		this.beforeDatabaseChange = this.beforeDatabaseChange.bind(this);
		this.afterDatabaseChange = this.afterDatabaseChange.bind(this);
	}

	beforeDatabaseChange(query, { type, objects, objectIds, objectClass }) {
		if (objectClass === Thread.name) {
			return query(UpdateCountsQuery(objectIds, "-"));
		} else {
			return Promise.resolve();
		}
	}

	afterDatabaseChange(
		query,
		{ type, objects, objectIds, objectClass },
		_beforeResolveValue,
	) {
		if (objectClass === Thread.name) {
			return query(UpdateCountsQuery(objectIds, "+"));
		} else {
			return Promise.resolve();
		}
	}
}

class ThreadCountsStore extends NylasStore {
	static initClass() {
		ThreadCountsStore.prototype.CategoryDatabaseMutationObserver =
			CategoryDatabaseMutationObserver;
	}

	constructor() {
		super();
		this.reset = this.reset.bind(this);
		this._onCountsChanged = this._onCountsChanged.bind(this);
		this.unreadCountForCategoryId = this.unreadCountForCategoryId.bind(this);
		this.totalCountForCategoryId = this.totalCountForCategoryId.bind(this);
		this._counts = {};
		this._observer = new CategoryDatabaseMutationObserver();
		DatabaseStore.addMutationHook(this._observer);

		if (NylasEnv.isMainWindow()) {
			// For now, unread counts are only retrieved in the main window.
			this._onCountsChangedDebounced = _.throttle(this._onCountsChanged, 1000);
			DatabaseStore.listen((change) => {
				if (change.objectClass === Thread.name) {
					return this._onCountsChangedDebounced();
				}
			});
			this._onCountsChangedDebounced();
		}

		if (
			NylasEnv.isWorkWindow() &&
			!NylasEnv.config.get("nylas.threadCountsValid")
		) {
			this.reset();
		}
	}

	reset() {
		let countsStartTime = null;
		return DatabaseStore.inTransaction((_t) => {
			countsStartTime = Date.now();
			return DatabaseStore._query(SetCountsQuery());
		}).then(() => {
			NylasEnv.config.set("nylas.threadCountsValid", true);
			return console.log(
				`Recomputed all thread counts in ${Date.now() - countsStartTime}ms`,
			);
		});
	}

	_onCountsChanged() {
		return DatabaseStore._query(ReadCountsQuery()).then((results) => {
			const nextCounts = {};

			let foundNegative = false;
			for (var { category_id, unread, total } of Array.from(results)) {
				nextCounts[category_id] = { unread, total };
				if (unread < 0 || total < 0) {
					foundNegative = true;
				}
			}

			if (foundNegative) {
				NylasEnv.reportError(new Error("Assertion Failure: Negative Count"));
				this.reset();
				return;
			}

			if (_.isEqual(nextCounts, this._counts)) {
				return;
			}

			this._counts = nextCounts;
			return this.trigger();
		});
	}

	unreadCountForCategoryId(catId) {
		if (this._counts[catId] === undefined) {
			return null;
		}
		return this._counts[catId].unread;
	}

	totalCountForCategoryId(catId) {
		if (this._counts[catId] === undefined) {
			return null;
		}
		return this._counts[catId].total;
	}
}
ThreadCountsStore.initClass();

module.exports = new ThreadCountsStore();
