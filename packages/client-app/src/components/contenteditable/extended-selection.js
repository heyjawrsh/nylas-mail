/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const { DOMUtils } = require("nylas-exports");
const ExportedSelection = require("./exported-selection").default;

// Convenience methods over the DOM's Selection object
// https://developer.mozilla.org/en-US/docs/Web/API/Selection
class ExtendedSelection {
	static initClass() {
		Object.defineProperty(ExtendedSelection.prototype, "anchorNode", {
			get() {
				return this.rawSelection.anchorNode;
			},
			set() {
				throw this._errNoSet("anchorNode");
			},
		});
		Object.defineProperty(ExtendedSelection.prototype, "anchorOffset", {
			get() {
				return this.rawSelection.anchorOffset;
			},
			set() {
				throw this._errNoSet("anchorOffset");
			},
		});
		Object.defineProperty(ExtendedSelection.prototype, "focusNode", {
			get() {
				return this.rawSelection.focusNode;
			},
			set() {
				throw this._errNoSet("focusNode");
			},
		});
		Object.defineProperty(ExtendedSelection.prototype, "focusOffset", {
			get() {
				return this.rawSelection.focusOffset;
			},
			set() {
				throw this._errNoSet("focusOffset");
			},
		});
		Object.defineProperty(ExtendedSelection.prototype, "isCollapsed", {
			get() {
				return this.rawSelection.isCollapsed;
			},
			set() {
				throw this._errNoSet("isCollapsed");
			},
		});
		Object.defineProperty(ExtendedSelection.prototype, "rangeCount", {
			get() {
				return this.rawSelection.rangeCount;
			},
			set() {
				throw this._errNoSet("rangeCount");
			},
		});
	}
	constructor(scopeNode) {
		this.scopeNode = scopeNode;
		if (this.scopeNode == null) {
			this.scopeNode = document.body;
		}
		this.rawSelection = document.getSelection();
	}

	isInScope() {
		return (
			this.anchorNode != null &&
			this.focusNode != null &&
			this.anchorOffset != null &&
			this.focusOffset != null &&
			this.scopeNode.contains(this.anchorNode) &&
			this.scopeNode.contains(this.focusNode)
		);
	}

	// Public: Conveniently select nodes.
	select(...args) {
		if (args.length === 0) {
			throw this._errBadUsage();
		} else if (args.length === 1) {
			if (args[0] instanceof ExportedSelection) {
				this.importSelection(args[0]);
			} else if (args[0] instanceof Range) {
				this.selectRange(args[0]);
			} else {
				this.selectAt(args[0]);
			}
		} else if (args.length === 2) {
			this.selectFromTo(...Array.from(args || []));
		} else if (args.length === 3) {
			throw this._errBadUsage();
		} else if (args.length === 4) {
			this.selectFromToWithIndex(...Array.from(args || []));
		} else if (args.length >= 5) {
			throw this._errBadUsage();
		}
		return this;
	}

	selectAt(at) {
		const nodeAt = this.findNodeAt(at);
		const range = new Range();
		range.selectNode(nodeAt);
		this.rawSelection.removeAllRanges();
		this.rawSelection.addRange(range);
		return this;
	}

	selectRange(range) {
		return this.setBaseAndExtent(
			range.startContainer,
			range.startOffset,
			range.endContainer,
			range.endOffset,
		);
	}

	selectFromTo(from, to) {
		const fromNode = this.findNodeAt(from);
		const toNode = this.findNodeAt(to);
		if (!fromNode || !toNode) {
			return;
		}
		return this.setBaseAndExtent(
			fromNode,
			0,
			toNode,
			toNode.length != null ? toNode.length : 0,
		);
	}

	selectFromToWithIndex(from, fromIndex, to, toIndex) {
		const fromNode = this.findNodeAt(from);
		const toNode = this.findNodeAt(to);
		if (!_.isNumber(fromIndex) || !_.isNumber(toIndex)) {
			throw this._errBadUsage();
		}
		if (!fromNode || !toNode) {
			return;
		}
		return this.setBaseAndExtent(fromNode, fromIndex, toNode, toIndex);
	}

	exportSelection() {
		return new ExportedSelection(this.rawSelection, this.scopeNode);
	}

