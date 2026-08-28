import React from "react";
import KeyCommandsRegion from "../key-commands-region.jsx";

function ListensToMovementKeys(ComposedComponent) {
	return class extends ComposedComponent {
		static displayName = ComposedComponent.displayName;
		static containerRequired = ComposedComponent.containerRequired;
		static containerStyles = ComposedComponent.containerStyles;

		localKeyHandlers() {
			return {
				"core:previous-item": (event) => {
					if (!this.composedRef?.current?.onArrowUp) {
						return;
					}
					event.stopPropagation();
					this.composedRef?.current.onArrowUp(event);
				},
				"core:next-item": (event) => {
					if (!this.composedRef?.current?.onArrowDown) {
						return;
					}
					event.stopPropagation();
					this.composedRef?.current.onArrowDown(event);
				},
				"core:move-left": (event) => {
					if (!this.composedRef?.current?.onArrowDown) {
						return;
					}
					event.stopPropagation();
					this.composedRef?.current.onArrowLeft(event);
				},
				"core:move-right": (event) => {
					if (!this.composedRef?.current?.onArrowDown) {
						return;
					}
					event.stopPropagation();
					this.composedRef?.current.onArrowRight(event);
				},
			};
		}

		onKeyDown = (event) => {
			if (["Enter", "Return"].includes(event.key)) {
				if (!this.composedRef?.current?.onEnter) {
					return;
				}
				event.stopPropagation();
				this.composedRef?.current.onEnter(event);
			}
			if (event.key === "Tab") {
				if (event.shiftKey) {
					if (!this.composedRef?.current?.onShiftTab) {
						return;
					}
					event.stopPropagation();
					event.preventDefault();
					this.composedRef?.current.onShiftTab(event);
				} else {
					if (!this.composedRef?.current?.onTab) {
						return;
					}
					event.stopPropagation();
					event.preventDefault();
					this.composedRef?.current.onTab(event);
				}
			}
		};

		render() {
			return (
				<KeyCommandsRegion
					tabIndex="0"
					localHandlers={this.localKeyHandlers()}
					onKeyDown={this.onKeyDown}
				>
					<ComposedComponent ref={this.composedRef} {...this.props} />
				</KeyCommandsRegion>
			);
		}
	};
}

export default ListensToMovementKeys;
