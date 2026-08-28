import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	runSendRequest: vi.fn(), queueTask: vi.fn(), recordUserEvent: vi.fn(),
	deliverySucceeded: vi.fn(), deliveryFailed: vi.fn(), updateAccount: vi.fn(),
	recordPerfMetric: vi.fn(), deleteDraft: vi.fn(), persistModel: vi.fn(),
	inTransaction: vi.fn(), accountForEmail: vi.fn(), accountForId: vi.fn(),
	playSound: vi.fn(), refreshDraft: vi.fn(),
}));

vi.mock("../src/flux/tasks/task.js", () => ({ default: class Task { static Status = { Success: "SUCCESS", Continue: "CONTINUE", Failed: "FAILED" }; } }));
vi.mock("../src/flux/actions.js", () => ({ default: {
	runSendRequest: m.runSendRequest, queueTask: m.queueTask, recordUserEvent: m.recordUserEvent,
	draftDeliverySucceeded: m.deliverySucceeded, draftDeliveryFailed: m.deliveryFailed,
	updateAccount: m.updateAccount, recordPerfMetric: m.recordPerfMetric,
} }));
vi.mock("../src/flux/models/message.js", () => ({ default: class Message {
	constructor() { this.pluginMetadata = []; }
	fromJSON(json) { Object.assign(this, json, { accountId: json.account_id }); return this; }
	clonePluginMetadataFrom(draft) { this.pluginMetadata = draft.pluginMetadata || []; }
} }));
vi.mock("../src/flux/models/account.js", () => ({ default: { SYNC_STATE_AUTH_FAILED: "auth-failed" } }));
vi.mock("../src/flux/nylas-api-helpers.js", () => ({ makeDraftDeletionRequest: m.deleteDraft }));
vi.mock("../src/flux/errors.js", () => ({
	APIError: class APIError extends Error { constructor(message, statusCode, body = {}) { super(message); this.statusCode = statusCode; this.body = body; } },
	RequestEnsureOnceError: class RequestEnsureOnceError extends Error {},
}));
vi.mock("../src/registries/sound-registry.js", () => ({ default: { playSound: m.playSound } }));
vi.mock("../src/flux/stores/database-store.js", () => ({ default: { inTransaction: m.inTransaction } }));
vi.mock("../src/flux/stores/account-store.js", () => ({ default: { accountForEmail: m.accountForEmail, accountForId: m.accountForId } }));
vi.mock("../src/flux/tasks/base-draft-task.js", () => ({ default: class BaseDraftTask {
	static DraftNotFoundError = class DraftNotFoundError extends Error {};
	constructor(draftClientId) { this.draftClientId = draftClientId; }
	performLocal() { return Promise.resolve(); }
	async refreshDraftReference() { this.draft = await m.refreshDraft(this.draftClientId); return this.draft; }
} }));
vi.mock("../src/flux/tasks/syncback-metadata-task.js", () => ({ default: class SyncbackMetadataTask { constructor(...args) { this.args = args; } } }));
vi.mock("../src/flux/tasks/ensure-message-in-sent-folder-task.js", () => ({ default: class EnsureMessageInSentFolderTask { constructor(options) { this.options = options; } } }));

NylasEnv.packages.pluginIdFor.mockImplementation((name) => `${name}-id`);
const { default: SendDraftTask } = await import("../src/flux/tasks/send-draft-task.js");
const { APIError, RequestEnsureOnceError } = await import("../src/flux/errors.js");
const { default: BaseDraftTask } = await import("../src/flux/tasks/base-draft-task.js");

const draft = (overrides = {}) => ({
	accountId: "a1", clientId: "d1", threadId: "t1", body: "body", subject: "Subject",
	from: [{ email: "me@example.com" }], pluginMetadata: [], toJSON: vi.fn(() => ({ subject: "Subject" })),
	participants: vi.fn(() => [{ email: "you@example.com" }]), metadataForPluginId: vi.fn(() => null), ...overrides,
});

beforeEach(() => {
	vi.clearAllMocks();
	NylasEnv.timer = { start: vi.fn(), isPending: vi.fn(() => false), stop: vi.fn(() => 17) };
	NylasEnv.showErrorDialog = vi.fn();
	NylasEnv.reportError = vi.fn();
	NylasEnv.config.get.mockReturnValue(false);
	m.accountForEmail.mockReturnValue({ id: "a1" });
	m.accountForId.mockReturnValue({ id: "a1", provider: "gmail" });
	m.inTransaction.mockImplementation((cb) => cb({ persistModel: m.persistModel }));
	m.persistModel.mockResolvedValue(undefined);
});

