/* eslint dot-notation: 0 */
/* eslint global-require: 0 */
global.shellStartTime = Date.now();
var util = require("node:util");

console.inspect = function consoleInspect(val) {
	console.log(util.inspect(val, true, (depth = 7), (colorize = true)));
};

const app = require("electron").app;
const path = require("node:path");
const mkdirp = require("mkdirp");

if (typeof process.setFdLimit === "function") {
	process.setFdLimit(1024);
}

const setupConfigDir = (args) => {
	let defaultDirName = ".nylas-mail";
	if (args.devMode) {
		defaultDirName = ".nylas-dev";
	}
	if (args.specMode) {
		defaultDirName = ".nylas-spec";
	}
	if (args.benchmarkMode) {
		defaultDirName = ".nylas-bench";
	}
	let configDirPath = path.join(app.getPath("home"), defaultDirName);

	if (args.configDirPath) {
		configDirPath = args.configDirPath;
	} else if (process.env.NYLAS_HOME) {
		configDirPath = process.env.NYLAS_HOME;
	}

	mkdirp.sync(configDirPath);
	process.env.NYLAS_HOME = configDirPath;
	return configDirPath;
};

const setupCompileCache = (configDirPath) => {
	const compileCache = require("../compile-cache.js");
	return compileCache.setHomeDirectory(configDirPath);
};

const setupErrorLogger = (args = {}) => {
	const ErrorLogger = require("../error-logger.js");
	const errorLogger = new ErrorLogger({
		inSpecMode: args.specMode,
		inDevMode: args.devMode,
		inBenchmarkMode: args.benchmarkMode,
		resourcePath: args.resourcePath,
	});
	process.on("uncaughtException", errorLogger.reportError);
	process.on("unhandledRejection", errorLogger.reportError);
	return errorLogger;
};

const declareOptions = (argv) => {
	const optimist = require("optimist");
	const options = optimist(argv);
	options.usage(
		"Nylas Mail v" +
			app.getVersion() +
			"\n\nUsage: nylas-mail [options]\n\nRun Nylas Mail: The open source extensible email client\n\n`nylas-mail --dev` to start the client in dev mode.\n\n`n1 --test` to run unit tests.",
	);
	options
		.alias("d", "dev")
		.boolean("d")
		.describe("d", "Run in development mode.");
	options
		.alias("b", "benchmark")
		.boolean("b")
		.describe("b", "Run in benchmark mode.");
	options
		.alias("S", "smoke")
		.boolean("S")
		.describe(
			"S",
			"Boot, wait for the main window + sync backend, then exit 0.",
		);
	options
		.alias("t", "test")
		.boolean("t")
		.describe(
			"t",
			"Run the specified specs and exit with error code on failures.",
		);
	options
		.boolean("safe")
		.describe(
			"safe",
			"Do not load packages from ~/.nylas-mail/packages or ~/.nylas/dev/packages.",
		);
	options
		.alias("h", "help")
		.boolean("h")
		.describe("h", "Print this usage message.");
	options
		.alias("l", "log-file")
		.string("l")
		.describe("l", "Log all test output to file.");
	options
		.alias("c", "config-dir-path")
		.string("c")
		.describe(
			"c",
			"Override the path to the Nylas Mail configuration directory",
		);
	options
		.alias("s", "spec-directory")
		.string("s")
		.describe("s", "Override the directory from which to run package specs");
	options
		.alias("f", "spec-file-pattern")
		.string("f")
		.describe(
			"f",
			'Override the default file regex to determine which tests should run (defaults to "-spec.(coffee|js|jsx|cjsx|es6|es)$" )',
		);
	options
		.alias("v", "version")
		.boolean("v")
		.describe("v", "Print the version.");
	options
		.alias("b", "background")
		.boolean("b")
		.describe("b", "Start Nylas Mail in the background");
	return options;
};

