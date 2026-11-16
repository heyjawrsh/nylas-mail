const {
	DEFAULTS,
	DEFAULT_THEME,
	DEFAULT_STYLE,
	TEXT_SIZES,
	DEFAULT_SIGNALS,
} = require("./defaults");

const ENUMS = {
	mode: ["auto", "light", "dark"],
	increaseContrast: ["system", "on", "off"],
	density: ["compact", "comfortable", "spacious"],
	textSize: TEXT_SIZES,
};

function resolveLook(applied, overrides, signals = DEFAULT_SIGNALS, library) {
	const look = { ...DEFAULTS, ...applied, ...overrides };
	for (const [key, fallback] of Object.entries(DEFAULTS)) {
		const valid = ENUMS[key]
			? ENUMS[key].includes(look[key])
			: typeof look[key] === "string" && look[key].length > 0;
		if (!valid) look[key] = fallback;
	}
	const themes = library?.themes ?? {};
	const theme =
		Object.hasOwn(themes, look.theme) &&
		themes[look.theme]?.status !== "unavailable"
			? look.theme
			: DEFAULT_THEME;
	const style = library?.styles?.includes(look.style)
		? look.style
		: DEFAULT_STYLE;
	const dark =
		look.mode === "dark" ||
		(look.mode === "auto" && signals.colorScheme === "dark");
	const forced = signals.forcedColors;
	const hc =
		!forced &&
		(look.increaseContrast === "on" ||
			(look.increaseContrast === "system" && signals.contrast === "more"));
	const standard = dark ? "dark" : "light";
	const variant =
		hc && themes[theme]?.variants?.includes(`${standard}-hc`)
			? `${standard}-hc`
			: standard;
	const attributes = {
		"data-look": "",
		"data-theme": theme,
		"data-variant": variant,
		"data-style": style,
		"data-density": look.density,
		"data-text-size": String(look.textSize * 100),
		"data-font": look.font,
	};
	if (hc) attributes["data-increased-contrast"] = "";
	if (forced) attributes["data-forced-colors"] = "";
	if (signals.reducedMotion) attributes["data-reduced-motion"] = "";
	if (signals.reducedTransparency) attributes["data-reduced-transparency"] = "";
	return attributes;
}

module.exports = { resolveLook };
