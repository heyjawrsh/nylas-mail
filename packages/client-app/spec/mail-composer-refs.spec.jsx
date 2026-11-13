// The composer and its plugins after findDOMNode and string refs: reply focus
// lands in the body, header fields by callback ref, the editor's
// contenteditable by object ref, and toolbar buttons that measure themselves.
// Modules load through the package loader with stubbed stores and kit.
import path from "node:path";
import { act, fireEvent, render } from "@testing-library/react";
import classnames from "classnames";
import PropTypes from "prop-types";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import underscore from "underscore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ListensToFluxStore from "../src/components/decorators/listens-to-flux-store.jsx";
import { createPackageLoader } from "./helpers/load-package-module.js";

const pkg = (rel) => path.join(__dirname, "..", "internal_packages", rel);

class RootedComponent extends React.Component {
	root = React.createRef();
	getDOMNode() {
		return this.root.current;
	}
	render() {
		return (
			<div ref={this.root} className={this.props.className}>
				{this.props.children}
			</div>
		);
	}
}
const Passthrough = ({ children }) => <div>{children}</div>;
const Nothing = () => null;
const FakeRetinaImg = () => null;
FakeRetinaImg.Mode = { ContentIsMask: "mask", ContentPreserve: "preserve" };

const base = {
	react: React,
	"react/jsx-runtime": jsxRuntime,
	"prop-types": PropTypes,
	classnames,
	underscore,
};

describe("ComposerView", () => {
	let ComposerView;
	let header;
	let injected;
	let actions;

	beforeEach(() => {
		injected = {};
		actions = { recordPerfMetric: vi.fn(), fetchFile: vi.fn(), destroyDraft: vi.fn() };
		class FakeHeader extends RootedComponent {
			constructor(props) {
				super(props);
				header = this;
				this.focused = false;
				this.isFocused = () => this.focused;
				this.focus = vi.fn();
				this.showAndFocusField = vi.fn();
			}
		}
		// Stands in for InjectedComponent, which exposes its requiredMethods.
		class FakeInjected extends RootedComponent {
			constructor(props) {
				super(props);
				injected[props.matching.role] = this;
				for (const method of props.requiredMethods || []) {
					this[method] = vi.fn();
				}
			}
		}
		NylasEnv.isComposerWindow = () => false;
		NylasEnv.timer = { isPending: () => false };
		const load = createPackageLoader({
			...base,
			"@electron/remote": { dialog: {}, getCurrentWindow: () => ({}) },
			"nylas-exports": {
				Utils: { shouldDisplayAsImage: () => false },
				Actions: actions,
				DraftStore: { isSendingDraft: () => false },
				DraftHelpers: { isForwardedMessage: () => false, shouldAppendQuotedText: () => false },
			},
			"nylas-component-kit": {
				DropZone: Passthrough,
				RetinaImg: FakeRetinaImg,
				ScrollRegion: Passthrough,
				TabGroupRegion: Passthrough,
				AttachmentItem: Nothing,
				InjectedComponent: FakeInjected,
				KeyCommandsRegion: RootedComponent,
				OverlaidComponents: Passthrough,
				ImageAttachmentItem: Nothing,
				InjectedComponentSet: Nothing,
			},
			"./composer-editor": { default: Nothing },
			"./composer-header": { default: FakeHeader },
			"./send-action-button": { default: Nothing },
			"./action-bar-plugins": { default: Nothing },
		});
		ComposerView = load(pkg("composer/lib/composer-view.jsx")).default;
	});

	afterEach(() => {
		delete NylasEnv.isComposerWindow;
		delete NylasEnv.timer;
	});

	const draft = { clientId: "d1", to: [{ email: "ben@fixture.test" }], files: [], uploads: [], body: "" };
	const session = { changes: { add: vi.fn() } };
	const renderComposer = () => {
		const ref = React.createRef();
		const view = render(<ComposerView ref={ref} className="draft" draft={draft} session={session} />);
		return { ...view, composer: ref.current };
	};

	it("puts focus in the body for a reply whose header isn't focused", () => {
		const { composer } = renderComposer();
		composer.focus();
		expect(injected["Composer:Editor"].focus).toHaveBeenCalled();
		expect(header.focus).not.toHaveBeenCalled();
	});

	it("keeps focus in the header when the header has it", () => {
		const { composer } = renderComposer();
		header.focused = true;
		composer.focus();
		expect(header.focus).toHaveBeenCalled();
		expect(injected["Composer:Editor"].focus).not.toHaveBeenCalled();
	});

	it("hands over its root node", () => {
		const { composer, container } = renderComposer();
		expect(composer.getDOMNode()).toBe(container.firstChild);
		expect(composer.getDOMNode().className).toBe("draft");
	});

	it("measures the composer wrap for the editor's scrolling", () => {
		const { composer } = renderComposer();
		expect(composer._getComposerBoundingRect()).toEqual(
			expect.objectContaining({ top: 0, height: 0 }),
		);
	});

	it("focuses the body's start or end on a click below or above it", () => {
		const { composer, container } = renderComposer();
		const body = injected["Composer:Editor"];
		body.getDOMNode().getBoundingClientRect = () => ({ top: 100 });
		const outside = container.querySelector(".compose-body");
		fireEvent.mouseDown(outside);
		fireEvent.mouseUp(outside, { clientY: 200 });
		expect(body.focusAbsoluteEnd).toHaveBeenCalled();
		fireEvent.mouseDown(outside);
		fireEvent.mouseUp(outside, { clientY: 50 });
		expect(body.focus).toHaveBeenCalled();
		expect(composer._mouseDownTarget).toBeNull();
	});

	it("ignores a mouse down inside the body", () => {
		const { composer } = renderComposer();
		const node = injected["Composer:Editor"].getDOMNode();
		fireEvent.mouseDown(node);
		expect(composer._mouseDownTarget).toBeNull();
	});

	it("sends through the send button's primarySend, and shows a field through the header", () => {
		const { composer } = renderComposer();
		const handlers = composer._keymapHandlers();
		handlers["composer:send-message"]();
		expect(injected["Composer:SendActionButton"].primarySend).toHaveBeenCalled();
		handlers["composer:show-and-focus-cc"]();
		expect(header.showAndFocusField).toHaveBeenCalledWith("textFieldCc");
	});

	it("saves and restores the body's selection for undo", () => {
		renderComposer();
		const body = injected["Composer:Editor"];
		body.getPreviousSelection.mockReturnValue("sel");
		expect(session._composerViewSelectionRetrieve()).toBe("sel");
		session._composerViewSelectionRestore("other");
		expect(body.setSelection).toHaveBeenCalledWith("other");
	});
});

