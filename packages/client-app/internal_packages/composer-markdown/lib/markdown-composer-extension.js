/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const marked = require("marked");
const _Utils = require("./utils");
const { ComposerExtension } = require("nylas-exports");

const rawBodies = {};

class MarkdownComposerExtension extends ComposerExtension {
	static applyTransformsForSending({ draftBodyRootNode, draft }) {
		rawBodies[draft.clientId] = draftBodyRootNode.innerHTML;
		return (draftBodyRootNode.innerHTML = marked(draftBodyRootNode.innerText));
	}

	static unapplyTransformsForSending({ draftBodyRootNode, draft }) {
		if (rawBodies[draft.clientId]) {
			return (draftBodyRootNode.innerHTML = rawBodies[draft.clientId]);
		}
	}
}

module.exports = MarkdownComposerExtension;
