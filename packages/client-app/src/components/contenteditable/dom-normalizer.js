/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const { ContenteditableExtension, DOMUtils } = require("nylas-exports");

class DOMNormalizer extends ContenteditableExtension {
	// This component works by re-rendering on every change and restoring the
	// selection. This is also how standard React controlled inputs work too.
	//
	// Since the contents of the contenteditable are complex, nested DOM
	// structures, a simple replacement of the DOM is not easy. There are a
	// variety of edge cases that we need to correct for and prepare both the
	// HTML and the selection to be serialized without error.
	static onContentChanged({ editor, mutations }) {
		DOMNormalizer._cleanHTML(editor);
		return DOMNormalizer._cleanSelection(editor);
	}

	// We need to clean the HTML on input to fix several edge cases that
	// arise when we go to save the selection state and restore it on the
	// next render.
	static _cleanHTML(editor) {
		if (!editor.rootNode) {
			return;
		}

		// One issue is that we need to pre-normalize the HTML so it looks the
		// same after it gets re-inserted. If we key selection markers off of
		// an non normalized DOM, then they won't match up when the HTML gets
		// reset.
		//
		// The Node.normalize() method puts the specified node and all of its
		// sub-tree into a "normalized" form. In a normalized sub-tree, no text
		// nodes in the sub-tree are empty and there are no adjacent text
		// nodes.
		editor.normalize();

		return DOMNormalizer._fixLeadingBRCondition(editor);
	}

	// An issue arises from <br/> tags immediately inside of divs. In this
	// case the cursor's anchor node will not be the <br/> tag, but rather
	// the entire enclosing element. Sometimes, that enclosing element is the
	// container wrapping all of the content. The browser has a native
	// built-in feature that will automatically scroll the page to the bottom
	// of the current element that the cursor is in if the cursor is off the
	// screen. In the given case, that element is the whole div. The net
	// effect is that the browser will scroll erroneously to the bottom of
	// the whole content div, which is likely NOT where the cursor is or the
	// user wants. The solution to this is to replace this particular case
	// with <span></span> tags and place the cursor in there.
	static _fixLeadingBRCondition(editor) {
		const treeWalker = document.createTreeWalker(editor.rootNode);
		while (treeWalker.nextNode()) {
			var { currentNode } = treeWalker;
			if (DOMNormalizer._hasLeadingBRCondition(currentNode)) {
				var newNode = document.createElement("div");
				newNode.appendChild(document.createElement("br"));
				currentNode.replaceChild(newNode, currentNode.childNodes[0]);
			}
		}
	}

	static _hasLeadingBRCondition(node) {
		const { childNodes } = node;
		return childNodes.length >= 2 && childNodes[0].nodeName === "BR";
	}

	// After an input, the selection can sometimes get itself into a state
	// that either can't be restored properly, or will cause undersirable
	// native behavior. This method, in combination with `_cleanHTML`, fixes
	// each of those scenarios before we save and later restore the
	// selection.
	static _cleanSelection(editor) {
		const selection = editor.currentSelection();
		if (selection.anchorNode == null || selection.focusNode == null) {
			return;
		}

		// The _unselectableNode case only is valid when it's at the very top
		// (offset 0) of the node. If the offsets are > 0 that means we're
		// trying to select somewhere within some sort of containing element.
		// This is okay to do. The odd case only arises at the top of
		// unselectable elements.
		if (selection.anchorOffset > 0 || selection.focusOffset > 0) {
			return;
		}

		if (
			selection.isCollapsed &&
			DOMNormalizer._unselectableNode(selection.focusNode)
		) {
			const treeWalker = document.createTreeWalker(selection.focusNode);
			while (treeWalker.nextNode()) {
				var { currentNode } = treeWalker;
				if (DOMNormalizer._unselectableNode(currentNode)) {
					selection.setBaseAndExtent(currentNode, 0, currentNode, 0);
					break;
				}
			}
		}
	}

	static _unselectableNode(node) {
		if (!node) {
			return true;
		}
		if (node.nodeType === Node.TEXT_NODE && DOMUtils.isBlankTextNode(node)) {
			return true;
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const child = node.firstChild;
			if (!child) {
				return true;
			}
			const hasText =
				child.nodeType === Node.TEXT_NODE && !DOMUtils.isBlankTextNode(node);
			const hasBr =
				child.nodeType === Node.ELEMENT_NODE && node.nodeName === "BR";
			return !hasText && !hasBr;
		} else {
			return false;
		}
	}
}

module.exports = DOMNormalizer;
