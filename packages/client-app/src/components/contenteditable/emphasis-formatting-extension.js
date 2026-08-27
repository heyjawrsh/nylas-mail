import { ContenteditableExtension } from "nylas-exports";

// This provides the default baisc formatting options for the
// Contenteditable using the declarative extension API.
export default class EmphasisFormattingExtension extends ContenteditableExtension {
	static keyCommandHandlers() {
		return {
			"contenteditable:bold": EmphasisFormattingExtension._onBold,
			"contenteditable:italic": EmphasisFormattingExtension._onItalic,
			"contenteditable:underline": EmphasisFormattingExtension._onUnderline,
			"contenteditable:strikeThrough":
				EmphasisFormattingExtension._onStrikeThrough,
		};
	}

	static toolbarButtons() {
		return [
			{
				className: "btn-bold",
				onClick: EmphasisFormattingExtension._onBold,
				tooltip: "Bold",
				iconUrl: null, // Defined in the css of btn-bold
			},
			{
				className: "btn-italic",
				onClick: EmphasisFormattingExtension._onItalic,
				tooltip: "Italic",
				iconUrl: null, // Defined in the css of btn-italic
			},
			{
				className: "btn-underline",
				onClick: EmphasisFormattingExtension._onUnderline,
				tooltip: "Underline",
				iconUrl: null, // Defined in the css of btn-underline
			},
		];
	}

	static _onBold({ editor }) {
		editor.bold();
	}

	static _onItalic({ editor }) {
		editor.italic();
	}

	static _onUnderline({ editor }) {
		editor.underline();
	}

	static _onStrikeThrough({ editor }) {
		editor.strikeThrough();
	}

	// None of the emphasis formatting buttons need a custom component.
	//
	// They use the default <ToolbarButtons> component via the
	// `toolbarButtons` extension API.
	//
	// The <ToolbarButtons> core component is managed by the
	// {ToolbarButtonManager}
	static toolbarComponentConfig() {
		return null;
	}
}
