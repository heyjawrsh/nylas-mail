import React from "react";
import PropTypes from "prop-types";
import { Utils } from "nylas-exports";
import { DropZone, InjectedComponentSet } from "nylas-component-kit";
import shallowEqual from "../../../src/components/shallow-equal.js";

const NUM_TO_DISPLAY_MAX = 999;

export default class CollapsedParticipants extends React.Component {
	static displayName = "CollapsedParticipants";

	static propTypes = {
		// Arrays of Contact objects.
		to: PropTypes.array,
		cc: PropTypes.array,
		bcc: PropTypes.array,
		onDrop: PropTypes.func,
		onDragChange: PropTypes.func,
	};

	static defaultProps = {
		to: [],
		cc: [],
		bcc: [],
		onDrop: () => {},
		onDragChange: () => {},
	};

	constructor(props = {}) {
		super(props);
		this._participantsWrap = React.createRef();
		this.state = {
			numToDisplay: NUM_TO_DISPLAY_MAX,
			numRemaining: 0,
			numBccRemaining: 0,
			prevProps: props,
		};
	}

	componentDidMount() {
		this._setNumHiddenParticipants();
	}

	// Reset before render, so a changed participant set never paints with the
	// old count. componentDidUpdate then re-measures.
	static getDerivedStateFromProps(props, state) {
		// shallowEqual first: React hands a fresh props object to every update
		// (defaultProps), including the setState-only ones.
		if (
			shallowEqual(props, state.prevProps) ||
			Utils.isEqualReact(props, state.prevProps)
		) {
			return null;
		}
		// Always re-evaluate the hidden participant count when the participant set changes
		return {
			numToDisplay: NUM_TO_DISPLAY_MAX,
			numRemaining: 0,
			numBccRemaining: 0,
			prevProps: props,
		};
	}

	shouldComponentUpdate(nextProps, nextState) {
		return (
			!Utils.isEqualReact(nextProps, this.props) ||
			!Utils.isEqualReact(nextState, this.state)
		);
	}

	componentDidUpdate() {
		if (this.state.numToDisplay === NUM_TO_DISPLAY_MAX) {
			this._setNumHiddenParticipants();
		}
	}

	_setNumHiddenParticipants() {
		const $wrap = this._participantsWrap.current;
		const $regulars = Array.from(
			$wrap.getElementsByClassName("regular-contact"),
		);
		const $bccs = Array.from($wrap.getElementsByClassName("bcc-contact"));

		const availableSpace = $wrap.getBoundingClientRect().width;
		let numRemaining = this.props.to.length + this.props.cc.length;
		let numBccRemaining = this.props.bcc.length;
		let numToDisplay = 0;
		let widthAccumulator = 0;

		for (const $p of $regulars) {
			widthAccumulator += $p.getBoundingClientRect().width;
			if (widthAccumulator >= availableSpace) {
				break;
			}
			numRemaining -= 1;
			numToDisplay += 1;
		}

		for (const $p of $bccs) {
			widthAccumulator += $p.getBoundingClientRect().width;
			if (widthAccumulator >= availableSpace) {
				break;
			}
			numBccRemaining -= 1;
			numToDisplay += 1;
		}

		this.setState({ numToDisplay, numRemaining, numBccRemaining });
	}

	_renderNumRemaining() {
		let str = null;
		if (this.state.numRemaining === 0 && this.state.numBccRemaining === 0) {
			return null;
		} else if (
			this.state.numRemaining > 0 &&
			this.state.numBccRemaining === 0
		) {
			str = `${this.state.numRemaining} more`;
		} else if (
			this.state.numRemaining === 0 &&
			this.state.numBccRemaining > 0
		) {
			str = `${this.state.numBccRemaining} Bcc`;
		} else if (this.state.numRemaining > 0 && this.state.numBccRemaining > 0) {
			str = `${this.state.numRemaining + this.state.numBccRemaining} more (${this.state.numBccRemaining} Bcc)`;
		}

		return (
			<div className="num-remaining-wrap tokenizing-field">
				<div className="show-more-fade" />
				<div className="num-remaining token">{str}</div>
			</div>
		);
	}

	_collapsedContact = (contact) => {
		const name = contact.displayName();
		const key = contact.email + contact.name;

		return (
			<span key={key} className="collapsed-contact regular-contact">
				<InjectedComponentSet
					matching={{ role: "Composer:RecipientChip" }}
					exposedProps={{ contact: contact, collapsed: true }}
					direction="row"
					inline
				/>
				{name}
			</span>
		);
	};

	_collapsedBccContact = (contact, i) => {
		let name = contact.displayName();
		const key = contact.email + contact.name;
		if (i === 0) {
			name = `Bcc: ${name}`;
		}
		return (
			<span key={key} className="collapsed-contact bcc-contact">
				{name}
			</span>
		);
	};

	render() {
		const contacts = this.props.to
			.concat(this.props.cc)
			.map(this._collapsedContact);
		const bcc = this.props.bcc.map(this._collapsedBccContact);

		let toDisplay = contacts.concat(bcc);
		toDisplay = toDisplay.splice(0, this.state.numToDisplay);
		if (toDisplay.length === 0) {
			toDisplay = "Recipients";
		}

		return (
			<DropZone
				shouldAcceptDrop={() => true}
				onDragStateChange={this.props.onDragChange}
				onDrop={this.props.onDrop}
			>
				<div
					ref={this._participantsWrap}
					className="collapsed-composer-participants"
				>
					{this._renderNumRemaining()}
					{toDisplay}
				</div>
			</DropZone>
		);
	}
}
