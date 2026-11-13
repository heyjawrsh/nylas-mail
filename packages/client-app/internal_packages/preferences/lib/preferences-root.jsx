/* eslint jsx-a11y/tabindex-no-positive: 0 */
import React from "react";
import PropTypes from "prop-types";
import {
	Flexbox,
	ScrollRegion,
	KeyCommandsRegion,
	ListensToFluxStore,
	ConfigPropContainer,
} from "nylas-component-kit";
import { PreferencesUIStore } from "nylas-exports";
import PreferencesTabsBar from "./preferences-tabs-bar";
import { domNodeOf } from "../../../src/components/dom-node.js";

class PreferencesRoot extends React.Component {
	static displayName = "PreferencesRoot";

	static containerRequired = false;

	static propTypes = {
		tab: PropTypes.object,
		tabs: PropTypes.object,
		selection: PropTypes.object,
	};

	_root = React.createRef();
	_scrollRegion = React.createRef();

	componentDidMount() {
		domNodeOf(this._root.current).focus();
		this._focusContent();
	}

	componentDidUpdate(oldProps) {
		if (oldProps.tab !== this.props.tab) {
			const scrollRegion = document.querySelector(
				".preferences-content .scroll-region-content",
			);
			scrollRegion.scrollTop = 0;
			this._focusContent();
		}
	}

	_localHandlers() {
		const stopPropagation = (e) => {
			e.stopPropagation();
		};
		// This prevents some basic commands from propagating to the threads list and
		// producing unexpected results

		// TODO This is a partial/temporary solution and should go away when we do the
		// Keymap/Commands/Menu refactor
		return {
			"core:next-item": stopPropagation,
			"core:previous-item": stopPropagation,
			"core:select-up": stopPropagation,
			"core:select-down": stopPropagation,
			"core:select-item": stopPropagation,
			"core:messages-page-up": stopPropagation,
			"core:messages-page-down": stopPropagation,
			"core:list-page-up": stopPropagation,
			"core:list-page-down": stopPropagation,
			"core:remove-from-view": stopPropagation,
			"core:gmail-remove-from-view": stopPropagation,
			"core:remove-and-previous": stopPropagation,
			"core:remove-and-next": stopPropagation,
			"core:archive-item": stopPropagation,
			"core:delete-item": stopPropagation,
			"core:print-thread": stopPropagation,
		};
	}

	// Focus the first thing with a tabindex when we update.
	// inside the content area. This makes it way easier to interact with prefs.
	_focusContent() {
		// ConfigPropContainer renders the tab itself, so the tab's root is the
		// one element in the scroll region's content.
		const content = domNodeOf(this._scrollRegion.current)?.querySelector(
			".scroll-region-content-inner",
		)?.firstElementChild;
		const node = content?.querySelector("[tabindex]");
		if (node) {
			node.focus();
		}
	}

	render() {
		const { tab, selection, tabs } = this.props;

		return (
			<KeyCommandsRegion
				ref={this._root}
				className="preferences-wrap"
				tabIndex="0"
				localHandlers={this._localHandlers()}
			>
				<Flexbox direction="column">
					<PreferencesTabsBar tabs={tabs} selection={selection} />
					<ScrollRegion
						ref={this._scrollRegion}
						className="preferences-content"
					>
						<ConfigPropContainer>
							{tab ? (
								<tab.component accountId={selection.get("accountId")} />
							) : (
								false
							)}
						</ConfigPropContainer>
					</ScrollRegion>
				</Flexbox>
			</KeyCommandsRegion>
		);
	}
}

export default ListensToFluxStore(PreferencesRoot, {
	stores: [PreferencesUIStore],
	getStateFromStores() {
		const tabs = PreferencesUIStore.tabs();
		const selection = PreferencesUIStore.selection();
		const tabId = selection.get("tabId");
		const tab = tabs.find((s) => s.tabId === tabId);
		return { tabs, selection, tab };
	},
});
