/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const { userAgent, taskPath } = process.env;
let handler = null;

const setupGlobals = () => {
	global.attachEvent = () => {};
	const console = {
		warn() {
			return emit("task:warn", ...arguments);
		},
		log() {
			return emit("task:log", ...arguments);
		},
		error() {
			return emit("task:error", ...arguments);
		},
		trace() {},
	};
	global.__defineGetter__("console", () => console);

	global.document = {
		createElement() {
			return {
				setAttribute() {},
				getElementsByTagName() {
					return [];
				},
				appendChild() {},
			};
		},
		documentElement: {
			insertBefore() {},
			removeChild() {},
		},
		getElementById() {
			return {};
		},
		createComment() {
			return {};
		},
		createDocumentFragment() {
			return {};
		},
	};

	global.emit = (event, ...args) => {
		if (!process.connected) return;
		return process.send({ event, args });
	};
	global.navigator = { userAgent };
	return (global.window = global);
};

const handleEvents = () => {
	// Exit orphaned tasks and avoid logging into a closed IPC channel (#24).
	process.on("disconnect", () => process.exit(0));
	process.on("unhandledRejection", (reason, promise) =>
		console.error(reason.stack, promise),
	);
	process.on("uncaughtException", (error) =>
		console.error(error.message, error.stack),
	);
	return process.on("message", (param) => {
		if (param == null) {
			param = {};
		}
		const { event, args } = param;
		if (event !== "start") {
			return;
		}

		let isAsync = false;
		const async = () => {
			isAsync = true;
			return (result) => emit("task:completed", result);
		};
		const result = handler.bind({ async })(...Array.from(args || []));
		if (!isAsync) {
			return emit("task:completed", result);
		}
	});
};

setupGlobals();
handleEvents();
handler = require(taskPath);
