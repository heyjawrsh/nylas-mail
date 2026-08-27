/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const React = require("react");
const ReactDOM = require("react-dom");
const ReactTestUtils = require('react-addons-test-utils');
const {
  Thread,
  FocusedContentStore,
  Actions,
  CategoryStore,
  ChangeUnreadTask,
  MailboxPerspective
} = require("nylas-exports");
const {ToggleStarredButton, ToggleUnreadButton, MarkAsSpamButton} = require('../lib/thread-toolbar-buttons');

const test_thread = (new Thread).fromJSON({
  "id" : "thread_12345",
  "account_id": TEST_ACCOUNT_ID,
  "subject" : "Subject 12345",
  "starred": false
});

const test_thread_starred = (new Thread).fromJSON({
  "id" : "thread_starred_12345",
  "account_id": TEST_ACCOUNT_ID,
  "subject" : "Subject 12345",
  "starred": true
});

describe("ThreadToolbarButtons", function() {
  beforeEach(function() {
    spyOn(Actions, "queueTask");
    spyOn(Actions, "queueTasks");
    spyOn(Actions, "toggleStarredThreads");
    return spyOn(Actions, "toggleUnreadThreads");
  });

  describe("Starring", function() {
    it("stars a thread if the star button is clicked and thread is unstarred", function() {
      const starButton = ReactTestUtils.renderIntoDocument(React.createElement(ToggleStarredButton, {"items": ([test_thread])}));

      ReactTestUtils.Simulate.click(ReactDOM.findDOMNode(starButton));

      return expect(Actions.toggleStarredThreads.mostRecentCall.args[0].threads).toEqual([test_thread]);
    });

    return it("unstars a thread if the star button is clicked and thread is starred", function() {
      const starButton = ReactTestUtils.renderIntoDocument(React.createElement(ToggleStarredButton, {"items": ([test_thread_starred])}));

      ReactTestUtils.Simulate.click(ReactDOM.findDOMNode(starButton));

      return expect(Actions.toggleStarredThreads.mostRecentCall.args[0].threads).toEqual([test_thread_starred]);
    });
  });

  describe("Marking as unread", function() {
    let thread = null;
    let markUnreadBtn = null;

    beforeEach(function() {
      thread = new Thread({id: "thread-id-lol-123", accountId: TEST_ACCOUNT_ID, unread: false});
      return markUnreadBtn = ReactTestUtils.renderIntoDocument(
        React.createElement(ToggleUnreadButton, {"items": ([thread])})
      );
    });

    it("queues a task to change unread status to true", function() {
      ReactTestUtils.Simulate.click(ReactDOM.findDOMNode(markUnreadBtn).childNodes[0]);
      return expect(Actions.toggleUnreadThreads.mostRecentCall.args[0].threads).toEqual([thread]);
    });

    return it("returns to the thread list", function() {
      spyOn(Actions, "popSheet");
      ReactTestUtils.Simulate.click(ReactDOM.findDOMNode(markUnreadBtn).childNodes[0]);

      return expect(Actions.popSheet).toHaveBeenCalled();
    });
  });

  return describe("Marking as spam", function() {
    let thread = null;
    let markSpamButton = null;

    describe("when the thread is already in spam", function() {
      beforeEach(function() {
        thread = new Thread({
          id: "thread-id-lol-123",
          accountId: TEST_ACCOUNT_ID,
          categories: [{name: 'spam'}]
        });
        return markSpamButton = ReactTestUtils.renderIntoDocument(
          React.createElement(MarkAsSpamButton, {"items": ([thread])})
        );
      });

      return it("queues a task to remove spam", function() {
        spyOn(CategoryStore, 'getSpamCategory').andReturn(thread.categories[0]);
        ReactTestUtils.Simulate.click(ReactDOM.findDOMNode(markSpamButton));
        const {labelsToAdd, labelsToRemove} = Actions.queueTasks.mostRecentCall.args[0][0];
        expect(labelsToAdd).toEqual([]);
        return expect(labelsToRemove).toEqual([thread.categories[0]]);
      });
    });

    return describe("when the thread can be moved to spam", function() {
      beforeEach(function() {
        spyOn(MailboxPerspective.prototype, 'canMoveThreadsTo').andReturn(true);
        thread = new Thread({id: "thread-id-lol-123", accountId: TEST_ACCOUNT_ID, categories: []});
        return markSpamButton = ReactTestUtils.renderIntoDocument(
          React.createElement(MarkAsSpamButton, {"items": ([thread])})
        );
      });

      it("queues a task to mark as spam", function() {
        spyOn(Actions, 'markAsSpamThreads');
        ReactTestUtils.Simulate.click(ReactDOM.findDOMNode(markSpamButton));
        return expect(Actions.markAsSpamThreads).toHaveBeenCalledWith({
          threads: [thread],
          source: 'Toolbar Button: Thread List'
        });
      });

      return it("returns to the thread list", function() {
        spyOn(Actions, 'popSheet');
        ReactTestUtils.Simulate.click(ReactDOM.findDOMNode(markSpamButton));
        return expect(Actions.popSheet).toHaveBeenCalled();
      });
    });
  });
});
