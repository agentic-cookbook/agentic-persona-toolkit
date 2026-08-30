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
/// Task 7 seams: a `.danger`-styled failure state for `deliveryStatus ==
/// .failed`, a streaming caret while the owning draft is still live,
/// markdown rendering, and a `CodeHighlighter` hook all attach inside
/// `applyTheme`'s attributed-string build below.
@MainActor
public final class MessageBubbleView: NSView, Themeable {

    public let message: any Message
    public let isLocalUser: Bool
    public let maxWidth: CGFloat

    private let textView = NSTextView(frame: .zero)
    private var themeObserver: ThemePaletteObserver?

    private var textWidthConstraint: NSLayoutConstraint!
    private var textHeightConstraint: NSLayoutConstraint!
    private var bubbleWidthConstraint: NSLayoutConstraint!

    private static let horizontalPadding: CGFloat = 12
    private static let verticalPadding: CGFloat = 8

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

    public init(message: any Message, maxWidth: CGFloat, isLocalUser: Bool) {
        self.message = message
        self.maxWidth = maxWidth
        self.isLocalUser = isLocalUser
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
            string: message.text,
            attributes: [.font: palette.font(.body), .foregroundColor: textColor]
        )
        if let timestamp = message.timestamp {
            attrString.append(NSAttributedString(
                string: "  " + Self.timeFormatter.string(from: timestamp),
                attributes: [.font: palette.font(.caption), .foregroundColor: palette.nsColor(.timestampText)]
            ))
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
