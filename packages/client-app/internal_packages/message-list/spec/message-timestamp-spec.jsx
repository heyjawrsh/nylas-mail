const moment = require("moment");
const _React = require("react");
const _ReactDOM = require("react-dom");
const ReactTestUtils = require("react-addons-test-utils");
const MessageTimestamp = require("../lib/message-timestamp").default;
const msgTime = () => moment([2010, 1, 14, 15, 25, 50, 125]);

describe("MessageTimestamp", () => {
	beforeEach(function () {
		this.item = ReactTestUtils.renderIntoDocument(
			<MessageTimestamp date={msgTime()} />,
		);
	});
	return it("still processes one day, even if it crosses a month divider", () => {
		const feb28 = moment([2015, 1, 28]);
		const mar01 = moment([2015, 2, 1]);
		return expect(mar01.diff(feb28, "days")).toBe(1);
	});
});
