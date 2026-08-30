import AppKit
import AgenticDeveloperToolkit

/// A single chat bubble for `any Message`, sized to its measured text and
/// themed from the active `SemanticPalette`. Repaints (color, font, and
/// measured size — the theme's typography size scale can change the fit)
/// live on theme change.
///
/// `isLocalUser` — not `message` itself — decides the bubble's side and
/// color roles, because ADT's `Message` protocol carries no semantic role
/// (unlike AgenticToolkit's `ChatMessage.role`); the caller (`InlineChatView`)
/// resolves that by comparing `message.senderID` against the conversation's
/// local participant id.
///
/// The attributed-string build in `applyTheme` is the whole rendering
/// contract: `MarkdownRenderer` turns `message.text` into themed spans (and
/// offers fenced blocks to an injected `CodeHighlighter`), a `.composing`
/// message gets a streaming caret, and a `.failed` one gets a `.danger`
/// border plus its reason spelled out beneath the text.
@MainActor
public final class MessageBubbleView: NSView, Themeable {

    public let message: any Message
    public let isLocalUser: Bool
    public let maxWidth: CGFloat

    /// How `message.text` becomes an attributed string. Defaulted so callers
    /// need not care, and injectable so a host with a `CodeHighlighter` can
    /// pass one down — that is the only reason the seam exists.
    public let renderer: MarkdownRenderer

    private let textView = NSTextView(frame: .zero)
    private var themeObserver: ThemePaletteObserver?

    private var textWidthConstraint: NSLayoutConstraint!
    private var textHeightConstraint: NSLayoutConstraint!
    private var bubbleWidthConstraint: NSLayoutConstraint!

    private static let horizontalPadding: CGFloat = 12
    private static let verticalPadding: CGFloat = 8
    private static let failureBorderWidth: CGFloat = 1

    /// The block appended while a message is still streaming. A character
    /// rather than a blinking sublayer: it goes into the same attributed
    /// string as the text, so the measurement pass below sizes the bubble to
    /// include it and the caret can never overhang the bubble it belongs to.
    static let streamingCaret = "\u{258B}"

    /// The exact attributed string the last `applyTheme` handed to the text
    /// view. Internal rather than public: it exists so tests can assert on
    /// what was rendered — fonts and colors included — without
    /// screenshotting, and a host has `message` for everything else.
    var renderedText: NSAttributedString { textView.attributedString() }

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

    public init(
        message: any Message,
        maxWidth: CGFloat,
        isLocalUser: Bool,
        renderer: MarkdownRenderer = MarkdownRenderer()
    ) {
        self.message = message
        self.maxWidth = maxWidth
        self.isLocalUser = isLocalUser
        self.renderer = renderer
        super.init(frame: .zero)

        wantsLayer = true
        layer?.cornerRadius = 12
        translatesAutoresizingMaskIntoConstraints = false

        textView.isEditable = false
        textView.isSelectable = true
        textView.drawsBackground = false
        textView.textContainerInset = .zero
        textView.textContainer?.lineFragmentPadding = 0
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(textView)

        let hPad = Self.horizontalPadding
        let vPad = Self.verticalPadding
        textWidthConstraint = textView.widthAnchor.constraint(equalToConstant: max(maxWidth - hPad * 2, 1))
        textHeightConstraint = textView.heightAnchor.constraint(equalToConstant: 20)
        bubbleWidthConstraint = widthAnchor.constraint(equalToConstant: maxWidth)

        NSLayoutConstraint.activate([
            textView.topAnchor.constraint(equalTo: topAnchor, constant: vPad),
            textView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: hPad),
            textView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -hPad),
            textView.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -vPad),
            textWidthConstraint,
            textHeightConstraint,
            bubbleWidthConstraint
        ])

        themeObserver = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    public func applyTheme(_ palette: SemanticPalette) {
        let bubbleRole: ThemeRole = isLocalUser ? .userBubble : .personaBubble
        let textColor = palette.nsColor(isLocalUser ? .userText : .personaText)
        layer?.backgroundColor = palette.nsColor(bubbleRole).cgColor

        let hPad = Self.horizontalPadding
        let textMaxWidth = max(maxWidth - hPad * 2, 1)

        let attrString = NSMutableAttributedString(
            attributedString: renderer.render(message.text, palette: palette, textColor: textColor)
        )
        if message.deliveryStatus == .composing {
            // `InlineChatView`'s `DraftMessageAdapter` reports `.composing`
            // for every live draft, so a streaming reply gets its caret with
            // no extra plumbing, and a committed message never does.
            attrString.append(NSAttributedString(
                string: Self.streamingCaret,
                attributes: [.font: palette.font(.body), .foregroundColor: palette.nsColor(.personaName)]
            ))
        }
        if let timestamp = message.timestamp {
            attrString.append(NSAttributedString(
                string: "  " + Self.timeFormatter.string(from: timestamp),
                attributes: [.font: palette.font(.caption), .foregroundColor: palette.nsColor(.timestampText)]
            ))
        }
        // The reason is spelled out rather than left encoded in the border
        // color: the border says something went wrong, the caption says what,
        // and the message text stays readable either way.
        if case .failed(let reason) = message.deliveryStatus {
            layer?.borderWidth = Self.failureBorderWidth
            layer?.borderColor = palette.nsColor(.danger).cgColor
            attrString.append(NSAttributedString(
                string: "\n" + reason,
                attributes: [.font: palette.font(.caption), .foregroundColor: palette.nsColor(.danger)]
            ))
        } else {
            layer?.borderWidth = 0
            layer?.borderColor = nil
        }

        let (textWidth, textHeight) = Self.measure(attrString, maxWidth: textMaxWidth)

        textView.textContainer?.size = NSSize(width: textWidth, height: .greatestFiniteMagnitude)
        textView.textStorage?.setAttributedString(attrString)

        textWidthConstraint.constant = textWidth
        textHeightConstraint.constant = textHeight
        bubbleWidthConstraint.constant = min(textWidth + hPad * 2, maxWidth)
    }

    /// Measures `attrString`'s used size when wrapped at `maxWidth`, via a
    /// throwaway layout manager — the same approach AppKit text views use
    /// internally, kept out-of-line so `applyTheme` reads as "build the
    /// string, measure it, apply the measurement."
    private static func measure(_ attrString: NSAttributedString, maxWidth: CGFloat) -> (width: CGFloat, height: CGFloat) {
        let textStorage = NSTextStorage(attributedString: attrString)
        let layoutManager = NSLayoutManager()
        let textContainer = NSTextContainer(size: NSSize(width: maxWidth, height: .greatestFiniteMagnitude))
        textContainer.lineFragmentPadding = 0
        layoutManager.addTextContainer(textContainer)
        textStorage.addLayoutManager(layoutManager)
        layoutManager.ensureLayout(for: textContainer)
        let usedRect = layoutManager.usedRect(for: textContainer)
        return (min(ceil(usedRect.width), maxWidth), ceil(usedRect.height))
    }
}
