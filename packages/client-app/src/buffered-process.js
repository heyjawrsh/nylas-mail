/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let BufferedProcess;
const _ = require("underscore");
const ChildProcess = require("node:child_process");
const { Emitter } = require("event-kit");
const path = require("node:path");

// Extended: A wrapper which provides standard error/output line buffering for
// Node's ChildProcess.
//
// ## Examples
//
// ```coffee
// {BufferedProcess} = require 'nylas-exports'
//
// command = 'ps'
// args = ['-ef']
// stdout = (output) -> console.log(output)
// exit = (code) -> console.log("ps -ef exited with #{code}")
// process = new BufferedProcess({command, args, stdout, exit})
// ```
module.exports = BufferedProcess = class BufferedProcess {
	/*
  Section: Construction
  */

	// Public: Runs the given command by spawning a new child process.
	//
	// * `options` An {Object} with the following keys:
	//   * `command` The {String} command to execute.
	//   * `args` The {Array} of arguments to pass to the command (optional).
	//   * `options` {Object} (optional) The options {Object} to pass to Node's
	//     `ChildProcess.spawn` method.
	//   * `stdout` {Function} (optional) The callback that receives a single
	//     argument which contains the standard output from the command. The
	//     callback is called as data is received but it's buffered to ensure only
	//     complete lines are passed until the source stream closes. After the
	//     source stream has closed all remaining data is sent in a final call.
	//     * `data` {String}
	//   * `stderr` {Function} (optional) The callback that receives a single
	//     argument which contains the standard error output from the command. The
	//     callback is called as data is received but it's buffered to ensure only
	//     complete lines are passed until the source stream closes. After the
	//     source stream has closed all remaining data is sent in a final call.
	//     * `data` {String}
	//   * `exit` {Function} (optional) The callback which receives a single
	//     argument containing the exit status.
	//     * `code` {Number}
	constructor(param) {
		if (param == null) {
			param = {};
		}
		let { command, args, options, stdout, stderr, exit } = param;
		this.emitter = new Emitter();
		if (options == null) {
			options = {};
		}
		this.command = command;
		// Related to joyent/node#2318
		if (process.platform === "win32") {
			// Quote all arguments and escapes inner quotes
			let cmdArgs;
			if (args != null) {
				cmdArgs = args.filter((arg) => arg != null);
				cmdArgs = cmdArgs.map((arg) => {
					if (this.isExplorerCommand(command) && /^\/[a-zA-Z]+,.*$/.test(arg)) {
						// Don't wrap /root,C:\folder style arguments to explorer calls in
						// quotes since they will not be interpreted correctly if they are
						return arg;
					} else {
						return `"${arg.toString().replace(/"/g, '\\"')}"`;
					}
				});
			} else {
				cmdArgs = [];
			}
			if (/\s/.test(command)) {
				cmdArgs.unshift(`"${command}"`);
			} else {
				cmdArgs.unshift(command);
			}
			cmdArgs = ["/s", "/c", `"${cmdArgs.join(" ")}"`];
			const cmdOptions = _.clone(options);
			cmdOptions.windowsVerbatimArguments = true;
			this.spawn(this.getCmdPath(), cmdArgs, cmdOptions);
		} else {
			this.spawn(command, args, options);
		}

		this.killed = false;
		this.handleEvents(stdout, stderr, exit);
	}

	/*
  Section: Event Subscription
  */

	// Public: Will call your callback when an error will be raised by the process.
	// Usually this is due to the command not being available or not on the PATH.
	// You can call `handle()` on the object passed to your callback to indicate
	// that you have handled this error.
	//
	// * `callback` {Function} callback
	//   * `errorObject` {Object}
	//     * `error` {Object} the error object
	//     * `handle` {Function} call this to indicate you have handled the error.
	//       The error will not be thrown if this function is called.
	//
	// Returns a {Disposable}
	onWillThrowError(callback) {
		return this.emitter.on("will-throw-error", callback);
	}

	/*
  Section: Helper Methods
  */

	// Helper method to pass data line by line.
	//
	// * `stream` The Stream to read from.
	// * `onLines` The callback to call with each line of data.
	// * `onDone` The callback to call when the stream has closed.
	bufferStream(stream, onLines, onDone) {
		stream.setEncoding("utf8");
		let buffered = "";

		stream.on("data", (data) => {
			if (this.killed) {
				return;
			}
			buffered += data;
			const lastNewlineIndex = buffered.lastIndexOf("\n");
			if (lastNewlineIndex !== -1) {
				onLines(buffered.substring(0, lastNewlineIndex + 1));
				return (buffered = buffered.substring(lastNewlineIndex + 1));
			}
		});

		return stream.on("close", () => {
			if (this.killed) {
				return;
			}
			if (buffered.length > 0) {
				onLines(buffered);
			}
			return onDone();
		});
	}

	// Kill all child processes of the spawned cmd.exe process on Windows.
	//
	// This is required since killing the cmd.exe does not terminate child
	// processes.
	killOnWindows() {
		let wmicProcess;
		if (this.process == null) {
			return;
		}

		const parentPid = this.process.pid;
		const cmd = "wmic";
		const args = [
			"process",
			"where",
			`(ParentProcessId=${parentPid})`,
			"get",
			"processid",
		];

		try {
			wmicProcess = ChildProcess.spawn(cmd, args);
		} catch (_spawnError) {
			this.killProcess();
			return;
		}

		wmicProcess.on("error", () => {}); // ignore errors
		let output = "";
		wmicProcess.stdout.on("data", (data) => (output += data));
		return wmicProcess.stdout.on("close", () => {
			const pidsToKill = output
				.split(/\s+/)
				.filter((pid) => /^\d+$/.test(pid))
				.map((pid) => parseInt(pid, 10))
				.filter((pid) => pid !== parentPid && 0 < pid && pid < Infinity);

			for (var pid of Array.from(pidsToKill)) {
				try {
					process.kill(pid);
				} catch (_error) {}
			}
			return this.killProcess();
		});
	}

	killProcess() {
		if (this.process != null) {
			this.process.kill();
		}
		return (this.process = null);
	}

	isExplorerCommand(command) {
		if (command === "explorer.exe" || command === "explorer") {
			return true;
		} else if (process.env.SystemRoot) {
			return (
				command === path.join(process.env.SystemRoot, "explorer.exe") ||
				command === path.join(process.env.SystemRoot, "explorer")
			);
		} else {
			return false;
		}
	}

	getCmdPath() {
		if (process.env.comspec) {
			return process.env.comspec;
		} else if (process.env.SystemRoot) {
			return path.join(process.env.SystemRoot, "System32", "cmd.exe");
		} else {
			return "cmd.exe";
		}
	}

	// Public: Terminate the process.
	kill() {
		if (this.killed) {
			return;
		}

		this.killed = true;
		if (process.platform === "win32") {
			this.killOnWindows();
		} else {
			this.killProcess();
		}

		return undefined;
	}

	spawn(command, args, options) {
		try {
			return (this.process = ChildProcess.spawn(command, args, options));
		} catch (spawnError) {
			return setTimeout(() => this.handleError(spawnError), 0);
		}
	}

	handleEvents(stdout, stderr, exit) {
		if (this.process == null) {
			return;
		}

		let stdoutClosed = true;
		let stderrClosed = true;
		let processExited = true;
		let exitCode = 0;
		const triggerExitCallback = () => {
			if (this.killed) {
				return;
			}
			if (stdoutClosed && stderrClosed && processExited) {
				return typeof exit === "function" ? exit(exitCode) : undefined;
			}
		};

		if (stdout) {
			stdoutClosed = false;
			this.bufferStream(this.process.stdout, stdout, () => {
				stdoutClosed = true;
				return triggerExitCallback();
			});
		}

		if (stderr) {
			stderrClosed = false;
			this.bufferStream(this.process.stderr, stderr, () => {
				stderrClosed = true;
				return triggerExitCallback();
			});
		}

		if (exit) {
			processExited = false;
			this.process.on("exit", (code) => {
				exitCode = code;
				processExited = true;
				return triggerExitCallback();
			});
		}

		this.process.on("error", (error) => this.handleError(error));
	}

	handleError(error) {
		let handled = false;
		const handle = () => (handled = true);

		this.emitter.emit("will-throw-error", { error, handle });

		if (error.code === "ENOENT" && error.syscall.indexOf("spawn") === 0) {
			error = new Error(
				`Failed to spawn command \`${this.command}\`. Make sure \`${this.command}\` is installed and on your PATH`,
				error.path,
			);
			error.name = "BufferedProcessError";
		}

		if (!handled) {
			throw error;
		}
	}
};
