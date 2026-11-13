/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
import React from "react";

import {
	Actions,
	AccountStore,
	SheetDepthContext,
	WorkspaceStore,
} from "nylas-exports";

import { RetinaImg, KeyCommandsRegion } from "nylas-component-kit";

import CategoryPickerPopover from "./category-picker-popover";

// This changes the category on one or more threads.
class CategoryPicker extends React.Component {
	static initClass() {
		CategoryPicker.displayName = "CategoryPicker";

		CategoryPicker.containerRequired = false;

		CategoryPicker.propTypes = { items: PropTypes.array };

		CategoryPicker.contextType = SheetDepthContext;
	}

	constructor(props) {
		super();
		this._onOpenCategoryPopover = this._onOpenCategoryPopover.bind(this);
		this.render = this.render.bind(this);
		this.props = props;
		this._button = React.createRef();
		this._account = AccountStore.accountForItems(this.props.items);
		this._accountItems = this.props.items;
	}

	// If the threads we're picking categories for change, (like when they
	// get their categories updated), we expect our parents to pass us new
	// props. We don't listen to the DatabaseStore ourselves. Recomputed in
	// render, before it is read.
	_updateAccount() {
		if (this.props.items !== this._accountItems) {
			this._accountItems = this.props.items;
			this._account = AccountStore.accountForItems(this.props.items);
		}
	}

	_keymapHandlers() {
		return { "core:change-category": this._onOpenCategoryPopover };
	}

	_onOpenCategoryPopover() {
		if (!(this.props.items.length > 0)) {
			return;
		}
		if (this.context.sheetDepth !== WorkspaceStore.sheetStack().length - 1) {
			return;
		}
		const buttonRect = this._button.current.getBoundingClientRect();
		Actions.openPopover(
			<CategoryPickerPopover
				threads={this.props.items}
				account={this._account}
			/>,
			{ originRect: buttonRect, direction: "down" },
		);
	}

	render() {
		this._updateAccount();
		if (!this._account) {
			return <span />;
		}
		const btnClasses = "btn btn-toolbar btn-category-picker";
		let img = "";
		let tooltip = "";
		if (this._account.usesLabels()) {
			img = "toolbar-tag.png";
			tooltip = "Apply Labels";
		} else {
			img = "toolbar-movetofolder.png";
			tooltip = "Move to Folder";
		}

		return (
			<KeyCommandsRegion
				style={{ order: -103 }}
				globalHandlers={this._keymapHandlers()}
				globalMenuItems={[
					{
						label: "Thread",
						submenu: [
							{
								label: `${tooltip}...`,
								command: "core:change-category",
								position: "endof=thread-actions",
							},
						],
					},
				]}
			>
				<button
					tabIndex={-1}
					ref={this._button}
					title={tooltip}
					onClick={this._onOpenCategoryPopover}
					className={btnClasses}
				>
					<RetinaImg name={img} mode={RetinaImg.Mode.ContentIsMask} />
				</button>
			</KeyCommandsRegion>
		);
	}
}
CategoryPicker.initClass();

module.exports = CategoryPicker;
