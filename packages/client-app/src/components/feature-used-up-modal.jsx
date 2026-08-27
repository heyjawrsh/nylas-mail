import React from "react";
import PropTypes from "prop-types";
import { shell } from "electron";
import Actions from "../flux/actions.js";
import RetinaImg from "./retina-img.jsx";
import BillingModal from "./billing-modal.jsx";
import IdentityStore from "../flux/stores/identity-store.js";

export default class FeatureUsedUpModal extends React.Component {
	static propTypes = {
		modalClass: PropTypes.string.isRequired,
		featureName: PropTypes.string.isRequired,
		headerText: PropTypes.string.isRequired,
		rechargeText: PropTypes.string.isRequired,
		iconUrl: PropTypes.string.isRequired,
	};

	componentDidMount() {
		this._mounted = true;
		const start = Date.now();
		IdentityStore.fetchSingleSignOnURL("/payment?embedded=true").then((url) => {
			console.log("Done grabbing url", Date.now() - start);
			if (!this._mounted) return;
			this.setState({ upgradeUrl: url });
		});
	}

	componentWillUnmount() {
		this._mounted = false;
	}

	render() {
		const gotoFeatures = () =>
			shell.openExternal("https://nylas.com/nylas-pro");

		const upgrade = (e) => {
			e.stopPropagation();
			Actions.openModal({
				component: (
					<BillingModal
						source="feature-limit"
						upgradeUrl={this.state.upgradeUrl}
					/>
				),
				height: 575,
				width: 412,
			});
		};

		return (
			<div className={`feature-usage-modal ${this.props.modalClass}`}>
				<div className="feature-header">
					<div className="icon">
						<RetinaImg
							url={this.props.iconUrl}
							style={{ position: "relative", top: "-2px" }}
							mode={RetinaImg.Mode.ContentPreserve}
						/>
					</div>
					<h2 className="header-text">{this.props.headerText}</h2>
					<p className="recharge-text">{this.props.rechargeText}</p>
				</div>
				<div className="feature-cta">
					<h2>
						Want to{" "}
						<span className="feature-name">{this.props.featureName} more</span>?
					</h2>
					<div className="pro-description">
						<h3>Nylas Pro includes:</h3>
						<ul>
							<li>Unlimited Snoozing</li>
							<li>Unlimited Reminders</li>
							<li>Unlimited Mail Merge</li>
						</ul>
						<p>
							&hellip; plus{" "}
							<a onClick={gotoFeatures}>dozens of other features</a>
						</p>
					</div>

					<button className="btn btn-cta btn-emphasis" onClick={upgrade}>
						Upgrade
					</button>
				</div>
			</div>
		);
	}
}
