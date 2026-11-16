import { DEFAULT_SIGNALS } from "../../appearance/look-runtime/defaults.js";

export function readSignalsSnapshot() {
	// Story 9 replaces this default snapshot with live OS signals.
	return { ...DEFAULT_SIGNALS };
}
