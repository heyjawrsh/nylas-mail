import React from "react";
import PropTypes from "prop-types";
import { RegExpUtils } from "nylas-exports";

import OnboardingActions from "./onboarding-actions";
import CreatePageForForm from "./decorators/create-page-for-form";
import { accountInfoWithIMAPAutocompletions } from "./onboarding-helpers";
import FormField from "./form-field";

class AccountBasicSettingsForm extends React.Component {
	static displayName = "AccountBasicSettingsForm";

	static propTypes = {
		accountInfo: PropTypes.object,
		errorFieldNames: PropTypes.array,
		submitting: PropTypes.bool,
		onConnect: PropTypes.func,
		onFieldChange: PropTypes.func,
		onFieldKeyPress: PropTypes.func,
	};

	static submitLabel = (accountInfo) => {
		return accountInfo.type === "imap" ? "Continue" : "Connect Account";
	};

	static titleLabel = (AccountType) => {
		return AccountType.title || `Add your ${AccountType.displayName} account`;
	};

	static subtitleLabel = () => {
		return "Enter your email account credentials to get started.";
	};

	static validateAccountInfo = (accountInfo) => {
		const { email, password, name } = accountInfo;
		const errorFieldNames = [];
		let errorMessage = null;

		if (!email || !password || !name) {
			return { errorMessage, errorFieldNames, populated: false };
		}

		if (!RegExpUtils.emailRegex().test(accountInfo.email)) {
			errorFieldNames.push("email");
			errorMessage = "Please provide a valid email address.";
		}
		if (!accountInfo.password) {
			errorFieldNames.push("password");
			errorMessage = "Please provide a password for your account.";
		}
		if (!accountInfo.name) {
			errorFieldNames.push("name");
			errorMessage = "Please provide your name.";
		}

		return { errorMessage, errorFieldNames, populated: true };
	};

	submit() {
		if (!["gmail", "office365"].includes(this.props.accountInfo.type)) {
			const accountInfo = accountInfoWithIMAPAutocompletions(
				this.props.accountInfo,
			);
			OnboardingActions.setAccountInfo(accountInfo);
			if (this.props.accountInfo.type === "imap") {
				OnboardingActions.moveToPage("account-settings-imap");
			} else {
				// We have to pass in the updated accountInfo, because the onConnect()
				// we're calling exists on a component that won't have had it's state
				// updated from the OnboardingStore change yet.
				this.props.onConnect(accountInfo);
			}
		} else {
			this.props.onConnect();
		}
	}

	render() {
		return (
			<form className="settings">
				<FormField field="name" title="Name" {...this.props} />
				<FormField field="email" title="Email" {...this.props} />
				<FormField
					field="password"
					title="Password"
					type="password"
					{...this.props}
				/>
			</form>
		);
	}
}

export default CreatePageForForm(AccountBasicSettingsForm);
