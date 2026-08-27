/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const Message = require("../models/message").default;
const _Actions = require("../actions").default;
const NylasAPIHelpers = require("../nylas-api-helpers");
const AccountStore = require("./account-store").default;
const ContactStore = require("./contact-store");
const DatabaseStore = require("./database-store").default;
const UndoStack = require("../../undo-stack").default;
const DraftHelpers = require("../stores/draft-helpers").default;
const ExtensionRegistry = require("../../registries/extension-registry");
const { Listener, Publisher } = require("../modules/reflux-coffee");
const CoffeeHelpers = require("../coffee-helpers");
let DraftStore = null;
const _ = require("underscore");

const MetadataChangePrefix = "metadata.";

/*
Public: As the user interacts with the draft, changes are accumulated in the
DraftChangeSet associated with the store session. The DraftChangeSet does two things:

1. It debounces changes and calls Actions.saveDraft() at a reasonable interval.

2. It exposes `applyToModel`, which allows you to optimistically apply changes
  to a draft object. When the session vends the draft, it passes it through this
  function to apply uncommitted changes. This means the Draft provided by the
  DraftEditingSession will always relfect recent changes, even though they're
  written to the database intermittently.

Section: Drafts
*/
class DraftChangeSet {
	static initClass() {
		DraftChangeSet.include = CoffeeHelpers.includeModule;
		DraftChangeSet.include(Publisher);
	}

	constructor(callbacks) {
		this.add = this.add.bind(this);
		this.addPluginMetadata = this.addPluginMetadata.bind(this);
		this.commit = this.commit.bind(this);
		this.applyToModel = this.applyToModel.bind(this);
		this.callbacks = callbacks;
		this._commitChain = Promise.resolve();
		this._pending = {};
		this._saving = {};
		this._timer = null;
	}

	teardown() {
		this._pending = {};
		this._saving = {};
		if (this._timer) {
			clearTimeout(this._timer);
			return (this._timer = null);
		}
	}

	add(changes, param) {
		if (param == null) {
			param = {};
		}
		const { doesNotAffectPristine } = param;
		this.callbacks.onWillAddChanges(changes);
		this._pending = _.extend(this._pending, changes);
		if (!doesNotAffectPristine) {
			this._pending.pristine = false;
		}
		this.callbacks.onDidAddChanges(changes);

		if (this._timer) {
			clearTimeout(this._timer);
		}
		return (this._timer = setTimeout(this.commit, 10000));
	}

	addPluginMetadata(pluginId, metadata) {
		const changes = {};
		changes[`${MetadataChangePrefix}${pluginId}`] = metadata;
		return this.add(changes, { doesNotAffectPristine: true });
	}

	commit() {
		if (this._timer) {
			clearTimeout(this._timer);
		}
		this._commitChain = this._commitChain.finally(() => {
			if (Object.keys(this._pending).length === 0) {
				return Promise.resolve(true);
			}

			this._saving = this._pending;
			this._pending = {};
			return this.callbacks.onCommit().then(() => {
				return (this._saving = {});
			});
		});

		return this._commitChain;
	}

	applyToModel(model) {
		if (model) {
			const changesToApply = _.pairs(this._saving).concat(
				_.pairs(this._pending),
			);
			for (var [key, val] of Array.from(changesToApply)) {
				if (key.startsWith(MetadataChangePrefix)) {
					model.applyPluginMetadata(key.split(MetadataChangePrefix).pop(), val);
				} else {
					model[key] = val;
				}
			}
		}
		return model;
	}
}
DraftChangeSet.initClass();

/*
Public: DraftEditingSession is a small class that makes it easy to implement components
that display Draft objects or allow for interactive editing of Drafts.

1. It synchronously provides an instance of a draft via `draft()`, and
   triggers whenever that draft instance has changed.

2. It provides an interface for modifying the draft that transparently
   batches changes, and ensures that the draft provided via `draft()`
   always has pending changes applied.

Section: Drafts
*/
class DraftEditingSession {
	static initClass() {
		DraftEditingSession.include = CoffeeHelpers.includeModule;

		DraftEditingSession.include(Publisher);
		DraftEditingSession.include(Listener);
	}

