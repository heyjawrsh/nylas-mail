import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	if (!Promise.each) Promise.each = (items, fn) => items.reduce((p, item) => p.then(() => fn(item)), Promise.resolve());
	if (!Promise.prototype.thenReturn) Promise.prototype.thenReturn = function thenReturn(value) { return this.then(() => value); };
	return {
		accountForEmail: vi.fn(), applyMetadata: vi.fn(), deletion: vi.fn(), extensions: vi.fn(() => []),
		findBy: vi.fn(), include: vi.fn(), inTransaction: vi.fn(), isForwarded: vi.fn(() => false),
		isValidContact: vi.fn(() => true), mentionsAttachment: vi.fn(() => false), persistModel: vi.fn(),
		listenTo: vi.fn(), stopListening: vi.fn(), trigger: vi.fn(), undoRedo: vi.fn(), undoSave: vi.fn(),
	};
});

vi.mock("../src/flux/models/message.js", () => ({
	default: class Message {
		static attributes = { id: {}, clientId: {}, body: {}, subject: {}, to: {}, cc: {}, bcc: {}, accountId: {} };
		clone() { return Object.assign(Object.create(Object.getPrototypeOf(this)), this); }
		applyPluginMetadata(pluginId, value) { m.applyMetadata(pluginId, value); }
	},
}));
vi.mock("../src/flux/actions.js", () => ({ default: {} }));
vi.mock("../src/flux/nylas-api-helpers.js", () => ({ makeDraftDeletionRequest: m.deletion }));
vi.mock("../src/flux/stores/account-store.js", () => ({ default: { accountForEmail: m.accountForEmail } }));
// contact-store.js exports the store instance as its default, nothing named
vi.mock("../src/flux/stores/contact-store.js", () => ({ default: { isValidContact: m.isValidContact } }));
vi.mock("../src/flux/stores/database-store.js", () => ({ default: { findBy: m.findBy, inTransaction: m.inTransaction } }));
vi.mock("../src/undo-stack.js", () => ({ default: class UndoStack {
	save(value) { return m.undoSave(value); }
	saveAndUndo(value) { return m.undoRedo("undo", value); }
	redo() { return m.undoRedo("redo"); }
} }));
vi.mock("../src/flux/stores/draft-helpers.js", () => ({ default: {
	isForwardedMessage: m.isForwarded, messageMentionsAttachment: m.mentionsAttachment,
} }));
vi.mock("../src/registries/extension-registry.js", () => ({ Composer: { extensions: m.extensions } }));
vi.mock("../src/flux/modules/reflux-coffee.js", () => ({
	Listener: { listenTo(...args) { return m.listenTo(...args); }, stopListeningToAll() { return m.stopListening(); } },
	Publisher: { trigger(...args) { return m.trigger(...args); } },
}));
vi.mock("../src/flux/coffee-helpers.js", () => ({ includeModule(mixin) { Object.assign(this.prototype, mixin); } }));
vi.mock("../src/flux/stores/draft-store.js", () => ({ default: { name: "DraftStoreStub", listen: m.storeListen || (() => ({ dispose: () => {} })), unlisten: () => {} } }));
vi.mock("underscore", () => {
	const exports = {
		extend: (target, ...sources) => Object.assign(target, ...sources),
		filter: (items, predicate) => items.filter(predicate),
		isEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
		pairs: (object) => Object.entries(object),
	};
	return { default: exports, ...exports };
});

import DraftEditingSession from "../src/flux/stores/draft-editing-session.js";
import Message from "../src/flux/models/message.js";

const DraftChangeSet = DraftEditingSession.DraftChangeSet;
const draft = (overrides = {}) => Object.assign(new Message(), {
	clientId: "draft-1", body: "Hello", pristine: false, subject: "Subject", to: [{ email: "to@example.com" }],
	cc: [], bcc: [], files: [], uploads: [], from: [{ email: "me@example.com" }], accountId: "account-1", pluginMetadata: [],
}, overrides);

