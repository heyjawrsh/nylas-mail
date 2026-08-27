/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const fs = require('fs');

let style = null;

module.exports = {
  activate() {
    return NylasEnv.commands.add(document.body, "window:toggle-screenshot-mode", function() {
      if (!style) {
        style = document.createElement('style');
        style.innerText = fs.readFileSync(path.join(__dirname, '..', 'assets','font-override.css')).toString();
      }

      if (style.parentElement) {
        return document.body.removeChild(style);
      } else {
        return document.body.appendChild(style);
      }
    });
  },

  deactivate() {
    if (style && style.parentElement) {
      return document.body.removeChild(style);
    }
  },

  serialize() {}
};