	constructor(draftClientId, draft = null) {
		this.validateDraftForSending = this.validateDraftForSending.bind(this);
		this.ensureCorrectAccount = this.ensureCorrectAccount.bind(this);
		this.changeSetCommit = this.changeSetCommit.bind(this);
		this.changeSetWillAddChanges = this.changeSetWillAddChanges.bind(this);
		this.changeSetDidAddChanges = this.changeSetDidAddChanges.bind(this);
		this.restoreSnapshot = this.restoreSnapshot.bind(this);
		this.undo = this.undo.bind(this);
		this.redo = this.redo.bind(this);
		this._snapshot = this._snapshot.bind(this);
		this.draftClientId = draftClientId;
		if (DraftStore == null) {
			DraftStore = require("./draft-store").default;
		}
		this.listenTo(DraftStore, this._onDraftChanged);

		this._draft = false;
		this._draftPristineBody = null;
		this._destroyed = false;
		this._undoStack = new UndoStack();

		this.changes = new DraftChangeSet({
			onWillAddChanges: this.changeSetWillAddChanges,
			onDidAddChanges: this.changeSetDidAddChanges,
			onCommit: this.changeSetCommit,
		});

		if (draft) {
			this._draftPromise = this._setDraft(draft);
		}

		this.prepare();
	}

	// Public: Returns the draft object with the latest changes applied.
	//
	draft() {
		if (!this._draft) {
			return null;
		}
		this.changes.applyToModel(this._draft);
		return this._draft.clone();
	}

	// Public: Returns the initial body of the draft when it was pristine, or null if the
	// draft was never pristine in this editing session. Useful for determining if the
	// body is still in an unchanged / empty state.
	//
	draftPristineBody() {
		return this._draftPristineBody;
	}

	prepare() {
		return this._draftPromise != null
			? this._draftPromise
			: (this._draftPromise = DatabaseStore.findBy(Message, {
					clientId: this.draftClientId,
				})
					.include(Message.attributes.body)
					.then((draft) => {
						if (this._destroyed) {
							return Promise.reject(new Error("Draft has been destroyed."));
						}
						if (!draft) {
							return Promise.reject(
								new Error(
									`Assertion Failure: Draft ${this.draftClientId} not found.`,
								),
							);
						}
						return this._setDraft(draft);
					}));
	}

	teardown() {
		this.stopListeningToAll();
		this.changes.teardown();
		return (this._destroyed = true);
	}

	validateDraftForSending() {
		let warnings = [];
		const errors = [];
		const allRecipients = [].concat(
			this._draft.to,
			this._draft.cc,
			this._draft.bcc,
		);
		const bodyIsEmpty =
			this._draft.body === this.draftPristineBody() ||
			this._draft.body === "<br>";
		const forwarded = DraftHelpers.isForwardedMessage(this._draft);
		const hasAttachment =
			(this._draft.files != null ? this._draft.files.length : undefined) > 0 ||
			(this._draft.uploads != null ? this._draft.uploads.length : undefined) >
				0;

		for (var contact of Array.from(allRecipients)) {
			if (!ContactStore.isValidContact(contact)) {
				errors.push(
					`${contact.email} is not a valid email address - please remove or edit it before sending.`,
				);
			}
		}

		if (allRecipients.length === 0) {
			errors.push(
				"You need to provide one or more recipients before sending the message.",
			);
		}

		if (errors.length > 0) {
			return { errors, warnings };
		}

		if (this._draft.subject.length === 0) {
			warnings.push("without a subject line");
		}

		if (DraftHelpers.messageMentionsAttachment(this._draft) && !hasAttachment) {
			warnings.push("without an attachment");
		}

		if (bodyIsEmpty && !forwarded && !hasAttachment) {
			warnings.push("without a body");
		}

		//# Check third party warnings added via Composer extensions
		for (var extension of Array.from(ExtensionRegistry.Composer.extensions())) {
			if (!extension.warningsForSending) {
				continue;
			}
			warnings = warnings.concat(
				extension.warningsForSending({ draft: this._draft }),
			);
		}

		return { errors, warnings };
	}

	// This function makes sure the draft is attached to a valid account, and changes
	// it's accountId if the from address does not match the account for the from
	// address
	//
	// If the account is updated it makes a request to delete the draft with the
	// old accountId
	ensureCorrectAccount() {
		const account = AccountStore.accountForEmail(this._draft.from[0].email);
		if (!account) {
			return Promise.reject(
				new Error(
					"DraftEditingSession::ensureCorrectAccount - you can only send drafts from a configured account.",
				),
			);
		}

		if (account.id !== this._draft.accountId) {
			NylasAPIHelpers.makeDraftDeletionRequest(this._draft);
			this.changes.add({
				accountId: account.id,
				version: null,
				serverId: null,
				threadId: null,
				replyToMessageId: null,
			});
			return this.changes.commit().thenReturn(this);
		}
		return Promise.resolve(this);
	}

