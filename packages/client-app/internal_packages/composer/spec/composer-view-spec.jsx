/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const _React = require("react");
const ReactDOM = require("react-dom");
const ReactTestUtils = require("react-addons-test-utils");

const {
	Actions,
	Utils,
	File,
	Contact,
	Message,
	Account,
	DraftStore,
	DatabaseStore,
	NylasTestUtils,
	AccountStore,
	FileUploadStore,
	ContactStore,
	FocusedContentStore,
	ComponentRegistry,
} = require("nylas-exports");

const {
	InjectedComponent,
	ParticipantsTextField,
} = require("nylas-component-kit");

const DraftEditingSession = require("../../../src/flux/stores/draft-editing-session");
const ComposerEditor = require("../lib/composer-editor").default;
const Fields = require("../lib/fields").default;

const u1 = new Contact({ name: "Christine Spang", email: "spang@nylas.com" });
const u2 = new Contact({ name: "Michael Grinich", email: "mg@nylas.com" });
const u3 = new Contact({ name: "Evan Morikawa", email: "evan@nylas.com" });
const u4 = new Contact({ name: "Zoë Leiper", email: "zip@nylas.com" });
const u5 = new Contact({ name: "Ben Gotow", email: "ben@nylas.com" });

const f1 = new File({
	id: "file_1_id",
	filename: "a.png",
	contentType: "image/png",
	size: 10,
	object: "file",
});
const f2 = new File({
	id: "file_2_id",
	filename: "b.pdf",
	contentType: "",
	size: 999999,
	object: "file",
});

const users = [u1, u2, u3, u4, u5];

const ComposerView = require("../lib/composer-view").default;

// This will setup the mocks necessary to make the composer element (once
// mounted) think it's attached to the given draft. This mocks out the
// proxy system used by the composer.
const DRAFT_CLIENT_ID = "local-123";

const useDraft = function (draftAttributes) {
	if (draftAttributes == null) {
		draftAttributes = {};
	}
	this.draft = new Message(
		_.extend({ draft: true, body: "" }, draftAttributes),
	);
	this.draft.clientId = DRAFT_CLIENT_ID;
	this.session = new DraftEditingSession(DRAFT_CLIENT_ID, this.draft);
	// spyOn().andCallFake wasn't working properly on ensureCorrectAccount for some reason
	this.session.ensureCorrectAccount = () => Promise.resolve(this.session);
	DraftStore._draftSessions[DRAFT_CLIENT_ID] = this.session;
	return this.session._draftPromise;
};

const useFullDraft = function () {
	return useDraft.call(this, {
		from: [AccountStore.accounts()[0].me()],
		to: [u2],
		cc: [u3, u4],
		bcc: [u5],
		files: [f1, f2],
		subject: "Test Message 1",
		body: "Hello <b>World</b><br/> This is a test",
		replyToMessageId: null,
	});
};

const makeComposer = function (props) {
	if (props == null) {
		props = {};
	}
	this.composer = NylasTestUtils.renderIntoDocument(
		<ComposerView draft={this.draft} session={this.session} {...props} />,
	);
	return advanceClock();
};

