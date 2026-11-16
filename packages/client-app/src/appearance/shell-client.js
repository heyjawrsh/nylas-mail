import { ipcRenderer } from "electron";

export const getThemeLibrary = () => ipcRenderer.invoke("get-theme-library");

function subscribe(channel, callback) {
	const listener = (_event, payload) => callback(payload);
	ipcRenderer.on(channel, listener);
	return { dispose: () => ipcRenderer.removeListener(channel, listener) };
}

export const onThemeChanged = (callback) =>
	subscribe("theme-changed", callback);
export const onLoadSettingsChanged = (callback) =>
	subscribe("load-settings-changed", callback);
export const setWindowChrome = (attributes) =>
	ipcRenderer.send("set-window-chrome", attributes);
