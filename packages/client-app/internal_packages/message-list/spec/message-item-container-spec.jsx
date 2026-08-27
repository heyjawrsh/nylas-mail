const React = require("react");
const proxyquire = require("proxyquire").noPreserveCache();
const ReactTestUtils = require("react-addons-test-utils");
const {
	Thread,
	Message,
	ComponentRegistry,
	DraftStore,
} = require("nylas-exports");
class StubMessageItem extends React.Component {
	render() {
		return <span></span>;
	}
}
StubMessageItem.displayName = "StubMessageItem";
class StubComposer extends React.Component {
	render() {
		return <span></span>;
	}
}
StubComposer.displayName = "StubComposer";
const MessageItemContainer = proxyquire("../lib/message-item-container", {
	"./message-item": StubMessageItem,
});
const testThread = new Thread({ id: "t1", accountId: TEST_ACCOUNT_ID });
const testClientId = "local-id";
const testMessage = new Message({
	id: "m1",
	draft: false,
	unread: true,
	accountId: TEST_ACCOUNT_ID,
});
const testDraft = new Message({
	id: "d1",
	draft: true,
	unread: true,
	accountId: TEST_ACCOUNT_ID,
});

xdescribe("MessageItemContainer", () => {
	beforeEach(function () {
		this.isSendingDraft = false;
		spyOn(DraftStore, "isSendingDraft").andCallFake(() => this.isSendingDraft);
		return ComponentRegistry.register(StubComposer, { role: "Composer" });
	});
	afterEach(() =>
		ComponentRegistry.register(StubComposer, { role: "Composer" }),
	);
	const renderContainer = (message) =>
		ReactTestUtils.renderIntoDocument(
			<MessageItemContainer
				thread={testThread}
				message={message}
				draftClientId={testClientId}
			/>,
		);
	it("shows composer if it's a draft", function () {
		this.isSendingDraft = false;
		return expect(
			ReactTestUtils.scryRenderedComponentsWithType(
				renderContainer(testDraft),
				StubComposer,
			).length,
		).toBe(1);
	});
	it("renders a message if it's a draft that is sending", function () {
		this.isSendingDraft = true;
		const items = ReactTestUtils.scryRenderedComponentsWithType(
			renderContainer(testDraft),
			StubMessageItem,
		);
		expect(items.length).toBe(1);
		return expect(items[0].props.pending).toBe(true);
	});
	return it("renders a message if it's not a draft", function () {
		this.isSendingDraft = false;
		return expect(
			ReactTestUtils.scryRenderedComponentsWithType(
				renderContainer(testMessage),
				StubMessageItem,
			).length,
		).toBe(1);
	});
});
