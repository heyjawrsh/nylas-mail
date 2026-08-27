(() => {
	var BINARY_EXTENSIONS,
		COMPRESSED_EXTENSIONS,
		IMAGE_EXTENSIONS,
		MARKDOWN_EXTENSIONS,
		Module,
		async,
		checkIfElectron2OrLower,
		fs,
		fsPlus,
		isElectron2OrLower,
		isMoveTargetValid,
		isMoveTargetValidSync,
		isPathValid,
		lstatSyncNoException,
		mkdirp,
		path,
		rimraf,
		statSyncNoException,
		_,
		__slice = [].slice;

	fs = require("fs");

	Module = require("module");

	path = require("path");

	_ = require("underscore-plus");

	async = require("async");

	mkdirp = require("mkdirp");

	rimraf = require("rimraf");

	fsPlus = {
		__esModule: false,
		getHomeDirectory: () => {
			if (process.platform === "win32" && !process.env.HOME) {
				return process.env.USERPROFILE;
			} else {
				return process.env.HOME;
			}
		},
		absolute: (relativePath) => {
			var e;
			if (relativePath == null) {
				return null;
			}
			relativePath = fsPlus.resolveHome(relativePath);
			try {
				return fs.realpathSync(relativePath);
			} catch (_error) {
				e = _error;
				return relativePath;
			}
		},
		normalize: (pathToNormalize) => {
			if (pathToNormalize == null) {
				return null;
			}
			return fsPlus.resolveHome(path.normalize(pathToNormalize.toString()));
		},
		resolveHome: (relativePath) => {
			if (relativePath === "~") {
				return fsPlus.getHomeDirectory();
			} else if (relativePath.indexOf("~" + path.sep) === 0) {
				return "" + fsPlus.getHomeDirectory() + relativePath.substring(1);
			}
			return relativePath;
		},
		tildify: (pathToTildify) => {
			var homeDir, normalized;
			if (process.platform === "win32") {
				return pathToTildify;
			}
			normalized = fsPlus.normalize(pathToTildify);
			homeDir = fsPlus.getHomeDirectory();
			if (homeDir == null) {
				return pathToTildify;
			}
			if (normalized === homeDir) {
				return "~";
			}
			if (!normalized.startsWith(path.join(homeDir, path.sep))) {
				return pathToTildify;
			}
			return path.join("~", path.sep, normalized.substring(homeDir.length + 1));
		},
		getAppDataDirectory: () => {
			switch (process.platform) {
				case "darwin":
					return fsPlus.absolute(
						path.join("~", "Library", "Application Support"),
					);
				case "linux":
					return "/var/lib";
				case "win32":
					return process.env.APPDATA;
				default:
					return null;
			}
		},
		isAbsolute: (pathToCheck) => {
			if (pathToCheck == null) {
				pathToCheck = "";
			}
			if (process.platform === "win32") {
				if (pathToCheck[1] === ":") {
					return true;
				}
				if (pathToCheck[0] === "\\" && pathToCheck[1] === "\\") {
					return true;
				}
			} else {
				return pathToCheck[0] === "/";
			}
			return false;
		},
		existsSync: (pathToCheck) =>
			isPathValid(pathToCheck) && statSyncNoException(pathToCheck) !== false,
		isDirectorySync: (directoryPath) => {
			var stat;
			if (!isPathValid(directoryPath)) {
				return false;
			}
			if ((stat = statSyncNoException(directoryPath))) {
				return stat.isDirectory();
			} else {
				return false;
			}
		},
		isDirectory: (directoryPath, done) => {
			if (!isPathValid(directoryPath)) {
				return done(false);
			}
			return fs.stat(directoryPath, (error, stat) => {
				if (error != null) {
					return done(false);
				} else {
					return done(stat.isDirectory());
				}
			});
		},
		isFileSync: (filePath) => {
			var stat;
			if (!isPathValid(filePath)) {
				return false;
			}
			if ((stat = statSyncNoException(filePath))) {
				return stat.isFile();
			} else {
				return false;
			}
		},
		isSymbolicLinkSync: (symlinkPath) => {
			var stat;
			if (!isPathValid(symlinkPath)) {
				return false;
			}
			if ((stat = lstatSyncNoException(symlinkPath))) {
				return stat.isSymbolicLink();
			} else {
				return false;
			}
		},
		isSymbolicLink: (symlinkPath, callback) => {
			if (isPathValid(symlinkPath)) {
				return fs.lstat(symlinkPath, (error, stat) =>
					typeof callback === "function"
						? callback(stat != null && stat.isSymbolicLink())
						: void 0,
				);
			} else {
				return process.nextTick(() =>
					typeof callback === "function" ? callback(false) : void 0,
				);
			}
		},
		isExecutableSync: (pathToCheck) => {
			var stat;
			if (!isPathValid(pathToCheck)) {
				return false;
			}
			if ((stat = statSyncNoException(pathToCheck))) {
				return (stat.mode & 0x1ff & 1) !== 0;
			} else {
				return false;
			}
		},
		getSizeSync: (pathToCheck) => {
			var _ref;
			if (isPathValid(pathToCheck)) {
				return (_ref = statSyncNoException(pathToCheck).size) != null
					? _ref
					: -1;
			} else {
				return -1;
			}
		},
		listSync: (rootPath, extensions) => {
			var paths;
			if (!fsPlus.isDirectorySync(rootPath)) {
				return [];
			}
			paths = fs.readdirSync(rootPath);
			if (extensions) {
				paths = fsPlus.filterExtensions(paths, extensions);
			}
			paths = paths.sort((a, b) =>
				a.toLowerCase().localeCompare(b.toLowerCase()),
			);
			paths = paths.map((childPath) => path.join(rootPath, childPath));
			return paths;
		},
		list: function () {
			var done, extensions, rest, rootPath;
			(rootPath = arguments[0]),
				(rest = 2 <= arguments.length ? __slice.call(arguments, 1) : []);
			if (rest.length > 1) {
				extensions = rest.shift();
			}
			done = rest.shift();
			return fs.readdir(rootPath, (error, paths) => {
				if (error != null) {
					return done(error);
				} else {
					if (extensions) {
						paths = fsPlus.filterExtensions(paths, extensions);
					}
					paths = paths.sort((a, b) =>
						a.toLowerCase().localeCompare(b.toLowerCase()),
					);
					paths = paths.map((childPath) => path.join(rootPath, childPath));
					return done(null, paths);
				}
			});
		},
		filterExtensions: (paths, extensions) => {
			extensions = extensions.map((ext) => {
				if (ext === "") {
					return ext;
				} else {
					return "." + ext.replace(/^\./, "");
				}
			});
			return paths.filter((pathToCheck) =>
				_.include(extensions, path.extname(pathToCheck)),
			);
		},
		listTreeSync: (rootPath) => {
			var onPath, paths;
			paths = [];
			onPath = (childPath) => {
				paths.push(childPath);
				return true;
			};
			fsPlus.traverseTreeSync(rootPath, onPath, onPath);
			return paths;
		},
		move: (source, target, callback) =>
			isMoveTargetValid(
				source,
				target,
				(isMoveTargetValidErr, isTargetValid) => {
					var error, targetParentPath;
					if (isMoveTargetValidErr) {
						callback(isMoveTargetValidErr);
						return;
					}
					if (!isTargetValid) {
						error = new Error("'" + target + "' already exists.");
						error.code = "EEXIST";
						callback(error);
						return;
					}
					targetParentPath = path.dirname(target);
					return fs.exists(targetParentPath, (targetParentExists) => {
						if (targetParentExists) {
							fs.rename(source, target, callback);
							return;
						}
						return fsPlus.makeTree(targetParentPath, (makeTreeErr) => {
							if (makeTreeErr) {
								callback(makeTreeErr);
								return;
							}
							return fs.rename(source, target, callback);
						});
					});
				},
			),
		moveSync: (source, target) => {
			var error, targetParentPath;
			if (!isMoveTargetValidSync(source, target)) {
				error = new Error("'" + target + "' already exists.");
				error.code = "EEXIST";
				throw error;
			}
			targetParentPath = path.dirname(target);
			if (!fs.existsSync(targetParentPath)) {
				fsPlus.makeTreeSync(targetParentPath);
			}
			return fs.renameSync(source, target);
		},
		removeSync: (pathToRemove) => rimraf.sync(pathToRemove),
		remove: (pathToRemove, callback) => rimraf(pathToRemove, callback),
		writeFileSync: (filePath, content, options) => {
			mkdirp.sync(path.dirname(filePath));
			return fs.writeFileSync(filePath, content, options);
		},
		writeFile: function (filePath, content, options, callback) {
			callback = _.last(arguments);
			return mkdirp(path.dirname(filePath), (error) => {
				if (error != null) {
					return typeof callback === "function" ? callback(error) : void 0;
				} else {
					return fs.writeFile(filePath, content, options, callback);
				}
			});
		},
		copy: (sourcePath, destinationPath, done) =>
			mkdirp(path.dirname(destinationPath), (error) => {
				var destinationStream, sourceStream;
				if (error != null) {
					if (typeof done === "function") {
						done(error);
					}
					return;
				}
				sourceStream = fs.createReadStream(sourcePath);
				sourceStream.on("error", (error) => {
					if (typeof done === "function") {
						done(error);
					}
					return (done = null);
				});
				destinationStream = fs.createWriteStream(destinationPath);
				destinationStream.on("error", (error) => {
					if (typeof done === "function") {
						done(error);
					}
					return (done = null);
				});
				destinationStream.on("close", () => {
					if (typeof done === "function") {
						done();
					}
					return (done = null);
				});
				return sourceStream.pipe(destinationStream);
			}),
		copySync: (sourcePath, destinationPath) => {
			var destinationFilePath,
				source,
				sourceFilePath,
				sources,
				_i,
				_len,
				_results;
			sources = fs.readdirSync(sourcePath);
			mkdirp.sync(destinationPath);
			_results = [];
			for (_i = 0, _len = sources.length; _i < _len; _i++) {
				source = sources[_i];
				sourceFilePath = path.join(sourcePath, source);
				destinationFilePath = path.join(destinationPath, source);
				if (fsPlus.isDirectorySync(sourceFilePath)) {
					_results.push(fsPlus.copySync(sourceFilePath, destinationFilePath));
				} else {
					_results.push(
						fsPlus.copyFileSync(sourceFilePath, destinationFilePath),
					);
				}
			}
			return _results;
		},
		copyFileSync: (sourceFilePath, destinationFilePath, bufferSize) => {
			var buffer, bytesRead, position, readFd, writeFd, _results;
			if (bufferSize == null) {
				bufferSize = 16 * 1024;
			}
			mkdirp.sync(path.dirname(destinationFilePath));
			readFd = null;
			writeFd = null;
			try {
				readFd = fs.openSync(sourceFilePath, "r");
				writeFd = fs.openSync(destinationFilePath, "w");
				bytesRead = 1;
				position = 0;
				_results = [];
				while (bytesRead > 0) {
					buffer = new Buffer(bufferSize);
					bytesRead = fs.readSync(readFd, buffer, 0, buffer.length, position);
					fs.writeSync(writeFd, buffer, 0, bytesRead, position);
					_results.push((position += bytesRead));
				}
				return _results;
			} finally {
				if (readFd != null) {
					fs.closeSync(readFd);
				}
				if (writeFd != null) {
					fs.closeSync(writeFd);
				}
			}
		},
		makeTreeSync: (directoryPath) => {
			if (!fsPlus.isDirectorySync(directoryPath)) {
				return mkdirp.sync(directoryPath);
			}
		},
		makeTree: (directoryPath, callback) =>
			fsPlus.isDirectory(directoryPath, (exists) => {
				if (exists) {
					return typeof callback === "function" ? callback() : void 0;
				}
				return mkdirp(directoryPath, (error) =>
					typeof callback === "function" ? callback(error) : void 0,
				);
			}),
		traverseTreeSync: (rootPath, onFile, onDirectory) => {
			var traverse;
			if (onDirectory == null) {
				onDirectory = onFile;
			}
			if (!fsPlus.isDirectorySync(rootPath)) {
				return;
			}
			traverse = (directoryPath, onFile, onDirectory) => {
				var childPath, file, linkStats, stats, _i, _len, _ref;
				_ref = fs.readdirSync(directoryPath);
				for (_i = 0, _len = _ref.length; _i < _len; _i++) {
					file = _ref[_i];
					childPath = path.join(directoryPath, file);
					stats = fs.lstatSync(childPath);
					if (stats.isSymbolicLink()) {
						if ((linkStats = statSyncNoException(childPath))) {
							stats = linkStats;
						}
					}
					if (stats.isDirectory()) {
						if (onDirectory(childPath)) {
							traverse(childPath, onFile, onDirectory);
						}
					} else if (stats.isFile()) {
						onFile(childPath);
					}
				}
				return void 0;
			};
			return traverse(rootPath, onFile, onDirectory);
		},
		traverseTree: (rootPath, onFile, onDirectory, onDone) =>
			fs.readdir(rootPath, (error, files) => {
				var file, queue, _i, _len, _results;
				if (error) {
					return typeof onDone === "function" ? onDone() : void 0;
				} else {
					queue = async.queue((childPath, callback) =>
						fs.stat(childPath, (error, stats) => {
							if (error) {
								return callback(error);
							} else if (stats.isFile()) {
								onFile(childPath);
								return callback();
							} else if (stats.isDirectory()) {
								if (onDirectory(childPath)) {
									return fs.readdir(childPath, (error, files) => {
										var file, _i, _len;
										if (error) {
											return callback(error);
										} else {
											for (_i = 0, _len = files.length; _i < _len; _i++) {
												file = files[_i];
												queue.unshift(path.join(childPath, file));
											}
											return callback();
										}
									});
								} else {
									return callback();
								}
							} else {
								return callback();
							}
						}),
					);
					queue.concurrency = 1;
					queue.drain = onDone;
					_results = [];
					for (_i = 0, _len = files.length; _i < _len; _i++) {
						file = files[_i];
						_results.push(queue.push(path.join(rootPath, file)));
					}
					return _results;
				}
			}),
		md5ForPath: (pathToDigest) => {
			var contents;
			contents = fs.readFileSync(pathToDigest);
			return require("crypto").createHash("md5").update(contents).digest("hex");
		},
		resolve: function () {
			var args,
				candidatePath,
				extensions,
				loadPath,
				loadPaths,
				pathToResolve,
				resolvedPath,
				_i,
				_len,
				_ref;
			args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
			if (_.isArray(_.last(args))) {
				extensions = args.pop();
			}
			pathToResolve = (_ref = args.pop()) != null ? _ref.toString() : void 0;
			loadPaths = args;
			if (!pathToResolve) {
				return void 0;
			}
			if (fsPlus.isAbsolute(pathToResolve)) {
				if (
					extensions &&
					(resolvedPath = fsPlus.resolveExtension(pathToResolve, extensions))
				) {
					return resolvedPath;
				} else {
					if (fsPlus.existsSync(pathToResolve)) {
						return pathToResolve;
					}
				}
			}
			for (_i = 0, _len = loadPaths.length; _i < _len; _i++) {
				loadPath = loadPaths[_i];
				candidatePath = path.join(loadPath, pathToResolve);
				if (extensions) {
					if (
						(resolvedPath = fsPlus.resolveExtension(candidatePath, extensions))
					) {
						return resolvedPath;
					}
				} else {
					if (fsPlus.existsSync(candidatePath)) {
						return fsPlus.absolute(candidatePath);
					}
				}
			}
			return void 0;
		},
		resolveOnLoadPath: function () {
			var args, loadPaths, modulePaths;
			args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
			modulePaths = null;
			if (module.paths != null) {
				modulePaths = module.paths;
			} else if (process.resourcesPath) {
				modulePaths = [path.join(process.resourcesPath, "app", "node_modules")];
			} else {
				modulePaths = [];
			}
			loadPaths = Module.globalPaths.concat(modulePaths);
			return fsPlus.resolve.apply(
				fsPlus,
				__slice.call(loadPaths).concat(__slice.call(args)),
			);
		},
		resolveExtension: (pathToResolve, extensions) => {
			var extension, pathWithExtension, _i, _len;
			for (_i = 0, _len = extensions.length; _i < _len; _i++) {
				extension = extensions[_i];
				if (extension === "") {
					if (fsPlus.existsSync(pathToResolve)) {
						return fsPlus.absolute(pathToResolve);
					}
				} else {
					pathWithExtension =
						pathToResolve + "." + extension.replace(/^\./, "");
					if (fsPlus.existsSync(pathWithExtension)) {
						return fsPlus.absolute(pathWithExtension);
					}
				}
			}
			return void 0;
		},
		isCompressedExtension: (ext) => {
			if (ext == null) {
				return false;
			}
			return Object.hasOwn(COMPRESSED_EXTENSIONS, ext.toLowerCase());
		},
		isImageExtension: (ext) => {
			if (ext == null) {
				return false;
			}
			return Object.hasOwn(IMAGE_EXTENSIONS, ext.toLowerCase());
		},
		isPdfExtension: (ext) =>
			(ext != null ? ext.toLowerCase() : void 0) === ".pdf",
		isBinaryExtension: (ext) => {
			if (ext == null) {
				return false;
			}
			return Object.hasOwn(BINARY_EXTENSIONS, ext.toLowerCase());
		},
		isReadmePath: (readmePath) => {
			var base, extension;
			extension = path.extname(readmePath);
			base = path.basename(readmePath, extension).toLowerCase();
			return (
				base === "readme" &&
				(extension === "" || fsPlus.isMarkdownExtension(extension))
			);
		},
		isMarkdownExtension: (ext) => {
			if (ext == null) {
				return false;
			}
			return Object.hasOwn(MARKDOWN_EXTENSIONS, ext.toLowerCase());
		},
		isCaseInsensitive: () => {
			var lowerCaseStat, upperCaseStat;
			if (fsPlus.caseInsensitiveFs == null) {
				lowerCaseStat = statSyncNoException(process.execPath.toLowerCase());
				upperCaseStat = statSyncNoException(process.execPath.toUpperCase());
				if (lowerCaseStat && upperCaseStat) {
					fsPlus.caseInsensitiveFs =
						lowerCaseStat.dev === upperCaseStat.dev &&
						lowerCaseStat.ino === upperCaseStat.ino;
				} else {
					fsPlus.caseInsensitiveFs = false;
				}
			}
			return fsPlus.caseInsensitiveFs;
		},
		isCaseSensitive: () => !fsPlus.isCaseInsensitive(),
		statSyncNoException: function () {
			var args;
			args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
			return statSyncNoException.apply(null, args);
		},
		lstatSyncNoException: function () {
			var args;
			args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
			return lstatSyncNoException.apply(null, args);
		},
	};

	isElectron2OrLower = null;

	checkIfElectron2OrLower = () => {
		if (isElectron2OrLower === null) {
			isElectron2OrLower =
				process.versions.electron &&
				parseInt(process.versions.electron.split(".")[0]) <= 2;
		}
		return isElectron2OrLower;
	};

	statSyncNoException = function () {
		var args, error;
		args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
		if (fs.statSyncNoException && checkIfElectron2OrLower()) {
			return fs.statSyncNoException.apply(fs, args);
		} else {
			try {
				return fs.statSync.apply(fs, args);
			} catch (_error) {
				error = _error;
				return false;
			}
		}
	};

	lstatSyncNoException = function () {
		var args, error;
		args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
		if (fs.lstatSyncNoException && checkIfElectron2OrLower()) {
			return fs.lstatSyncNoException.apply(fs, args);
		} else {
			try {
				return fs.lstatSync.apply(fs, args);
			} catch (_error) {
				error = _error;
				return false;
			}
		}
	};

	BINARY_EXTENSIONS = {
		".ds_store": true,
		".a": true,
		".exe": true,
		".o": true,
		".pyc": true,
		".pyo": true,
		".so": true,
		".woff": true,
	};

	COMPRESSED_EXTENSIONS = {
		".bz2": true,
		".egg": true,
		".epub": true,
		".gem": true,
		".gz": true,
		".jar": true,
		".lz": true,
		".lzma": true,
		".lzo": true,
		".rar": true,
		".tar": true,
		".tgz": true,
		".war": true,
		".whl": true,
		".xpi": true,
		".xz": true,
		".z": true,
		".zip": true,
	};

	IMAGE_EXTENSIONS = {
		".gif": true,
		".ico": true,
		".jpeg": true,
		".jpg": true,
		".png": true,
		".tif": true,
		".tiff": true,
		".webp": true,
	};

	MARKDOWN_EXTENSIONS = {
		".markdown": true,
		".md": true,
		".mdown": true,
		".mkd": true,
		".mkdown": true,
		".rmd": true,
		".ron": true,
	};

	isPathValid = (pathToCheck) =>
		pathToCheck != null &&
		typeof pathToCheck === "string" &&
		pathToCheck.length > 0;

	isMoveTargetValid = (source, target, callback) =>
		fs.stat(source, (oldErr, oldStat) => {
			if (oldErr) {
				callback(oldErr);
				return;
			}
			return fs.stat(target, (newErr, newStat) => {
				if (newErr && newErr.code === "ENOENT") {
					callback(void 0, true);
					return;
				}
				return callback(
					void 0,
					source.toLowerCase() === target.toLowerCase() &&
						oldStat.dev === newStat.dev &&
						oldStat.ino === newStat.ino,
				);
			});
		});

	isMoveTargetValidSync = (source, target) => {
		var newStat, oldStat;
		oldStat = statSyncNoException(source);
		newStat = statSyncNoException(target);
		if (!(oldStat && newStat)) {
			return true;
		}
		return (
			source.toLowerCase() === target.toLowerCase() &&
			oldStat.dev === newStat.dev &&
			oldStat.ino === newStat.ino
		);
	};

	module.exports = new Proxy(
		{},
		{
			get: (target, key) => {
				var _ref;
				return (_ref = fsPlus[key]) != null ? _ref : fs[key];
			},
			set: (target, key, value) => (fsPlus[key] = value),
		},
	);
}).call(this);
