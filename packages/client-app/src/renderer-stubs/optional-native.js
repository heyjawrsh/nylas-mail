// Renderer-bundle stubs for native/optional modules that are not needed during
// boot or smoke. Each exports a Proxy that tolerates any property access;
// real functionality requires the native binary (keytar, pathwatcher,
// spellchecker) which the bundler cannot embed.
const tolerant = new Proxy(
	{},
	{
		get: (_t, prop) => {
			if (prop === "then") return undefined; // not a thenable
			return () => {
				throw new Error(
					`optional-native stub: ${String(prop)} unavailable in renderer bundle`,
				);
			};
		},
	},
);

export default tolerant;
