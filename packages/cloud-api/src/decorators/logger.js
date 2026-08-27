export default function registerLoggerDecorator(server) {
  server.decorate('request', 'logger', function logger() {
    const request = this
    const childLogger = global.Logger.child({
      http_method: request.method.toUpperCase(),
      remote_addr: request.info.remoteAddress,
      remote_port: request.info.remotePort,
      // path includes query params; pathname does not
      endpoint: request.url.pathname,
      http_request: request.url.path,
      // http://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-request-tracing.html
      request_uid: request.headers['x-amzn-trace-id'] || request.id,
    })
    childLogger.forAccount = (account) => global.Logger.forAccount(account, childLogger);
    return childLogger;
  }, {apply: true});
}
