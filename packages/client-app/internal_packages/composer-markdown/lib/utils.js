/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */

class Utils {
	static getTextFromHtml(html) {
		const div = document.createElement("div");
		div.innerHTML = html;
		return div.textContent != null ? div.textContent : div.innerText;
	}
}

module.exports = Utils;
