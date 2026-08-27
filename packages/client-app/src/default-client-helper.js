/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const { exec } = require("child_process");
const fs = require("fs");
const { remote, shell } = require("electron");

const bundleIdentifier = "com.nylas.nylas-mail";

class Windows {
	available() {
		return true;
	}

	isRegisteredForURLScheme(scheme, callback) {
		if (!callback) {
			throw new Error("isRegisteredForURLScheme is async, provide a callback");
		}
		let output = "";
		return exec(
			`reg.exe query HKCU\\SOFTWARE\\Microsoft\\Windows\\Roaming\\OpenWith\\UrlAssociations\\${scheme}\\UserChoice`,
			(err, stdout, stderr) => {
				output += stdout.toString();
				return exec(
					`reg.exe query HKCU\\SOFTWARE\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\${scheme}\\UserChoice`,
					(err, stdout, stderr) => {
						output += stdout.toString();
						if (callback && err) {
							return callback(err);
						}
						return callback(stdout.includes("Nylas"));
					},
				);
			},
		);
	}

	resetURLScheme(scheme, callback) {
		return remote.dialog.showMessageBox(
			null,
			{
				type: "info",
				buttons: ["Learn More"],
				message: "Visit Windows Settings to change your default mail client",
				detail:
					"You'll find Nylas Mail, along with other options, listed in Default Apps > Mail.",
			},
			() =>
				shell.openExternal(
					"https://support.nylas.com/hc/en-us/articles/229277648",
				),
		);
	}

	registerForURLScheme(scheme, callback) {
		// Ensure that our registry entires are present
		const WindowsUpdater = remote.require("./windows-updater");
		return WindowsUpdater.createRegistryEntries(
			{
				allowEscalation: true,
				registerDefaultIfPossible: true,
			},
			(err, didMakeDefault) => {
				if (err) {
					remote.dialog.showMessageBox(null, {
						type: "error",
						buttons: ["OK"],
						message: "Sorry, an error occurred.",
						detail: err.message,
					});
				}

				if (!didMakeDefault) {
					remote.dialog.showMessageBox(
						null,
						{
							type: "info",
							buttons: ["Learn More"],
							defaultId: 1,
							message:
								"Visit Windows Settings to finish making Nylas Mail your mail client",
							detail:
								"Click 'Learn More' to view instructions in our knowledge base.",
						},
						() =>
							shell.openExternal(
								"https://support.nylas.com/hc/en-us/articles/229277648",
							),
					);
				}

				if (callback) {
					return callback(null, null);
				}
			},
		);
	}
}

class Linux {
	available() {
		return true;
	}

	isRegisteredForURLScheme(scheme, callback) {
		if (!callback) {
			throw new Error("isRegisteredForURLScheme is async, provide a callback");
		}
		return exec(
			`xdg-mime query default x-scheme-handler/${scheme}`,
			(err, stdout, stderr) => {
				if (err) {
					return callback(err);
				}
				return callback(stdout.trim() === "nylas.desktop");
			},
		);
	}

	resetURLScheme(scheme, callback) {
		return exec(
			`xdg-mime default thunderbird.desktop x-scheme-handler/${scheme}`,
			(err, stdout, stderr) => {
				if (callback && err) {
					return callback(err);
				}
				if (callback) {
					return callback(null, null);
				}
			},
		);
	}

	registerForURLScheme(scheme, callback) {
		return exec(
			`xdg-mime default nylas.desktop x-scheme-handler/${scheme}`,
			(err, stdout, stderr) => {
				if (callback && err) {
					return callback(err);
				}
				if (callback) {
					return callback(null, null);
				}
			},
		);
	}
}

class Mac {
	constructor() {
		this.secure = false;
	}

	available() {
		return true;
	}

	getLaunchServicesPlistPath(callback) {
		const secure = `${process.env.HOME}/Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure.plist`;
		const insecure = `${process.env.HOME}/Library/Preferences/com.apple.LaunchServices.plist`;

		return fs.exists(secure, (exists) => {
			if (exists) {
				return callback(secure);
			} else {
				return callback(insecure);
			}
		});
	}

	readDefaults(callback) {
		return this.getLaunchServicesPlistPath((plistPath) => {
			const tmpPath = `${plistPath}.${Math.random()}`;
			return exec(
				`plutil -convert json "${plistPath}" -o "${tmpPath}"`,
				(err, stdout, stderr) => {
					if (callback && err) {
						return callback(err);
					}
					return fs.readFile(tmpPath, (err, data) => {
						if (callback && err) {
							return callback(err);
						}
						try {
							data = JSON.parse(data);
							callback(data["LSHandlers"], data);
							return fs.unlink(tmpPath);
						} catch (e) {
							if (callback && err) {
								return callback(e);
							}
						}
					});
				},
			);
		});
	}

	writeDefaults(defaults, callback) {
		return this.getLaunchServicesPlistPath((plistPath) => {
			const tmpPath = `${plistPath}.${Math.random()}`;
			return exec(
				`plutil -convert json "${plistPath}" -o "${tmpPath}"`,
				(err, stdout, stderr) => {
					if (callback && err) {
						return callback(err);
					}
					try {
						let data = fs.readFileSync(tmpPath);
						data = JSON.parse(data);
						data["LSHandlers"] = defaults;
						data = JSON.stringify(data);
						fs.writeFileSync(tmpPath, data);
					} catch (error) {
						if (callback && error) {
							return callback(error);
						}
					}

					return exec(
						`plutil -convert binary1 "${tmpPath}" -o "${plistPath}"`,
						() => {
							fs.unlink(tmpPath);
							return exec(
								"/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain system -domain user",
								(err, stdout, stderr) => {
									if (callback) {
										return callback(err);
									}
								},
							);
						},
					);
				},
			);
		});
	}

	isRegisteredForURLScheme(scheme, callback) {
		if (!callback) {
			throw new Error("isRegisteredForURLScheme is async, provide a callback");
		}
		return this.readDefaults((defaults) => {
			for (var def of Array.from(defaults)) {
				if (def.LSHandlerURLScheme === scheme) {
					return callback(def.LSHandlerRoleAll === bundleIdentifier);
				}
			}
			return callback(false);
		});
	}

	resetURLScheme(scheme, callback) {
		return this.readDefaults((defaults) => {
			// Remove anything already registered for the scheme
			for (let ii = defaults.length - 1; ii >= 0; ii--) {
				if (defaults[ii].LSHandlerURLScheme === scheme) {
					defaults.splice(ii, 1);
				}
			}
			return this.writeDefaults(defaults, callback);
		});
	}

	registerForURLScheme(scheme, callback) {
		return this.readDefaults((defaults) => {
			// Remove anything already registered for the scheme
			for (let ii = defaults.length - 1; ii >= 0; ii--) {
				if (defaults[ii].LSHandlerURLScheme === scheme) {
					defaults.splice(ii, 1);
				}
			}

			// Add our scheme default
			defaults.push({
				LSHandlerURLScheme: scheme,
				LSHandlerRoleAll: bundleIdentifier,
			});

			return this.writeDefaults(defaults, callback);
		});
	}
}

if (process.platform === "darwin") {
	module.exports = Mac;
} else if (process.platform === "linux") {
	module.exports = Linux;
} else if (process.platform === "win32") {
	module.exports = Windows;
} else {
	module.exports = {};
}

module.exports.Mac = Mac;
module.exports.Linux = Linux;
module.exports.Windows = Windows;
