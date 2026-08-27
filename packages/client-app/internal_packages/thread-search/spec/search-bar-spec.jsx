/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const React = require("react");
const ReactDOM = require("react-dom");
const ReactTestUtils = require("react-addons-test-utils");

const ThreadSearchBar = require("../lib/thread-search-bar").default;
const SearchActions = require("../lib/search-actions").default;

describe("ThreadSearchBar", () => {
	beforeEach(function () {
		spyOn(NylasEnv, "isMainWindow").andReturn(true);
		this.searchBar = ReactTestUtils.renderIntoDocument(<ThreadSearchBar />);
		return (this.input = ReactDOM.findDOMNode(this.searchBar).querySelector(
			"input",
		));
	});

	it("supports search queries with a colon character", function () {
		spyOn(SearchActions, "queryChanged");
		const test = "::Hello: World::";
		ReactTestUtils.Simulate.change(this.input, { target: { value: test } });
		return expect(SearchActions.queryChanged).toHaveBeenCalledWith(test);
	});

	return it("preserves capitalization on searches", function () {
		const test = "HeLlO wOrLd";
		ReactTestUtils.Simulate.change(this.input, { target: { value: test } });
		waitsFor(() => {
			return this.input.value.length > 0;
		});
		return runs(() => {
			return expect(this.input.value).toBe(test);
		});
	});
});
