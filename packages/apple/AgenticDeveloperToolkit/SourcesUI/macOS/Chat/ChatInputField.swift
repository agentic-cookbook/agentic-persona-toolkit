import AppKit
import AgenticDeveloperToolkit

/// The chat composer's text field, painted from the three chat-input roles
/// every theme already carries: `.chatInputBackground`, `.chatInputBorder`,
/// and `.chatInputFocus`.
///
/// A separate type from `ThemedTextField` because the two answer different
/// questions. `ThemedTextField` is a *form* field — a stock rounded bezel over
/// `controlBackgroundColor`, which is what a settings panel wants and what its
/// callers get today. A chat composer is chrome: web's themes style
/// `.pc-input` with their own fill, their own one-pixel rule and their own
/// focus colour, and `old-school-terminal` in particular asks for a
/// transparent fill under a green rule that brightens on focus. A bezel cannot
/// express any of that — AppKit draws the bezel, and `backgroundColor` under
/// it is simply not visible — so this field turns the bezel off and paints its
/// own layer instead.
///
/// Those three roles were populated by all 21 ported themes and read by no
/// view at all before this existed, which is why a themed chat still showed a
/// stock macOS input.
@MainActor
public final class ChatInputField: NSTextField, Themeable {

    /// Squared off for terminal themes, rounded for everything else. Web
    /// carries the same knob as `--pc-radius`, which `old-school-terminal`
    /// sets to `0`.
    public var cornerRadius: CGFloat = 6 {
        didSet { layer?.cornerRadius = cornerRadius }
    }

    /// Whether the field currently has the keyboard focus, which selects
    /// between `.chatInputBorder` and `.chatInputFocus`.
    ///
    /// Driven by the *delegate* (`InlineChatView`'s
    /// `controlTextDidBeginEditing`/`controlTextDidEndEditing`) rather than by
    /// overriding `becomeFirstResponder`: an editable `NSTextField` never
    /// becomes the first responder itself — it hands off to the window's
    /// shared field editor — so the override fires at moments that have
    /// nothing to do with whether the user is typing here.
    public var isFocused: Bool = false {
        didSet {
            guard isFocused != oldValue else { return }
            applyTheme(ThemePaletteObserver.currentPalette)
        }
    }

    private var observer: ThemePaletteObserver?

    public override class var cellClass: AnyClass? {
        get { PaddedTextFieldCell.self }
        set { super.cellClass = newValue }
    }

    public init(string: String = "") {
        super.init(frame: .zero)
        stringValue = string
        isEditable = true
        isBordered = false
        isBezeled = false
        drawsBackground = false
        focusRingType = .none
        wantsLayer = true
        layer?.cornerRadius = cornerRadius
        layer?.borderWidth = 1
        cell?.wraps = false
        cell?.usesSingleLineMode = true
        lineBreakMode = .byTruncatingHead
        observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    /// The cell's padding is drawn, not laid out, so auto layout has no idea
    /// it is there — a field asking for exactly its glyph height renders with
    /// its text clipped top and bottom.
    public override var intrinsicContentSize: NSSize {
        var size = super.intrinsicContentSize
        size.height += PaddedTextFieldCell.inset.height * 2
        return size
    }

    public func applyTheme(_ palette: SemanticPalette) {
        layer?.backgroundColor = palette.nsColor(.chatInputBackground).cgColor
        layer?.borderColor = palette.nsColor(isFocused ? .chatInputFocus : .chatInputBorder).cgColor
        textColor = palette.nsColor(.userText)
        font = palette.font(.body)
        // The field editor is shared by every field in the window and keeps
        // whatever attributes the last editor set, so an already-focused field
        // needs its live text colour and insertion point pushed across
        // directly — repainting the cell alone leaves the theme change
        // invisible until focus moves away and back.
        if let editor = currentEditor() as? NSTextView {
            editor.textColor = palette.nsColor(.userText)
            editor.insertionPointColor = palette.nsColor(.chatInputFocus)
            editor.font = palette.font(.body)
        }
        if let placeholder = placeholderString {
            placeholderAttributedString = NSAttributedString(string: placeholder, attributes: [
                .foregroundColor: palette.nsColor(.timestampText),
                .font: palette.font(.body)
            ])
        }
    }
}

/// Insets the text so it is not painted hard against the border this field
/// draws. A bezeled field gets this for free from the bezel; an unbezeled one
/// gets nothing.
private final class PaddedTextFieldCell: NSTextFieldCell {
    static let inset = NSSize(width: 8, height: 5)

    override func titleRect(forBounds rect: NSRect) -> NSRect {
        super.titleRect(forBounds: rect.insetBy(dx: Self.inset.width, dy: Self.inset.height))
    }

    override func drawInterior(withFrame cellFrame: NSRect, in controlView: NSView) {
        super.drawInterior(withFrame: titleRect(forBounds: cellFrame), in: controlView)
    }

    override func edit(
        withFrame rect: NSRect, in controlView: NSView, editor textObj: NSText,
        delegate: Any?, event: NSEvent?
    ) {
        super.edit(
            withFrame: titleRect(forBounds: rect), in: controlView, editor: textObj,
            delegate: delegate, event: event)
    }

    override func select(
        withFrame rect: NSRect, in controlView: NSView, editor textObj: NSText,
        delegate: Any?, start: Int, length: Int
    ) {
        super.select(
            withFrame: titleRect(forBounds: rect), in: controlView, editor: textObj,
            delegate: delegate, start: start, length: length)
    }
}