	// A selectionSnapshot is slightly different from an {ExportedSelection}.
	// An {ExportedSelection} maintains clones of the nodes (which don't have
	// parentNodes nor are attached to the dcoument). An {ExportedSelection}
	// also contains counting indices for future restoration.
	//
	// This is necessary since references to `rawSelection` can have its
	// anchorNodes change out from underneath it as the selection changes.
	selectionSnapshot() {
		return {
			anchorNode: this.rawSelection.anchorNode,
			anchorOffset: this.rawSelection.anchorOffset,
			focusNode: this.rawSelection.focusNode,
			focusOffset: this.rawSelection.focusOffset,
			isCollapsed: this.rawSelection.isCollapsed,
		};
	}

	// Since the last time we exported the selection, the DOM may have
	// completely changed due to a re-render. To the user it may look
	// identical, but the newly rendered region may be comprised of
	// completely new DOM nodes. Our old node references may not exist
	// anymore. As such, we have the task of re-finding the nodes again and
	// creating a new selection that matches as accurately as possible.
	//
	// There are multiple ways of setting a new selection with the Selection
	// API. One very common one is to create a new Range object and then call
	// `addRange` on a selection instance. This does NOT work for us because
	// `Range` objects are direction-less. A Selection's start node (aka
	// anchor node aka base node) can be "after" a selection's end node (aka
	// focus node aka extent node).
	importSelection(exportedSelection) {
		if (!(exportedSelection instanceof ExportedSelection)) {
			return;
		}
		const newAnchorNode = DOMUtils.findSimilarNodeAtIndex(
			this.scopeNode,
			exportedSelection.anchorNode,
			exportedSelection.anchorNodeIndex,
		);

		const newFocusNode = DOMUtils.findSimilarNodeAtIndex(
			this.scopeNode,
			exportedSelection.focusNode,
			exportedSelection.focusNodeIndex,
		);

		return this.setBaseAndExtent(
			newAnchorNode,
			exportedSelection.anchorOffset,
			newFocusNode,
			exportedSelection.focusOffset,
		);
	}

	findNodeAt(arg) {
		let node = null;
		if (arg instanceof Node) {
			node = arg;
		} else if (_.isString(arg)) {
			node = this.scopeNode.querySelector(arg);
		} else if (_.isRegExp(arg)) {
			//# TODO
			node = DOMUtils.findNodeByRegex(this.scopeNode, arg);
		}

		return node;
	}

	// Finds the start and end text index of the current selection relative
	// to a given Node or Range. Returns an object of the form:
	//   {startIndex, endIndex}
	//
	// Uses getIndexedTextContent to index the text, which accounts for line breaks
	// from DIVs and BRs. For ranges, the index takes into account the start and end
	// offsets of the range.
	getSelectionTextIndex(refRangeOrNode) {
		let parentNode;
		if (!DOMUtils.selectionStartsOrEndsIn(refRangeOrNode)) {
			return null;
		}
		const sel = this.rawSelection;
		if (!sel) {
			return null;
		}
		let startIndex = null;
		let endIndex = null;
		let range = null;
		let rangeOffset = 0;
		if (refRangeOrNode instanceof Range) {
			range = refRangeOrNode;
			parentNode = range.commonAncestorContainer;
		} else {
			parentNode = refRangeOrNode;
		}

		// If the selection is directly on the parent node, just return the
		// selection offsets
		if (parentNode === sel.anchorNode) {
			if (range) {
				rangeOffset = range.startOffset;
			}
			startIndex = sel.anchorOffset - rangeOffset;
		}
		if (parentNode === sel.focusNode) {
			if (range) {
				rangeOffset = range.startOffset;
			}
			endIndex = sel.focusOffset - rangeOffset;
		}

		if (parentNode === sel.anchorNode && parentNode === sel.focusNode) {
			return { startIndex, endIndex };
		}

		// Otherwise find the start and end index within a text representation of the
		// parent node
		for (var { node, start, end } of Array.from(
			DOMUtils.getIndexedTextContent(parentNode),
		)) {
			if ((range != null ? range.startContainer : undefined) === node) {
				rangeOffset = start + range.startOffset;
			}
			if (sel.anchorNode === node) {
				startIndex = start + sel.anchorOffset - rangeOffset;
			}
			if (sel.focusNode === node) {
				endIndex = start + sel.focusOffset - rangeOffset;
			}
		}
		return { startIndex, endIndex };
	}

