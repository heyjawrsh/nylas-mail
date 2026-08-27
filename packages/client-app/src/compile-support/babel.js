var crypto = require("node:crypto");
var path = require("node:path");
var fs = require("node:fs");

var babel = null;
var babelVersionDirectory = null;

// This adds in the regeneratorRuntime for generators to work properly
// We manually insert it here instead of using the kitchen-sink
// babel-polyfill.
require("babel-regenerator-runtime");

// We run babel with lots of different working directories (like plugin folders).
// To make sure presets always resolve to the correct path inside N1, resolve
// them to their absolute paths ahead of time.
const babelPath = path.resolve(path.join(__dirname, "..", "..", ".babelrc"));
var defaultOptions = JSON.parse(fs.readFileSync(babelPath));
defaultOptions.presets = (defaultOptions.presets || []).map((modulename) =>
	require.resolve(`babel-preset-${modulename}`),
);
defaultOptions.plugins = (defaultOptions.plugins || []).map((modulename) =>
	require.resolve(`babel-plugin-${modulename}`),
);

exports.shouldCompile = (_sourceCode, filePath) =>
	filePath.endsWith(".es6") || filePath.endsWith(".jsx");

exports.getCachePath = (sourceCode) => {
	if (babelVersionDirectory == null) {
		var babelVersion = require("babel-core/package.json").version;
		babelVersionDirectory = path.join(
			"js",
			"babel",
			createVersionAndOptionsDigest(babelVersion, defaultOptions),
		);
	}

	return path.join(
		babelVersionDirectory,
		`${crypto.createHash("sha1").update(sourceCode, "utf8").digest("hex")}.js`,
	);
};

exports.compile = (sourceCode, filePath) => {
	if (!babel) {
		babel = require("babel-core");
	}

	var options = { filename: filePath };
	for (var key in defaultOptions) {
		options[key] = defaultOptions[key];
	}
	return babel.transform(sourceCode, options).code;
};

function createVersionAndOptionsDigest(version, options) {
	return crypto
		.createHash("sha1")
		.update("babel-core", "utf8")
		.update("\0", "utf8")
		.update(version, "utf8")
		.update("\0", "utf8")
		.update(JSON.stringify(options), "utf8")
		.digest("hex");
}
