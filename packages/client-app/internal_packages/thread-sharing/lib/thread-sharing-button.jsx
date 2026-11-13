import { Actions, React } from "nylas-exports";
import PropTypes from "prop-types";
import { RetinaImg } from "nylas-component-kit";
import ThreadSharingPopover from "./thread-sharing-popover";

export default class ThreadSharingButton extends React.Component {
	static displayName = "ThreadSharingButton";

	static containerRequired = false;

	_root = React.createRef();

	// The button (or the empty span for a multi-selection).
	getDOMNode() {
		return this._root.current;
	}

	static propTypes = {
		items: PropTypes.array,
		thread: PropTypes.object,
	};

	componentDidUpdate(prevProps) {
		if (prevProps.thread.id !== this.props.thread.id) {
			Actions.closePopover();
		}
	}

	_onClick = () => {
		const { thread } = this.props;

		Actions.openPopover(
			<ThreadSharingPopover
				thread={thread}
				accountId={thread.accountId}
				closePopover={Actions.closePopover}
			/>,
			{
				originRect: this._root.current.getBoundingClientRect(),
				direction: "down",
			},
		);
	};

	render() {
		if (this.props.items && this.props.items.length > 1) {
			return <span ref={this._root} />;
		}

		return (
			<button
				ref={this._root}
				className="btn btn-toolbar thread-sharing-button"
				title="Share"
				style={{ marginRight: 0 }}
				onClick={this._onClick}
			>
				<RetinaImg
					name="ic-toolbar-native-share.png"
					mode={RetinaImg.Mode.ContentIsMask}
				/>
			</button>
		);
	}
}