describe("ComposerHeader", () => {
	let ComposerHeader;
	let fields;
	let subject;
	const shiftFocus = vi.fn();

	beforeEach(() => {
		fields = {};
		class FakeParticipantsField extends RootedComponent {
			constructor(props) {
				super(props);
				fields[props.field] = this;
				this.focus = vi.fn();
			}
			render() {
				return (
					<div ref={this.root}>
						<input className={`${this.props.field}-input`} />
					</div>
				);
			}
		}
		class FakeSubject extends RootedComponent {
			constructor(props) {
				super(props);
				subject = this;
				this.focus = vi.fn();
			}
		}
		const TabGroupContext = React.createContext({ parentTabGroup: { shiftFocus } });
		const load = createPackageLoader({
			...base,
			"nylas-exports": {
				Utils: {
					waitFor: (fn) => (fn() ? Promise.resolve() : Promise.reject(new Error("never"))),
				},
				DraftHelpers: { isForwardedMessage: () => false },
				Actions: { draftParticipantsChanged: vi.fn() },
				AccountStore: { accountForId: () => null, accounts: () => [] },
			},
			"nylas-component-kit": {
				InjectedComponent: FakeSubject,
				KeyCommandsRegion: RootedComponent,
				ParticipantsTextField: FakeParticipantsField,
				ListensToFluxStore: (C) => C,
				TabGroupContext,
			},
			"./account-contact-field": { default: Nothing },
			"./collapsed-participants": { default: Nothing },
			"./composer-header-actions": { default: Nothing },
			"./subject-text-field": { default: Nothing },
		});
		ComposerHeader = load(pkg("composer/lib/composer-header.jsx")).default;
	});

	const renderHeader = (draftOverrides = {}) => {
		const ref = React.createRef();
		const draft = { clientId: "d1", to: [], cc: [], bcc: [], from: [{}], subject: "", ...draftOverrides };
		render(<ComposerHeader ref={ref} draft={draft} session={{ changes: { add: vi.fn() } }} initiallyFocused />);
		return ref.current;
	};

	it("focuses a field by name once it renders", async () => {
		const header = renderHeader();
		await act(async () => {
			header.showAndFocusField("textFieldTo");
		});
		expect(fields.to.focus).toHaveBeenCalled();
	});

	it("focuses the subject field when the subject had focus", () => {
		const header = renderHeader();
		act(() => header.setState({ subjectFocused: true }));
		header.focus();
		expect(subject.focus).toHaveBeenCalled();
	});

	it("remembers which participant field had focus", () => {
		const header = renderHeader({ cc: [{ email: "c@x" }] });
		act(() => header._onFocusOutParticipants(fields.cc.getDOMNode().querySelector("input")));
		expect(header.state.participantsLastActiveField).toBe("textFieldCc");
	});

	it("moves focus back before hiding the field that has it", () => {
		const header = renderHeader({ cc: [{ email: "c@x" }] });
		fields.cc.getDOMNode().querySelector("input").focus();
		act(() => header.hideField("textFieldCc"));
		expect(shiftFocus).toHaveBeenCalledWith(-1);
		expect(header.state.enabledFields).not.toContain("textFieldCc");
	});
});

