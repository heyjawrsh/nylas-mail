/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const { EventEmitter } = require("node:events");
const _ = require("underscore");
const WindowsUpdater = require("./windows-updater.js");

class WindowsUpdaterSquirrelAdapter {
	static initClass() {
		_.extend(WindowsUpdaterSquirrelAdapter.prototype, EventEmitter.prototype);
	}

	setFeedURL(updateUrl) {
		this.updateUrl = updateUrl;
	}

	restartN1() {
		if (WindowsUpdater.existsSync()) {
			return WindowsUpdater.restartN1(require("electron").app);
		} else {
			return console.error("SquirrelUpdate does not exist");
		}
	}

	downloadUpdate(callback) {
		return WindowsUpdater.spawn(
			["--download", this.updateUrl],
			(error, stdout) => {
				let update;
				if (error != null) {
					return callback(error);
				}

				try {
					// Last line of output is the JSON details about the releases
					const json = stdout.trim().split("\n").pop();
					update = __guardMethod__(
						__guard__(JSON.parse(json), (x) => x.releasesToApply),
						"pop",
						(o) => o.pop(),
					);
				} catch (error1) {
					error = error1;
					error.stdout = stdout;
					return callback(error);
				}

				return callback(null, update);
			},
		);
	}

	installUpdate(callback) {
		return WindowsUpdater.spawn(["--update", this.updateUrl], callback);
	}

	supportsUpdates() {
		return WindowsUpdater.existsSync();
	}

	downloadAndInstallUpdate() {
		if (!this.updateUrl) {
			throw new Error("Update URL is not set");
		}

		this.emit("checking-for-update");

		if (!WindowsUpdater.existsSync()) {
			this.emit("update-not-available");
			return;
		}

		return this.downloadUpdate((error, update) => {
			if (error != null) {
				this.emit("update-not-available");
				return;
			}

			if (update == null) {
				this.emit("update-not-available");
				return;
			}

			this.emit("update-available");
			return this.installUpdate((error) => {
				if (error != null) {
					this.emit("error", error);
					return;
				}

				// During this time, Windows Squirrel will invoke the Nylas.exe
				// with a variety of flags as event hooks.
				//
				// See https://github.com/Squirrel/Squirrel.Windows/blob/master/docs/using/custom-squirrel-events-non-cs.md
				//
				// See `handleStartupEventsWithSquirrel` in `src/browser/main.js`

				return this.emit(
					"update-downloaded",
					{},
					update.releaseNotes,
					update.version,
				);
			});
		});
	}
}
WindowsUpdaterSquirrelAdapter.initClass();

module.exports = new WindowsUpdaterSquirrelAdapter();

function __guardMethod__(obj, methodName, transform) {
	if (
		typeof obj !== "undefined" &&
		obj !== null &&
		typeof obj[methodName] === "function"
	) {
		return transform(obj, methodName);
	} else {
		return undefined;
	}
}
function __guard__(value, transform) {
	return typeof value !== "undefined" && value !== null
		? transform(value)
		: undefined;
}