describe("DraftChangeSet", () => {
	let callbacks;
	let changes;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		callbacks = { onWillAddChanges: vi.fn(), onDidAddChanges: vi.fn(), onCommit: vi.fn().mockResolvedValue(undefined) };
		changes = new DraftChangeSet(callbacks);
	});

	it("notifies before adding changes", () => {
		changes.add({ subject: "New" });
		expect(callbacks.onWillAddChanges).toHaveBeenCalledWith({ subject: "New" });
	});

	it("notifies after adding changes", () => {
		changes.add({ subject: "New" });
		expect(callbacks.onDidAddChanges).toHaveBeenCalledWith({ subject: "New" });
	});

	it("marks ordinary edits non-pristine", () => {
		changes.add({ subject: "New" });
		expect(changes.applyToModel({})).toMatchObject({ subject: "New", pristine: false });
	});

	it("can add an edit without changing pristine", () => {
		changes.add({ subject: "New" }, { doesNotAffectPristine: true });
		expect(changes.applyToModel({})).toEqual({ subject: "New" });
	});

	it("merges later pending fields", () => {
		changes.add({ subject: "New" });
		changes.add({ body: "Body" });
		expect(changes.applyToModel({})).toMatchObject({ subject: "New", body: "Body" });
	});

	it("lets the latest pending value win", () => {
		changes.add({ subject: "First" });
		changes.add({ subject: "Second" });
		expect(changes.applyToModel({}).subject).toBe("Second");
	});

	it("commits pending changes", async () => {
		changes.add({ subject: "New" });
		await changes.commit();
		expect(callbacks.onCommit).toHaveBeenCalledOnce();
	});

	it("does not invoke the commit callback when empty", async () => {
		await changes.commit();
		expect(callbacks.onCommit).not.toHaveBeenCalled();
	});

	it("clears saved changes after a successful commit", async () => {
		changes.add({ subject: "New" });
		await changes.commit();
		expect(changes.applyToModel({})).toEqual({});
	});

	it("keeps edits added while a save is in flight", async () => {
		let finish;
		callbacks.onCommit.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
		changes.add({ subject: "Saving" });
		const saving = changes.commit();
		await Promise.resolve();
		changes.add({ body: "Pending" });
		finish();
		await saving;
		expect(changes.applyToModel({})).toMatchObject({ body: "Pending" });
	});

	it("applies plugin metadata through the model API", () => {
		changes.addPluginMetadata("calendar", { event: 1 });
		changes.applyToModel({ applyPluginMetadata: m.applyMetadata });
		expect(m.applyMetadata).toHaveBeenCalledWith("calendar", { event: 1 });
	});

	it("plugin metadata does not make a draft non-pristine", () => {
		const model = { applyPluginMetadata: vi.fn() };
		changes.addPluginMetadata("calendar", {});
		changes.applyToModel(model);
		expect(model).not.toHaveProperty("pristine");
	});

	it("returns null unchanged", () => {
		changes.add({ subject: "New" });
		expect(changes.applyToModel(null)).toBeNull();
	});

	it("debounces automatic commits for ten seconds", async () => {
		vi.useFakeTimers();
		changes.add({ subject: "One" });
		changes.add({ subject: "Two" });
		await vi.advanceTimersByTimeAsync(9999);
		expect(callbacks.onCommit).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(callbacks.onCommit).toHaveBeenCalledOnce();
	});

	it("teardown discards pending changes", () => {
		changes.add({ subject: "New" });
		changes.teardown();
		expect(changes.applyToModel({})).toEqual({});
	});
});

