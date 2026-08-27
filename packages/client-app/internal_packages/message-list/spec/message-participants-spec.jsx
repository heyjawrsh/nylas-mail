'use strict';

const _ = require('underscore');
const React = require("react");
const ReactDOM = require("react-dom");
const ReactTestUtils = require('react-addons-test-utils');
const {Contact, Message, DOMUtils} = require("nylas-exports");
const MessageParticipants = require("../lib/message-participants");
const user_1 = {name: "User One", email: "user1@nylas.com"};
const user_2 = {name: "User Two", email: "user2@nylas.com"};
const user_3 = {name: "User Three", email: "user3@nylas.com"};
const user_4 = {name: "User Four", email: "user4@nylas.com"};
const user_5 = {name: "User Five", email: "user5@nylas.com"};
const many_users = Array.from({length: 101}, (_, i) => new Contact({name: `User ${i}`, email: `${i}@app.com`}));
const test_message = (new Message()).fromJSON({id: "111", from: [user_1], to: [user_2], cc: [user_3, user_4], bcc: [user_5]});
const big_test_message = (new Message()).fromJSON({id: "222", from: [user_1], to: many_users});
const many_thread_users = [user_1].concat(many_users);

describe("MessageParticipants", function() {
  describe("when collapsed", function() {
    const makeParticipants = props => ReactTestUtils.renderIntoDocument(<MessageParticipants {...props} />);
    it("renders into the document", () => expect(makeParticipants({to: test_message.to, cc: test_message.cc, from: test_message.from, message_participants: test_message.participants()})).toBeDefined());
    it("uses short names", function() { const actualOut = makeParticipants({to: test_message.to}); const to = ReactTestUtils.findRenderedDOMComponentWithClass(actualOut, "to-contact"); return expect(ReactDOM.findDOMNode(to).innerHTML).toBe("User"); });
    it("doesn't render any To nodes if To array is empty", function() { const actualOut = makeParticipants({to: []}); return expect(() => ReactTestUtils.findRenderedDOMComponentWithClass(actualOut, "to-contact")).toThrow(); });
    it("doesn't render any Cc nodes if Cc array is empty", function() { const actualOut = makeParticipants({cc: []}); return expect(() => ReactTestUtils.findRenderedDOMComponentWithClass(actualOut, "cc-contact")).toThrow(); });
    return it("doesn't render any Bcc nodes if Bcc array is empty", function() { const actualOut = makeParticipants({bcc: []}); return expect(() => ReactTestUtils.findRenderedDOMComponentWithClass(actualOut, "bcc-contact")).toThrow(); });
  });
  return describe("when expanded", function() {
    beforeEach(function() { this.participants = ReactTestUtils.renderIntoDocument(<MessageParticipants to={test_message.to} cc={test_message.cc} from={test_message.from} isDetailed={true} message_participants={test_message.participants()} />); });
    it("renders into the document", function() { return expect(ReactTestUtils.findRenderedDOMComponentWithClass(this.participants, "expanded-participants")).toBeDefined(); });
    return it("uses full names", function() { const to = ReactTestUtils.findRenderedDOMComponentWithClass(this.participants, "to-contact"); return expect(ReactDOM.findDOMNode(to).innerText.trim()).toEqual("User Two <user2@nylas.com>"); });
  });
});
