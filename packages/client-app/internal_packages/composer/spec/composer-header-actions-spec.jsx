/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _React = require("react");
const ReactDOM = require("react-dom");
const ComposerHeaderActions = require("../lib/composer-header-actions").default;
const Fields = require("../lib/fields").default;
const ReactTestUtils = require("react-addons-test-utils");
const { Actions } = require("nylas-exports");

describe("ComposerHeaderActions", () => {
	const makeField = function (props) {
		if (props == null) {
			props = {};
		}
		this.onShowAndFocusField = jasmine.createSpy("onShowAndFocusField");
		props.onShowAndFocusField = this.onShowAndFocusField;
		if (props.enabledFields == null) {
			props.enabledFields = [];
		}
		props.draftClientId = "a";
		return (this.component = ReactTestUtils.renderIntoDocument(
			<ComposerHeaderActions {...props} />,
		));
	};

	it("renders the 'show' buttons for 'cc', 'bcc' when participantsFocused", function () {
		makeField.call(this, {
			enabledFields: [Fields.To],
			participantsFocused: true,
		});
		const showCc = ReactTestUtils.findRenderedDOMComponentWithClass(
			this.component,
			"show-cc",
		);
		const showBcc = ReactTestUtils.findRenderedDOMComponentWithClass(
			this.component,
			"show-bcc",
		);
		const _showSubject = ReactTestUtils.findRenderedDOMComponentWithClass(
			this.component,
			"show-subject",
		);
		expect(showCc).toBeDefined();
		return expect(showBcc).toBeDefined();
	});

	it("does not render the 'show' buttons for 'cc', 'bcc' when participantsFocused is false", function () {
		makeField.call(this, {
			enabledFields: [Fields.To],
			participantsFocused: false,
		});
		const showCc = ReactTestUtils.scryRenderedDOMComponentsWithClass(
			this.component,
			"show-cc",
		);
		const showBcc = ReactTestUtils.scryRenderedDOMComponentsWithClass(
			this.component,
			"show-bcc",
		);
		const _showSubject = ReactTestUtils.scryRenderedDOMComponentsWithClass(
			this.component,
			"show-subject",
		);
		expect(showCc.length).toBe(0);
		return expect(showBcc.length).toBe(0);
	});

	it("hides show cc if it's enabled", function () {
		makeField.call(this, {
			enabledFields: [Fields.To, Fields.Cc],
			participantsFocused: true,
		});
		const els = ReactTestUtils.scryRenderedDOMComponentsWithClass(
			this.component,
			"show-cc",
		);
		return expect(els.length).toBe(0);
	});

	it("hides show bcc if it's enabled", function () {
		makeField.call(this, {
			enabledFields: [Fields.To, Fields.Bcc],
			participantsFocused: true,
		});
		const els = ReactTestUtils.scryRenderedDOMComponentsWithClass(
			this.component,
			"show-bcc",
		);
		return expect(els.length).toBe(0);
	});

	it("hides show subject if it's enabled", function () {
		makeField.call(this, {
			enabledFields: [Fields.To, Fields.Subject],
			participantsFocused: true,
		});
		const els = ReactTestUtils.scryRenderedDOMComponentsWithClass(
			this.component,
			"show-subject",
		);
		return expect(els.length).toBe(0);
	});

	it("renders 'popout composer' in the inline mode", function () {
		makeField.call(this, {
			enabledFields: [Fields.To],
			participantsFocused: true,
		});
		const els = ReactTestUtils.scryRenderedDOMComponentsWithClass(
			this.component,
			"show-popout",
		);
		return expect(els.length).toBe(1);
	});

	it("doesn't render 'popout composer' if in a composer window", function () {
		spyOn(NylasEnv, "isComposerWindow").andReturn(true);
		makeField.call(this, {
			enabledFields: [Fields.To],
			participantsFocused: true,
		});
		const els = ReactTestUtils.scryRenderedDOMComponentsWithClass(
			this.component,
			"show-popout",
		);
		return expect(els.length).toBe(0);
	});

	it("pops out the composer when clicked", function () {
		spyOn(Actions, "composePopoutDraft");
		makeField.call(this, {
			enabledFields: [Fields.To],
			participantsFocused: true,
		});
		const el = ReactTestUtils.findRenderedDOMComponentWithClass(
			this.component,
			"show-popout",
		);
		ReactTestUtils.Simulate.click(ReactDOM.findDOMNode(el));
		return expect(Actions.composePopoutDraft).toHaveBeenCalled();
	});

	it("shows and focuses cc when clicked", function () {
		makeField.call(this, {
			enabledFields: [Fields.To],
			participantsFocused: true,
		});
		const el = ReactTestUtils.findRenderedDOMComponentWithClass(
			this.component,
			"show-cc",
		);
		ReactTestUtils.Simulate.click(ReactDOM.findDOMNode(el));
		return expect(this.onShowAndFocusField).toHaveBeenCalledWith(Fields.Cc);
	});

	it("shows and focuses bcc when clicked", function () {
		makeField.call(this, {
			enabledFields: [Fields.To],
			participantsFocused: true,
		});
		const el = ReactTestUtils.findRenderedDOMComponentWithClass(
			this.component,
			"show-bcc",
		);
		ReactTestUtils.Simulate.click(ReactDOM.findDOMNode(el));
		return expect(this.onShowAndFocusField).toHaveBeenCalledWith(Fields.Bcc);
	});

	return it("shows subject when clicked", function () {
		makeField.call(this, {
			enabledFields: [Fields.To],
			participantsFocused: false,
		});
		const el = ReactTestUtils.findRenderedDOMComponentWithClass(
			this.component,
			"show-subject",
		);
		ReactTestUtils.Simulate.click(ReactDOM.findDOMNode(el));
		return expect(this.onShowAndFocusField).toHaveBeenCalledWith(
			Fields.Subject,
		);
	});
});