describe("ComposerEditor", () => {
	let ComposerEditor;
	let contenteditable;

	beforeEach(() => {
		class FakeContenteditable extends React.Component {
			constructor(props) {
				super(props);
				contenteditable = this;
				this.rootNode = document.createElement("div");
				this.rootNode.tabIndex = 0;
				document.body.appendChild(this.rootNode);
				this.getPreviousSelection = vi.fn(() => "previous");
				this.setSelection = vi.fn();
				this._onDrop = vi.fn();
			}
			atomicEdit(fn) {
				fn({ editor: { rootNode: this.rootNode } });
			}
			render() {
				return null;
			}
		}
		const load = createPackageLoader({
			...base,
			"nylas-exports": {
				ExtensionRegistry: { Composer: { extensions: () => [], listen: () => () => {} } },
				DOMUtils: { lastNonBlankChildNode: () => null },
			},
			"nylas-component-kit": {
				DropZone: Passthrough,
				ScrollRegion: { ScrollPosition: {} },
				Contenteditable: FakeContenteditable,
			},
		});
		ComposerEditor = load(pkg("composer/lib/composer-editor.jsx")).default;
	});

	it("focuses the contenteditable's root through its ref", () => {
		const ref = React.createRef();
		render(<ComposerEditor ref={ref} body="" />);
		ref.current.focusAbsoluteEnd();
		expect(document.activeElement).toBe(contenteditable.rootNode);
	});

	it("passes selection and drop calls to the contenteditable", () => {
		const ref = React.createRef();
		render(<ComposerEditor ref={ref} body="" />);
		expect(ref.current.getPreviousSelection()).toBe("previous");
		ref.current.setSelection("s");
		expect(contenteditable.setSelection).toHaveBeenCalledWith("s");
		ref.current._onDrop("event");
		expect(contenteditable._onDrop).toHaveBeenCalledWith("event");
	});
});

describe("small composer pieces", () => {
	it("SubjectTextField focuses its input", () => {
		const load = createPackageLoader(base);
		const SubjectTextField = load(pkg("composer/lib/subject-text-field.jsx")).default;
		const ref = React.createRef();
		const { container } = render(<SubjectTextField ref={ref} value="Re: hi" onSubjectChange={() => {}} />);
		ref.current.focus();
		expect(document.activeElement).toBe(container.querySelector("input"));
	});

	it("the send button exposes primarySend through ListensToFluxStore", () => {
		const sendDraft = vi.fn();
		const load = createPackageLoader({
			...base,
			"nylas-exports": {
				Actions: { sendDraft },
				SendActionsStore: {
					availableSendActionsForDraft: () => [{ configKey: "send", title: "Send" }],
					orderedSendActionsForDraft: () => ({ preferred: { configKey: "send", title: "Send" }, rest: [] }),
					listen: () => () => {},
				},
			},
			"nylas-component-kit": {
				Menu: Nothing,
				RetinaImg: FakeRetinaImg,
				ButtonDropdown: Nothing,
				ListensToFluxStore,
			},
		});
		const SendActionButton = load(pkg("composer/lib/send-action-button.jsx")).default;
		const ref = React.createRef();
		render(<SendActionButton ref={ref} draft={{ clientId: "d1" }} isValidDraft={() => true} />);
		ref.current.primarySend();
		expect(sendDraft).toHaveBeenCalledWith("d1", "send");
	});

	it("CollapsedParticipants measures its wrap on mount", () => {
		const load = createPackageLoader({
			...base,
			"nylas-exports": { Utils: { isEqualReact: () => false } },
			"nylas-component-kit": { DropZone: Passthrough, InjectedComponentSet: Nothing },
		});
		const CollapsedParticipants = load(pkg("composer/lib/collapsed-participants.jsx")).default;
		const { container } = render(<CollapsedParticipants to={[]} cc={[]} bcc={[]} />);
		expect(container.querySelector(".collapsed-composer-participants")).not.toBeNull();
	});
});

