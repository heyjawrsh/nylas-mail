/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS104: Avoid inline assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let Utils;
const _ = require("underscore");
const fs = require("fs-plus");
const path = require("path");
const moment = require("moment-timezone");

let DefaultResourcePath = null;
const TaskRegistry = require("../../registries/task-registry").default;
const DatabaseObjectRegistry =
	require("../../registries/database-object-registry").default;

let imageData = null;

module.exports = Utils = {
	waitFor(latch, options) {
		if (options == null) {
			options = {};
		}
		const timeout = options.timeout || 400;
		const expire = Date.now() + timeout;
		return new Promise((resolve, reject) => {
			var attempt = () => {
				if (Date.now() > expire) {
					return reject(
						new Error(
							`Utils.waitFor hit timeout (${timeout}ms) without firing.`,
						),
					);
				}
				if (latch()) {
					return resolve();
				}
				return window.requestAnimationFrame(attempt);
			};
			return attempt();
		});
	},

	showIconForAttachments(files) {
		if (!(files instanceof Array)) {
			return false;
		}
		return files.find((f) => !f.contentId || f.size > 12 * 1024);
	},

	extractTextFromHtml(html, param) {
		if (param == null) {
			param = {};
		}
		const { maxLength } = param;
		if ((html != null ? html : "").trim().length === 0) {
			return "";
		}
		if (maxLength && html.length > maxLength) {
			html = html.slice(0, maxLength);
		}
		return new DOMParser().parseFromString(html, "text/html").body.innerText;
	},

	registeredObjectReviver(k, v) {
		const type = v != null ? v.__constructorName : undefined;
		if (!type) {
			return v;
		}

		if (DatabaseObjectRegistry.isInRegistry(type)) {
			return DatabaseObjectRegistry.deserialize(type, v);
		}

		if (TaskRegistry.isInRegistry(type)) {
			return TaskRegistry.deserialize(type, v);
		}

		return v;
	},

	registeredObjectReplacer(k, v) {
		if (_.isObject(v)) {
			const type = this[k].constructor.name;
			if (
				DatabaseObjectRegistry.isInRegistry(type) ||
				TaskRegistry.isInRegistry(type)
			) {
				v.__constructorName = type;
			}
		}
		return v;
	},

	fastOmit(props, without) {
		const otherProps = Object.assign({}, props);
		for (var w of Array.from(without)) {
			delete otherProps[w];
		}
		return otherProps;
	},

	isHash(object) {
		return _.isObject(object) && !_.isFunction(object) && !_.isArray(object);
	},

	escapeRegExp(str) {
		return str.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
	},

	range(start, end, inclusive) {
		if (inclusive == null) {
			inclusive = true;
		}
		if (inclusive) {
			return __range__(start, end, true);
		}
		return __range__(start, end, false);
	},

	// Generates a new RegExp that is great for basic search fields. It
	// checks if the test string is at the start of words
	//
	// See regex explanation and test here:
	// https://regex101.com/r/zG7aW4/2
	wordSearchRegExp(str) {
		if (str == null) {
			str = "";
		}
		return new RegExp(`((?:^|\\W|$)${Utils.escapeRegExp(str.trim())})`, "ig");
	},

	// Takes an optional customizer. The customizer is passed the key and the
	// new cloned value for that key. The customizer is expected to either
	// modify the value and return it or simply be the identity function.
	deepClone(object, customizer, stackSeen, stackRefs) {
		let newObject;
		if (stackSeen == null) {
			stackSeen = [];
		}
		if (stackRefs == null) {
			stackRefs = [];
		}
		if (!_.isObject(object)) {
			return object;
		}
		if (_.isFunction(object)) {
			return object;
		}

		if (_.isArray(object)) {
			// http://perfectionkills.com/how-ecmascript-5-still-does-not-allow-to-subclass-an-array/
			newObject = [];
		} else if (object instanceof Date) {
			// You can't clone dates by iterating through `getOwnPropertyNames`
			// of the Date object. We need to special-case Dates.
			newObject = new Date(object);
		} else {
			newObject = Object.create(Object.getPrototypeOf(object));
		}

		// Circular reference check
		const seenIndex = stackSeen.indexOf(object);
		if (seenIndex >= 0) {
			return stackRefs[seenIndex];
		}
		stackSeen.push(object);
		stackRefs.push(newObject);

		// It's important to use getOwnPropertyNames instead of Object.keys to
		// get the non-enumerable items as well.
		for (var key of Array.from(Object.getOwnPropertyNames(object))) {
			var newVal = Utils.deepClone(
				object[key],
				customizer,
				stackSeen,
				stackRefs,
			);
			if (_.isFunction(customizer)) {
				newObject[key] = customizer(key, newVal);
			} else {
				newObject[key] = newVal;
			}
		}
		return newObject;
	},

	toSet(arr) {
		if (arr == null) {
			arr = [];
		}
		const set = {};
		for (var item of Array.from(arr)) {
			set[item] = true;
		}
		return set;
	},

	// Given a File object or uploadData of an uploading file object,
	// determine if it looks like an image and is in the size range for previews
	shouldDisplayAsImage(file) {
		let left, left1, left2;
		if (file == null) {
			file = {};
		}
		const name =
			(left =
				(left1 = file.filename != null ? file.filename : file.fileName) != null
					? left1
					: file.name) != null
				? left
				: "";
		const size =
			(left2 = file.size != null ? file.size : file.fileSize) != null
				? left2
				: 0;
		const ext = path.extname(name).toLowerCase();
		const extensions = [".jpg", ".bmp", ".gif", ".png", ".jpeg"];

		return (
			Array.from(extensions).includes(ext) &&
			size > 512 &&
			size < 1024 * 1024 * 5
		);
	},

	// Escapes potentially dangerous html characters
	// This code is lifted from Angular.js
	// See their specs here:
	// https://github.com/angular/angular.js/blob/master/test/ngSanitize/sanitizeSpec.js
	// And the original source here: https://github.com/angular/angular.js/blob/master/src/ngSanitize/sanitize.js#L451
	encodeHTMLEntities(value) {
		const SURROGATE_PAIR_REGEXP = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
		const pairFix = (value) => {
			const hi = value.charCodeAt(0);
			const low = value.charCodeAt(1);
			return "&#" + ((hi - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000) + ";";
		};

		// Match everything outside of normal chars and " (quote character)
		const NON_ALPHANUMERIC_REGEXP = /([^#-~| |!])/g;
		const alphaFix = (value) => "&#" + value.charCodeAt(0) + ";";

		return value
			.replace(/&/g, "&amp;")
			.replace(SURROGATE_PAIR_REGEXP, pairFix)
			.replace(NON_ALPHANUMERIC_REGEXP, alphaFix)
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	},

	modelFreeze(o) {
		Object.freeze(o);
		return Object.getOwnPropertyNames(o).forEach((key) => {
			const val = o[key];
			if (typeof val === "object" && val !== null && !Object.isFrozen(val)) {
				return Utils.modelFreeze(val);
			}
		});
	},

	generateTempId() {
		const s4 = () =>
			Math.floor((1 + Math.random()) * 0x10000)
				.toString(16)
				.substring(1);
		return "local-" + s4() + s4() + "-" + s4();
	},

	generateFakeServerId() {
		const s5 = () =>
			Math.floor((1 + Math.random()) * 0x10000000)
				.toString(36)
				.substring(1);
		return s5() + s5() + s5() + s5() + s5();
	},

	isTempId(id) {
		if (!id || !_.isString(id)) {
			return false;
		}
		return id.slice(0, 6) === "local-";
	},

	tableNameForJoin(primaryKlass, secondaryKlass) {
		return `${primaryKlass.name}${secondaryKlass.name}`;
	},

	imageNamed(fullname, resourcePath) {
		let left2, left3, left4, left5, left6, left7;
		const [name, ext] = Array.from(fullname.split("."));

		if (DefaultResourcePath == null) {
			DefaultResourcePath = NylasEnv.getLoadSettings().resourcePath;
		}
		if (resourcePath == null) {
			resourcePath = DefaultResourcePath;
		}

		if (!imageData) {
			let left, left1;
			imageData =
				(left = NylasEnv.fileListCache().imageData) != null ? left : "{}";
			Utils.images = (left1 = JSON.parse(imageData)) != null ? left1 : {};
		}

		if (
			!__guard__(
				Utils != null ? Utils.images : undefined,
				(x) => x[resourcePath],
			)
		) {
			if (Utils.images == null) {
				Utils.images = {};
			}
			if (Utils.images[resourcePath] == null) {
				Utils.images[resourcePath] = {};
			}
			const imagesPath = path.join(resourcePath, "static", "images");
			const files = fs.listTreeSync(imagesPath);
			for (var file of Array.from(files)) {
				// On Windows, we get paths like C:\images\compose.png, but
				// Chromium doesn't accept the backward slashes. Convert to
				// C:/images/compose.png
				file = file.replace(/\\/g, "/");
				var basename = path.basename(file);
				Utils.images[resourcePath][path.basename(file)] = file;
			}
			NylasEnv.fileListCache().imageData = JSON.stringify(Utils.images);
		}

		const plat = process.platform != null ? process.platform : "";
		const ratio = window.devicePixelRatio != null ? window.devicePixelRatio : 1;

		return (left2 =
			(left3 =
				(left4 =
					(left5 =
						(left6 =
							(left7 =
								Utils.images[resourcePath][
									`${name}-${plat}@${ratio}x.${ext}`
								] != null
									? Utils.images[resourcePath][
											`${name}-${plat}@${ratio}x.${ext}`
										]
									: Utils.images[resourcePath][`${name}@${ratio}x.${ext}`]) !=
							null
								? left7
								: Utils.images[resourcePath][`${name}-${plat}.${ext}`]) != null
							? left6
							: Utils.images[resourcePath][`${name}.${ext}`]) != null
						? left5
						: Utils.images[resourcePath][`${name}-${plat}@2x.${ext}`]) != null
					? left4
					: Utils.images[resourcePath][`${name}@2x.${ext}`]) != null
				? left3
				: Utils.images[resourcePath][`${name}-${plat}@1x.${ext}`]) != null
			? left2
			: Utils.images[resourcePath][`${name}@1x.${ext}`];
	},

	subjectWithPrefix(subject, prefix) {
		if (subject.search(/fwd:/i) === 0) {
			return subject.replace(/fwd:/i, prefix);
		} else if (subject.search(/re:/i) === 0) {
			return subject.replace(/re:/i, prefix);
		} else {
			return `${prefix} ${subject}`;
		}
	},

	// True of all arguments have the same domains
	emailsHaveSameDomain(...args) {
		if (args.length < 2) {
			return false;
		}
		const domains = args.map((email) => {
			if (email == null) {
				email = "";
			}
			return _.last(email.toLowerCase().trim().split("@"));
		});
		const toMatch = domains[0];
		return _.every(
			domains,
			(domain) => domain.length > 0 && toMatch === domain,
		);
	},

	emailHasCommonDomain(email) {
		if (email == null) {
			email = "";
		}
		const domain = _.last(email.toLowerCase().trim().split("@"));
		return Utils.commonDomains[domain] != null
			? Utils.commonDomains[domain]
			: false;
	},

	// This looks for and removes plus-ing, it taks a VERY liberal approach
	// to match an email address. We'd rather let false positives through.
	toEquivalentEmailForm(email) {
		// https://regex101.com/r/iS7kD5/3
		const [ignored, user, domain] = Array.from(
			/^([^+]+).*@(.+)$/gi.exec(email) || [null, "", ""],
		);
		return `${user}@${domain}`.trim().toLowerCase();
	},

	emailIsEquivalent(email1, email2) {
		if (email1 == null) {
			email1 = "";
		}
		if (email2 == null) {
			email2 = "";
		}
		email1 = email1.toLowerCase().trim();
		email2 = email2.toLowerCase().trim();
		if (email1 === email2) {
			return true;
		}
		email1 = Utils.toEquivalentEmailForm(email1);
		email2 = Utils.toEquivalentEmailForm(email2);
		return email1 === email2;
	},

	rectVisibleInRect(r1, r2) {
		return !(
			r2.left > r1.right ||
			r2.right < r1.left ||
			r2.top > r1.bottom ||
			r2.bottom < r1.top
		);
	},

	isEqualReact(a, b, options) {
		if (options == null) {
			options = {};
		}
		options.functionsAreEqual = true;
		options.ignoreKeys = (
			options.ignoreKeys != null ? options.ignoreKeys : []
		).push("clientId");
		return Utils.isEqual(a, b, options);
	},

	// Customized version of Underscore 1.8.2's isEqual function
	// You can pass the following options:
	//   - functionsAreEqual: if true then all functions are equal
	//   - keysToIgnore: an array of object keys to ignore checks on
	//   - logWhenFalse: logs when isEqual returns false
	isEqual(a, b, options) {
		if (options == null) {
			options = {};
		}
		const value = Utils._isEqual(a, b, [], [], options);
		if (options.logWhenFalse) {
			if (value === false) {
				console.log("isEqual is false", a, b, options);
			}
			return value;
		} else {
		}
		return value;
	},

	_isEqual(a, b, aStack, bStack, options) {
		// Identical objects are equal. `0 is -0`, but they aren't identical.
		// See the [Harmony `egal`
		// proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
		if (options == null) {
			options = {};
		}
		if (a === b) {
			return a !== 0 || 1 / a === 1 / b;
		}
		// A strict comparison is necessary because `null == undefined`.
		if (a === null || b === null) {
			return a === b;
		}
		// Unwrap any wrapped objects.
		if ((a != null ? a._wrapped : undefined) != null) {
			a = a._wrapped;
		}
		if ((b != null ? b._wrapped : undefined) != null) {
			b = b._wrapped;
		}

		if (options.functionsAreEqual) {
			if (_.isFunction(a) && _.isFunction(b)) {
				return true;
			}
		}

		// Compare `[[Class]]` names.
		const className = toString.call(a);
		if (className !== toString.call(b)) {
			return false;
		}
		switch (className) {
			// Strings, numbers, regular expressions, dates, and booleans are
			// compared by value.
			// RegExps are coerced to strings for comparison (Note: '' + /a/i is '/a/i')
			case "[object RegExp]":
			case "[object String]":
				// Primitives and their corresponding object wrappers are equivalent;
				// thus, `"5"` is equivalent to `new String("5")`.
				return "" + a === "" + b;
				break;
			case "[object Number]":
				// `NaN`s are equivalent, but non-reflexive.
				// Object(NaN) is equivalent to NaN
				if (+a !== +a) {
					return +b !== +b;
				}
				// An `egal` comparison is performed for other numeric values.
				if (+a === 0) {
					return 1 / +a === 1 / b;
				} else {
					return +a === +b;
				}
				break;
			case "[object Date]":
			case "[object Boolean]":
				// Coerce dates and booleans to numeric primitive values. Dates are
				// compared by their millisecond representations. Note that invalid
				// dates with millisecond representations of `NaN` are not
				// equivalent.
				return +a === +b;
				break;
		}

		const areArrays = className === "[object Array]";
		if (!areArrays) {
			if (typeof a !== "object" || typeof b !== "object") {
				return false;
			}

			// Objects with different constructors are not equivalent, but
			// `Object`s or `Array`s from different frames are.
			const aCtor = a.constructor;
			const bCtor = b.constructor;
			if (
				aCtor !== bCtor &&
				!(
					_.isFunction(aCtor) &&
					aCtor instanceof aCtor &&
					_.isFunction(bCtor) &&
					bCtor instanceof bCtor
				) &&
				"constructor" in a &&
				"constructor" in b
			) {
				return false;
			}
		}
		// Assume equality for cyclic structures. The algorithm for detecting cyclic
		// structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

		// Initializing stack of traversed objects.
		// It's done here since we only need them for objects and arrays comparison.
		aStack = aStack != null ? aStack : [];
		bStack = bStack != null ? bStack : [];
		let { length } = aStack;
		while (length--) {
			// Linear search. Performance is inversely proportional to the number of
			// unique nested structures.
			if (aStack[length] === a) {
				return bStack[length] === b;
			}
		}

		// Add the first object to the stack of traversed objects.
		aStack.push(a);
		bStack.push(b);

		// Recursively compare objects and arrays.
		if (areArrays) {
			// Compare array lengths to determine if a deep comparison is necessary.
			({ length } = a);
			if (length !== b.length) {
				return false;
			}
			// Deep compare the contents, ignoring non-numeric properties.
			while (length--) {
				if (!Utils._isEqual(a[length], b[length], aStack, bStack, options)) {
					return false;
				}
			}
		} else {
			// Deep compare objects.
			let key;
			const keys = Object.keys(a);
			({ length } = keys);
			// Ensure that both objects contain the same number of properties
			// before comparing deep equality.
			if (Object.keys(b).length !== length) {
				return false;
			}
			const keysToIgnore = {};
			if (options.ignoreKeys && _.isArray(options.ignoreKeys)) {
				for (key of Array.from(options.ignoreKeys)) {
					keysToIgnore[key] = true;
				}
			}
			while (length--) {
				// Deep compare each member
				key = keys[length];
				if (key in keysToIgnore) {
					continue;
				}
				if (
					!(
						_.has(b, key) &&
						Utils._isEqual(a[key], b[key], aStack, bStack, options)
					)
				) {
					return false;
				}
			}
		}
		// Remove the first object from the stack of traversed objects.
		aStack.pop();
		bStack.pop();
		return true;
	},

	// https://github.com/mailcheck/mailcheck/wiki/list-of-popular-domains
	// As a hash for instant lookup.
	commonDomains: {
		"aol.com": true,
		"att.net": true,
		"comcast.net": true,
		"facebook.com": true,
		"gmail.com": true,
		"gmx.com": true,
		"googlemail.com": true,
		"google.com": true,
		"hotmail.com": true,
		"hotmail.co.uk": true,
		"mac.com": true,
		"me.com": true,
		"mail.com": true,
		"msn.com": true,
		"live.com": true,
		"sbcglobal.net": true,
		"verizon.net": true,
		"yahoo.com": true,
		"yahoo.co.uk": true,
		"email.com": true,
		"games.com": true,
		"gmx.net": true,
		"hush.com": true,
		"hushmail.com": true,
		"inbox.com": true,
		"lavabit.com": true,
		"love.com": true,
		"pobox.com": true,
		"rocketmail.com": true,
		"safe-mail.net": true,
		"wow.com": true,
		"ygm.com": true,
		"ymail.com": true,
		"zoho.com": true,
		"fastmail.fm": true,
		"bellsouth.net": true,
		"charter.net": true,
		"cox.net": true,
		"earthlink.net": true,
		"juno.com": true,
		"btinternet.com": true,
		"virginmedia.com": true,
		"blueyonder.co.uk": true,
		"freeserve.co.uk": true,
		"live.co.uk": true,
		"ntlworld.com": true,
		"o2.co.uk": true,
		"orange.net": true,
		"sky.com": true,
		"talktalk.co.uk": true,
		"tiscali.co.uk": true,
		"virgin.net": true,
		"wanadoo.co.uk": true,
		"bt.com": true,
		"sina.com": true,
		"qq.com": true,
		"naver.com": true,
		"hanmail.net": true,
		"daum.net": true,
		"nate.com": true,
		"yahoo.co.jp": true,
		"yahoo.co.kr": true,
		"yahoo.co.id": true,
		"yahoo.co.in": true,
		"yahoo.com.sg": true,
		"yahoo.com.ph": true,
		"hotmail.fr": true,
		"live.fr": true,
		"laposte.net": true,
		"yahoo.fr": true,
		"wanadoo.fr": true,
		"orange.fr": true,
		"gmx.fr": true,
		"sfr.fr": true,
		"neuf.fr": true,
		"free.fr": true,
		"gmx.de": true,
		"hotmail.de": true,
		"live.de": true,
		"online.de": true,
		"t-online.de": true,
		"web.de": true,
		"yahoo.de": true,
		"mail.ru": true,
		"rambler.ru": true,
		"yandex.ru": true,
		"hotmail.be": true,
		"live.be": true,
		"skynet.be": true,
		"voo.be": true,
		"tvcablenet.be": true,
		"hotmail.com.ar": true,
		"live.com.ar": true,
		"yahoo.com.ar": true,
		"fibertel.com.ar": true,
		"speedy.com.ar": true,
		"arnet.com.ar": true,
		"hotmail.com": true,
		"gmail.com": true,
		"yahoo.com.mx": true,
		"live.com.mx": true,
		"yahoo.com": true,
		"hotmail.es": true,
		"live.com": true,
		"hotmail.com.mx": true,
		"prodigy.net.mx": true,
		"msn.com": true,
	},

	// This method ensures that the provided function `fn` is only executing
	// once at any given time. `fn` should have the following signature:
	//
	// (finished, reinvoked, arg1, arg2, ...)
	//
	// During execution, the function can call reinvoked() to see if
	// it has been called again since it was invoked. When it stops
	// or finishes execution, it should call finished()
	//
	// If the wrapped function is called again while `fn` is still executing,
	// another invocation of the function is queued up. The paramMerge
	// function allows you to control the params that are passed to
	// the next invocation.
	//
	// For example,
	//
	// fetchFromCache({shallow: true})
	//
	// fetchFromCache({shallow: true})
	//  -- will be executed once the initial call finishes
	//
	// fetchFromCache({})
	//  -- `paramMerge` is called with `[{}]` and `[{shallow:true}]`. At this
	//     point it should return `[{}]` since calling fetchFromCache with no
	//     options is a more significant refresh.
	//
	ensureSerialExecution(fn, paramMerge) {
		let fnRun = null;
		const fnReinvoked = () => fn.next;
		const fnFinished = () => {
			fn.executing = false;
			if (fn.next) {
				const args = fn.next;
				fn.next = null;
				return fnRun(...Array.from(args || []));
			}
		};
		fnRun = function () {
			if (fn.executing) {
				if (fn.next) {
					return (fn.next = paramMerge(fn.next, arguments));
				} else {
					return (fn.next = arguments);
				}
			} else {
				fn.executing = true;
				return fn.apply(this, [fnFinished, fnReinvoked, ...arguments]);
			}
		};
		return fnRun;
	},

	hueForString(str) {
		if (str == null) {
			str = "";
		}
		return (
			str
				.split("")
				.map((c) => c.charCodeAt())
				.reduce((n, a) => n + a) % 360
		);
	},

	// Emails that nave no-reply or similar phrases in them are likely not a
	// human. As such it's not worth the cost to do a lookup on that person.
	//
	// Also emails that are really long are likely computer-generated email
	// strings used for bcc-based automated teasks.
	likelyNonHumanEmail(email) {
		const at = "[-@+=]";
		const prefixes = [
			"noreply",
			"no-reply",
			"donotreply",
			"do-not-reply",
			`bounce[s]?${at}`,
			`notification[s]?${at}`,
			`support${at}`,
			`alert[s]?${at}`,
			`news${at}`,
			`info${at}`,
			`automated${at}`,
			`list[s]?${at}`,
			`distribute[s]?${at}`,
			`catchall${at}`,
			`catch-all${at}`,
		];
		const reStr = `(${prefixes.join("|")})`;
		const re = new RegExp(reStr, "gi");
		return re.test(email) || email.length > 64;
	},

	// Does the several tests you need to determine if a test range is within
	// a bounds. Expects both objects to have `start` and `end` keys.
	// Compares any values with <= and >=.
	overlapsBounds(bounds, test) {
		// Fully enclosed
		return (
			(test.start <= bounds.end && test.end >= bounds.start) ||
			// Starts in bounds. Ends out of bounds
			(test.start <= bounds.end && test.start >= bounds.start) ||
			// Ends in bounds. Starts out of bounds
			(test.end >= bounds.start && test.end <= bounds.end) ||
			// Spans entire boundary
			(test.end >= bounds.end && test.start <= bounds.start)
		);
	},

	mean(values) {
		if (values == null) {
			values = [];
		}
		if (values.length === 0) {
			throw new Error("Can't average zero values");
		}
		const sum = values.reduce((sum, value) => sum + value, 0);
		return sum / values.length;
	},

	stdev(values) {
		if (values == null) {
			values = [];
		}
		if (values.length === 0) {
			throw new Error("Can't stdev zero values");
		}
		const avg = Utils.mean(values);
		const squareDiffs = values.map((val) => (val - avg) ** 2);
		return Math.sqrt(Utils.mean(squareDiffs));
	},

	// Resolves nested paths in objects of the form "key.subKey.subKey".
	// Null checks along the way.
	//
	// If the result is a function, this will call it with no arguments.
	//
	// Also supports "key1,key2.subkey,key3". The commas lookup those paths
	// in order and takes the first non-blank one.
	//
	// Also supports "key1+key2". This will attempt to concatenate the
	// lookup.
	//
	// Order of operations is "," then "+", then "."
	resolvePath(fullPath, model) {
		if (fullPath == null) {
			fullPath = "";
		}
		const commaPaths = fullPath.split(",");
		for (var commaPath of Array.from(commaPaths)) {
			var joinedVals = [];
			var paths = commaPath.split("+");
			for (var filePath of Array.from(paths)) {
				var parts = filePath.split(".");
				var curVal = model;
				for (var part of Array.from(parts)) {
					if (_.isFunction(curVal[part])) {
						curVal = curVal[part]();
					} else {
						curVal = curVal[part];
					}
					if (!curVal || curVal.length === 0) {
						curVal = null;
						break;
					}
				}
				joinedVals.push(curVal);
			}
			joinedVals = _.compact(joinedVals);
			if (joinedVals.length === 0) {
				continue;
			}
			return joinedVals.join(" ");
		}
		return null;
	},
};

function __range__(left, right, inclusive) {
	const range = [];
	const ascending = left < right;
	const end = !inclusive ? right : ascending ? right + 1 : right - 1;
	for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
		range.push(i);
	}
	return range;
}
function __guard__(value, transform) {
	return typeof value !== "undefined" && value !== null
		? transform(value)
		: undefined;
}
