'use strict';

const _ = require("underscore");
const moment = require("moment");
const proxyquire = require("proxyquire").noPreserveCache();
const React = require("react");
const ReactDOM = require("react-dom");
const ReactTestUtils = require('react-addons-test-utils');
const {Thread, Contact, Actions, Message, Account, DraftStore, MessageStore, AccountStore, NylasTestUtils, ComponentRegistry} = require("nylas-exports");
const MessageParticipants = require("../lib/message-participants");
const MessageItemContainer = require("../lib/message-item-container");
const MessageList = require('../lib/message-list');

const user_1 = new Contact({name: TEST_ACCOUNT_NAME, email: TEST_ACCOUNT_EMAIL});
const user_2 = new Contact({name: "User Two", email: "user2@nylas.com"});
const user_3 = new Contact({name: "User Three", email: "user3@nylas.com"});
const user_4 = new Contact({name: "User Four", email: "user4@nylas.com"});
const user_5 = new Contact({name: "User Five", email: "user5@nylas.com"});
const makeMessage = (id, from, to, cc, bcc, label, draft = false) => (new Message()).fromJSON({id, from, to, cc, bcc, body: `Body ${label}`, date: 1415814587, draft, files: [], unread: false, object: draft ? "draft" : "message", snippet: `${draft ? 'draft ' : ''}snippet ${label}...`, subject: `${draft ? 'Draft' : 'Subject'} ${label}`, thread_id: "thread_12345", account_id: TEST_ACCOUNT_ID});
const m1 = makeMessage("111", [user_1], [user_2], [user_3, user_4], null, "One");
const m2 = makeMessage("222", [user_2], [user_1], [user_3, user_4], null, "Two");
const m3 = makeMessage("333", [user_3], [user_1], [user_2, user_4], [], "Three");
const m4 = makeMessage("444", [user_4], [user_1], [], [user_5], "Four");
const m5 = makeMessage("555", [user_1], [user_4], [], [], "Five");
const testMessages = [m1, m2, m3, m4, m5];
const draftMessages = [makeMessage("666", [user_1], [], [], null, "One", true)];
const test_thread = (new Thread()).fromJSON({id: "thread_12345", subject: "Subject 12345", account_id: TEST_ACCOUNT_ID});

