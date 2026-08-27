/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const NylasStore = require("nylas-store");
const _ = require("underscore");
const {
	Rx,
	Message,
	OutboxStore,
	AccountStore,
	MutableQueryResultSet,
	MutableQuerySubscription,
	ObservableListDataSource,
	FocusedPerspectiveStore,
	DatabaseStore,
} = require("nylas-exports");
const { ListTabular } = require("nylas-component-kit");

class DraftListStore extends NylasStore {
	constructor() {
		this.dataSource = this.dataSource.bind(this);
		this.selectionObservable = this.selectionObservable.bind(this);
		this._onPerspectiveChanged = this._onPerspectiveChanged.bind(this);
		this._createListDataSource = this._createListDataSource.bind(this);
		this.listenTo(FocusedPerspectiveStore, this._onPerspectiveChanged);
		this._createListDataSource();
	}

	dataSource() {
		return this._dataSource;
	}

	selectionObservable() {
		return Rx.Observable.fromListSelection(this);
	}

	// Inbound Events

	_onPerspectiveChanged() {
		return this._createListDataSource();
	}

	// Internal

	_createListDataSource() {
		const mailboxPerspective = FocusedPerspectiveStore.current();

		if (mailboxPerspective.drafts) {
			const query = DatabaseStore.findAll(Message)
				.include(Message.attributes.body)
				.order(Message.attributes.date.descending())
				.where({ draft: true })
				.page(0, 1);

			// Adding a "account_id IN (a,b,c)" clause to our query can result in a full
			// table scan. Don't add the where clause if we know we want results from all.
			if (
				mailboxPerspective.accountIds.length < AccountStore.accounts().length
			) {
				query.where({ accountId: mailboxPerspective.accountIds });
			}

			const subscription = new MutableQuerySubscription(query, {
				emitResultSet: true,
			});
			let $resultSet = Rx.Observable.fromNamedQuerySubscription(
				"draft-list",
				subscription,
			);
			$resultSet = Rx.Observable.combineLatest(
				[$resultSet, Rx.Observable.fromStore(OutboxStore)],
				(resultSet, outbox) => {
					// Generate a new result set that includes additional information on
					// the draft objects. This is similar to what we do in the thread-list,
					// where we set thread.__messages to the message array.
					const resultSetWithTasks = new MutableQueryResultSet(resultSet);

					mailboxPerspective.accountIds.forEach((aid) => {
						return OutboxStore.itemsForAccount(aid).forEach((task) => {
							let draft = resultSet.modelWithId(task.draftClientId);
							if (draft) {
								draft = draft.clone();
								draft.uploadTaskId = task.id;
								draft.uploadProgress = task.progress;
								return resultSetWithTasks.updateModel(draft);
							}
						});
					});

					return resultSetWithTasks.immutableClone();
				},
			);

			this._dataSource = new ObservableListDataSource(
				$resultSet,
				subscription.replaceRange,
			);
		} else {
			this._dataSource = new ListTabular.DataSource.Empty();
		}

		return this.trigger(this);
	}
}

module.exports = new DraftListStore();