describe("SendDraftTask", () => {
	it("stores constructor options", () => {
		const task = new SendDraftTask("d1", { playSound: false, emitError: false, allowMultiSend: false, performRemoteAlreadyCalled: true });
		expect(task).toMatchObject({ draftClientId: "d1", playSound: false, emitError: false, allowMultiSend: false, performRemoteAlreadyCalled: true });
	});

	it("labels itself as sending", () => expect(new SendDraftTask("d1").label()).toBe("Sending message"));

	it("starts a draft-specific timer after local work", async () => {
		const task = new SendDraftTask("d1");
		await task.performLocal();
		expect(NylasEnv.timer.start).toHaveBeenCalledWith("send-draft-d1");
	});

	it("rejects a draft without a from address", async () => {
		const task = new SendDraftTask("d1"); task.draft = draft({ from: [] });
		await expect(task.assertDraftValidity()).rejects.toThrow("populate `from`");
	});

	it("rejects a from address without a configured account", async () => {
		m.accountForEmail.mockReturnValue(null);
		const task = new SendDraftTask("d1"); task.draft = draft();
		await expect(task.assertDraftValidity()).rejects.toThrow("configured account");
	});

	it("rejects when the from account changed", async () => {
		m.accountForEmail.mockReturnValue({ id: "other" });
		const task = new SendDraftTask("d1"); task.draft = draft();
		await expect(task.assertDraftValidity()).rejects.toThrow("from address has changed");
	});

	it("builds a single-body send request", async () => {
		m.runSendRequest.mockImplementation(({ onSuccess }) => onSuccess({ message: { id: "m1", account_id: "a1" } }));
		const task = new SendDraftTask("d1"); task.draft = draft(); task.refreshDraftReference = vi.fn(async () => task.draft);
		await task._sendWithSingleBody();
		expect(m.runSendRequest).toHaveBeenCalledWith(expect.objectContaining({ syncbackRequestJSON: { type: "SendMessage", accountId: "a1", props: { messagePayload: { subject: "Subject" } } } }));
	});

	it("builds per-recipient tracking flags", async () => {
		const d = draft({ metadataForPluginId: vi.fn((id) => id === "open-tracking-id" ? {} : null) });
		m.runSendRequest.mockImplementation(({ onSuccess }) => onSuccess({ message: { id: "m1", account_id: "a1" } }));
		const task = new SendDraftTask("d1"); task.draft = d; task.refreshDraftReference = vi.fn(async () => d);
		await task._sendPerRecipient();
		expect(m.runSendRequest.mock.calls[0][0].syncbackRequestJSON).toEqual({ type: "SendMessagePerRecipient", accountId: "a1", props: { messagePayload: { subject: "Subject" }, usesOpenTracking: true, usesLinkTracking: false } });
	});

	it("uses custom bodies only for two through ten recipients with tracking", () => {
		const task = new SendDraftTask("d1"); task.draft = draft({ participants: () => [{}, {}], metadataForPluginId: () => ({}) });
		expect(task.hasCustomBodyPerRecipient()).toBe(true);
	});

	it("does not use custom bodies for EAS accounts", () => {
		m.accountForId.mockReturnValue({ provider: "eas" });
		const task = new SendDraftTask("d1"); task.draft = draft({ participants: () => [{}, {}], metadataForPluginId: () => ({}) });
		expect(task.hasCustomBodyPerRecipient()).toBe(false);
	});

	it("reports failed recipients but still persists the sent message", async () => {
		const task = new SendDraftTask("d1"); task.draft = draft(); task.refreshDraftReference = vi.fn(async () => task.draft);
		await task._createMessageFromResponse({ failedRecipients: ["bad@example.com"], message: { id: "m1", account_id: "a1" } });
		expect(NylasEnv.showErrorDialog).toHaveBeenCalledWith(expect.stringContaining("bad@example.com"), { showInMainWindow: true });
		expect(m.persistModel).toHaveBeenCalledWith(expect.objectContaining({ id: "m1", clientId: "d1", body: "body", draft: false }));
	});

	it("throws a property-access error when the send response omits the message", async () => {
		const task = new SendDraftTask("d1"); task.draft = draft();
		// The error-message template reads message.subject before the source's
		// explicit missing-message branch can run.
		expect(() => task._createMessageFromResponse({})).toThrow(TypeError);
	});

	it("queues metadata syncback tasks", async () => {
		const task = new SendDraftTask("d1"); task.message = { clientId: "m1", constructor: { name: "Message" }, pluginMetadata: [{ pluginId: "p1" }] };
		await task.updatePluginMetadata();
		expect(m.queueTask.mock.calls[0][0].args).toEqual(["m1", "Message", "p1"]);
	});

	it("records success and deletes the draft", async () => {
		const task = new SendDraftTask("d1"); task.draft = draft(); task.message = { clientId: "d1" };
		await expect(task.onSuccess()).resolves.toBe("SUCCESS");
		expect(m.deliverySucceeded).toHaveBeenCalledWith({ message: task.message, messageClientId: "d1", draftClientId: "d1" });
		expect(m.deleteDraft).toHaveBeenCalledWith(task.draft);
	});

	it("treats a missing draft as continue", async () => {
		const task = new SendDraftTask("d1"); task.draft = draft();
		await expect(task.onError(new BaseDraftTask.DraftNotFoundError())).resolves.toBe("CONTINUE");
	});

	it("uses the uncertain-send warning for ensure-once errors", async () => {
		const task = new SendDraftTask("d1"); task.draft = draft();
		await task.onError(new RequestEnsureOnceError("network"));
		expect(m.deliveryFailed).toHaveBeenCalledWith(expect.objectContaining({ errorMessage: expect.stringContaining("MIGHT have sent") }));
	});

	it("marks SMTP authentication failures on the account", async () => {
		const task = new SendDraftTask("d1"); task.draft = draft();
		await task.onError(new APIError("smtp", 500, { message: "Incorrect SMTP username or password" }));
		expect(m.updateAccount).toHaveBeenCalledWith("a1", { syncState: "auth-failed" });
		expect(m.deliveryFailed).toHaveBeenCalledWith(expect.objectContaining({ errorMessage: expect.stringContaining("authentication error") }));
	});
});
