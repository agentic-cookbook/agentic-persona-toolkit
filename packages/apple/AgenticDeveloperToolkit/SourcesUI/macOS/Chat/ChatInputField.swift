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

    /// Whether the field paints its one-pixel rule at all. Off for terminal
    /// themes, whose `.pc-input` says `border: none` — see
    /// `InlineChatChrome.showsInputBorder`.
    public var showsBorder: Bool = true {
        didSet { layer?.borderWidth = showsBorder ? 1 : 0 }
    }

    /// Whether the insertion point is a solid block rather than the system's
    /// one-pixel bar.
    ///
    /// Read by this field's *own* editor, which is why `PaddedTextFieldCell`
    /// overrides `fieldEditor(for:)` at all: an `NSTextField` normally borrows
    /// the window's shared field editor, and widening that one's caret would
    /// hand a block cursor to every other text field in the window.
    public var usesBlockCaret: Bool = false {
        didSet { (currentEditor() as? BlockCaretTextView)?.drawsBlockCaret = usesBlockCaret }
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
        layer?.borderWidth = showsBorder ? 1 : 0
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

    /// This cell's own field editor, so the caret shape is a property of *this*
    /// composer.
    ///
    /// By default every editable control in a window shares one field editor
    /// the window vends, so a text view subclass installed there would give a
    /// block cursor to the search field and the settings panel too. `NSCell`
    /// exists precisely for this: return a view here and AppKit uses it for
    /// this cell alone.
    private var blockCaretEditor: BlockCaretTextView?

    override func fieldEditor(for controlView: NSView) -> NSTextView? {
        let editor = blockCaretEditor ?? {
            let created = BlockCaretTextView()
            created.isFieldEditor = true
            blockCaretEditor = created
            return created
        }()
        editor.drawsBlockCaret = (controlView as? ChatInputField)?.usesBlockCaret ?? false
        return editor
    }
}

/// A field editor whose insertion point is a solid character-wide block rather
/// than the system's one-pixel bar.
///
/// Web draws this itself — it hides the native caret and animates a
/// `.pc-input-caret` div with `ost-caret-blink` — because a browser cannot
/// restyle a text input's cursor. AppKit can: `drawInsertionPoint` is handed
/// the rect to fill, and the blink is already the framework's job, so the only
/// thing to say here is how wide.
final class BlockCaretTextView: NSTextView {

    /// Off by default, so a field that says nothing keeps the system caret.
    var drawsBlockCaret = false {
        didSet {
            guard drawsBlockCaret != oldValue else { return }
            needsDisplay = true
        }
    }

    /// One character wide, measured from the editor's own font rather than
    /// fixed: the terminal themes scale their type (VT323 at a 1.07 size
    /// scale), and a caret that did not scale with the text would sit under
    /// half a glyph.
    private var caretWidth: CGFloat {
        let font = self.font ?? NSFont.monospacedSystemFont(ofSize: NSFont.systemFontSize, weight: .regular)
        return max(("0" as NSString).size(withAttributes: [.font: font]).width, 1)
    }

    override func drawInsertionPoint(in rect: NSRect, color: NSColor, turnedOn flag: Bool) {
        guard drawsBlockCaret else {
            super.drawInsertionPoint(in: rect, color: color, turnedOn: flag)
            return
        }
        var block = rect
        block.size.width = caretWidth
        super.drawInsertionPoint(in: block, color: color, turnedOn: flag)
    }

    /// The blink erases by invalidating the caret's rect, and AppKit computes
    /// that rect from the one-pixel bar it thinks it drew. Without widening it
    /// to match, the block's tail is never repainted and a trail of it is left
    /// behind as the caret moves.
    override func setNeedsDisplay(_ invalidRect: NSRect, avoidAdditionalLayout flag: Bool) {
        var rect = invalidRect
        rect.size.width += caretWidth
        super.setNeedsDisplay(rect, avoidAdditionalLayout: flag)
    }
}
