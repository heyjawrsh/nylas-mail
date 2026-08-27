/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const NylasAPI = require("./flux/nylas-api.js").default;
const nock = require("nock");

// We be wrecking havok in your code
class ChaosMonkey {
	static unleashOnAPI(param) {
		if (param == null) {
			param = {};
		}
		let { errorCode, numMonkeys, makeTimeout } = param;
		if (errorCode == null) {
			errorCode = 500;
		}
		if (numMonkeys == null) {
			numMonkeys = "all the monkeys";
		}
		if (makeTimeout == null) {
			makeTimeout = false;
		}
		let nGet = nock(NylasAPI.APIRoot);
		let nPut = nock(NylasAPI.APIRoot);
		let nPost = nock(NylasAPI.APIRoot);

		let numTimes = 1;
		if (numMonkeys.toLowerCase() === "all the monkeys") {
			nGet = nGet.persist();
			nPut = nPut.persist();
			nPost = nPost.persist();
		} else if (_.isNumber(numMonkeys)) {
			numTimes = numMonkeys;
		}

		nGet = nGet.filteringPath((_path) => "/*").get("/*");

		nPut = nPut
			.filteringRequestBody((_body) => "*")
			.filteringPath((_path) => "/*")
			.put("/*", "*");

		nPost = nPost
			.filteringRequestBody((_body) => "*")
			.filteringPath((_path) => "/*")
			.post("/*", "*");

		[nGet, nPut, nPost] = Array.from(
			[nGet, nPut, nPost].map((n) => {
				n = n.times(numTimes);
				if (makeTimeout) {
					return n.socketDelay(31000);
				} else {
					return n;
				}
			}),
		);

		if (makeTimeout) {
			return [nGet, nPut, nPost].forEach((n) => n.reply(200, "Timed out"));
		} else {
			nGet.replyWithError({ message: "Monkey GET error!", code: errorCode });
			nPut.replyWithError({ message: "Monkey PUT error!", code: errorCode });
			return nPost.replyWithError({
				message: "Monkey POST error!",
				code: errorCode,
			});
		}
	}

	static goHome() {
		nock.restore();
		return nock.cleanAll();
	}
}

window.ChaosMonkey = ChaosMonkey;
module.exports = ChaosMonkey;