describe("composer toolbar buttons open their popover from their own rect", () => {
	let openPopover;
	const rect = { top: 1, left: 2, width: 30, height: 20 };

	beforeEach(() => {
		openPopover = vi.fn();
	});

	const clickAndCheck = (Button, props, selector) => {
		const { container } = render(<Button {...props} />);
		const button = container.querySelector(selector);
		button.getBoundingClientRect = () => rect;
		fireEvent.click(button);
		expect(openPopover).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ originRect: rect }));
	};

	it("EmojiButton", () => {
		const load = createPackageLoader({
			...base,
			"nylas-exports": { Actions: { openPopover }, React },
			"nylas-component-kit": { RetinaImg: FakeRetinaImg },
			"./emoji-button-popover": { default: Nothing },
		});
		clickAndCheck(load(pkg("composer-emoji/lib/emoji-button.jsx")).default, {}, ".btn-emoji");
	});

	it("TemplatePicker", () => {
		const load = createPackageLoader({
			...base,
			"nylas-exports": { Actions: { openPopover }, React },
			"nylas-component-kit": { Menu: Nothing, RetinaImg: FakeRetinaImg },
			"./template-store": { default: { items: () => [], listen: () => () => {} } },
		});
		const exported = load(pkg("composer-templates/lib/template-picker.jsx"));
		clickAndCheck(exported.default, { draftClientId: "d1" }, ".btn-templates");
	});

	it("TranslateButton", () => {
		let TranslateButton;
		const load = createPackageLoader({
			...base,
			request: {},
			"nylas-exports": {
				React,
				Actions: { openPopover },
				ComponentRegistry: {
					register: (component) => {
						TranslateButton = component;
					},
				},
				QuotedHTMLTransformer: {},
			},
			"nylas-component-kit": { Menu: Nothing, RetinaImg: FakeRetinaImg },
		});
		load(pkg("composer-translate/lib/main.jsx")).activate();
		clickAndCheck(TranslateButton, { draft: {}, session: {} }, ".btn-translate");
	});
});

describe("mail merge", () => {
	it("ListensToMailMergeSession focuses the wrapped field through its ref", () => {
		const load = createPackageLoader({
			...base,
			"./mail-merge-draft-editing-session": { mailMergeSessionForDraft: () => ({ state: {}, listen: () => () => {} }) },
		});
		const ListensToMailMergeSession = load(pkg("composer-mail-merge/lib/listens-to-mail-merge-session.jsx")).default;
		const focus = vi.fn();
		class Field extends React.Component {
			focus = focus;
			render() {
				return null;
			}
		}
		const Wrapped = ListensToMailMergeSession(Field);
		const ref = React.createRef();
		render(<Wrapped ref={ref} draftClientId="d1" session={{}} />);
		ref.current.focus();
		expect(focus).toHaveBeenCalled();
	});
});

describe("node accessors the composer packages measure", () => {
	it("InflatesDraftClientId hands over the composed composer's node", async () => {
		const { default: InflatesDraftClientId } = await import("../src/decorators/inflates-draft-client-id.jsx");
		const { default: DraftStore } = await import("../src/flux/stores/draft-store.js");
		const session = { draftClientId: "d1", draft: () => ({ clientId: "d1" }), listen: () => () => {}, changes: { commit: vi.fn() } };
		const spy = vi.spyOn(DraftStore, "sessionForClientId").mockResolvedValue(session);
		const Wrapped = InflatesDraftClientId(RootedComponent);
		const ref = React.createRef();
		const { container } = render(<Wrapped ref={ref} draftClientId="d1" className="composer" />);
		// While the session loads, the placeholder stands in.
		expect(ref.current.getDOMNode()).toBe(container.querySelector("span"));
		await act(async () => {});
		expect(ref.current.getDOMNode()).toBe(container.querySelector(".composer"));
		spy.mockRestore();
	});

	it("ParticipantsTextField hands over its rendered root node", async () => {
		const load = createPackageLoader({
			...base,
			electron: { clipboard: {} },
			"@electron/remote": {},
			"nylas-exports": { Utils: { isEqualReact: () => false }, ContactStore: {} },
			"nylas-component-kit": {
				TokenizingTextField: Nothing,
				Menu: Nothing,
				InjectedComponent: Nothing,
				InjectedComponentSet: Nothing,
			},
		});
		const ParticipantsTextField = load(
			path.join(__dirname, "..", "src/components/participants-text-field.jsx"),
		).default;
		const ref = React.createRef();
		const { container } = render(
			<ParticipantsTextField
				ref={ref}
				field="to"
				className="composer-participant-field to-field"
				participants={{ to: [], cc: [], bcc: [] }}
				change={() => {}}
			/>,
		);
		expect(ref.current.getDOMNode()).toBe(container.querySelector(".to-field"));
		expect(container.querySelector(".to-field")).toBe(container.firstChild);
	});
});
