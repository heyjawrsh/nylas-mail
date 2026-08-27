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

const _Fields = require("../lib/fields").default;
const CollapsedParticipants = require("../lib/collapsed-participants").default;

const { Contact } = require("nylas-exports");

describe("CollapsedParticipants", () => {
	const makeField = function (props) {
		if (props == null) {
			props = {};
		}
		return (this.fields = ReactTestUtils.renderIntoDocument(
			<CollapsedParticipants {...props} />,
		));
	};

	const numStr = function () {
		return ReactDOM.findDOMNode(
			ReactTestUtils.findRenderedDOMComponentWithClass(
				this.fields,
				"num-remaining",
			),
		).innerHTML;
	};

	it("doesn't render num remaining when nothing remains", function () {
		makeField.call(this);
		const els = ReactTestUtils.scryRenderedDOMComponentsWithClass(
			this.fields,
			"num-remaining",
		);
		return expect(els.length).toBe(0);
	});

	it("renders num remaining when remaining with no bcc", function () {
		makeField.call(this);
		spyOn(this.fields, "_setNumHiddenParticipants");
		this.fields.setState({ numRemaining: 10, numBccRemaining: 0 });
		const str = numStr.call(this);
		return expect(str).toBe("10 more");
	});

	it("renders num remaining when only bcc", function () {
		makeField.call(this);
		spyOn(this.fields, "_setNumHiddenParticipants");
		this.fields.setState({ numRemaining: 0, numBccRemaining: 5 });
		const str = numStr.call(this);
		return expect(str).toBe("5 Bcc");
	});

	return it("renders num remaining when both remaining andj bcc", function () {
		makeField.call(this);
		spyOn(this.fields, "_setNumHiddenParticipants");
		this.fields.setState({ numRemaining: 10, numBccRemaining: 5 });
		const str = numStr.call(this);
		return expect(str).toBe("15 more (5 Bcc)");
	});
});
