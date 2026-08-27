function getMockServer() {
  return {routes: [], route(route) { this.routes.push(route) }}
}
export {getMockServer}
