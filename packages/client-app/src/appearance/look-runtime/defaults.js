// epic-loft flips these defaults to loft.
const DEFAULT_THEME = "classic";
const DEFAULT_STYLE = "classic";
const DEFAULTS = {
	style: DEFAULT_STYLE,
	theme: DEFAULT_THEME,
	mode: "auto",
	increaseContrast: "system",
	density: "comfortable",
	textSize: 1,
	font: "theme",
};
const TEXT_SIZES = [0.875, 1, 1.125, 1.25, 1.375, 1.5];
const DEFAULT_SIGNALS = {
	revision: 0,
	platform:
		process.platform === "darwin"
			? "mac"
			: process.platform === "win32"
				? "windows"
				: "linux",
	colorScheme: "light",
	contrast: "no-preference",
	forcedColors: false,
	reducedMotion: false,
	reducedTransparency: false,
};

module.exports = {
	DEFAULTS,
	DEFAULT_THEME,
	DEFAULT_STYLE,
	TEXT_SIZES,
	DEFAULT_SIGNALS,
};