const parseCommandLine = (argv) => {
	const version = app.getVersion();
	const options = declareOptions(argv.slice(1));
	const args = options.argv;

	if (args.help) {
		process.stdout.write(options.help());
		process.exit(0);
	}
	if (args.version) {
		process.stdout.write(`${version}\n`);
		process.exit(0);
	}
	const devMode = args.dev || args.test || args.benchmark;
	const benchmarkMode = args.benchmark;
	const logFile = args["log-file"];
	const specMode = args.test;
	const smokeMode = args.smoke || process.env.NYLAS_SMOKE === "1";
	const jUnitXmlPath = args["junit-xml"];
	const safeMode = args.safe;
	const background = args.background;
	const configDirPath = args["config-dir-path"];
	const specDirectory = args["spec-directory"];
	const specFilePattern = args["spec-file-pattern"];
	const showSpecsInWindow = specMode === "window";
	const resourcePath = path.resolve(path.dirname(path.dirname(__dirname)));
	const urlsToOpen = [];
	const pathsToOpen = [];

	// On Windows and Linux, mailto and file opens are passed in argv. Go through
	// the items and pluck out things that look like mailto:, nylas:, file paths
	let ignoreNext = false;
	// args._ is all of the non-hyphenated options.
	for (const arg of args._) {
		if (ignoreNext) {
			ignoreNext = false;
			continue;
		}
		if (arg.includes("executed-from") || arg.includes("squirrel")) {
			ignoreNext = true;
			continue;
		}
		// Skip the argument if it's part of the main electron invocation.
		if (path.resolve(arg) === resourcePath) {
			continue;
		}
		if (arg.startsWith("mailto:") || arg.startsWith("nylas:")) {
			urlsToOpen.push(arg);
		} else if (arg[0] !== "-" && /[/|\\]/.test(arg)) {
			pathsToOpen.push(arg);
		}
	}

	if (args["path-environment"]) {
		process.env.PATH = args["path-environment"];
	}

	return {
		version,
		devMode,
		background,
		logFile,
		specMode,
		smokeMode,
		benchmarkMode,
		jUnitXmlPath,
		safeMode,
		configDirPath,
		specDirectory,
		specFilePattern,
		showSpecsInWindow,
		resourcePath,
		urlsToOpen,
		pathsToOpen,
	};
};

const start = () => {
	// The appId, so Windows attributes notifications to the app. Builds are
	// NSIS, not Squirrel, so a --squirrel-* argument is just an unknown flag and
	// the app starts as usual.
	app.setAppUserModelId("com.nylas.nylas-mail");

	const options = parseCommandLine(process.argv);

	if (!options.devMode) {
		// Electron 4+: makeSingleInstance -> requestSingleInstanceLock
		const gotLock = app.requestSingleInstanceLock();
		app.on("second-instance", (_event, commandLine) => {
			const otherOpts = parseCommandLine(commandLine);
			if (global.application) {
				global.application.handleLaunchOptions(otherOpts);
			}
		});

		if (!gotLock) {
			console.log(
				"Exiting because another instance of the app is already running.",
			);
			app.quit();
		}
	}

	global.errorLogger = setupErrorLogger(options);
	const configDirPath = setupConfigDir(options);
	options.configDirPath = configDirPath;
	setupCompileCache(configDirPath);

	const onOpenFileBeforeReady = (event, file) => {
		event.preventDefault();
		options.pathsToOpen.push(file);
	};

	const onOpenUrlBeforeReady = (event, url) => {
		event.preventDefault();
		options.urlsToOpen.push(url);
	};

	app.on("open-url", onOpenUrlBeforeReady);
	app.on("open-file", onOpenFileBeforeReady);
	// Enable the @electron/remote bridge (renderer uses remote.getGlobal)
	require("@electron/remote/main").initialize();
	app.on("ready", () => {
		app.removeListener("open-file", onOpenFileBeforeReady);
		app.removeListener("open-url", onOpenUrlBeforeReady);
		const Application = require(
			path.join(options.resourcePath, "src", "browser", "application"),
		).default;
		global.application = new Application();
		global.application.start(options);
		if (options.smokeMode) {
			const quitWhenReady = () => {
				// Give the window + sync backend a moment to settle, then exit 0.
				setTimeout(() => {
					console.log("SMOKE_PASS: app booted");
					app.exit(0);
				}, 5_000);
			};
			// Arm both paths: window-load when the renderer finishes, or a
			// hard fallback so headless runs always terminate.
			global.application.once("window-load", quitWhenReady);
			setTimeout(quitWhenReady, 15_000);
		}
		if (!options.specMode) {
			console.log(`App load time: ${Date.now() - global.shellStartTime}ms`);
		}
	});
};

start();