	_setDraft(draft) {
		if (draft.body == null) {
			throw new Error("DraftEditingSession._setDraft - new draft has no body!");
		}

		const extensions = ExtensionRegistry.Composer.extensions();

		// Run `extensions[].unapplyTransformsForSending`
		const fragment = document.createDocumentFragment();
		const draftBodyRootNode = document.createElement("root");
		fragment.appendChild(draftBodyRootNode);
		draftBodyRootNode.innerHTML = draft.body;

		return Promise.each(extensions, (ext) => {
			if (ext.applyTransformsForSending && ext.unapplyTransformsForSending) {
				return Promise.resolve(
					ext.unapplyTransformsForSending({
						draftBodyRootNode,
						draft,
					}),
				);
			}
		}).then(() => {
			draft.body = draftBodyRootNode.innerHTML;
			this._draft = draft;

			// We keep track of the draft's initial body if it's pristine when the editing
			// session begins. This initial value powers things like "are you sure you want
			// to send with an empty body?"
			if (draft.pristine) {
				this._draftPristineBody = draft.body;
				this._undoStack.save(this._snapshot());
			}

			this.trigger();
			return Promise.resolve(this);
		});
	}

	_onDraftChanged(change) {
		if (change == null) {
			return;
		}

		// We don't accept changes unless our draft object is loaded
		if (!this._draft) {
			return;
		}

		// If our draft has been changed, only accept values which are present.
		// If `body` is undefined, assume it's not loaded. Do not overwrite old body.
		const nextDraft = _.filter(
			change.objects,
			(obj) => obj.clientId === this._draft.clientId,
		).pop();
		if (nextDraft) {
			const nextValues = {};
			for (var key in Message.attributes) {
				var _attr = Message.attributes[key];
				if (key === "id") {
					continue;
				}
				if (nextDraft[key] === undefined) {
					continue;
				}
				nextValues[key] = nextDraft[key];
			}
			this._setDraft(Object.assign(new Message(), this._draft, nextValues));
			return this.trigger();
		}
	}

	changeSetCommit() {
		if (this._destroyed || !this._draft) {
			return Promise.resolve(true);
		}

		// Set a variable here to protect againg @_draft getting set from
		// underneath us
		const inMemoryDraft = this._draft;

		return DatabaseStore.inTransaction((t) => {
			return t
				.findBy(Message, { clientId: inMemoryDraft.clientId })
				.include(Message.attributes.body)
				.then((draft) => {
					if (draft == null) {
						draft = inMemoryDraft;
					}
					const updatedDraft = this.changes.applyToModel(draft);
					return t.persistModel(updatedDraft);
				});
		});
	}

	// Undo / Redo

	changeSetWillAddChanges(changes) {
		if (this._restoring) {
			return;
		}
		const hasBeen300ms = Date.now() - this._lastAddTimestamp > 300;
		const hasChangedFields = !_.isEqual(
			Object.keys(changes),
			this._lastChangedFields,
		);

		this._lastChangedFields = Object.keys(changes);
		this._lastAddTimestamp = Date.now();
		if (hasBeen300ms || hasChangedFields) {
			return this._undoStack.save(this._snapshot());
		}
	}

	changeSetDidAddChanges() {
		if (this._destroyed) {
			return;
		}
		if (!this._draft) {
			throw new Error(
				"DraftChangeSet was modified before the draft was prepared.",
			);
		}

		this.changes.applyToModel(this._draft);
		return this.trigger();
	}

	restoreSnapshot(snapshot) {
		if (!snapshot) {
			return;
		}
		this._restoring = true;
		this.changes.add(snapshot.draft);
		if (this._composerViewSelectionRestore) {
			this._composerViewSelectionRestore(snapshot.selection);
		}
		return (this._restoring = false);
	}

	undo() {
		return this.restoreSnapshot(this._undoStack.saveAndUndo(this._snapshot()));
	}

	redo() {
		return this.restoreSnapshot(this._undoStack.redo());
	}

	_snapshot() {
		const snapshot = {
			selection:
				typeof this._composerViewSelectionRetrieve === "function"
					? this._composerViewSelectionRetrieve()
					: undefined,
			draft: Object.assign({}, this.draft()),
		};
		for (var { pluginId, value } of Array.from(snapshot.draft.pluginMetadata)) {
			snapshot.draft[`${MetadataChangePrefix}${pluginId}`] = value;
		}
		delete snapshot.draft.pluginMetadata;
		return snapshot;
	}
}
DraftEditingSession.initClass();

DraftEditingSession.DraftChangeSet = DraftChangeSet;

module.exports = DraftEditingSession;
