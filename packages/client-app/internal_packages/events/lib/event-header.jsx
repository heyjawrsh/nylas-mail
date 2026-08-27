/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
const _ = require("underscore");
const _path = require("node:path");
const React = require("react");
const { RetinaImg } = require("nylas-component-kit");
const {
	Actions,
	DateUtils,
	Message,
	Event,
	ComponentRegistry,
	EventRSVPTask,
	DatabaseStore,
	AccountStore,
} = require("nylas-exports");
const moment = require("moment-timezone");

class EventHeader extends React.Component {
	static initClass() {
		EventHeader.displayName = "EventHeader";

		EventHeader.propTypes = {
			message: PropTypes.instanceOf(Message).isRequired,
		};
	}

	constructor(props) {
		super();
		this._onChange = this._onChange.bind(this);
		this.componentDidMount = this.componentDidMount.bind(this);
		this.UNSAFE_componentWillReceiveProps =
			this.UNSAFE_componentWillReceiveProps.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this.render = this.render.bind(this);
		this._renderEventActions = this._renderEventActions.bind(this);
		this._rsvp = this._rsvp.bind(this);
		this.props = props;
		this.state = { event: this.props.message.events[0] };
	}

	_onChange() {
		if (!this.state.event) {
			return;
		}
		return DatabaseStore.find(Event, this.state.event.id).then((event) => {
			if (!event) {
				return;
			}
			return this.setState({ event });
		});
	}

	componentDidMount() {
		// TODO: This should use observables!
		this._unlisten = DatabaseStore.listen((change) => {
			if (this.state.event && change.objectClass === Event.name) {
				const updated = _.find(
					change.objects,
					(o) => o.id === this.state.event.id,
				);
				if (updated) {
					return this.setState({ event: updated });
				}
			}
		});
		return this._onChange();
	}

	UNSAFE_componentWillReceiveProps(nextProps) {
		this.setState({ event: nextProps.message.events[0] });
		return this._onChange();
	}

	componentWillUnmount() {
		return typeof this._unlisten === "function" ? this._unlisten() : undefined;
	}

	render() {
		const timeFormat = DateUtils.getTimeFormat({ timeZone: true });
		if (this.state.event != null) {
			return (
				<div className="event-wrapper">
					<div className="event-header">
						<RetinaImg
							name="icon-RSVP-calendar-mini@2x.png"
							mode={RetinaImg.Mode.ContentPreserve}
						/>
						<span className="event-title-text">Event: </span>
						<span className="event-title">{this.state.event.title}</span>
					</div>
					<div className="event-body">
						<div className="event-date">
							<div className="event-day">
								{moment(this.state.event.start * 1000)
									.tz(DateUtils.timeZone)
									.format("dddd, MMMM Do")}
							</div>
							<div>
								<div className="event-time">
									{moment(this.state.event.start * 1000)
										.tz(DateUtils.timeZone)
										.format(timeFormat)}
								</div>
								{this._renderEventActions()}
							</div>
						</div>
					</div>
				</div>
			);
		} else {
			return <div></div>;
		}
	}

	_renderEventActions() {
		const me = this.state.event.participantForMe();
		if (!me) {
			return false;
		}

		const actions = [
			["yes", "Accept"],
			["maybe", "Maybe"],
			["no", "Decline"],
		];
		const renderAction = ([status, label]) => {
			let classes = "btn-rsvp ";
			if (me.status === status) {
				classes += status;
			}
			return (
				<div
					key={status}
					className={classes}
					onClick={() => this._rsvp(status)}
				>
					{label}
				</div>
			);
		};

		return <div className="event-actions">{actions.map(renderAction)}</div>;
	}

	_rsvp(status) {
		const me = this.state.event.participantForMe();
		return Actions.queueTask(
			new EventRSVPTask(this.state.event, me.email, status),
		);
	}
}
EventHeader.initClass();

module.exports = EventHeader;
