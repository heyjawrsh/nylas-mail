// import {DraftStore, React, Actions, NylasAPI, DatabaseStore, Message, Rx} from 'nylas-exports'
import { React, APIError, NylasAPI } from "nylas-exports";
import PropTypes from "prop-types";
import { MetadataComposerToggleButton } from "nylas-component-kit";
import { PLUGIN_ID, PLUGIN_NAME } from "./link-tracking-constants";

export default class LinkTrackingButton extends React.Component {
	static displayName = "LinkTrackingButton";

	_toggle = React.createRef();

	static propTypes = {
		draft: PropTypes.object.isRequired,
		session: PropTypes.object.isRequired,
	};

	shouldComponentUpdate(nextProps) {
		return (
			nextProps.draft.metadataForPluginId(PLUGIN_ID) !==
			this.props.draft.metadataForPluginId(PLUGIN_ID)
		);
	}

	// The toggle's button, for HasTutorialTip.
	getDOMNode() {
		return this._toggle.current?.getDOMNode() || null;
	}

	_title(enabled) {
		const dir = enabled ? "Disable" : "Enable";
		return `${dir} link tracking`;
	}

	_errorMessage(error) {
		if (
			error instanceof APIError &&
			NylasAPI.TimeoutErrorCodes.includes(error.statusCode)
		) {
			return `Link tracking does not work offline. Please re-enable when you come back online.`;
		}
		return `Unfortunately, link tracking servers are currently not available. Please try again later. Error: ${error.message}`;
	}

	render() {
		return (
			<MetadataComposerToggleButton
				ref={this._toggle}
				title={this._title}
				iconName="icon-composer-linktracking.png"
				pluginId={PLUGIN_ID}
				pluginName={PLUGIN_NAME}
				metadataEnabledValue={{ tracked: true }}
				stickyToggle
				errorMessage={this._errorMessage}
				draft={this.props.draft}
				session={this.props.session}
			/>
		);
	}
}

LinkTrackingButton.containerRequired = false;
