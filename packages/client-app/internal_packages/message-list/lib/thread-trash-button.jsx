const _ = require("underscore");
const React = require("react");
const {
	Actions,
	DOMUtils,
	TaskFactory,
	AccountStore,
	FocusedPerspectiveStore,
} = require("nylas-exports");
const { RetinaImg } = require("nylas-component-kit");

class ThreadTrashButton extends React.Component {
	static displayName = "ThreadTrashButton";
	static containerRequired = false;
	static propTypes = { thread: PropTypes.object.isRequired };

	constructor() {
		super(...arguments);
		this.render = this.render.bind(this);
		this._onRemove = this._onRemove.bind(this);
	}

	render() {
		const allowed = FocusedPerspectiveStore.current().canMoveThreadsTo(
			[this.props.thread],
			"trash",
		);
		if (!allowed) {
			return <span />;
		}
		return (
			<button
				className="btn btn-toolbar"
				style={{ order: -106 }}
				title="Move to Trash"
				onClick={this._onRemove}
			>
				<RetinaImg
					name="toolbar-trash.png"
					mode={RetinaImg.Mode.ContentIsMask}
				/>
			</button>
		);
	}

	_onRemove(e) {
		if (!DOMUtils.nodeIsVisible(e.currentTarget)) {
			return;
		}
		Actions.trashThreads({
			source: "Toolbar Button: Thread List",
			threads: [this.props.thread],
		});
		Actions.popSheet();
		return e.stopPropagation();
	}
}

module.exports = ThreadTrashButton;
