/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require('underscore');
const {DOMUtils} = require('nylas-exports');
const React = require('react');
const ExtendedSelection = require('./extended-selection');
let OverlaidComponents = null;

// An extended interface of execCommand
//
// Muates the DOM and Selection in atomic and predictable ways.
//
// editor.select(/{{}}/).checkNode().wrapNode("code")
//
// codeTags.forEach (tag) ->
//   if testTag(tag) DOMUtils.unwrap(tag)
//
// fn: ->
//   editor.moveDown().indent().selectRight(2).wrapSelection().bold().moveToEnd()
//
//   editor.moveDown()
//   editor.selectRight()
//   editor.bold()
//   editor.indent()
//   editor.moveToEnd()
//
//   moveToEnd bold selectRight moveDown current()
//
class EditorAPI {
  constructor(rootNode) {
    this.rootNode = rootNode;
    this._extendedSelection = new ExtendedSelection(this.rootNode);
  }

  wrapSelection(nodeName) {
    const wrapped = DOMUtils.wrap(this._extendedSelection.getRangeAt(0), nodeName);
    this.select(wrapped);
    return this;
  }

  unwrapNodeAndSelectAll(node) {
    const replacedNodes = DOMUtils.unwrapNode(node);
    if (replacedNodes.length === 0) { return this; }
    const first = DOMUtils.findFirstTextNode(replacedNodes[0]);
    const last = DOMUtils.findLastTextNode(_.last(replacedNodes));
    this._extendedSelection.selectFromTo(first, last);
    return this;
  }

  regExpSelectorAll(regex) {
    return DOMUtils.regExpSelectorAll(this.rootNode, regex);
  }

  currentSelection() { return this._extendedSelection; }

  whilePreservingSelection(fn) {
    // We only preserve selection if the active element is actually within the
    // contenteditable. Otherwise, we can unintentionally "steal" focus back if
    // `whilePreservingSelection` is called by a plugin when we are not focused.
    if ((document.activeElement !== this.rootNode) && !this.rootNode.contains(document.activeElement)) { return fn(); }
    const sel = this.currentSelection().exportSelection();
    fn();
    return this.select(sel);
  }

  getSelectionTextIndex(...args) {
    return this._extendedSelection.getSelectionTextIndex(...Array.from(args || []));
  }

  importSelection(...args) {
    this._extendedSelection.importSelection(...Array.from(args || [])); return this;
  }

  select(...args) {
    this._extendedSelection.select(...Array.from(args || [])); return this;
  }

  selectAllChildren(...args) {
    this._extendedSelection.selectAllChildren(...Array.from(args || [])); return this;
  }

  restoreSelectionByTextIndex(...args) {
    this._extendedSelection.restoreSelectionByTextIndex(...Array.from(args || [])); return this;
  }

  normalize() { this.rootNode.normalize(); return this; }

  insertCustomComponent(componentKey, props) {
    if (props == null) { props = {}; }
    if (OverlaidComponents == null) { OverlaidComponents = require('../overlaid-components/overlaid-components').default; }
    const {anchorId, anchorTag} = OverlaidComponents.buildAnchorTag(componentKey, props, props.anchorId);
    this.insertHTML(anchorTag);
    return anchorId;
  }

  removeCustomComponentByAnchorId(anchorId) {
    if (!anchorId) { return; }
    const node = this.rootNode.querySelector(`img[data-overlay-id=\"${anchorId}\"]`);
    return (node != null ? node.parentNode.removeChild(node) : undefined);
  }

  //#######################################################################
  //###################### execCommand Delegation #########################
  //#######################################################################
  backColor(color) { return this._ec("backColor", false, color); }
  bold() { return this._ec("bold", false); }
  copy() { return this._ec("copy", false); }
  createLink(uri) { return this._ec("createLink", false, uri); }
  cut() { return this._ec("cut", false); }
  decreaseFontSize() { return this._ec("decreaseFontSize", false); }
  delete() { return this._ec("delete", false); }
  fontName(fontName) { return this._ec("fontName", false, fontName); }
  fontSize(fontSize) { return this._ec("fontSize", false, fontSize); }
  foreColor(color) { return this._ec("foreColor", false, color); }
  formatBlock(tagName) { return this._ec("formatBlock", false, tagName); }
  forwardDelete() { return this._ec("forwardDelete", false); }
  heading(tagName) { return this._ec("heading", false, tagName); }
  hiliteColor(color) { return this._ec("hiliteColor", false, color); }
  increaseFontSize() { return this._ec("increaseFontSize", false); }
  indent() { return this._ec("indent", false); }
  insertHorizontalRule() { return this._ec("insertHorizontalRule", false); }

  insertHTML(html, param) {
    if (param == null) { param = {}; }
    const {selectInsertion} = param;
    if (selectInsertion) {
      const wrappedHtml = `<span id="tmp-html-insertion-wrap">${html}</span>`;
      this._ec("insertHTML", false, wrappedHtml);
      const wrap = this.rootNode.querySelector("#tmp-html-insertion-wrap");
      this.unwrapNodeAndSelectAll(wrap);
      return this;
    } else {
      return this._ec("insertHTML", false, html);
    }
  }

  insertImage(uri) { return this._ec("insertImage", false, uri); }
  insertOrderedList() { return this._ec("insertOrderedList", false); }
  insertUnorderedList() { return this._ec("insertUnorderedList", false); }
  insertParagraph() { return this._ec("insertParagraph", false); }
  insertText(text) { return this._ec("insertText", false, text); }
  italic() { return this._ec("italic", false); }
  justifyCenter() { return this._ec("justifyCenter", false); }
  justifyFull() { return this._ec("justifyFull", false); }
  justifyLeft() { return this._ec("justifyLeft", false); }
  justifyRight() { return this._ec("justifyRight", false); }
  outdent() { return this._ec("outdent", false); }
  paste() { return this._ec("paste", false); }
  redo() { return this._ec("redo", false); }
  removeFormat() { return this._ec("removeFormat", false); }
  selectAll() { return this._ec("selectAll", false); }
  strikeThrough() { return this._ec("strikeThrough", false); }
  subscript() { return this._ec("subscript", false); }
  superscript() { return this._ec("superscript", false); }
  underline() { return this._ec("underline", false); }
  undo() { return this._ec("undo", false); }
  unlink() { return this._ec("unlink", false); }
  styleWithCSS(style) { return this._ec("styleWithCSS", false, style); }

  contentReadOnly() { return this._notImplemented(); }
  enableInlineTableEditing() { return this._notImplemented(); }
  enableObjectResizing() { return this._notImplemented(); }
  insertBrOnReturn() { return this._notImplemented(); }
  useCSS() { return this._notImplemented(); }

  //#######################################################################
  //###################### Private Helper Methods #########################
  //#######################################################################
  _ec(...args) { document.execCommand(...Array.from(args || [])); return this; }
  _notImplemented() { throw new Error("Not implemented"); }
}

module.exports = EditorAPI;
