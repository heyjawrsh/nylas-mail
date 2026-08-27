export default function registerLoggerDecorator(server) {
	server.decorate(
		"request",
		"logger",
		function logger() {
			const childLogger = global.Logger.child({
				http_method: this.method.toUpperCase(),
				remote_addr: this.info.remoteAddress,
				remote_port: this.info.remotePort,
				// path includes query params; pathname does not
				endpoint: this.url.pathname,
				http_request: this.url.path,
				// http://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-request-tracing.html
				request_uid: this.headers["x-amzn-trace-id"] || this.id,
			});
			childLogger.forAccount = (account) =>
				global.Logger.forAccount(account, childLogger);
			return childLogger;
		},
		{ apply: true },
	);
}
