import { Actions, React } from "nylas-exports";
import { RetinaImg } from "nylas-component-kit";

import EmojiButtonPopover from "./emoji-button-popover";

class EmojiButton extends React.Component {
	static displayName = "EmojiButton";

	_button = React.createRef();

	getDOMNode() {
		return this._button.current;
	}

	onClick = () => {
		const buttonRect = this._button.current.getBoundingClientRect();
		Actions.openPopover(<EmojiButtonPopover />, {
			originRect: buttonRect,
			direction: "up",
		});
	};

	render() {
		return (
			<button
				ref={this._button}
				tabIndex={-1}
				className="btn btn-toolbar btn-emoji"
				title="Insert emoji…"
				onClick={this.onClick}
			>
				<RetinaImg
					name="icon-composer-emoji.png"
					mode={RetinaImg.Mode.ContentIsMask}
				/>
			</button>
		);
	}
}

EmojiButton.containerStyles = {
	order: 2,
};

export default EmojiButton;
