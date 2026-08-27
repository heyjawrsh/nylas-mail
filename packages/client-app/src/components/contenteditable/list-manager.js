import { DOMUtils, ContenteditableExtension } from "nylas-exports";

export default class ListManager extends ContenteditableExtension {
	static keyCommandHandlers() {
		return {
			"contenteditable:numbered-list": ListManager._insertNumberedList,
			"contenteditable:bulleted-list": ListManager._insertBulletedList,
		};
	}

	static onContentChanged({ editor }) {
		if (
			ListManager._spaceEntered &&
			ListManager.hasListStartSignature(editor.currentSelection())
		) {
			ListManager.createList(editor);
		}

		return ListManager._collapseAdjacentLists(editor);
	}

	static onKeyDown({ editor, event }) {
		ListManager._spaceEntered = event.key === " ";
		if (DOMUtils.isInList()) {
			if (event.key === "Backspace" && DOMUtils.atStartOfList()) {
				event.preventDefault();
				ListManager.outdentListItem(editor);
			} else if (event.key === "Tab" && editor.currentSelection().isCollapsed) {
				event.preventDefault();
				if (event.shiftKey) {
					ListManager.outdentListItem(editor);
				} else {
					editor.indent();
				}
			} else {
				// Do nothing, let the event through.
				ListManager.originalInput = null;
			}
		} else {
			ListManager.originalInput = null;
		}

		return event;
	}

	static bulletRegex() {
		return /^[*-]\s[^\S]*/;
	}

	static numberRegex() {
		return /^\d\.\s[^\S]*/;
	}

	static hasListStartSignature(selection) {
		if (!selection?.anchorNode) {
			return false;
		}
		if (!selection.isCollapsed) {
			return false;
		}

		const sibling = selection.anchorNode.previousElementSibling;
		if (!sibling || DOMUtils.looksLikeBlockElement(sibling)) {
			const text = selection.anchorNode.textContent;
			return (
				ListManager.numberRegex().test(text) ||
				ListManager.bulletRegex().test(text)
			);
		}
		return false;
	}

	static createList(editor) {
		const anchorNode = editor.currentSelection().anchorNode;
		const text = anchorNode ? anchorNode.textContent : null;
		if (!text) {
			return;
		}
		if (ListManager.numberRegex().test(text)) {
			ListManager.originalInput = text.slice(0, 3);
			ListManager.insertList(editor, { ordered: true });
			ListManager.removeListStarter(
				ListManager.numberRegex(),
				editor.currentSelection(),
			);
		} else if (ListManager.bulletRegex().test(text)) {
			ListManager.originalInput = text.slice(0, 2);
			ListManager.insertList(editor, { ordered: false });
			ListManager.removeListStarter(
				ListManager.bulletRegex(),
				editor.currentSelection(),
			);
		} else {
			return;
		}
		const el = DOMUtils.closest(editor.currentSelection().anchorNode, "li");
		DOMUtils.Mutating.removeEmptyNodes(el);
	}

	static removeListStarter(starterRegex, selection) {
		const el = DOMUtils.closest(selection.anchorNode, "li");
		const textContent = el.textContent.replace(starterRegex, "");

		if (textContent.trim().length === 0) {
			el.innerHTML = "<br>";
		} else {
			const textNode = DOMUtils.findFirstTextNode(el);
			textNode.textContent = textNode.textContent.replace(starterRegex, "");
		}
	}

	// From a newly-created list
	// Outdent returns to a <div><br/></div> structure
	// I need to turn into <div>-&nbsp;</div>
	//
	// From a list with content
	// Outent returns to <div>sometext</div>
	// We need to turn that into <div>-&nbsp;sometext</div>
	static restoreOriginalInput(editor) {
		const node = editor.currentSelection().anchorNode;
		if (!node) {
			return;
		}

		if (node.nodeType === Node.TEXT_NODE) {
			node.textContent = ListManager.originalInput + node.textContent;
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const textNode = DOMUtils.findFirstTextNode(node);
			if (!textNode) {
				node.innerHTML =
					ListManager.originalInput.replace(" ", "&nbsp;") + node.innerHTML;
			} else {
				textNode.textContent = ListManager.originalInput + textNode.textContent;
			}
		}

		if (ListManager.numberRegex().test(ListManager.originalInput)) {
			DOMUtils.Mutating.moveSelectionToIndexInAnchorNode(
				editor.currentSelection(),
				3,
			); // digit plus dot
		}
		if (ListManager.bulletRegex().test(ListManager.originalInput)) {
			DOMUtils.Mutating.moveSelectionToIndexInAnchorNode(
				editor.currentSelection(),
				2,
			); // dash or star
		}

		ListManager.originalInput = null;
	}

	static insertList(editor, { ordered }) {
		const node = editor.currentSelection().anchorNode;
		if (ListManager.isInsideListItem(node)) {
			editor.indent();
		} else {
			if (ordered === true) {
				editor.insertOrderedList();
			} else {
				editor.insertUnorderedList();
			}
		}
	}

	static _insertNumberedList({ editor }) {
		return editor.insertOrderedList();
	}

	static _insertBulletedList({ editor }) {
		return editor.insertUnorderedList();
	}

	static outdentListItem(editor) {
		if (ListManager.originalInput) {
			editor.outdent();
			ListManager.restoreOriginalInput(editor);
		}
		editor.outdent();
	}

	static isInsideListItem(node) {
		return DOMUtils.isDescendantOf(node, (parent) => parent.tagName === "LI");
	}

	// If users ended up with two <ul> lists adjacent to each other, we
	// collapse them into one. We leave adjacent <ol> lists intact in case
	// the user wanted to restart the numbering sequence
	static _collapseAdjacentLists(editor) {
		const els = editor.rootNode.querySelectorAll("ul, ol");

		// This mutates the DOM in place.
		return DOMUtils.Mutating.collapseAdjacentElements(els);
	}
}
