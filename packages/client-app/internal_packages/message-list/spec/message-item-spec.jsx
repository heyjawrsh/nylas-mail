const proxyquire = require("proxyquire");
const React = require("react");
const ReactDOM = require("react-dom");
const ReactTestUtils = require("react-addons-test-utils");
const {
	Contact,
	Message,
	File,
	Thread,
	Utils,
	QuotedHTMLTransformer,
	FileDownloadStore,
	MessageBodyProcessor,
} = require("nylas-exports");
const MessageItemBody = React.createClass({
	render() {
		return <div></div>;
	},
});
const { InjectedComponent } = require("nylas-component-kit");
const makeFile = (
	id,
	filename,
	contentId,
	contentType = "image/png",
	size = 10,
) => new File({ id, filename, contentId, contentType, size });
const file = makeFile("file_1_id", "a.png");
const file_not_downloaded = makeFile("file_2_id", "b.png");
const file_inline = makeFile("file_inline_id", "c.png", "file_inline_id");
const file_inline_downloading = makeFile(
	"file_inline_downloading_id",
	"d.png",
	"file_inline_downloading_id",
);
const file_inline_not_downloaded = makeFile(
	"file_inline_not_downloaded_id",
	"e.png",
	"file_inline_not_downloaded_id",
);
const file_cid_but_not_referenced = makeFile(
	"file_cid_but_not_referenced",
	"f.png",
	"file_cid_but_not_referenced",
);
const file_cid_but_not_referenced_or_image = makeFile(
	"file_cid_but_not_referenced_or_image",
	"ansible notes.txt",
	"file_cid_but_not_referenced_or_image",
	"text/plain",
	300,
);
const file_without_filename = makeFile("file_without_filename");
const download = { fileId: "file_1_id" };
const download_inline = { fileId: "file_inline_downloading_id" };
const users = [1, 2, 3, 4, 5].map(
	(i) =>
		new Contact({
			name: `User ${["One", "Two", "Three", "Four", "Five"][i - 1]}`,
			email: `user${i}@nylas.com`,
		}),
);
const [user_1, user_2, user_3, user_4, _user_5] = users;
const MessageItem = proxyquire("../lib/message-item", {
	"./message-item-body": MessageItemBody,
});
const MessageTimestamp = require("../lib/message-timestamp").default;

xdescribe("MessageItem", () => {
	beforeEach(function () {
		spyOn(FileDownloadStore, "pathForFile").andCallFake((f) =>
			f.id === file.id
				? "/fake/path.png"
				: f.id === file_inline.id
					? "/fake/path-inline.png"
					: f.id === file_inline_downloading.id
						? "/fake/path-downloading.png"
						: null,
		);
		spyOn(FileDownloadStore, "getDownloadDataForFiles").andCallFake(() => ({
			file_1_id: download,
			file_inline_downloading_id: download_inline,
		}));
		spyOn(MessageBodyProcessor, "_addToCache").andCallFake(() => {});
		this.message = new Message({
			id: "111",
			from: [user_1],
			to: [user_2],
			cc: [user_3, user_4],
			bcc: null,
			body: "Body One",
			date: new Date(1415814587),
			draft: false,
			files: [],
			unread: false,
			snippet: "snippet one...",
			subject: "Subject One",
			threadId: "thread_12345",
			accountId: TEST_ACCOUNT_ID,
		});
		this.thread = new Thread({ id: "thread-111", accountId: TEST_ACCOUNT_ID });
		this.threadParticipants = [user_1, user_2, user_3, user_4];
		this.createComponent = ({ collapsed = false } = {}) => {
			this.component = ReactTestUtils.renderIntoDocument(
				<MessageItem
					key={this.message.id}
					message={this.message}
					thread={this.thread}
					collapsed={collapsed}
				/>,
			);
		};
	});
	describe("when displaying detailed headers", () => {
		beforeEach(function () {
			this.createComponent({ collapsed: false });
			return this.component.setState({ detailedHeaders: true });
		});
		it("correctly sets the participant states", function () {
			expect(
				ReactTestUtils.scryRenderedDOMComponentsWithClass(
					this.component,
					"expanded-participants",
				).length,
			).toBe(2);
			return expect(() =>
				ReactTestUtils.findRenderedDOMComponentWithClass(
					this.component,
					"collapsed-participants",
				),
			).toThrow();
		});
		return it("correctly sets the timestamp", function () {
			return expect(
				ReactTestUtils.findRenderedComponentWithType(
					this.component,
					MessageTimestamp,
				).props.isDetailed,
			).toBe(true);
		});
	});
	describe("when not collapsed", () => {
		beforeEach(function () {
			return this.createComponent({ collapsed: false });
		});
		it("should render the MessageItemBody", function () {
			return expect(
				ReactTestUtils.findRenderedComponentWithType(
					this.component,
					MessageItemBody,
				),
			).toBeDefined();
		});
		return it("should not have the `collapsed` class", function () {
			return expect(
				ReactDOM.findDOMNode(this.component).className.indexOf("collapsed") >=
					0,
			).toBe(false);
		});
	});
	return xdescribe("when the message contains attachments", () => {
		beforeEach(function () {
			this.message.files = [
				file,
				file_not_downloaded,
				file_cid_but_not_referenced,
				file_cid_but_not_referenced_or_image,
				file_inline,
				file_inline_downloading,
				file_inline_not_downloaded,
				file_without_filename,
			];
			this.message.body = `<img alt="A" src="cid:${file_inline.contentId}"/><img alt="B" src="cid:${file_inline_downloading.contentId}"/><img alt="C" src="cid:${file_inline_not_downloaded.contentId}"/><img src="cid:missing-attachment"/>`;
			return this.createComponent();
		});
		it("should include the attachments area", function () {
			return expect(
				ReactTestUtils.findRenderedDOMComponentWithClass(
					this.component,
					"attachments-area",
				),
			).toBeDefined();
		});
		it("injects a MessageAttachments component for any present attachments", function () {
			return expect(
				ReactTestUtils.scryRenderedComponentsWithTypeAndProps(
					this.component,
					InjectedComponent,
					{ matching: { role: "MessageAttachments" } },
				).length,
			).toBe(1);
		});
		it("should list attachments that are not mentioned in the body via cid", function () {
			const attachments = ReactTestUtils.scryRenderedComponentsWithTypeAndProps(
				this.component,
				InjectedComponent,
				{ matching: { role: "MessageAttachments" } },
			)[0].props.exposedProps.files;
			expect(attachments.length).toEqual(5);
			expect(attachments[0]).toBe(file);
			expect(attachments[1]).toBe(file_not_downloaded);
			expect(attachments[2]).toBe(file_cid_but_not_referenced);
			return expect(attachments[3]).toBe(file_cid_but_not_referenced_or_image);
		});
		it("should provide the correct file download state for each attachment", function () {
			const { downloads } =
				ReactTestUtils.scryRenderedComponentsWithTypeAndProps(
					this.component,
					InjectedComponent,
					{ matching: { role: "MessageAttachments" } },
				)[0].props.exposedProps;
			expect(downloads.file_1_id).toBe(download);
			return expect(downloads.file_not_downloaded).toBe(undefined);
		});
		return it("should still list attachments when the message has no body", function () {
			this.message.body = "";
			this.createComponent();
			const attachments = ReactTestUtils.scryRenderedComponentsWithTypeAndProps(
				this.component,
				InjectedComponent,
				{ matching: { role: "MessageAttachments" } },
			)[0].props.exposedProps.files;
			return expect(attachments.length).toEqual(8);
		});
	});
});