describe("MessageList", function() {
  beforeEach(function() {
    MessageStore._items = []; MessageStore._threadId = null;
    spyOn(MessageStore, "itemsLoading").andCallFake(() => false);
    this.messageList = ReactTestUtils.renderIntoDocument(<MessageList />);
    this.messageList_node = ReactDOM.findDOMNode(this.messageList);
  });
  it("renders into the document", function() { return expect(ReactTestUtils.isCompositeComponentWithType(this.messageList, MessageList)).toBe(true); });
  it("by default has zero children", function() { return expect(ReactTestUtils.scryRenderedComponentsWithType(this.messageList, MessageItemContainer).length).toBe(0); });

  describe("Populated Message list", function() {
    beforeEach(function() { MessageStore._items = testMessages; MessageStore._expandItemsToDefault(); MessageStore.trigger(MessageStore); this.messageList.setState({currentThread: test_thread}); return NylasTestUtils.loadKeymap("keymaps/base"); });
    it("renders all the correct number of messages", function() { return expect(ReactTestUtils.scryRenderedComponentsWithType(this.messageList, MessageItemContainer).length).toBe(5); });
    it("renders the correct number of expanded messages", function() { return expect(ReactTestUtils.scryRenderedDOMComponentsWithClass(this.messageList, "collapsed message-item-wrap").length).toBe(4); });
    it("displays lists of participants on the page", function() { return expect(ReactTestUtils.scryRenderedComponentsWithType(this.messageList, MessageParticipants).length).toBe(2); });
    return it("includes drafts as message item containers", function() { this.messageList.setState({messages: this.messageList.state.messages.concat(draftMessages)}); return expect(ReactTestUtils.scryRenderedComponentsWithType(this.messageList, MessageItemContainer).length).toBe(6); });
  });

  describe("reply type", function() {
    it("prompts for a reply when there's only one participant", function() { MessageStore._items = [m3, m5]; MessageStore._thread = test_thread; MessageStore.trigger(); expect(this.messageList._replyType()).toBe("reply"); return expect(ReactTestUtils.scryRenderedDOMComponentsWithClass(this.messageList, "footer-reply-area").length).toBe(1); });
    it("prompts for a reply-all when there's more than one participant and the default is reply-all", function() { spyOn(NylasEnv.config, "get").andReturn("reply-all"); MessageStore._items = [m5, m3]; MessageStore._thread = test_thread; MessageStore.trigger(); expect(this.messageList._replyType()).toBe("reply-all"); return expect(ReactTestUtils.scryRenderedDOMComponentsWithClass(this.messageList, "footer-reply-area").length).toBe(1); });
    it("prompts for a reply-all when there's more than one participant and the default is reply", function() { spyOn(NylasEnv.config, "get").andReturn("reply"); MessageStore._items = [m5, m3]; MessageStore._thread = test_thread; MessageStore.trigger(); expect(this.messageList._replyType()).toBe("reply"); return expect(ReactTestUtils.scryRenderedDOMComponentsWithClass(this.messageList, "footer-reply-area").length).toBe(1); });
    return it("hides the reply type if the last message is a draft", function() { MessageStore._items = [m5, m3, draftMessages[0]]; MessageStore._thread = test_thread; MessageStore.trigger(); return expect(ReactTestUtils.scryRenderedDOMComponentsWithClass(this.messageList, "footer-reply-area").length).toBe(0); });
  });

  describe("Message minification", function() {
    beforeEach(function() { this.messageList.MINIFY_THRESHOLD = 3; this.messageList.setState({minified: true}); this.messages = ['a','b','c','d','e','f','g'].map(id => ({id})); });
    const check = function(context, state, expected) { context.messageList.setState({messagesExpandedState: state}); return expect(context.messageList._messagesWithMinification(context.messages)).toEqual(expected); };
    const bundle = ids => ({type: "minifiedBundle", messages: ids.map(id => ({id}))});
    it("ignores the first message if it's collapsed", function() { return check(this, {a:false,b:false,c:false,d:false,e:false,f:false,g:"default"}, [{id:'a'},bundle(['b','c','d','e']),{id:'f'},{id:'g'}]); });
    it("ignores the first message if it's expanded", function() { return check(this, {a:"default",b:false,c:false,d:false,e:false,f:false,g:"default"}, [{id:'a'},bundle(['b','c','d','e']),{id:'f'},{id:'g'}]); });
    it("doesn't minify the last collapsed message", function() { return check(this, {a:false,b:false,c:false,d:false,e:false,f:"default",g:"default"}, [{id:'a'},bundle(['b','c','d']),{id:'e'},{id:'f'},{id:'g'}]); });
    it("allows explicitly expanded messages", function() { return check(this, {a:false,b:false,c:false,d:false,e:false,f:"explicit",g:"default"}, [{id:'a'},bundle(['b','c','d','e']),{id:'f'},{id:'g'}]); });
    it("doesn't minify if the threshold isn't reached", function() { return check(this, {a:false,b:"default",c:false,d:"default",e:false,f:"default",g:"default"}, this.messages); });
    it("doesn't minify if the threshold isn't reached due to the rule about not minifying the last collapsed messages", function() { return check(this, {a:false,b:false,c:false,d:false,e:"default",f:"default",g:"default"}, this.messages); });
    it("minifies at the threshold if the message is explicitly expanded", function() { return check(this, {a:false,b:false,c:false,d:false,e:"explicit",f:"default",g:"default"}, [{id:'a'},bundle(['b','c','d']),{id:'e'},{id:'f'},{id:'g'}]); });
    it("can have multiple minification blocks", function() { this.messages = ['a','b','c','d','e','f','g','h','i','j','k','l'].map(id => ({id})); return check(this, {a:false,b:false,c:false,d:false,e:false,f:"default",g:false,h:false,i:false,j:false,k:false,l:"default"}, [{id:'a'},bundle(['b','c','d']),{id:'e'},{id:'f'},bundle(['g','h','i','j']),{id:'k'},{id:'l'}]); });
    return it("can have multiple minification blocks next to explicitly expanded messages", function() { this.messages = ['a','b','c','d','e','f','g','h','i','j','k','l'].map(id => ({id})); return check(this, {a:false,b:false,c:false,d:false,e:"explicit",f:"default",g:false,h:false,i:false,j:false,k:"explicit",l:"default"}, [{id:'a'},bundle(['b','c','d']),{id:'e'},{id:'f'},bundle(['g','h','i','j']),{id:'k'},{id:'l'}]); });
  });
});
