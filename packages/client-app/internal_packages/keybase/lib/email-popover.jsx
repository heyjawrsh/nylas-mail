/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let EmailPopover;
const { React, Actions } = require("nylas-exports");
const { ParticipantsTextField } = require("nylas-component-kit");
const Identity = require("./identity");
const _ = require("underscore");

module.exports = EmailPopover = (() => {
	EmailPopover = class EmailPopover extends React.Component {
		static initClass() {
			EmailPopover.propTypes = {
				profile: PropTypes.instanceOf(Identity).isRequired,
			};
		}
		constructor() {
			this._onRecipientFieldChange = this._onRecipientFieldChange.bind(this);
			this._onDone = this._onDone.bind(this);
			this.state = { to: [], cc: [], bcc: [] };
		}

		render() {
			const participants = this.state;

			return (
				<div className="keybase-import-popover">
					<ParticipantsTextField
						field="to"
						className="keybase-participant-field"
						participants={participants}
						change={this._onRecipientFieldChange}
					/>
					<button className="btn btn-toolbar" onClick={this._onDone}>
						Associate Emails with Key
					</button>
				</div>
			);
		}

		_onRecipientFieldChange(contacts) {
			return this.setState(contacts);
		}

		_onDone() {
			this.props.onPopoverDone(
				_.pluck(this.state.to, "email"),
				this.props.profile,
			);
			return Actions.closePopover();
		}
	};
	EmailPopover.initClass();
	return EmailPopover;
})();
