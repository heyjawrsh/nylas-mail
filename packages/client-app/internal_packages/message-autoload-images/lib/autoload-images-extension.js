import { MessageViewExtension } from "nylas-exports";
import AutoloadImagesStore from "./autoload-images-store";

export default class AutoloadImagesExtension extends MessageViewExtension {
	static formatMessageBody = ({ message }) => {
		if (AutoloadImagesStore.shouldBlockImagesIn(message)) {
			message.body = message.body.replace(
				AutoloadImagesStore.ImagesRegexp,
				(_match, prefix) => {
					return `${prefix}#`;
				},
			);
		}
	};
}
