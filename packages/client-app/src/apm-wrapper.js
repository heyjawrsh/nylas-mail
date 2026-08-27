/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let APMWrapper;
const _ = require("underscore");
const Q = require("q");
const semver = require("semver");

const BufferedProcess = require("./buffered-process");

module.exports = APMWrapper = class APMWrapper {
	constructor() {
		this.packagePromises = [];
	}

	runCommand(args, options, callback) {
		const command = NylasEnv.packages.getApmPath();
		const outputLines = [];
		const stdout = (lines) => outputLines.push(lines);
		const errorLines = [];
		const stderr = (lines) => errorLines.push(lines);
		const exit = (code) =>
			callback(code, outputLines.join("\n"), errorLines.join("\n"));

		if (!options) {
			options = {};
		}
		options.env = {
			ATOM_API_URL: "https://edgehill-packages.nylas.com/api",
			ATOM_RESOURCE_PATH: NylasEnv.getLoadSettings().resourcePath,
			ATOM_HOME: NylasEnv.getConfigDirPath(),
		};

		if (process.platform === "win32") {
			options.env["ProgramFiles"] = process.env.ProgramFiles;
		}

		args.push("--no-color");
		return new BufferedProcess({
			command,
			args,
			stdout,
			stderr,
			exit,
			options,
		});
	}

	runCommandReturningPackages(args, errorMessage, callback) {
		return this.runCommand(args, null, (code, stdout, stderr) => {
			let error;
			if (code === 0) {
				let packages;
				try {
					let left;
					packages = (left = JSON.parse(stdout)) != null ? left : [];
				} catch (parseError) {
					error = createJsonParseError(errorMessage, parseError, stdout);
					return callback(error);
				}
				return callback(null, packages);
			} else {
				error = new Error(errorMessage);
				error.stdout = stdout;
				error.stderr = stderr;
				return callback(error);
			}
		});
	}

	loadInstalled(callback) {
		const args = ["ls", "--json"];
		const errorMessage = "Fetching local packages failed.";
		const apmProcess = this.runCommandReturningPackages(
			args,
			errorMessage,
			callback,
		);

		return handleProcessErrors(apmProcess, errorMessage, callback);
	}

	loadFeatured(options, callback) {
		const args = ["featured", "--json"];
		const version = NylasEnv.getVersion();
		if (options.themes) {
			args.push("--themes");
		}
		if (semver.valid(version)) {
			args.push("--compatible", version);
		}
		const errorMessage = "Fetching featured packages failed.";

		const apmProcess = this.runCommandReturningPackages(
			args,
			errorMessage,
			callback,
		);
		return handleProcessErrors(apmProcess, errorMessage, callback);
	}

	loadOutdated(callback) {
		const args = ["outdated", "--json"];
		const version = NylasEnv.getVersion();
		if (semver.valid(version)) {
			args.push("--compatible", version);
		}
		const errorMessage = "Fetching outdated packages and themes failed.";

		const apmProcess = this.runCommandReturningPackages(
			args,
			errorMessage,
			callback,
		);
		return handleProcessErrors(apmProcess, errorMessage, callback);
	}

	loadPackage(packageName, callback) {
		const args = ["view", packageName, "--json"];
		const errorMessage = `Fetching package '${packageName}' failed.`;

		const apmProcess = this.runCommandReturningPackages(
			args,
			errorMessage,
			callback,
		);
		return handleProcessErrors(apmProcess, errorMessage, callback);
	}

	loadCompatiblePackageVersion(packageName, callback) {
		const args = [
			"view",
			packageName,
			"--json",
			"--compatible",
			this.normalizeVersion(NylasEnv.getVersion()),
		];
		const errorMessage = `Fetching package '${packageName}' failed.`;

		const apmProcess = this.runCommandReturningPackages(
			args,
			errorMessage,
			callback,
		);
		return handleProcessErrors(apmProcess, errorMessage, callback);
	}

	getInstalled() {
		return Promise.promisify(this.loadInstalled, { context: this })();
	}

	getFeatured(options) {
		if (options == null) {
			options = {};
		}
		return Promise.promisify(this.loadFeatured, { context: this })(options);
	}

	getOutdated() {
		return Promise.promisify(this.loadOutdated, { context: this })();
	}

	getPackage(packageName) {
		return this.packagePromises[packageName] != null
			? this.packagePromises[packageName]
			: (this.packagePromises[packageName] = Promise.promisify(
					this.loadPackage,
					{ context: this },
				)());
	}

	satisfiesVersion(version, metadata) {
		const engine =
			(metadata.engines != null ? metadata.engines.nylas : undefined) != null
				? metadata.engines != null
					? metadata.engines.nylas
					: undefined
				: "*";
		if (!semver.validRange(engine)) {
			return false;
		}
		return semver.satisfies(version, engine);
	}

	normalizeVersion(version) {
		if (typeof version === "string") {
			[version] = Array.from(version.split("-"));
		}
		return version;
	}

	search(query, options) {
		if (options == null) {
			options = {};
		}
		const deferred = Promise.defer();

		const args = ["search", query, "--json"];
		if (options.themes) {
			args.push("--themes");
		} else if (options.packages) {
			args.push("--packages");
		}
		const errorMessage = `Searching for \u201C${query}\u201D failed.`;

		const apmProcess = this.runCommand(args, null, (code, stdout, stderr) => {
			let error;
			if (code === 0) {
				try {
					let left;
					const packages = (left = JSON.parse(stdout)) != null ? left : [];
					return deferred.resolve(packages);
				} catch (parseError) {
					error = createJsonParseError(errorMessage, parseError, stdout);
					return deferred.reject(error);
				}
			} else {
				error = new Error(errorMessage);
				error.stdout = stdout;
				error.stderr = stderr;
				return deferred.reject(error);
			}
		});

		handleProcessErrors(apmProcess, errorMessage, (error) =>
			deferred.reject(error),
		);

		return deferred.promise;
	}

	update(pack, newVersion, callback) {
		let activateOnSuccess;
		const { name, theme } = pack;

		if (theme) {
			activateOnSuccess = NylasEnv.packages.isPackageActive(name);
		} else {
			activateOnSuccess = !NylasEnv.packages.isPackageDisabled(name);
		}
		const activateOnFailure = NylasEnv.packages.isPackageActive(name);
		if (NylasEnv.packages.isPackageActive(name)) {
			NylasEnv.packages.deactivatePackage(name);
		}
		if (NylasEnv.packages.isPackageLoaded(name)) {
			NylasEnv.packages.unloadPackage(name);
		}

		const errorMessage = `Updating to \u201C${name}@${newVersion}\u201D failed.`;
		const onError = (error) => {
			error.packageInstallError = !theme;
			return callback(error);
		};

		const args = ["install", `${name}@${newVersion}`];
		const exit = (code, stdout, stderr) => {
			if (code === 0) {
				if (activateOnSuccess) {
					NylasEnv.packages.activatePackage(name);
				} else {
					NylasEnv.packages.loadPackage(name);
				}

				return typeof callback === "function" ? callback() : undefined;
			} else {
				if (activateOnFailure) {
					NylasEnv.packages.activatePackage(name);
				}
				const error = new Error(errorMessage);
				error.stdout = stdout;
				error.stderr = stderr;
				return onError(error);
			}
		};

		const apmProcess = this.runCommand(args, null, exit);
		return handleProcessErrors(apmProcess, errorMessage, onError);
	}

	unload(packageName) {
		if (NylasEnv.packages.isPackageLoaded(name)) {
			if (NylasEnv.packages.isPackageActive(name)) {
				NylasEnv.packages.deactivatePackage(name);
			}
			return NylasEnv.packages.unloadPackage(name);
		}
	}

	install(pack, callback) {
		const { name, version, theme } = pack;
		const activateOnSuccess =
			!theme && !NylasEnv.packages.isPackageDisabled(name);
		const activateOnFailure = NylasEnv.packages.isPackageActive(name);

		this.unload(name);
		const args = ["install", `${name}@${version}`];

		const errorMessage = `Installing \u201C${name}@${version}\u201D failed.`;
		const onError = (error) => {
			error.packageInstallError = !theme;
			return callback(error);
		};

		const exit = (code, stdout, stderr) => {
			if (code === 0) {
				if (activateOnSuccess) {
					NylasEnv.packages.activatePackage(name);
				} else {
					NylasEnv.packages.loadPackage(name);
				}

				return typeof callback === "function" ? callback() : undefined;
			} else {
				if (activateOnFailure) {
					NylasEnv.packages.activatePackage(name);
				}
				const error = new Error(errorMessage);
				error.stdout = stdout;
				error.stderr = stderr;
				return onError(error);
			}
		};

		const apmProcess = this.runCommand(args, null, exit);
		return handleProcessErrors(apmProcess, errorMessage, onError);
	}

	installDependenciesInPackageDirectory(dir, callback) {
		const errorMessage =
			"Running apm install failed to install package dependencies.";

		const exit = (code, stdout, stderr) => {
			if (code === 0) {
				return typeof callback === "function" ? callback() : undefined;
			} else {
				const error = new Error(errorMessage);
				error.stdout = stdout;
				error.stderr = stderr;
				return callback(error);
			}
		};

		const apmProcess = this.runCommand(
			["install", "--production"],
			{ cwd: dir },
			exit,
		);
		return handleProcessErrors(apmProcess, errorMessage, callback);
	}

	uninstall(pack, callback) {
		const { name } = pack;

		if (NylasEnv.packages.isPackageActive(name)) {
			NylasEnv.packages.deactivatePackage(name);
		}

		const errorMessage = `Uninstalling \u201C${name}\u201D failed.`;
		const onError = (error) => {
			return callback(error);
		};

		const apmProcess = this.runCommand(
			["uninstall", "--hard", name],
			null,
			(code, stdout, stderr) => {
				if (code === 0) {
					this.unload(name);
					return typeof callback === "function" ? callback() : undefined;
				} else {
					const error = new Error(errorMessage);
					error.stdout = stdout;
					error.stderr = stderr;
					return onError(error);
				}
			},
		);

		return handleProcessErrors(apmProcess, errorMessage, onError);
	}

	canUpgrade(installedPackage, availableVersion) {
		if (installedPackage == null) {
			return false;
		}

		const installedVersion = installedPackage.metadata.version;
		if (!semver.valid(installedVersion)) {
			return false;
		}
		if (!semver.valid(availableVersion)) {
			return false;
		}

		return semver.gt(availableVersion, installedVersion);
	}

	checkNativeBuildTools() {
		const deferred = Promise.defer();
		const apmProcess = this.runCommand(
			["install", "--check"],
			null,
			(code, stdout, stderr) => {
				if (code === 0) {
					return deferred.resolve();
				} else {
					return deferred.reject(new Error());
				}
			},
		);

		apmProcess.onWillThrowError(({ error, handle }) => {
			handle();
			return deferred.reject(error);
		});

		return deferred.promise;
	}
};

var createJsonParseError = (message, parseError, stdout) => {
	const error = new Error(message);
	error.stdout = "";
	error.stderr = `${parseError.message}: ${stdout}`;
	return error;
};

const createProcessError = (message, processError) => {
	const error = new Error(message);
	error.stdout = "";
	error.stderr = processError.message;
	return error;
};

var handleProcessErrors = (apmProcess, message, callback) =>
	apmProcess.onWillThrowError(({ error, handle }) => {
		handle();
		return callback(createProcessError(message, error));
	});
