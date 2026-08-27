const path = require("path");
const cjsxtransform = require("coffee-react-transform");
const rimraf = require("rimraf");

const fs = require("fs-plus");
var fs_extra = require("fs-extra");

const _ = require("underscore");

const donna = require("donna");
const joanna = require("joanna");
const tello = require("tello");

module.exports = (grunt) => {
	const { cp, mkdir, rm } = grunt.config("taskHelpers");

	const getClassesToInclude = () => {
		const modulesPath = path.resolve(
			__dirname,
			"..",
			"..",
			"internal_packages",
		);
		const classes = {};
		fs.traverseTreeSync(modulesPath, (modulePath) => {
			// Don't traverse inside dependencies
			if (modulePath.match(/node_modules/g)) {
				return false;
			}

			// Don't traverse blacklisted packages (that have docs, but we don't want to include)
			if (path.basename(modulePath) !== "package.json") {
				return true;
			}
			if (!fs.isFileSync(modulePath)) {
				return true;
			}

			const apiPath = path.join(path.dirname(modulePath), "api.json");
			if (fs.isFileSync(apiPath)) {
				_.extend(classes, grunt.file.readJSON(apiPath).classes);
			}
			return true;
		});
		return classes;
	};

	const sortClasses = (classes) => {
		const sortedClasses = {};
		for (const className of Array.from(Object.keys(classes).sort())) {
			sortedClasses[className] = classes[className];
		}
		return sortedClasses;
	};

	return grunt.registerTask(
		"docs-build",
		"Builds the API docs in src",
		function () {
			grunt.log.writeln("Time to build the docs!");

			const done = this.async();

			const classDocsOutputDir = grunt.config.get("classDocsOutputDir");

			const cjsxOutputDir = path.join(classDocsOutputDir, "temp-cjsx");

			return rimraf(cjsxOutputDir, () => {
				let api;
				fs.mkdir(cjsxOutputDir);

				const srcPath = path.resolve(__dirname, "..", "..", "src");

				const blacklist = ["/K2/", "legacy-edgehill-api", "edgehill-api"];

				const in_blacklist = (file) => {
					for (var i = 0; i < blacklist.length; i++) {
						if (file.indexOf(blacklist[i]) >= 0) {
							return true;
						}
					}
					return false;
				};

				fs.traverseTreeSync(srcPath, (file) => {
					if (in_blacklist(file)) {
						console.log("Skipping " + file);
						// Skip K2
					}

					// Convert CJSX into coffeescript that can be read by Donna
					else if (path.extname(file) === ".cjsx") {
						const transformed = cjsxtransform(grunt.file.read(file));

						// Only attempt to parse this file as documentation if it contains
						// real Coffeescript classes.
						if (transformed.indexOf("\nclass ") > 0) {
							grunt.log.writeln("Found class in file: " + file);

							grunt.file.write(
								path.join(
									cjsxOutputDir,
									path.basename(file).slice(0, -5 + 1 || undefined) + "coffee",
								),
								transformed,
							);
						}
					} else if (path.extname(file) === ".jsx") {
						console.log("Transforming " + file);

						const fileStr = grunt.file.read(file);

						const transformed = require("babel-core").transform(fileStr, {
							plugins: ["transform-react-jsx", "transform-class-properties"],
							presets: ["react", "stage-2"],
						});

						grunt.file.write(
							path.join(
								cjsxOutputDir,
								path.basename(file).slice(0, -3 || undefined) + "js",
							),
							transformed.code,
						);
					} else if (path.extname(file) == ".es6") {
						console.log(file);

						const fileStr = grunt.file.read(file);

						const transformed = require("babel-core").transform(fileStr, {
							plugins: [
								"transform-class-properties",
								"transform-function-bind",
							],
							presets: ["react", "stage-2"],
						});

						if (transformed.code.indexOf("class ") > 0) {
							grunt.log.writeln("Found class in file: " + file);

							grunt.file.write(
								path.join(
									cjsxOutputDir,
									path.basename(file).slice(0, -3 || undefined) + "js",
								),
								transformed.code,
							);
						}
					} else if (
						path.extname(file) == ".coffee" ||
						path.extname(file) == ".js"
					) {
						const dest_path = path.join(cjsxOutputDir, path.basename(file));
						console.log("Copying " + file + " to " + dest_path);
						fs_extra.copySync(file, dest_path);
					}
					return true;
				});

				grunt.log.ok("Done transforming, starting donna extraction");
				grunt.log.writeln("cjsxOutputDir: " + cjsxOutputDir);

				// Process coffeescript source
				const metadata = donna.generateMetadata([cjsxOutputDir]);
				grunt.log.ok("---- Done with Donna (cjsx metadata)----");

				// DEBUG
				// Use to check individual files
				var js_files = [];
				fs.traverseTreeSync(cjsxOutputDir, (file) => {
					if (path.extname(file) === ".js") {
						console.log("testing joanna on " + file);
						const meta = joanna([file]);
						console.log("testing tello on " + file);
						tello.digest(meta);
						console.log("passed");
					}
				});

				var js_files = [];
				fs.traverseTreeSync(cjsxOutputDir, (file) => {
					if (path.extname(file) === ".js") {
						js_files.push(file.toString());
					}
				});

				console.log(js_files);
				grunt.log.ok("---- Starting Jonna (jsx metadata)----");
				const jsx_metadata = joanna(js_files);
				grunt.log.ok("---- Done with Joanna (jsx metadata)----");

				Object.assign(metadata[0].files, jsx_metadata.files);
				console.log(metadata[0]);

				grunt.file.write(
					"/tmp/metadata.json",
					JSON.stringify(metadata, null, 2),
				);

				try {
					api = tello.digest(metadata);
				} catch (e) {
					console.log(e);
					console.log(e.stack);

					console.log(metadata);
					return;
				}

				console.log("---- Done with Tello ----");
				_.extend(api.classes, getClassesToInclude());

				console.log(api.classes);

				api.classes = sortClasses(api.classes);
				console.log(api.classes);

				const apiJson = JSON.stringify(api, null, 2);
				const apiJsonPath = path.join(classDocsOutputDir, "api.json");
				grunt.file.write(apiJsonPath, apiJson);
				return done();
			});
		},
	);
};
