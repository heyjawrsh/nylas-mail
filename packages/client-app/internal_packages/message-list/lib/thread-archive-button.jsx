const { RetinaImg } = require("nylas-component-kit");
const {
	Actions,
	React,
	TaskFactory,
	DOMUtils,
	AccountStore,
	FocusedPerspectiveStore,
} = require("nylas-exports");

class ThreadArchiveButton extends React.Component {
	static displayName = "ThreadArchiveButton";
	static containerRequired = false;
	static propTypes = { thread: PropTypes.object.isRequired };

	constructor() {
		super(...arguments);
		this.render = this.render.bind(this);
		this._onArchive = this._onArchive.bind(this);
	}

	render() {
		const canArchiveThreads =
			FocusedPerspectiveStore.current().canArchiveThreads([this.props.thread]);
		if (!canArchiveThreads) {
			return <span />;
		}
		return (
			<button
				className="btn btn-toolbar btn-archive"
				style={{ order: -107 }}
				title="Archive"
				onClick={this._onArchive}
			>
				<RetinaImg
					name="toolbar-archive.png"
					mode={RetinaImg.Mode.ContentIsMask}
				/>
			</button>
		);
	}

	_onArchive(e) {
		if (!DOMUtils.nodeIsVisible(e.currentTarget)) {
			return;
		}
		Actions.archiveThreads({
			threads: [this.props.thread],
			source: "Toolbar Button: Message List",
		});
		Actions.popSheet();
		return e.stopPropagation();
	}
}

module.exports = ThreadArchiveButton;