	// Sets the current selection to start and end at the specified indices, relative
	// to the given Range or Node. This is the inverse of getSelectionByTextIndex.
	//
	// Uses getIndexedTextContent to index the text, which accounts for line breaks
	// from DIVs and BRs. For ranges, the index takes into account the start and end
	// offsets of the range.
	restoreSelectionByTextIndex(refRangeOrNode, startIndex, endIndex) {
		let parentNode;
		let startNode = null;
		let startOffset = null;
		let endNode = null;
		let endOffset = null;
		let range = null;
		const sel = this.rawSelection;
		if (refRangeOrNode instanceof Range) {
			range = refRangeOrNode;
			parentNode = range.commonAncestorContainer;
		} else {
			parentNode = refRangeOrNode;
		}

		if (parentNode.childNodes.length === 0) {
			// text node
			sel.setBaseAndExtent(parentNode, startIndex, parentNode, endIndex);
		}

		let inRange = range === null; // we're not in range yet, unless there is no range
		const items = DOMUtils.getIndexedTextContent(parentNode);
		for (let i = 0; i < items.length; i++) {
			var { node, start, end } = items[i];
			inRange = inRange || range.startContainer === node;
			var atEnd = i === items.length - 1;
			if (!inRange) {
				continue;
			}
			if ((range != null ? range.startContainer : undefined) === node) {
				var rangeOffset = start + range.startIndex;
				if (startIndex != null) {
					startIndex += rangeOffset;
				}
				if (endIndex != null) {
					endIndex += rangeOffset;
				}
			}
			if (
				startIndex != null &&
				startIndex >= start &&
				(startIndex < end || (atEnd && startIndex === end))
			) {
				startNode = node;
				startOffset = startIndex - start;
			}
			if (
				endIndex != null &&
				endIndex >= start &&
				(endIndex < end || (atEnd && endIndex === end))
			) {
				endNode = node;
				endOffset = endIndex - start;
			}
		}
		return sel.setBaseAndExtent(
			startNode != null ? startNode : sel.anchorNode,
			startOffset != null ? startOffset : sel.anchorOffset,
			endNode != null ? endNode : sel.focusNode,
			endOffset != null ? endOffset : sel.focusOffset,
		);
	}

	setBaseAndExtent(...args) {
		return this.rawSelection.setBaseAndExtent(...Array.from(args || []));
	}
	getRangeAt(...args) {
		return this.rawSelection.getRangeAt(...Array.from(args || []));
	}
	collapse(...args) {
		return this.rawSelection.collapse(...Array.from(args || []));
	}
	extend(...args) {
		return this.rawSelection.extend(...Array.from(args || []));
	}
	modify(...args) {
		return this.rawSelection.modify(...Array.from(args || []));
	}
	collapseToStart(...args) {
		return this.rawSelection.collapseToStart(...Array.from(args || []));
	}
	collapseToEnd(...args) {
		return this.rawSelection.collapseToEnd(...Array.from(args || []));
	}
	selectAllChildren(...args) {
		return this.rawSelection.selectAllChildren(...Array.from(args || []));
	}
	addRange(...args) {
		return this.rawSelection.addRange(...Array.from(args || []));
	}
	removeRange(...args) {
		return this.rawSelection.removeRange(...Array.from(args || []));
	}
	removeAllRanges(...args) {
		return this.rawSelection.removeAllRanges(...Array.from(args || []));
	}
	deleteFromDocument(...args) {
		return this.rawSelection.deleteFromDocument(...Array.from(args || []));
	}
	toString(...args) {
		return this.rawSelection.toString(...Array.from(args || []));
	}
	containsNode(...args) {
		return this.rawSelection.containsNode(...Array.from(args || []));
	}

	_errBadUsage() {
		return new Error("Invalid arguments");
	}
	_errNoSet(property) {
		return new Error(`Can't set ${property}`);
	}
}
ExtendedSelection.initClass();

module.exports = ExtendedSelection;