describe("DraftEditingSession", () => {
	let session;

	beforeEach(async () => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		m.extensions.mockReturnValue([]);
		m.isValidContact.mockReturnValue(true);
		m.isForwarded.mockReturnValue(false);
		m.mentionsAttachment.mockReturnValue(false);
		session = new DraftEditingSession("draft-1", draft());
		await session.prepare();
		vi.clearAllMocks();
	});

	it("returns a clone of the current draft", () => {
		const result = session.draft();
		expect(result).toMatchObject({ clientId: "draft-1", body: "Hello" });
		expect(result).not.toBe(session._draft);
	});

	it("applies pending edits before vending a draft", () => {
		session.changes.add({ subject: "Changed" });
		expect(session.draft().subject).toBe("Changed");
	});

	it("records the initial body for a pristine draft", async () => {
		const pristineSession = new DraftEditingSession("draft-2", draft({ clientId: "draft-2", body: "Initial", pristine: true }));
		await pristineSession.prepare();
		expect(pristineSession.draftPristineBody()).toBe("Initial");
	});

	it("leaves the pristine body null for a previously edited draft", () => {
		expect(session.draftPristineBody()).toBeNull();
	});

	it("rejects a draft without a body", () => {
		expect(() => session._setDraft(draft({ body: null }))).toThrow("new draft has no body");
	});

	it("unapplies extension send transforms before storing a draft", async () => {
		const unapply = vi.fn(({ draftBodyRootNode }) => { draftBodyRootNode.innerHTML = "Clean"; });
		m.extensions.mockReturnValue([{ applyTransformsForSending: vi.fn(), unapplyTransformsForSending: unapply }]);
		await session._setDraft(draft({ body: "Decorated" }));
		expect(session.draft().body).toBe("Clean");
	});

	it("ignores extensions lacking the matching apply transform", async () => {
		const unapply = vi.fn();
		m.extensions.mockReturnValue([{ unapplyTransformsForSending: unapply }]);
		await session._setDraft(draft());
		expect(unapply).not.toHaveBeenCalled();
	});


	it("reports missing recipients as an error", () => {
		session._draft.to = [];
		expect(session.validateDraftForSending().errors[0]).toContain("one or more recipients");
	});

	it("validates every recipient through ContactStore.isValidContact", () => {
		const cc = { email: "cc@example.com" };
		const bcc = { email: "bcc@example.com" };
		session._draft.cc = [cc];
		session._draft.bcc = [bcc];
		expect(session.validateDraftForSending().errors).toEqual([]);
		expect(m.isValidContact.mock.calls.map(([contact]) => contact.email)).toEqual(["to@example.com", "cc@example.com", "bcc@example.com"]);
	});

	it("reports invalid recipients as errors", () => {
		m.isValidContact.mockReturnValue(false);
		expect(session.validateDraftForSending().errors[0]).toContain("to@example.com is not a valid email");
	});

	it("stops validation warnings when recipient errors exist", () => {
		session._draft.to = [];
		session._draft.subject = "";
		expect(session.validateDraftForSending().warnings).toEqual([]);
	});

	it("warns about an empty subject", () => {
		session._draft.subject = "";
		expect(session.validateDraftForSending().warnings).toContain("without a subject line");
	});

	it("warns when attachment language has no attachment", () => {
		m.mentionsAttachment.mockReturnValue(true);
		expect(session.validateDraftForSending().warnings).toContain("without an attachment");
	});

	it("warns when the body still equals its pristine body", () => {
		session._draftPristineBody = "Hello";
		expect(session.validateDraftForSending().warnings).toContain("without a body");
	});

	it("does not warn about an empty body on forwarded mail", () => {
		session._draftPristineBody = "Hello";
		m.isForwarded.mockReturnValue(true);
		expect(session.validateDraftForSending().warnings).not.toContain("without a body");
	});

	it("includes composer extension warnings", () => {
		m.extensions.mockReturnValue([{ warningsForSending: () => ["before sending"] }]);
		expect(session.validateDraftForSending().warnings).toContain("before sending");
	});

	it("rejects sending from an unconfigured account", async () => {
		m.accountForEmail.mockReturnValue(null);
		await expect(session.ensureCorrectAccount()).rejects.toThrow("configured account");
	});

	it("returns itself when the account is already correct", async () => {
		m.accountForEmail.mockReturnValue({ id: "account-1" });
		await expect(session.ensureCorrectAccount()).resolves.toBe(session);
	});

	it("deletes the remote draft when changing accounts", async () => {
		m.accountForEmail.mockReturnValue({ id: "account-2" });
		vi.spyOn(session.changes, "commit").mockResolvedValue(undefined);
		await session.ensureCorrectAccount();
		expect(m.deletion).toHaveBeenCalledWith(session._draft);
	});

	it("clears server identity when changing accounts", async () => {
		m.accountForEmail.mockReturnValue({ id: "account-2" });
		vi.spyOn(session.changes, "commit").mockResolvedValue(undefined);
		await session.ensureCorrectAccount();
		expect(session.draft()).toMatchObject({ accountId: "account-2", version: null, serverId: null, threadId: null, replyToMessageId: null });
	});

	it("throws if edits arrive before preparation", () => {
		session._draft = false;
		expect(() => session.changeSetDidAddChanges()).toThrow("before the draft was prepared");
	});




	it("ignores null draft-store notifications", () => {
		session._onDraftChanged(null);
		expect(m.trigger).not.toHaveBeenCalled();
	});

	it("ignores draft-store notifications for another draft", () => {
		session._onDraftChanged({ objects: [draft({ clientId: "other" })] });
		expect(m.trigger).not.toHaveBeenCalled();
	});

	it("retains the loaded body when a store update omits it", async () => {
		session._onDraftChanged({ objects: [{ clientId: "draft-1", subject: "Remote" }] });
		await Promise.resolve();
		expect(session.draft()).toMatchObject({ body: "Hello", subject: "Remote" });
	});


	it("persists the edited draft in a transaction", async () => {
		const stored = draft({ subject: "Stored" });
		const query = { include: vi.fn().mockResolvedValue(stored) };
		const transaction = { findBy: vi.fn(() => query), persistModel: m.persistModel };
		m.inTransaction.mockImplementation((fn) => fn(transaction));
		session.changes.add({ subject: "Edited" });
		await session.changeSetCommit();
		expect(m.persistModel).toHaveBeenCalledWith(expect.objectContaining({ subject: "Edited" }));
	});

	it("restores draft and selection from a snapshot", () => {
		const restoreSelection = vi.fn();
		session._composerViewSelectionRestore = restoreSelection;
		session.restoreSnapshot({ draft: { subject: "Earlier" }, selection: { start: 2 } });
		expect(session.draft().subject).toBe("Earlier");
		expect(restoreSelection).toHaveBeenCalledWith({ start: 2 });
	});

	it("undo restores the snapshot returned by the undo stack", () => {
		m.undoRedo.mockReturnValue({ draft: { subject: "Undone" } });
		session.undo();
		expect(session.draft().subject).toBe("Undone");
	});

	it("redo restores the snapshot returned by the undo stack", () => {
		m.undoRedo.mockReturnValue({ draft: { subject: "Redone" } });
		session.redo();
		expect(session.draft().subject).toBe("Redone");
	});

	it("flattens plugin metadata into snapshot change keys", () => {
		session._draft.pluginMetadata = [{ pluginId: "calendar", value: { id: 3 } }];
		const snapshot = session._snapshot();
		expect(snapshot.draft["metadata.calendar"]).toEqual({ id: 3 });
		expect(snapshot.draft).not.toHaveProperty("pluginMetadata");
	});
});
