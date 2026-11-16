import classic from "../../../static/themes/classic.descriptor.json";
import * as shell from "../shell-client.js";
import { createLookRuntime } from "./commit-queue.js";
import { DEFAULTS, DEFAULT_SIGNALS } from "./defaults";

export const BUILTIN_LIBRARY = { themes: { classic }, styles: ["classic"] };

export function installLookRuntime(env) {
	if (env.lookRuntime) return env.lookRuntime;
	const appearance = env.getLoadSettings().appearance;
	let revision = appearance?.revision ?? 0;
	let library = BUILTIN_LIBRARY;
	const runtime = createLookRuntime({
		root: document.documentElement,
		state: {
			applied: env.config.get("core.appearance"),
			signals: appearance?.signals || DEFAULT_SIGNALS,
			attributes: appearance?.attributes,
			library,
		},
		shell,
	});
	env.lookRuntime = runtime;
	const report = (error) =>
		console.error("Could not update window look", error);
	const commit = (change) => runtime.commit(change).catch(report);
	const subscriptions = [
		shell.onThemeChanged((descriptor) => {
			if (descriptor.revision <= revision) return;
			revision = descriptor.revision;
			library = {
				...library,
				themes: { ...library.themes, [descriptor.id]: descriptor },
			};
			return commit({ library });
		}),
		env.config.onDidChange("core.appearance", ({ newValue }) =>
			commit({ applied: { ...DEFAULTS, ...newValue } }),
		),
		shell.onLoadSettingsChanged(({ appearance }) => {
			if (!appearance) return;
			return commit({ signals: appearance.signals });
		}),
	];
	let disposed = false;
	runtime.dispose = () => {
		disposed = true;
		for (const subscription of subscriptions) subscription.dispose();
		delete env.lookRuntime;
	};
	runtime.ready = shell
		.getThemeLibrary()
		.then((snapshot) => {
			if (disposed || snapshot.revision < revision) return;
			revision = snapshot.revision;
			library = {
				...library,
				themes: Object.fromEntries(
					snapshot.descriptors.map((descriptor) => [descriptor.id, descriptor]),
				),
			};
			return commit({ library });
		})
		.catch(report);
	return runtime;
}
