/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const {MessageViewExtension, Actions} = require('nylas-exports');
const PGPKeyStore = require('./pgp-key-store');

class DecryptPGPExtension extends MessageViewExtension {
  static initClass() {
    this.formatMessageBody = ({message}) => {
      if (!PGPKeyStore.hasEncryptedComponent(message)) {
        return message;
      }
      if (PGPKeyStore.isDecrypted(message)) {
        message.body = PGPKeyStore.getDecrypted(message);
      } else {
        // trigger a decryption
        PGPKeyStore.decrypt(message);
      }
      return message;
    };
  }
}
DecryptPGPExtension.initClass();

module.exports = DecryptPGPExtension;
