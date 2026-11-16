import { nativeTheme } from "electron";
import { DEFAULT_SIGNALS } from "../../appearance/look-runtime/defaults.js";

export function readSignalsSnapshot() {
	return {
		...DEFAULT_SIGNALS,
		colorScheme: nativeTheme.shouldUseDarkColors ? "dark" : "light",
		revision: 0,
	};
}