describe("ComposerView", () => {
	beforeEach(function () {
		ComposerEditor.containerRequired = false;
		ComponentRegistry.register(ComposerEditor, { role: "Composer:Editor" });

		spyOn(Actions, "queueTask");
		spyOn(Actions, "queueTasks");
		spyOn(DraftStore, "isSendingDraft").andCallThrough();
		spyOn(DraftEditingSession.prototype, "changeSetCommit").andCallFake(
			(draft) => {
				return (this.draft = draft);
			},
		);
		spyOn(ContactStore, "searchContacts").andCallFake((email) => {
			return _.filter(users, u(u.email.toLowerCase() === email.toLowerCase()));
		});
		return spyOn(Contact.prototype, "isValid").andCallFake(function (_contact) {
			return this.email.indexOf("@") > 0;
		});
	});

	afterEach(function () {
		ComposerEditor.containerRequired = undefined;
		ComponentRegistry.unregister(ComposerEditor);
		DraftStore._cleanupAllSessions();
		return NylasTestUtils.removeFromDocument(this.composer);
	});

	describe("when sending a new message", () =>
		it("makes a request with the message contents", function () {
			let sessionSetupComplete = false;
			useDraft.call(this).then(() => {
				return (sessionSetupComplete = true);
			});
			waitsFor(
				() => sessionSetupComplete,
				"The session's draft needs to be set",
				500,
			);
			return runs(() => {
				makeComposer.call(this);
				const editableNode = ReactDOM.findDOMNode(this.composer).querySelector(
					"[contenteditable]",
				);
				spyOn(this.session.changes, "add");
				editableNode.innerHTML = "Hello <strong>world</strong>";
				this.composer.refs[Fields.Body]._onDOMMutated(["mutated"]);
				expect(this.session.changes.add).toHaveBeenCalled();
				expect(this.session.changes.add.calls.length).toBe(1);
				const { body } = this.session.changes.add.calls[0].args[0];
				return expect(body).toBe("Hello <strong>world</strong>");
			});
		}));

	describe("when sending a reply-to message", () => {
		beforeEach(function () {
			let sessionSetupComplete = false;
			useDraft
				.call(this, {
					from: [u1],
					to: [u2],
					subject: "Test Reply Message 1",
					body: "",
					replyToMessageId: "1",
				})
				.then(() => {
					return (sessionSetupComplete = true);
				});
			waitsFor(
				() => sessionSetupComplete,
				"The session's draft needs to be set",
				500,
			);

			return runs(() => {
				makeComposer.call(this);
				this.editableNode = ReactDOM.findDOMNode(this.composer).querySelector(
					"[contenteditable]",
				);
				return spyOn(this.session.changes, "add");
			});
		});

		return it("begins with empty body", function () {
			return expect(this.editableNode.innerHTML).toBe("");
		});
	});

	describe("when sending a forwarded message", () => {
		beforeEach(function () {
			this.fwdBody = `<br><br><blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex;">
---------- Forwarded message ---------
<br><br>
From: Evan Morikawa &lt;evan@evanmorikawa.com&gt;<br>Subject: Test Forward Message 1<br>Date: Sep 3 2015, at 12:14 pm<br>To: Evan Morikawa &lt;evan@nylas.com&gt;
<br><br>

<meta content="text/html; charset=us-ascii">This is a test!
</blockquote>`;

			let sessionSetupComplete = false;
			useDraft
				.call(this, {
					from: [u1],
					to: [u2],
					subject: "Fwd: Test Forward Message 1",
					body: this.fwdBody,
				})
				.then(() => {
					return (sessionSetupComplete = true);
				});
			waitsFor(
				() => sessionSetupComplete,
				"The session's draft needs to be set",
				500,
			);

			return runs(() => {
				makeComposer.call(this);
				this.editableNode = ReactDOM.findDOMNode(this.composer).querySelector(
					"[contenteditable]",
				);
				return spyOn(this.session.changes, "add");
			});
		});

		it("begins with the forwarded message expanded", function () {
			return expect(this.editableNode.innerHTML).toBe(this.fwdBody);
		});

		return it("saves the full new body, plus forwarded text", function () {
			this.editableNode.innerHTML = `Hello <strong>world</strong>${this.fwdBody}`;
			this.composer.refs[Fields.Body]._onDOMMutated(["mutated"]);
			expect(this.session.changes.add).toHaveBeenCalled();
			expect(this.session.changes.add.calls.length).toBe(1);
			const { body } = this.session.changes.add.calls[0].args[0];
			return expect(body).toBe(`Hello <strong>world</strong>${this.fwdBody}`);
		});
	});

	describe("When sending a message", function () {
		beforeEach(function () {
			spyOn(NylasEnv, "isMainWindow").andReturn(true);
			const { remote } = require("electron");
			this.dialog = remote.dialog;
			spyOn(remote, "getCurrentWindow");
			spyOn(this.dialog, "showMessageBox");
			return spyOn(Actions, "sendDraft").andCallThrough();
		});

		it("shows an error if there are no recipients", function () {
			let sessionSetupComplete = false;
			useDraft.call(this, { subject: "no recipients" }).then(() => {
				return (sessionSetupComplete = true);
			});
			waitsFor(
				() => sessionSetupComplete,
				"The session's draft needs to be set",
				500,
			);
			return runs(() => {
				makeComposer.call(this);
				const status = this.composer._isValidDraft();
				expect(status).toBe(false);
				expect(this.dialog.showMessageBox).toHaveBeenCalled();
				const dialogArgs = this.dialog.showMessageBox.mostRecentCall.args[1];
				expect(dialogArgs.detail).toEqual(
					"You need to provide one or more recipients before sending the message.",
				);
				return expect(dialogArgs.buttons).toEqual(["Edit Message", "Cancel"]);
			});
		});

		it("shows an error if a recipient is invalid", function () {
			let sessionSetupComplete = false;
			useDraft
				.call(this, {
					subject: "hello world!",
					to: [new Contact({ email: "lol", name: "lol" })],
				})
				.then(() => {
					return (sessionSetupComplete = true);
				});
			waitsFor(
				() => sessionSetupComplete,
				"The session's draft needs to be set",
				500,
			);
			return runs(() => {
				makeComposer.call(this);
				const status = this.composer._isValidDraft();
				expect(status).toBe(false);
				expect(this.dialog.showMessageBox).toHaveBeenCalled();
				const dialogArgs = this.dialog.showMessageBox.mostRecentCall.args[1];
				expect(dialogArgs.detail).toEqual(
					"lol is not a valid email address - please remove or edit it before sending.",
				);
				return expect(dialogArgs.buttons).toEqual(["Edit Message", "Cancel"]);
			});
		});

		describe("empty body warning", () => {
			it("warns if the body of the email is still the pristine body", function () {
				const pristineBody = "<br><br>";
				let sessionSetupComplete = false;
				useDraft
					.call(this, {
						to: [u1],
						subject: "Hello World",
						body: pristineBody,
					})
					.then(() => {
						return (sessionSetupComplete = true);
					});
				waitsFor(
					() => sessionSetupComplete,
					"The session's draft needs to be set",
					500,
				);

				return runs(() => {
					makeComposer.call(this);
					spyOn(this.session, "draftPristineBody").andCallFake(
						() => pristineBody,
					);

					const status = this.composer._isValidDraft();
					expect(status).toBe(false);
					expect(this.dialog.showMessageBox).toHaveBeenCalled();
					const dialogArgs = this.dialog.showMessageBox.mostRecentCall.args[1];
					return expect(dialogArgs.buttons).toEqual(["Send Anyway", "Cancel"]);
				});
			});

			it("does not warn if the body of the email is all quoted text, but the email is a forward", function () {
				let sessionSetupComplete = false;
				useDraft
					.call(this, {
						to: [u1],
						subject: "Fwd: Hello World",
						body: "<br><br><blockquote class='gmail_quote'>This is my quoted text!</blockquote>",
					})
					.then(() => {
						return (sessionSetupComplete = true);
					});
				waitsFor(
					() => sessionSetupComplete,
					"The session's draft needs to be set",
					500,
				);
				return runs(() => {
					makeComposer.call(this);
					const status = this.composer._isValidDraft();
					return expect(status).toBe(true);
				});
			});

			return it("does not warn if the user has attached a file", function () {
				let sessionSetupComplete = false;
				useDraft
					.call(this, {
						to: [u1],
						subject: "Hello World",
						body: "",
						files: [f1],
					})
					.then(() => {
						return (sessionSetupComplete = true);
					});
				waitsFor(
					() => sessionSetupComplete,
					"The session's draft needs to be set",
					500,
				);

				return runs(() => {
					makeComposer.call(this);
					const status = this.composer._isValidDraft();
					expect(status).toBe(true);
					return expect(this.dialog.showMessageBox).not.toHaveBeenCalled();
				});
			});
		});

		it("shows a warning if there's no subject", function () {
			let sessionSetupComplete = false;
			useDraft.call(this, { to: [u1], subject: "" }).then(() => {
				return (sessionSetupComplete = true);
			});
			waitsFor(
				() => sessionSetupComplete,
				"The session's draft needs to be set",
				500,
			);
			return runs(() => {
				makeComposer.call(this);
				const status = this.composer._isValidDraft();
				expect(status).toBe(false);
				expect(this.dialog.showMessageBox).toHaveBeenCalled();
				const dialogArgs = this.dialog.showMessageBox.mostRecentCall.args[1];
				return expect(dialogArgs.buttons).toEqual(["Send Anyway", "Cancel"]);
			});
		});

		it("doesn't show a warning if requirements are satisfied", function () {
			let sessionSetupComplete = false;
			useFullDraft.apply(this).then(() => {
				return (sessionSetupComplete = true);
			});
			waitsFor(
				() => sessionSetupComplete,
				"The session's draft needs to be set",
				500,
			);
			return runs(() => {
				makeComposer.call(this);
				const status = this.composer._isValidDraft();
				expect(status).toBe(true);
				return expect(this.dialog.showMessageBox).not.toHaveBeenCalled();
			});
		});

		describe("Checking for attachments", () => {
			const warn = function (body) {
				let sessionSetupComplete = false;
				useDraft.call(this, { subject: "Subject", to: [u1], body }).then(() => {
					return (sessionSetupComplete = true);
				});
				waitsFor(
					() => sessionSetupComplete,
					"The session's draft needs to be set",
					500,
				);
				return runs(() => {
					makeComposer.call(this);
					const status = this.composer._isValidDraft();
					expect(status).toBe(false);
					expect(this.dialog.showMessageBox).toHaveBeenCalled();
					const dialogArgs = this.dialog.showMessageBox.mostRecentCall.args[1];
					return expect(dialogArgs.buttons).toEqual(["Send Anyway", "Cancel"]);
				});
			};

			const noWarn = function (body) {
				let sessionSetupComplete = false;
				useDraft.call(this, { subject: "Subject", to: [u1], body }).then(() => {
					return (sessionSetupComplete = true);
				});
				waitsFor(
					() => sessionSetupComplete,
					"The session's draft needs to be set",
					500,
				);
				return runs(() => {
					makeComposer.call(this);
					const status = this.composer._isValidDraft();
					expect(status).toBe(true);
					return expect(this.dialog.showMessageBox).not.toHaveBeenCalled();
				});
			};

			it("warns", function () {
				return warn.call(this, "Check out the attached file");
			});
			it("warns", function () {
				return warn.call(this, "I've added an attachment");
			});
			it("warns", function () {
				return warn.call(this, "I'm going to attach the file");
			});
			it("warns", function () {
				return warn.call(
					this,
					"Hey attach me <blockquote class='gmail_quote'>sup</blockquote>",
				);
			});

			it("doesn't warn", function () {
				return noWarn.call(this, "sup yo");
			});
			it("doesn't warn", function () {
				return noWarn.call(this, "Look at the file");
			});
			return it("doesn't warn", function () {
				return noWarn.call(
					this,
					"Hey there <blockquote class='gmail_quote'>attach</blockquote>",
				);
			});
		});

		it("doesn't show a warning if you've attached a file", function () {
			let sessionSetupComplete = false;
			useDraft
				.call(this, {
					subject: "Subject",
					to: [u1],
					body: "Check out attached file",
					files: [f1],
				})
				.then(() => {
					return (sessionSetupComplete = true);
				});
			waitsFor(
				() => sessionSetupComplete,
				"The session's draft needs to be set",
				500,
			);
			return runs(() => {
				makeComposer.call(this);
				const status = this.composer._isValidDraft();
				expect(status).toBe(true);
				return expect(this.dialog.showMessageBox).not.toHaveBeenCalled();
			});
		});

		it("bypasses the warning if force bit is set", function () {
			let sessionSetupComplete = false;
			useDraft.call(this, { to: [u1], subject: "" }).then(() => {
				return (sessionSetupComplete = true);
			});
			waitsFor(
				() => sessionSetupComplete,
				"The session's draft needs to be set",
				500,
			);
			return runs(() => {
				makeComposer.call(this);
				const status = this.composer._isValidDraft({ force: true });
				expect(status).toBe(true);
				return expect(this.dialog.showMessageBox).not.toHaveBeenCalled();
			});
		});

		it("sends when you click the send button", function () {
			let sessionSetupComplete = false;
			useFullDraft.apply(this).then(() => {
				return (sessionSetupComplete = true);
			});
			waitsFor(
				() => sessionSetupComplete,
				"The session's draft needs to be set",
				500,
			);
			return runs(() => {
				makeComposer.call(this);
				const sendBtn = this.composer.refs.sendActionButton;
				sendBtn.primarySend();
				expect(Actions.sendDraft).toHaveBeenCalledWith(DRAFT_CLIENT_ID, "send");
				expect(Actions.sendDraft.calls.length).toBe(1);
				// Delete the draft from _draftsSending so we can send it in other tests
				return delete DraftStore._draftsSending[DRAFT_CLIENT_ID];
			});
		});

		it("doesn't send twice if you double click", () => {
			let sessionSetupComplete = false;
			useFullDraft.apply(this).then(() => {
				return (sessionSetupComplete = true);
			});
			waitsFor(
				() => sessionSetupComplete,
				"The session's draft needs to be set",
				500,
			);
			return runs(() => {
				makeComposer.call(this);
				const sendBtn = this.composer.refs.sendActionButton;
				sendBtn.primarySend();
				sendBtn.primarySend();
				expect(Actions.sendDraft).toHaveBeenCalledWith(DRAFT_CLIENT_ID, "send");
				expect(Actions.sendDraft.calls.length).toBe(1);
				// Delete the draft from _draftsSending so we can send it in other tests
				return delete DraftStore._draftsSending[DRAFT_CLIENT_ID];
			});
		});

		return describe("when sending a message with keyboard inputs", () => {
			beforeEach(function () {
				let sessionSetupComplete = false;
				return useFullDraft.apply(this).then(() => {
					makeComposer.call(this);
					this.$composer = this.composer.refs.composerWrap;
					sessionSetupComplete = true;
					return waitsFor(
						() => sessionSetupComplete,
						"The session's draft needs to be set",
						500,
					);
				});
			});

			afterEach(
				() =>
					// Delete the draft from _draftsSending so we can send it in other tests
					delete DraftStore._draftsSending[DRAFT_CLIENT_ID],
			);

			it("sends the draft on cmd-enter", function () {
				ReactDOM.findDOMNode(this.$composer).dispatchEvent(
					new CustomEvent("composer:send-message"),
				);
				expect(Actions.sendDraft).toHaveBeenCalledWith(DRAFT_CLIENT_ID, "send");
				return expect(Actions.sendDraft.calls.length).toBe(1);
			});

			return it("doesn't let you send twice", function () {
				ReactDOM.findDOMNode(this.$composer).dispatchEvent(
					new CustomEvent("composer:send-message"),
				);
				expect(Actions.sendDraft).toHaveBeenCalledWith(DRAFT_CLIENT_ID, "send");
				expect(Actions.sendDraft.calls.length).toBe(1);
				ReactDOM.findDOMNode(this.$composer).dispatchEvent(
					new CustomEvent("composer:send-message"),
				);
				expect(Actions.sendDraft).toHaveBeenCalledWith(DRAFT_CLIENT_ID, "send");
				return expect(Actions.sendDraft.calls.length).toBe(1);
			});
		});
	});

	describe("drag and drop", () => {
		beforeEach(function () {
			let sessionSetupComplete = false;
			useDraft
				.call(this, {
					to: [u1],
					subject: "Hello World",
					body: "",
					files: [f1],
				})
				.then(() => {
					makeComposer.call(this);
					return (sessionSetupComplete = true);
				});
			return waitsFor(
				() => sessionSetupComplete,
				"The session's draft needs to be set",
				500,
			);
		});

		describe("_shouldAcceptDrop", () => {
			it("should return true if the event is carrying native files", function () {
				const event = {
					dataTransfer: {
						files: [{ pretend: "imafile" }],
						types: [],
					},
				};
				return expect(this.composer._shouldAcceptDrop(event)).toBe(true);
			});

			it("should return true if the event is carrying a non-native file URL", function () {
				const event = {
					dataTransfer: {
						files: [],
						types: ["text/uri-list"],
					},
				};
				spyOn(this.composer, "_nonNativeFilePathForDrop").andReturn(
					"file://one-file",
				);

				expect(this.composer._shouldAcceptDrop(event)).toBe(true);
				return expect(this.draft.files.length).toBe(1);
			});

			return it("should return false otherwise", function () {
				const event = {
					dataTransfer: {
						files: [],
						types: ["text/plain"],
					},
				};
				return expect(this.composer._shouldAcceptDrop(event)).toBe(false);
			});
		});

		return describe("_nonNativeFilePathForDrop", () => {
			it("should return a path in the text/nylas-file-url data", function () {
				const event = {
					dataTransfer: {
						types: ["text/nylas-file-url"],
						getData() {
							return "image/png:test.png:file:///Users/bengotow/Desktop/test.png";
						},
					},
				};
				return expect(this.composer._nonNativeFilePathForDrop(event)).toBe(
					"/Users/bengotow/Desktop/test.png",
				);
			});

			it("should return a path in the text/uri-list data", function () {
				const event = {
					dataTransfer: {
						types: ["text/uri-list"],
						getData() {
							return "file:///Users/bengotow/Desktop/test.png";
						},
					},
				};
				return expect(this.composer._nonNativeFilePathForDrop(event)).toBe(
					"/Users/bengotow/Desktop/test.png",
				);
			});

			it("should return null otherwise", function () {
				const event = {
					dataTransfer: {
						types: ["text/plain"],
						getData() {
							return "Hello world";
						},
					},
				};
				return expect(this.composer._nonNativeFilePathForDrop(event)).toBe(
					null,
				);
			});

			it("should urldecode the contents of the text/uri-list field", function () {
				const event = {
					dataTransfer: {
						types: ["text/uri-list"],
						getData() {
							return "file:///Users/bengotow/Desktop/Screen%20shot.png";
						},
					},
				};
				return expect(this.composer._nonNativeFilePathForDrop(event)).toBe(
					"/Users/bengotow/Desktop/Screen shot.png",
				);
			});

			it("should return null if text/uri-list contains a non-file path", function () {
				const event = {
					dataTransfer: {
						types: ["text/uri-list"],
						getData() {
							return "http://apple.com";
						},
					},
				};
				return expect(this.composer._nonNativeFilePathForDrop(event)).toBe(
					null,
				);
			});

			return it("should return null if text/nylas-file-url contains a non-file path", function () {
				const event = {
					dataTransfer: {
						types: ["text/nylas-file-url"],
						getData() {
							return "application/json:filename.json:undefined";
						},
					},
				};
				return expect(this.composer._nonNativeFilePathForDrop(event)).toBe(
					null,
				);
			});
		});
	});

	return describe("A draft with files (attachments) and uploads", () => {
		beforeEach(function () {
			this.file1 = new File({
				id: "f_1",
				filename: "f1.pdf",
				size: 1230,
			});

			this.file2 = new File({
				id: "f_2",
				filename: "f2.jpg",
				size: 4560,
			});

			this.file3 = new File({
				id: "f_3",
				filename: "f3.png",
				size: 7890,
			});

			spyOn(Actions, "fetchFile");

			let sessionSetupComplete = false;
			useDraft.call(this, { files: [this.file1, this.file2] }).then(() => {
				makeComposer.call(this);
				return (sessionSetupComplete = true);
			});
			return waitsFor(
				() => sessionSetupComplete,
				"The session's draft needs to be set",
				500,
			);
		});

		it("starts fetching attached files", () => {
			waitsFor(() => Actions.fetchFile.callCount === 1);
			return runs(function () {
				expect(Actions.fetchFile).toHaveBeenCalled();
				expect(Actions.fetchFile.calls.length).toBe(1);
				return expect(Actions.fetchFile.calls[0].args[0]).toBe(this.file2);
			});
		});

		return it("injects a MessageAttachments component for any present attachments", function () {
			const els = ReactTestUtils.scryRenderedComponentsWithTypeAndProps(
				this.composer,
				InjectedComponent,
				{ matching: { role: "MessageAttachments" } },
			);
			expect(els.length).toBe(1);
			const el = els[0];
			return expect(el.props.exposedProps.files).toEqual(this.draft.files);
		});
	});
});

