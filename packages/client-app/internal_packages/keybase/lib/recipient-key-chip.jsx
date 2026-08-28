/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
import { RetinaImg } from "nylas-component-kit";
import PGPKeyStore from "./pgp-key-store";
import _ from "underscore";

// Sits next to recipient chips in the composer and turns them green/red
// depending on whether or not there's a PGP key present for that user
class RecipientKeyChip extends React.Component {
	static initClass() {
		RecipientKeyChip.displayName = "RecipientKeyChip";

		RecipientKeyChip.propTypes = { contact: PropTypes.object.isRequired };
	}

	constructor(props) {
		super(props);
		this.state = this._getStateFromStores();
	}

	componentDidMount() {
		// fetch the actual key(s) from disk
		const keys = PGPKeyStore.pubKeys(this.props.contact.email);
		_.each(keys, (key) => PGPKeyStore.getKeyContents({ key }));
		return (this.unlistenKeystore = PGPKeyStore.listen(
			this._onKeystoreChange,
			this,
		));
	}

	componentWillUnmount() {
		return this.unlistenKeystore();
	}

	_getStateFromStores() {
		return {
			// true if there is at least one loaded key for the account
			keys: PGPKeyStore.pubKeys(this.props.contact.email).some(
				(cv, _ind, _arr) => {
					return Object.hasOwn(cv, "key");
				},
			),
		};
	}

	_onKeystoreChange() {
		return this.setState(this._getStateFromStores());
	}

	render() {
		if (this.state.keys) {
			return (
				<div className="n1-keybase-recipient-key-chip">
					<RetinaImg
						url="nylas://keybase/key-present@2x.png"
						mode={RetinaImg.Mode.ContentPreserve}
						ref="keyIcon"
					/>
				</div>
			);
		} else {
			return (
				<div className="n1-keybase-recipient-key-chip">
					<span ref="noKeyIcon"></span>
				</div>
			);
		}
	}
}
RecipientKeyChip.initClass();

module.exports = RecipientKeyChip;
