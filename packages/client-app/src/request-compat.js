// Drop-in replacement for the deprecated `request` package over fetch.
// Supports the option subset this codebase uses: method, url, qs, body, json,
// form, headers, timeout, auth (basic). Callback signature matches request:
// (error, response, body) where response carries statusCode/statusMessage/
// headers.
import querystring from "node:querystring";

const buildURL = (options) => {
	let url = options.url ?? options.uri;
	if (!url) throw new Error("request-compat: url is required");
	if (options.qs) {
		const qs = querystring.stringify(options.qs);
		url += url.includes("?") ? `&${qs}` : `?${qs}`;
	}
	return url;
};

const requestCompat = (options, callback) => {
	const promise = (async () => {
		const controller = new AbortController();
		const timer = options.timeout
			? setTimeout(() => controller.abort(), options.timeout)
			: null;
		try {
			const headers = { ...(options.headers || {}) };
			let body = options.body;
			if (options.json === true || (options.json && typeof options.json === "object")) {
				headers["Content-Type"] = headers["Content-Type"] || "application/json";
				body = typeof options.json === "object" ? JSON.stringify(options.json) : body;
				if (typeof body === "object" && body !== null && body !== undefined) {
					body = JSON.stringify(body);
				}
			}
			if (options.form) {
				headers["Content-Type"] =
					headers["Content-Type"] || "application/x-www-form-urlencoded";
				body = querystring.stringify(options.form);
			}
			if (options.auth) {
				const { user, pass } = options.auth;
				headers.Authorization = `Basic ${btoa(`${user}:${pass ?? ""}`)}`;
			}
			const res = await fetch(buildURL(options), {
				method: options.method || "GET",
				headers,
				body: body === undefined || body === null ? undefined : body,
				signal: controller.signal,
			});
			const text = await res.text();
			let parsed = text;
			const isJSON =
				options.json === true ||
				(res.headers.get("content-type") || "").includes("application/json");
			if (isJSON && text) {
				try {
					parsed = JSON.parse(text);
				} catch {
					/* keep raw text */
				}
			}
			const response = {
				statusCode: res.status,
				statusMessage: res.statusText,
				headers: Object.fromEntries(res.headers.entries()),
			};
			if (callback) setImmediate(() => callback(null, response, parsed));
			return { response, body: parsed };
		} catch (error) {
			const err = error?.name === "AbortError" ? new Error("ETIMEDOUT") : error;
			if (callback) {
				setImmediate(() => callback(err, null, null));
			} else {
				throw err;
			}
			return { error: err };
		} finally {
			clearTimeout(timer);
		}
	// callback, but keep the promise chainable for safety.
	return promise;
};

export default requestCompat;
