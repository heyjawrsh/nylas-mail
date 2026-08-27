export default function registerErrorFormatDecorator(server) {
	server.ext("onPreResponse", (request, h) => {
		if (request.response?.isBoom) {
			request.response.reformat();
			return h.continue;
		}
		return h.continue;
	});
}