describe("when a file is received (via drag and drop or paste)", () => {
	beforeEach(function () {
		let sessionSetupComplete = false;
		useDraft.call(this).then(() => {
			return (sessionSetupComplete = true);
		});
		waitsFor(
			() => sessionSetupComplete,
			"The session's draft needs to be set",
			500,
		);
		return runs(() => {
			makeComposer.call(this);
			this.upload = {
				targetPath: "a/f.txt",
				size: 1000,
				name: "f.txt",
				id: "f",
			};
			spyOn(Actions, "addAttachment").andCallFake(
				({ filePath, messageClientId, onUploadCreated }) => {
					this.draft.uploads.push(this.upload);
					return onUploadCreated(this.upload);
				},
			);
			return spyOn(Actions, "insertAttachmentIntoDraft");
		});
	});

	it("should call addAttachment with the path and clientId", function () {
		this.composer._onFileReceived("../../f.txt");
		expect(Actions.addAttachment.callCount).toBe(1);
		return expect(Object.keys(Actions.addAttachment.calls[0].args[0])).toEqual([
			"filePath",
			"messageClientId",
			"onUploadCreated",
		]);
	});

	return it("should call insertAttachmentIntoDraft if the upload looks like an image", function () {
		this.upload = { targetPath: "a/f.txt", size: 1000, name: "f.txt", id: "f" };
		this.composer._onFileReceived("../../f.txt");
		advanceClock();
		expect(Actions.insertAttachmentIntoDraft).not.toHaveBeenCalled();
		expect(this.upload.inline).not.toEqual(true);

		this.upload = { targetPath: "a/f.png", size: 1000, name: "f.png", id: "g" };
		expect(Utils.shouldDisplayAsImage(this.upload)).toBe(true); // sanity check

		this.composer._onFileReceived("../../f.png");
		advanceClock();
		expect(Actions.insertAttachmentIntoDraft).toHaveBeenCalled();
		return expect(this.upload.inline).toEqual(true);
	});
});
