/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const { ipcRenderer } = require("electron");
const Utils = require("./flux/models/utils");

class WindowBridge {
	constructor() {
		this._onResults = this._onResults.bind(this);
		this._onRunInWindow = this._onRunInWindow.bind(this);
		this._tasks = {};
		ipcRenderer.on("remote-run-results", this._onResults);
		ipcRenderer.on("run-in-window", this._onRunInWindow);
	}

	runInWindow(window, objectName, methodName, args) {
		const taskId = Utils.generateTempId();
		return new Promise((resolve, reject) => {
			this._tasks[taskId] = { resolve, reject };
			args = JSON.stringify(args, Utils.registeredObjectReplacer);
			const params = { window, objectName, methodName, args, taskId };
			return ipcRenderer.send("run-in-window", params);
		});
	}

	runInMainWindow(...args) {
		return this.runInWindow("main", ...Array.from(args));
	}

	runInWorkWindow(...args) {
		return this.runInWindow("work", ...Array.from(args));
	}

	_onResults(event, param) {
		if (param == null) {
			param = {};
		}
		let { returnValue, taskId } = param;
		returnValue = JSON.parse(returnValue, Utils.registeredObjectReviver);
		this._tasks[taskId].resolve(returnValue);
		return delete this._tasks[taskId];
	}

	_onRunInWindow(event, param) {
		if (param == null) {
			param = {};
		}
		let { objectName, methodName, args, taskId } = param;
		args = JSON.parse(args, Utils.registeredObjectReviver);
		const exports = require("nylas-exports");
		const result = exports[objectName][methodName].apply(null, args);
		if (_.isFunction(result.then)) {
			return result.then((returnValue) => {
				returnValue = JSON.stringify(
					returnValue,
					Utils.registeredObjectReplacer,
				);
				return ipcRenderer.send("remote-run-results", { returnValue, taskId });
			});
		} else {
			let returnValue = result;
			returnValue = JSON.stringify(returnValue, Utils.registeredObjectReplacer);
			return ipcRenderer.send("remote-run-results", { returnValue, taskId });
		}
	}
}

module.exports = new WindowBridge();
