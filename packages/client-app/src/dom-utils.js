/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const _s = require("underscore.string");

var DOMUtils = {
	Mutating: {
		replaceFirstListItem(li, replaceWith) {
			let text;
			const list = DOMUtils.closest(li, "ul, ol");

			if (replaceWith.length === 0) {
				replaceWith = replaceWith.replace(/\s/g, "&nbsp;");
				text = document.createElement("div");
				text.innerHTML = "<br>";
			} else {
				replaceWith = replaceWith.replace(/\s/g, "&nbsp;");
				text = document.createElement("span");
				text.innerHTML = `${replaceWith}`;
			}

			if (list.querySelectorAll("li").length <= 1) {
				// Delete the whole list and replace with text
				list.parentNode.replaceChild(text, list);
			} else {
				// Delete the list item and prepend the text before the rest of the
				// list
				li.parentNode.removeChild(li);
				list.parentNode.insertBefore(text, list);
			}

			const child = text.childNodes[0] != null ? text.childNodes[0] : text;
			const index = Math.max(replaceWith.length - 1, 0);
			const selection = document.getSelection();
			return selection.setBaseAndExtent(child, index, child, index);
		},

		removeEmptyNodes(node) {
			return Array.prototype.slice.call(node.childNodes).forEach((child) => {
				if (child.textContent === "") {
					return node.removeChild(child);
				} else {
					return DOMUtils.Mutating.removeEmptyNodes(child);
				}
			});
		},

		// Given a bunch of elements, it will go through and find all elements
		// that are adjacent to that one of the same type. For each set of
		// adjacent elements, it will put all children of those elements into
		// the first one and delete the remaining elements.
		collapseAdjacentElements(els) {
			let el;
			if (els == null) {
				els = [];
			}
			if (els.length === 0) {
				return;
			}
			els = Array.prototype.slice.call(els);

			let seenEls = [];
			const toMerge = [];

			for (el of Array.from(els)) {
				if (Array.from(seenEls).includes(el)) {
					continue;
				}
				var adjacent = DOMUtils.collectAdjacent(el);
				seenEls = seenEls.concat(adjacent);
				if (adjacent.length <= 1) {
					continue;
				}
				toMerge.push(adjacent);
			}

			const anchors = [];
			for (var mergeSet of Array.from(toMerge)) {
				var anchor = mergeSet[0];
				var remaining = mergeSet.slice(1);
				for (el of Array.from(remaining)) {
					while (el.childNodes.length > 0) {
						anchor.appendChild(el.childNodes[0]);
					}
				}
				DOMUtils.Mutating.removeElements(remaining);
				anchors.push(anchor);
			}

			return anchors;
		},

		removeElements(elements) {
			if (elements == null) {
				elements = [];
			}
			for (var el of Array.from(elements)) {
				try {
					if (el.parentNode) {
						el.parentNode.removeChild(el);
					}
				} catch (_error) {}
			}
			return elements;
		},

		applyTextInRange(range, selection, newText) {
			range.deleteContents();
			const node = document.createTextNode(newText);
			range.insertNode(node);
			range.selectNode(node);
			selection.removeAllRanges();
			return selection.addRange(range);
		},

		getRangeAtAndSelectWord(selection, index) {
			let range = selection.getRangeAt(index);

			// On Windows, right-clicking a word does not select it at the OS-level.
			if (range.collapsed) {
				DOMUtils.Mutating.selectWordContainingRange(range);
				range = selection.getRangeAt(index);
			}
			return range;
		},

		// This method finds the bounding points of the word that the range
		// is currently within and selects that word.
		selectWordContainingRange(range) {
			const selection = document.getSelection();
			const node = selection.focusNode;
			const text = node.textContent;
			let wordStart = _s
				.reverse(text.substring(0, selection.focusOffset))
				.search(/\s/);
			if (wordStart === -1) {
				wordStart = 0;
			} else {
				wordStart = selection.focusOffset - wordStart;
			}
			let wordEnd = text.substring(selection.focusOffset).search(/\s/);
			if (wordEnd === -1) {
				wordEnd = text.length;
			} else {
				wordEnd += selection.focusOffset;
			}

			selection.removeAllRanges();
			range = new Range();
			range.setStart(node, wordStart);
			range.setEnd(node, wordEnd);
			return selection.addRange(range);
		},

		moveSelectionToIndexInAnchorNode(selection, index) {
			if (!selection.isCollapsed) {
				return;
			}
			const node = selection.anchorNode;
			return selection.setBaseAndExtent(node, index, node, index);
		},

		moveSelectionToEnd(selection) {
			if (!selection.isCollapsed) {
				return;
			}
			const node = DOMUtils.findLastTextNode(selection.anchorNode);
			const index = node.length;
			return selection.setBaseAndExtent(node, index, node, index);
		},
	},

	getSelectionRectFromDOM(selection) {
		if (selection == null) {
			selection = document.getSelection();
		}
		const node = selection.anchorNode;
		if (node.nodeType === Node.TEXT_NODE) {
			const r = document.createRange();
			r.selectNodeContents(node);
			return r.getBoundingClientRect();
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			return node.getBoundingClientRect();
		} else {
			return null;
		}
	},

	isSelectionInTextNode(selection) {
		if (selection == null) {
			selection = document.getSelection();
		}
		if (!selection) {
			return false;
		}
		return (
			selection.isCollapsed &&
			selection.anchorNode.nodeType === Node.TEXT_NODE &&
			selection.anchorOffset > 0
		);
	},

	isAtTabChar(selection) {
		if (selection == null) {
			selection = document.getSelection();
		}
		if (DOMUtils.isSelectionInTextNode(selection)) {
			return (
				selection.anchorNode.textContent[selection.anchorOffset - 1] === "\t"
			);
		} else {
			return false;
		}
	},

	isAtBeginningOfDocument(dom, selection) {
		if (selection == null) {
			selection = document.getSelection();
		}
		if (!selection.isCollapsed) {
			return false;
		}
		if (selection.anchorOffset > 0) {
			return false;
		}
		if (dom.childNodes.length === 0) {
			return true;
		}
		if (selection.anchorNode === dom) {
			return true;
		}
		const firstChild = dom.childNodes[0];
		return selection.anchorNode === firstChild;
	},

	atStartOfList() {
		const selection = document.getSelection();
		const anchor = selection.anchorNode;
		if (!selection.isCollapsed) {
			return false;
		}
		if ((anchor != null ? anchor.nodeName : undefined) === "LI") {
			return true;
		}
		if (selection.anchorOffset > 0) {
			return false;
		}
		const li = DOMUtils.closest(anchor, "li");
		if (!li) {
			return;
		}
		return DOMUtils.isFirstChild(li, anchor);
	},

	// Selectors for input types
	inputTypes() {
		return "input, textarea, *[contenteditable]";
	},

	// https://developer.mozilla.org/en-US/docs/Web/API/Element/closest
	// Only Elements (not Text nodes) have the `closest` method
	closest(node, selector) {
		if (node instanceof HTMLElement) {
			return node.closest(selector);
		} else if (node != null ? node.parentNode : undefined) {
			return DOMUtils.closest(node.parentNode, selector);
		} else {
			return null;
		}
	},

	closestAtCursor(selector) {
		const selection = document.getSelection();
		if (!(selection != null ? selection.isCollapsed : undefined)) {
			return;
		}
		return DOMUtils.closest(selection.anchorNode, selector);
	},

	closestElement(node) {
		if (node instanceof HTMLElement) {
			return node;
		} else if (node != null ? node.parentNode : undefined) {
			return DOMUtils.closestElement(node.parentNode);
		} else {
			return null;
		}
	},

	isInList() {
		const li = DOMUtils.closestAtCursor("li");
		const list = DOMUtils.closestAtCursor("ul, ol");
		return li && list;
	},

	// Returns an array of all immediately adjacent nodes of a particular
	// nodeName relative to the root. Includes the root if it has the correct
	// nodeName.
	//
	// nodName is optional. if left blank it'll be the nodeName of the root
	collectAdjacent(root, nodeName) {
		if (nodeName == null) {
			({ nodeName } = root);
		}
		const adjacent = [];

		let node = root;
		while (
			(node.nextSibling != null ? node.nextSibling.nodeName : undefined) ===
			nodeName
		) {
			adjacent.push(node.nextSibling);
			node = node.nextSibling;
		}

		if (root.nodeName === nodeName) {
			adjacent.unshift(root);
		}

		node = root;
		while (
			(node.previousSibling != null
				? node.previousSibling.nodeName
				: undefined) === nodeName
		) {
			adjacent.unshift(node.previousSibling);
			node = node.previousSibling;
		}

		return adjacent;
	},

	getNodeIndex: (context, nodeToFind) => {
		return DOMUtils.indexOfNodeInSimilarNodes(context, nodeToFind);
	},

	getRangeInScope: (scope) => {
		let range;
		const selection = document.getSelection();
		if (!DOMUtils.selectionInScope(selection, scope)) {
			return null;
		}
		try {
			range = selection.getRangeAt(0);
		} catch (_error) {
			console.warn("Selection is not returning a range");
			return document.createRange();
		}
		return range;
	},

	selectionInScope(selection, scope) {
		if (selection == null) {
			return false;
		}
		if (scope == null) {
			return false;
		}
		return (
			scope.contains(selection.anchorNode) &&
			scope.contains(selection.focusNode)
		);
	},

	isEmptyBoundingRect(rect) {
		return (
			rect.top === 0 && rect.bottom === 0 && rect.left === 0 && rect.right === 0
		);
	},

	atEndOfContent(selection, rootScope, containerScope) {
		if (containerScope == null) {
			containerScope = rootScope;
		}
		if (selection.isCollapsed) {
			// We need to use `lastChild` instead of `lastElementChild` because
			// we need to eventually check if the `selection.focusNode`, which is
			// usually a TEXT node, is equal to the returned `lastChild`.
			// `lastElementChild` will not return TEXT nodes.
			//
			// Unfortunately, `lastChild` can sometime return COMMENT nodes and
			// other blank TEXT nodes that we don't want to compare to.
			//
			// For example, if you have the structure:
			// <div>
			//   <p>Foo</p>
			// </div>
			//
			// The div may have 2 childNodes and 1 childElementNode. The 2nd
			// hidden childNode is a TEXT node with a data of "\n". I actually
			// want to return the <p></p>.
			//
			// However, The <p> element may have 1 childNode and 0
			// childElementNodes. In that case I DO want to return the TEXT node
			// that has the data of "foo"
			const lastChild = DOMUtils.lastNonBlankChildNode(containerScope);

			// Special case for a completely empty contenteditable.
			// In this case `lastChild` will be null, but we are definitely at
			// the end of the content.
			if (containerScope === rootScope) {
				if (containerScope.childNodes.length === 0) {
					return true;
				}
			}

			if (!lastChild) {
				return false;
			}

			// NOTE: `.contains` returns true if `lastChild` is equal to
			// `selection.focusNode`
			//
			// See: http://ejohn.org/blog/comparing-document-position/
			const inLastChild = lastChild.contains(selection.focusNode);

			// We should do true object identity here instead of `.isEqualNode`
			const isLastChild = lastChild === selection.focusNode;

			if (isLastChild) {
				let atEndIndex;
				if (
					selection.focusNode != null ? selection.focusNode.length : undefined
				) {
					atEndIndex = selection.focusOffset === selection.focusNode.length;
				} else {
					atEndIndex = selection.focusOffset === 0;
				}
				return atEndIndex;
			} else if (inLastChild) {
				return DOMUtils.atEndOfContent(selection, rootScope, lastChild);
			} else {
				return false;
			}
		} else {
			return false;
		}
	},

	lastNonBlankChildNode(node) {
		const lastNode = null;
		for (let i = node.childNodes.length - 1; i >= 0; i--) {
			var childNode = node.childNodes[i];
			if (childNode.nodeType === Node.TEXT_NODE) {
				if (DOMUtils.isBlankTextNode(childNode)) {
				} else {
					return childNode;
				}
			} else if (childNode.nodeType === Node.ELEMENT_NODE) {
				return childNode;
			} else {
			}
		}
		return lastNode;
	},

	lastDescendent(node) {
		if (!node) {
			return null;
		}
		if (node.childNodes.length > 0) {
			return DOMUtils.lastDescendent(
				node.childNodes[node.childNodes.length - 1],
			);
		} else {
			return null;
		}
	},

	findLastTextNode(node) {
		if (!node) {
			return null;
		}
		if (node.nodeType === Node.TEXT_NODE) {
			return node;
		}
		for (let i = node.childNodes.length - 1; i >= 0; i--) {
			var childNode = node.childNodes[i];
			if (childNode.nodeType === Node.TEXT_NODE) {
				return childNode;
			} else if (childNode.nodeType === Node.ELEMENT_NODE) {
				return DOMUtils.findLastTextNode(childNode);
			} else {
			}
		}
		return null;
	},

	// Only looks down node trees with one child for a text node.
	// Returns null if there's no single text node
	findOnlyChildTextNode(node) {
		if (!node) {
			return null;
		}
		if (node.nodeType === Node.TEXT_NODE) {
			return node;
		}
		if (node.childNodes.length > 1) {
			return null;
		}
		return DOMUtils.findOnlyChildTextNode(node.childNodes[0]);
	},

	findFirstTextNode(node) {
		if (!node) {
			return null;
		}
		if (node.nodeType === Node.TEXT_NODE) {
			return node;
		}
		for (var childNode of Array.from(node.childNodes)) {
			if (childNode.nodeType === Node.TEXT_NODE) {
				return childNode;
			} else if (childNode.nodeType === Node.ELEMENT_NODE) {
				return DOMUtils.findFirstTextNode(childNode);
			} else {
			}
		}
		return null;
	},

	isBlankTextNode(node) {
		if (!(node != null ? node.data : undefined)) {
			return;
		}
		// \u00a0 is &nbsp;
		return node.data.replace(/\u00a0/g, "x").trim().length === 0;
	},

	indexOfNodeInSimilarNodes(context, nodeToFind) {
		if (nodeToFind.isEqualNode(context)) {
			return 0;
		}

		const treeWalker = document.createTreeWalker(context);
		let idx = 0;
		while (treeWalker.nextNode()) {
			if (treeWalker.currentNode.isEqualNode(nodeToFind)) {
				if (treeWalker.currentNode.isSameNode(nodeToFind)) {
					return idx;
				}
				idx += 1;
			}
		}

		return -1;
	},

	// This is an optimization of findSimilarNodes which avoids tons of extra work
	// scanning a large DOM if all we're going to do is get item at index [0]. It
	// returns once it has found the similar node at the index desired.
	findSimilarNodeAtIndex(context, nodeToFind, desiredIdx) {
		if (desiredIdx === 0 && nodeToFind.isEqualNode(context)) {
			return context;
		}

		const treeWalker = document.createTreeWalker(context);
		let idx = 0;
		while (treeWalker.nextNode()) {
			if (treeWalker.currentNode.isEqualNode(nodeToFind)) {
				if (desiredIdx === idx) {
					return treeWalker.currentNode;
				}
				idx += 1;
			}
		}

		return null;
	},

	findCharacter(context, character) {
		let currentNode;
		let node = null;
		let index = null;
		const treeWalker = document.createTreeWalker(context, NodeFilter.SHOW_TEXT);
		while ((currentNode = treeWalker.nextNode())) {
			var i = currentNode.data.indexOf(character);
			if (i >= 0) {
				node = currentNode;
				index = i;
				break;
			}
		}
		return { node, index };
	},

	escapeHTMLCharacters(text) {
		const map = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#039;",
		};
		return text.replace(/[&<>"']/g, (m) => map[m]);
	},

	// Checks to see if a particular node is visible and any of its parents
	// are visible.
	//
	// WARNING. This is a fairly expensive operation and should be used
	// sparingly.
	nodeIsVisible(node) {
		while (node && node.nodeType === Node.ELEMENT_NODE) {
			var style = window.getComputedStyle(node);
			node = node.parentNode;
			if (style == null) {
				continue;
			}
			var isInvisible =
				[0, "0"].includes(style.opacity) ||
				style.visibility === "hidden" ||
				style.display === "none" ||
				[0, "0", "0px"].includes(style.width) ||
				[0, "0", "0px"].includes(style.height);
			if (isInvisible) {
				return false;
			}
		}
		return true;
	},

	// This checks for the `offsetParent` to be null. This will work for
	// hidden elements, but not if they are in a `position:fixed` container.
	//
	// It is less thorough then Utils.nodeIsVisible, but is ~16x faster!!
	// http://jsperf.com/check-hidden
	// http://stackoverflow.com/a/21696585/793472
	nodeIsLikelyVisible(node) {
		return node.offsetParent !== null;
	},

	// Finds all of the non blank node in a {Document} object or HTML string.
	//
	// - `elementOrHTML` a dom element or an HTML string. If passed a
	// string, it will use `DOMParser` to convert it into a DOM object.
	//
	// "Non blank" is defined as any node whose `textContent` returns a
	// whitespace string.
	//
	// It will also reject nodes we see are invisible due to basic CSS
	// properties.
	//
	// Returns an array of DOM Nodes
	nodesWithContent(elementOrHTML) {
		let allNodes;
		const nodes = [];
		if (_.isString(elementOrHTML)) {
			const domParser = new DOMParser();
			const doc = domParser.parseFromString(elementOrHTML, "text/html");
			allNodes = doc.body.childNodes;
		} else if (elementOrHTML != null ? elementOrHTML.childNodes : undefined) {
			allNodes = elementOrHTML.childNodes;
		} else {
			return nodes;
		}

		// We need to check `childNodes` instead of `children` to look for
		// plain Text nodes.
		for (let i = allNodes.length - 1; i >= 0; i--) {
			var node = allNodes[i];
			if (node.nodeName === "IMG" || node.nodeName === "HR") {
				nodes.unshift(node);
			}

			// It's important to use `textContent` and NOT `innerText`.
			// `innerText` causes a full reflow on every call because it
			// calcaultes CSS styles to determine if the text is truly visible or
			// not. This utility method must NOT cause a reflow. We instead will
			// check for basic cases ourselves.
			if (
				(node.textContent != null ? node.textContent : "").trim().length === 0
			) {
				continue;
			}

			if (
				(node.style != null ? node.style.opacity : undefined) === 0 ||
				(node.style != null ? node.style.opacity : undefined) === "0" ||
				(node.style != null ? node.style.visibility : undefined) === "hidden" ||
				(node.style != null ? node.style.display : undefined) === "none"
			) {
				continue;
			}

			nodes.unshift(node);
		}

		// No nodes with content found!
		return nodes;
	},

	parents(node) {
		const nodes = [];
		while ((node = node.parentNode)) {
			nodes.unshift(node);
		}
		return nodes;
	},

	// Returns true if the node is the first child of the root, is the root,
	// or is the first child of the first child of the root, etc.
	isFirstChild(root, node) {
		if (!root || !node) {
			return false;
		}
		if (root === node) {
			return true;
		}
		if (!root.childNodes[0]) {
			return false;
		}
		if (root.childNodes[0] === node) {
			return true;
		}
		return DOMUtils.isFirstChild(root.childNodes[0], node);
	},

	commonAncestor(nodes, parentFilter) {
		if (nodes == null) {
			nodes = [];
		}
		if (nodes.length === 0) {
			return null;
		}

		nodes = Array.prototype.slice.call(nodes);

		let minDepth = Number.MAX_VALUE;
		// Sometimes we can potentially have tons of REALLY deeply nested
		// nodes. Since we're looking for a common ancestor we can really speed
		// this up by keeping track of the min depth reached. We know that we
		// won't need to check past that.
		const getParents = (node) => {
			const parentNodes = [node];
			let depth = 0;
			while ((node = node.parentNode)) {
				if (parentFilter) {
					if (parentFilter(node)) {
						parentNodes.unshift(node);
					}
				} else {
					parentNodes.unshift(node);
				}
				depth += 1;
				if (depth > minDepth) {
					break;
				}
			}
			minDepth = Math.min(minDepth, depth);
			return parentNodes;
		};

		// _.intersection will preserve the ordering of the parent node arrays.
		// parents are ordered top to bottom, so the last node is the most
		// specific common ancenstor
		return _.last(_.intersection.apply(null, nodes.map(getParents)));
	},

	scrollAdjustmentToMakeNodeVisibleInContainer(node, container) {
		if (!node) {
			return;
		}
		const nodeRect = node.getBoundingClientRect();
		const containerRect = container.getBoundingClientRect();
		return this.scrollAdjustmentToMakeRectVisibleInRect(
			nodeRect,
			containerRect,
		);
	},

	scrollAdjustmentToMakeRectVisibleInRect(nodeRect, containerRect) {
		const distanceBelowBottom =
			nodeRect.top +
			nodeRect.height -
			(containerRect.top + containerRect.height);
		if (distanceBelowBottom >= 0) {
			return distanceBelowBottom;
		}

		const distanceAboveTop = containerRect.top - nodeRect.top;
		if (distanceAboveTop >= 0) {
			return -distanceAboveTop;
		}

		return 0;
	},

	// Produces a list of indexed text contained within a given node. Returns a
	// list of objects of the form:
	//   {start, end, node, text}
	//
	// The text being indexed is intended to approximate the rendered content visible
	// to the user. This includes the nodeValue of any text nodes, and "\n" for any
	// DIV or BR elements.
	getIndexedTextContent(node) {
		const items = [];
		const treeWalker = document.createTreeWalker(
			node,
			NodeFilter.SHOW_ELEMENT + NodeFilter.SHOW_TEXT,
		);
		let position = 0;
		while (treeWalker.nextNode()) {
			node = treeWalker.currentNode;
			if (
				node.tagName === "BR" ||
				node.nodeType === Node.TEXT_NODE ||
				node.tagName === "DIV"
			) {
				var text = node.nodeType === Node.TEXT_NODE ? node.nodeValue : "\n";
				var item = {
					start: position,
					end: position + text.length,
					node,
					text,
				};
				items.push(item);
				position += text.length;
			}
		}
		return items;
	},

	// Returns true if the inner range is fully contained within the outer range
	rangeInRange(inner, outer) {
		return (
			outer.isPointInRange(inner.startContainer, inner.startOffset) &&
			outer.isPointInRange(inner.endContainer, inner.endOffset)
		);
	},

	// Returns true if the given ranges overlap
	rangeOverlapsRange(range1, range2) {
		return (
			range2.isPointInRange(range1.startContainer, range1.startOffset) ||
			range1.isPointInRange(range2.startContainer, range2.startOffset)
		);
	},

	// Returns true if the first range starts or ends within the second range.
	// Unlike rangeOverlapsRange, returns false if range2 is fully within range1.
	rangeStartsOrEndsInRange(range1, range2) {
		return (
			range2.isPointInRange(range1.startContainer, range1.startOffset) ||
			range2.isPointInRange(range1.endContainer, range1.endOffset)
		);
	},

	// Accepts a Range or a Node, and returns true if the current selection starts
	// or ends within it. Useful for knowing if a DOM modification will break the
	// current selection.
	selectionStartsOrEndsIn(rangeOrNode) {
		const selection = document.getSelection();
		if (!selection || !(selection.rangeCount > 0)) {
			return false;
		}
		if (rangeOrNode instanceof Range) {
			return this.rangeStartsOrEndsInRange(
				selection.getRangeAt(0),
				rangeOrNode,
			);
		} else if (rangeOrNode instanceof Node) {
			const range = new Range();
			range.selectNode(rangeOrNode);
			return this.rangeStartsOrEndsInRange(selection.getRangeAt(0), range);
		} else {
			return false;
		}
	},

	// Accepts a Range or a Node, and returns true if the current selection is fully
	// contained within it.
	selectionIsWithin(rangeOrNode) {
		const selection = document.getSelection();
		if (!selection || !(selection.rangeCount > 0)) {
			return false;
		}
		if (rangeOrNode instanceof Range) {
			return this.rangeInRange(selection.getRangeAt(0), rangeOrNode);
		} else if (rangeOrNode instanceof Node) {
			const range = new Range();
			range.selectNode(rangeOrNode);
			return this.rangeInRange(selection.getRangeAt(0), range);
		} else {
			return false;
		}
	},

	// Finds all matches to a regex within a node's text content (including line
	// breaks from DIVs and BRs, as \n), and returns a list of corresponding Range
	// objects.
	regExpSelectorAll(node, regex) {
		// Generate a text representation of the node's content
		let result;
		const nodeTextList = this.getIndexedTextContent(node);
		const text = nodeTextList.map(({ text }) => text).join("");

		// Build a list of range objects by looping over regex matches in the
		// text content string, and then finding the node those match indexes
		// point to.
		const ranges = [];
		let listPosition = 0;
		while ((result = regex.exec(text)) !== null) {
			var from = result.index;
			var to = regex.lastIndex;
			var item = nodeTextList[listPosition];
			var range = document.createRange();

			while (from >= item.end) {
				item = nodeTextList[++listPosition];
			}
			var start = item.node.nodeType === Node.TEXT_NODE ? from - item.start : 0;
			range.setStart(item.node, start);

			while (to > item.end) {
				item = nodeTextList[++listPosition];
			}
			var end = item.node.nodeType === Node.TEXT_NODE ? to - item.start : 0;
			range.setEnd(item.node, end);

			ranges.push(range);
		}

		return ranges;
	},

	// Returns true if the given range is the sole content of a node with the given
	// nodeName. If the range's parent has a different nodeName or contains any other
	// content, returns false.
	isWrapped(range, nodeName) {
		if (!range || !nodeName) {
			return false;
		}
		const startNode = range.startContainer;
		const endNode = range.endContainer;
		if (startNode.parentNode !== endNode.parentNode) {
			return false;
		} // must have same parent
		if (startNode.previousSibling || endNode.nextSibling) {
			return false;
		} // selection must span all sibling nodes
		if (range.startOffset > 0 || range.endOffset < endNode.textContent.length) {
			return false;
		} // selection must span all text
		return startNode.parentNode.nodeName === nodeName;
	},

	// Modifies the DOM to wrap the given range with a new node, of name nodeName.
	//
	// If the range starts or ends in the middle of an node, that node will be split.
	// This will likely break selections that contain any of the affected nodes.
	wrap(range, nodeName) {
		const newNode = document.createElement(nodeName);
		try {
			range.surroundContents(newNode);
		} catch (_error) {
			newNode.appendChild(range.extractContents());
			range.insertNode(newNode);
		}
		return newNode;
	},

	// Modifies the DOM to "unwrap" a given node, replacing that node with its contents.
	// This may break selections containing the affected nodes.
	// We don't use `document.createFragment` because the returned `fragment`
	// would be empty and useless after its children get replaced.
	unwrapNode(node) {
		let child;
		if (node.childNodes.length === 0) {
			return node;
		}
		const replacedNodes = [];
		const parent = node.parentNode;
		if (parent == null) {
			return node;
		}

		let lastChild = _.last(node.childNodes);
		replacedNodes.unshift(lastChild);
		parent.replaceChild(lastChild, node);

		while ((child = _.last(node.childNodes))) {
			replacedNodes.unshift(child);
			parent.insertBefore(child, lastChild);
			lastChild = child;
		}

		return replacedNodes;
	},

	isDescendantOf(node, matcher) {
		if (matcher == null) {
			matcher = () => false;
		}
		let parent = node != null ? node.parentElement : undefined;
		while (parent) {
			if (matcher(parent)) {
				return true;
			}
			parent = parent.parentElement;
		}
		return false;
	},

	looksLikeBlockElement(node) {
		return ["BR", "P", "BLOCKQUOTE", "DIV", "TABLE"].includes(node.nodeName);
	},

	// When detecting if we're at the start of a "visible" line, we need to look
	// for text nodes that have visible content in them.
	looksLikeNonEmptyNode(node) {
		const textNode = DOMUtils.findFirstTextNode(node);
		if (textNode) {
			if (/^[\n ]*$/.test(textNode.data)) {
				return false;
			} else {
				return true;
			}
		} else {
			return false;
		}
	},

	previousTextNode(node) {
		let curNode = node;
		while (curNode.parentNode) {
			if (curNode.previousSibling) {
				return this.findLastTextNode(curNode.previousSibling);
			}
			curNode = curNode.parentNode;
		}
		return null;
	},
};

module.exports = DOMUtils;
