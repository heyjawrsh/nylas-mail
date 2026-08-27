/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// Markdown Editor
// Last Revised: April 23, 2015 by Ben Gotow
//
// Markdown editor is a simple React component that allows you to type your
// emails in markdown and see the live preview of your email in html
//
const { ExtensionRegistry, ComponentRegistry } = require("nylas-exports");
const MarkdownEditor = require("./markdown-editor");
const MarkdownComposerExtension = require("./markdown-composer-extension");

module.exports = {
	activate() {
		ComponentRegistry.register(MarkdownEditor, { role: "Composer:Editor" });
		return ExtensionRegistry.Composer.register(MarkdownComposerExtension);
	},

	serialize() {},

	deactivate() {
		ComponentRegistry.unregister(MarkdownEditor);
		return ExtensionRegistry.Composer.unregister(MarkdownComposerExtension);
	},
};
