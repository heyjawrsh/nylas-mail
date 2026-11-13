import _ from "underscore";

// The renderer bundle seeds a placeholder NylasEnv (scripts/build-renderer.js)
// for the stores built while the bundle evaluates, before the real env and its
// Config exist. AccountStore is one: it loads the accounts and subscribes to
// `nylas.accountsVersion` in its constructor. The placeholder answers reads
// from the saved settings and records each onDidChange/observe subscription
// with the value its subscriber saw.
//
// Call this once the real config has loaded. It moves every live subscription
// onto the real config, and tells a subscriber whose value changed in between,
// so a store hears the same changes it would have heard on the real config.

const sameValue = (a, b) => (a == null && b == null) || _.isEqual(a, b);

export function replayEarlyConfigSubscriptions(
	config,
	win = typeof window !== "undefined" ? window : null,
) {
	const early = win?.__nylasEarlyConfigSubscriptions;
	if (!early) {
		return;
	}
	win.__nylasEarlyConfigSubscriptions = null;
	for (const record of early) {
		const { method, keyPath, callback, seen } = record;
		if (record.disposed || typeof callback !== "function") {
			continue;
		}
		const current = config.get(keyPath);
		if (method === "observe") {
			record.real = config.onDidChange(keyPath, ({ newValue }) =>
				callback(newValue),
			);
			if (!sameValue(seen, current)) {
				callback(current);
			}
		} else {
			record.real = config.onDidChange(keyPath, callback);
			if (!sameValue(seen, current)) {
				callback({ oldValue: seen, newValue: current });
			}
		}
	}
}

export default replayEarlyConfigSubscriptions;
