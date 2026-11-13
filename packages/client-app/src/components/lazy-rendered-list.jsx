import { Component, createRef } from "react";
import PropTypes from "prop-types";
import { domNodeOf } from "./dom-node.js";

const MIN_RANGE_SIZE = 2;

function getRange({ total, itemHeight, containerHeight, scrollTop = 0 } = {}) {
	const itemsPerBody = Math.floor(containerHeight / itemHeight);
	const start = Math.max(
		0,
		Math.floor(scrollTop / itemHeight) - itemsPerBody * 2,
	);
	const end = Math.max(
		MIN_RANGE_SIZE,
		Math.min(start + 4 * itemsPerBody, total),
	);
	return { start, end };
}

class LazyRenderedList extends Component {
	static propTypes = {
		items: PropTypes.array,
		itemHeight: PropTypes.number,
		containerHeight: PropTypes.number,
		BufferTag: PropTypes.string,
		ItemRenderer: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
		RootRenderer: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
	};

	static defaultProps = {
		items: [],
		itemHeight: 30,
		containerHeight: 150,
		BufferTag: "div",
	};

	constructor(props) {
		super(props);
		this._rootRef = createRef();
		this.state = this.getRangeState(props);
	}

	// The range reads scrollTop as it was before the new items reach the DOM
	// (a shorter list can clamp it), so take it here and apply it after.
	getSnapshotBeforeUpdate(prevProps) {
		const { items, itemHeight, containerHeight } = this.props;
		if (
			prevProps.items === items &&
			prevProps.itemHeight === itemHeight &&
			prevProps.containerHeight === containerHeight
		) {
			return null;
		}
		const { scrollTop } = domNodeOf(this._rootRef.current) || {};
		return { scrollTop };
	}

	componentDidUpdate(_prevProps, _prevState, snapshot) {
		if (!snapshot) return;
		const range = this.getRangeState({
			...this.props,
			scrollTop: snapshot.scrollTop,
		});
		if (range.start !== this.state.start || range.end !== this.state.end) {
			this.setState(range);
		}
	}

	onScroll = () => {
		this.updateRangeState(this.props);
	};

	getRangeState({ items, itemHeight, containerHeight, scrollTop }) {
		return getRange({
			total: items.length,
			itemHeight,
			containerHeight,
			scrollTop,
		});
	}

	updateRangeState(props) {
		const { scrollTop } = domNodeOf(this._rootRef.current) || {};
		this.setState(this.getRangeState({ ...props, scrollTop }));
	}

	renderItems() {
		const { items, itemHeight, BufferTag, ItemRenderer } = this.props;
		const { start, end } = this.state;
		const topHeight = start * itemHeight;
		const bottomHeight = (items.length - end) * itemHeight;

		const top = <BufferTag key="lazy-top" style={{ height: topHeight }} />;
		const bottom = (
			<BufferTag key="lazy-bottom" style={{ height: bottomHeight }} />
		);
		const elements = items
			.slice(start, end)
			.map((item, idx) => (
				<ItemRenderer
					key={`item-${start + idx}`}
					item={item}
					idx={start + idx}
				/>
			));
		elements.unshift(top);
		elements.push(bottom);

		return elements;
	}

	render() {
		const { RootRenderer, containerHeight } = this.props;
		return (
			<RootRenderer
				ref={this._rootRef}
				style={{
					height: containerHeight,
					overflowX: "hidden",
					overflowY: "auto",
				}}
				onScroll={this.onScroll}
			>
				{this.renderItems()}
			</RootRenderer>
		);
	}
}

export default LazyRenderedList;
