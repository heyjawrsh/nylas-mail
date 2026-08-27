/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
class DeprecateUtils {
	// See
	// http://www.codeovertones.com/2011/08/how-to-print-stack-trace-anywhere-in.html
	static parseStack(stackString) {
		const stack = stackString
			.replace(/^[^(]+?[\n$]/gm, "")
			.replace(/^\s+at\s+/gm, "")
			.replace(/^Object.<anonymous>\s*\(/gm, "{anonymous}()@")
			.split("\n");
		return stack;
	}

	static warn(condition, message) {
		if (condition) {
			return console.warn(message);
		}
	}

	static deprecate(fnName, newName, ctx, fn) {
		if (NylasEnv.inDevMode() && !NylasEnv.inSpecMode()) {
			let warn = true;
			const newFn = function () {
				const stack = DeprecateUtils.parseStack(new Error().stack);
				DeprecateUtils.warn(
					warn,
					`Deprecation warning! ${fnName} is deprecated and will be removed soon. \
Use ${newName} instead.\nCheck your code at ${stack[1]}`,
				);
				warn = false;
				return fn.apply(ctx, arguments);
			}.bind(DeprecateUtils);
			return Object.assign(newFn, fn);
		}
		return fn;
	}
}

export const deprecate = DeprecateUtils.deprecate;
export default DeprecateUtils;
