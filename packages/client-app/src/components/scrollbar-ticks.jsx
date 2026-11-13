import React from "react";
import PropTypes from "prop-types";

export default class ScrollbarTicks extends React.Component {
	static displayName = "ScrollbarTicks";

	static propTypes = {
		ticks: PropTypes.array,
	};

	_rootRef = React.createRef();

	componentDidMount() {
		this._updateTicks();
	}

	componentDidUpdate() {
		this._updateTicks();
	}

	_updateTicks() {
		const html = this.props.ticks
			.map((percentData) => {
				let percent;
				let className = "";
				if (typeof percentData === "number") {
					percent = percentData;
				} else {
					percent = percentData.percent;
					className = ` ${percentData.className}`;
				}
				return `<div class="t${className}" style="top: ${percent * 100}%" />`;
			})
			.join("");
		if (this._rootRef.current) {
			this._rootRef.current.innerHTML = html;
		}
	}

	render() {
		return <div ref={this._rootRef} className="scrollbar-ticks" />;
	}
}
