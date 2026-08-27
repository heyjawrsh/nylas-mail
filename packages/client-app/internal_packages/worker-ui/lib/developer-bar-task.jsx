/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const React = require("react");
const classNames = require("classnames");
const _ = require("underscore");
const { Utils } = require("nylas-exports");

class DeveloperBarTask extends React.Component {
	static initClass() {
		DeveloperBarTask.displayName = "DeveloperBarTask";
	}

	constructor(props) {
		super();
		this.render = this.render.bind(this);
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
		this._taskSummary = this._taskSummary.bind(this);
		this._classNames = this._classNames.bind(this);
		this.props = props;
		this.state = { expanded: false };
	}

	render() {
		let details = false;
		if (this.state.expanded) {
			// This could be a potentially large amount of JSON.
			// Do not render unless it's actually being displayed!
			details = (
				<div className="task-details">
					{JSON.stringify(this.props.task.toJSON(), null, 2)}
				</div>
			);
		}

		return (
			<div
				className={this._classNames()}
				onClick={() => this.setState({ expanded: !this.state.expanded })}
			>
				<div className="task-summary">{this._taskSummary()}</div>
				{details}
			</div>
		);
	}

	shouldComponentUpdate(nextProps, nextState) {
		return (
			!Utils.isEqualReact(nextProps, this.props) ||
			!Utils.isEqualReact(nextState, this.state)
		);
	}

	_taskSummary() {
		let status;
		const qs = this.props.task.queueState;
		let errType = "";
		let errCode = "";
		let errMessage = "";
		if (qs.localError != null) {
			const { localError } = qs;
			errType = localError.constructor.name;
			errMessage =
				localError.message != null
					? localError.message
					: JSON.stringify(localError);
		} else if (qs.remoteError != null) {
			let left;
			const { remoteError } = qs;
			errType = remoteError.constructor.name;
			errCode = remoteError.statusCode != null ? remoteError.statusCode : "";
			errMessage =
				(left =
					(remoteError.body != null ? remoteError.body.message : undefined) !=
					null
						? remoteError.body != null
							? remoteError.body.message
							: undefined
						: remoteError != null
							? remoteError.message
							: undefined) != null
					? left
					: JSON.stringify(remoteError);
		}

		const id = this.props.task.id.slice(-4);

		if (qs.status) {
			status = `${qs.status} (${qs.debugStatus})`;
		} else {
			status = `${qs.debugStatus}`;
		}

		return `${this.props.task.constructor.name} (ID: ${id}) ${status} ${errType} ${errCode} ${errMessage}`;
	}

	_classNames() {
		const qs =
			this.props.task.queueState != null ? this.props.task.queueState : {};
		return classNames({
			task: true,
			"task-queued": this.props.type === "queued",
			"task-completed": this.props.type === "completed",
			"task-expanded": this.state.expanded,
			"task-local-error": qs.localError,
			"task-remote-error": qs.remoteError,
			"task-is-processing": qs.isProcessing,
			"task-success": qs.localComplete && qs.remoteComplete,
		});
	}
}
DeveloperBarTask.initClass();

module.exports = DeveloperBarTask;
