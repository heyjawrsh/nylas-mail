/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const { ComponentRegistry, ExtensionRegistry } = require("nylas-exports");
const { activate, deactivate } = require("../lib/main");

const EncryptMessageButton = require("../lib/encrypt-button");
const DecryptMessageButton = require("../lib/decrypt-button");
const DecryptPGPExtension = require("../lib/decryption-preprocess");

describe("activate", () => {
	it("should register the encryption button", () => {
		spyOn(ComponentRegistry, "register");
		activate();
		return expect(ComponentRegistry.register).toHaveBeenCalledWith(
			EncryptMessageButton,
			{ role: "Composer:ActionButton" },
		);
	});

	it("should register the decryption button", () => {
		spyOn(ComponentRegistry, "register");
		activate();
		return expect(ComponentRegistry.register).toHaveBeenCalledWith(
			DecryptMessageButton,
			{ role: "message:BodyHeader" },
		);
	});

	return it("should register the decryption processor", () => {
		spyOn(ExtensionRegistry.MessageView, "register");
		activate();
		return expect(ExtensionRegistry.MessageView.register).toHaveBeenCalledWith(
			DecryptPGPExtension,
		);
	});
});

describe("deactivate", () => {
	it("should unregister the encrypt button", () => {
		spyOn(ComponentRegistry, "unregister");
		deactivate();
		return expect(ComponentRegistry.unregister).toHaveBeenCalledWith(
			EncryptMessageButton,
		);
	});

	it("should unregister the decryption button", () => {
		spyOn(ComponentRegistry, "unregister");
		deactivate();
		return expect(ComponentRegistry.unregister).toHaveBeenCalledWith(
			DecryptMessageButton,
		);
	});

	return it("should unregister the decryption processor", () => {
		spyOn(ExtensionRegistry.MessageView, "unregister");
		deactivate();
		return expect(
			ExtensionRegistry.MessageView.unregister,
		).toHaveBeenCalledWith(DecryptPGPExtension);
	});
});
