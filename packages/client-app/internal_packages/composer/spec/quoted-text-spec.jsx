/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// This tests just quoted text within a contenteditable.
//
// For a test of the basic component itself see
// contenteditable-component-spec.cjsx
//
const _ = require("underscore");
const React = require("react");
const ReactDOM = require('react-dom');
const ReactTestUtils = require('react-addons-test-utils');

const Fields = require('../lib/fields').default;
const Composer = require("../lib/composer-view").default;
const ComposerEditor = require('../lib/composer-editor').default;

const {Message, DraftStore, ComponentRegistry} = require('nylas-exports');

describe("Composer Quoted Text", function() {
  beforeEach(function() {
    ComponentRegistry.register(ComposerEditor, {role: "Composer:Editor"});

    this.onChange = jasmine.createSpy('onChange');
    this.htmlNoQuote = 'Test <strong>HTML</strong><br>';
    this.htmlWithQuote = 'Test <strong>HTML</strong><div id="n1-quoted-text-marker"></div><br><blockquote class="gmail_quote">QUOTE</blockquote>';

    this.draft = new Message({draft: true, clientId: "client-123"});
    return this.session = {
      trigger() {},
      changes: {
        add: jasmine.createSpy('changes.add')
      },
      draft: () => this.draft
    };
  });

  afterEach(function() {
    DraftStore._cleanupAllSessions();
    ComposerEditor.containerRequired = undefined;
    return ComponentRegistry.unregister(ComposerEditor);
  });

  // Must be called with the test's scope
  const setHTML = function(newHTML) {
    this.$contentEditable.innerHTML = newHTML;
    return this.contentEditable._onDOMMutated(["mutated"]);
  };

  describe("when the message is a reply", function() {
    beforeEach(function() {
      this.draft.body = this.htmlNoQuote;
      this.composer = ReactTestUtils.renderIntoDocument(
        <Composer draft={this.draft} session={this.session}/>
      );
      this.composer.setState({
        showQuotedText: false,
        showQuotedTextControl: true
      });
      this.contentEditable = this.composer.refs[Fields.Body];
      this.$contentEditable = ReactDOM.findDOMNode(this.contentEditable).querySelector('[contenteditable]');
      return this.$composerBodyWrap = ReactDOM.findDOMNode(this.composer.refs.composerBodyWrap);
    });

    return it('should render the quoted-text-control toggle', function() {
      const toggles = ReactTestUtils.scryRenderedDOMComponentsWithClass(this.composer, 'quoted-text-control');
      return expect(toggles.length).toBe(1);
    });
  });

  return describe('when the quoted text has been expanded', function() {
    beforeEach(function() {
      this.draft.body = this.htmlWithQuote;
      this.composer = ReactTestUtils.renderIntoDocument(
        <Composer draft={this.draft} session={this.session}/>
      );
      this.composer.setState({
        showQuotedText: true,
        showQuotedTextControl: false
      });
      this.contentEditable = this.composer.refs[Fields.Body];
      this.$contentEditable = ReactDOM.findDOMNode(this.contentEditable).querySelector('[contenteditable]');
      return this.$composerBodyWrap = ReactDOM.findDOMNode(this.composer.refs.composerBodyWrap);
    });

    it("should call add changes with the entire HTML string", function() {
      const textToAdd = "MORE <strong>TEXT</strong>!";
      expect(this.$contentEditable.innerHTML).toBe(this.htmlWithQuote);
      setHTML.call(this, textToAdd + this.htmlWithQuote);
      const ev = this.session.changes.add.mostRecentCall.args[0].body;
      return expect(ev).toEqual(textToAdd + this.htmlWithQuote);
    });

    it("should allow the quoted text to be changed", function() {
      const newText = 'Test <strong>NEW 1 HTML</strong><blockquote class="gmail_quote">QUOTE CHANGED!!!</blockquote>';
      expect(this.$contentEditable.innerHTML).toBe(this.htmlWithQuote);
      setHTML.call(this, newText);
      const ev = this.session.changes.add.mostRecentCall.args[0].body;
      return expect(ev).toEqual(newText);
    });

    return describe('quoted text control toggle button', () => it('should not be rendered', function() {
      const toggles = ReactTestUtils.scryRenderedDOMComponentsWithClass(this.composer, 'quoted-text-control');
      return expect(toggles.length).toBe(0);
    }));
  });
});
