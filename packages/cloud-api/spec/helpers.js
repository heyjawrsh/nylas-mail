function getMockServer() {
  return {routes: [], route(route) { this.routes.push(route) }}
}
function getToolkit() {
  return {
    response(value) {
      return {value, statusCode: 200, headers: {}, code(statusCode) { this.statusCode = statusCode; return this },
        header(name, value) { this.headers[name] = value; return this }}
    },
    redirect(location) { return {location, redirected: true} },
    view(template, context) { return {template, context} },
  }
}
export {getMockServer, getToolkit}
