/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import Reflux from "reflux";

const Actions = ["focusAccounts", "setKeyCollapsed"];

for (var idx of Array.from(Actions)) {
	Actions[idx] = Reflux.createAction(Actions[idx]);
	Actions[idx].sync = true;
}

export default Actions;
