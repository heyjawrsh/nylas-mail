'use strict';

const proxyquire = require('proxyquire');
const React = require("react");
const ReactDOM = require("react-dom");
const ReactTestUtils = require('react-addons-test-utils');
const {Contact, Message, File, FileDownloadStore, MessageBodyProcessor} = require("nylas-exports");
const EmailFrameStub = React.createClass({render() { return <div></div>; }});
const {InjectedComponent} = require('nylas-component-kit');
const makeFile = (id, filename, contentId, contentType = 'image/png', size = 10) => new File({id, filename, contentId, contentType, size});
const file = makeFile('file_1_id', 'a.png');
const file_not_downloaded = makeFile('file_2_id', 'b.png');
const file_inline = makeFile('file_inline_id', 'c.png', 'file_inline_id');
const file_inline_downloading = makeFile('file_inline_downloading_id', 'd.png', 'file_inline_downloading_id');
const file_inline_not_downloaded = makeFile('file_inline_not_downloaded_id', 'e.png', 'file_inline_not_downloaded_id');
const file_cid_but_not_referenced = makeFile('file_cid_but_not_referenced', 'f.png', 'file_cid_but_not_referenced');
const file_cid_but_not_referenced_or_image = makeFile('file_cid_but_not_referenced_or_image', 'ansible notes.txt', 'file_cid_but_not_referenced_or_image', 'text/plain', 300);
const file_without_filename = makeFile('file_without_filename', undefined, undefined);
const download = {fileId: 'file_1_id'};
const download_inline = {fileId: 'file_inline_downloading_id'};
const user_1 = new Contact({name: "User One", email: "user1@nylas.com"});
const user_2 = new Contact({name: "User Two", email: "user2@nylas.com"});
const user_3 = new Contact({name: "User Three", email: "user3@nylas.com"});
const user_4 = new Contact({name: "User Four", email: "user4@nylas.com"});
const MessageItemBody = proxyquire('../lib/message-item-body', {'./email-frame': {default: EmailFrameStub}});

xdescribe("MessageItem", function() {
  beforeEach(function() {
    spyOn(FileDownloadStore, 'pathForFile').andCallFake(f => {
      if (f.id === file.id) { return '/fake/path.png'; }
      if (f.id === file_inline.id) { return '/fake/path-inline.png'; }
      if (f.id === file_inline_downloading.id) { return '/fake/path-downloading.png'; }
      return null;
    });
    spyOn(MessageBodyProcessor, '_addToCache').andCallFake(() => {});
    this.downloads = {'file_1_id': download, 'file_inline_downloading_id': download_inline};
    this.message = new Message({id: "111", from: [user_1], to: [user_2], cc: [user_3, user_4], bcc: null, body: "Body One", date: new Date(1415814587), draft: false, files: [], unread: false, snippet: "snippet one...", subject: "Subject One", threadId: "thread_12345", accountId: window.TEST_ACCOUNT_ID});
    this.createComponent = ({collapsed = false} = {}) => { this.component = ReactTestUtils.renderIntoDocument(<MessageItemBody message={this.message} downloads={this.downloads} />); return advanceClock(); };
  });
  describe("when the message contains attachments", function() {
    beforeEach(function() { this.message.files = [file, file_not_downloaded, file_cid_but_not_referenced, file_cid_but_not_referenced_or_image, file_inline, file_inline_downloading, file_inline_not_downloaded, file_without_filename]; });
    return describe("inline", function() {
      beforeEach(function() { this.message.body = `<img alt="A" src="cid:${file_inline.contentId}"/>\n<img alt="B" src="cid:${file_inline_downloading.contentId}"/>\n<img alt="C" src="cid:${file_inline_not_downloaded.contentId}"/>\n<img src="cid:missing-attachment"/>\nHello world!`; this.createComponent(); return waitsFor(() => ReactTestUtils.scryRenderedComponentsWithType(this.component, EmailFrameStub).length); });
      it("should never leave src=cid: in the message body", function() { return runs(() => expect(ReactTestUtils.findRenderedComponentWithType(this.component, EmailFrameStub).props.content.indexOf('cid')).toEqual(-1)); });
      it("should replace cid:<file.contentId> with the FileDownloadStore's path for the file", function() { return runs(() => { const body = ReactTestUtils.findRenderedComponentWithType(this.component, EmailFrameStub).props.content; return expect(body.indexOf('alt="A" src="file:///fake/path-inline.png"')).toEqual(this.message.body.indexOf('alt="A"')); }); });
      return it("should not replace cid:<file.contentId> with the FileDownloadStore's path if the download is in progress", function() { return runs(() => expect(ReactTestUtils.findRenderedComponentWithType(this.component, EmailFrameStub).props.content.indexOf('/fake/path-downloading.png')).toEqual(-1)); });
    });
  });
  return describe("showQuotedText", function() {
    it("should be initialized to false", function() { this.createComponent(); return expect(this.component.state.showQuotedText).toBe(false); });
    it("shouldn't render the quoted text control if there's no quoted text", function() { this.message.body = "no quotes here!"; this.createComponent(); return expect(ReactTestUtils.scryRenderedDOMComponentsWithClass(this.component, 'quoted-text-control').length).toBe(0); });
    describe('quoted text control toggle button', function() { beforeEach(function() { this.message.body = 'Message<blockquote class="gmail_quote">Quoted message</blockquote>'; this.createComponent(); this.toggle = ReactTestUtils.findRenderedDOMComponentWithClass(this.component, 'quoted-text-control'); }); return it('should be rendered', function() { return expect(this.toggle).toBeDefined(); }); });
    it("should be initialized to true if the message contains `Forwarded`...", function() { this.message.body = 'Hi guys<br><div class="gmail_quote">---- Forwarded Message ----- blablalba</div>'; this.createComponent(); return expect(this.component.state.showQuotedText).toBe(true); });
    it("should be initialized to false if the message is a response to a Forwarded message", function() { this.message.body = 'Thanks. On Sunday, Michael Wrote:<div class="gmail_quote">Hi<br><div class="gmail_quote">---- Forwarded Message -----</div></div>'; this.createComponent(); return expect(this.component.state.showQuotedText).toBe(false); });
    return describe("when showQuotedText is true", function() { beforeEach(function() { this.message.body = 'Message<blockquote class="gmail_quote">Quoted message</blockquote>'; this.createComponent(); this.component.state.showQuotedText = true; return waitsFor(() => ReactTestUtils.scryRenderedComponentsWithType(this.component, EmailFrameStub).length); }); it('quoted text control toggle button should be rendered', function() { return expect(ReactTestUtils.findRenderedDOMComponentWithClass(this.component, 'quoted-text-control')).toBeDefined(); }); return it("should pass the value into the EmailFrame", function() { return runs(() => expect(ReactTestUtils.findRenderedComponentWithType(this.component, EmailFrameStub).props.showQuotedText).toBe(true)); }); });
  });
});
