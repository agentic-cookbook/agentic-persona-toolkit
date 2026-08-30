import AppKit
import AgenticDeveloperToolkit

/// An inline chat surface bound to `any ChatViewModel`: a scrolling
/// transcript of `MessageBubbleView`s (committed messages plus any live
/// `activeDrafts`, both rendered through the same bubble view), a
/// `ThinkingIndicatorView` while someone is typing, and a single-line
/// composer that submits on Return.
///
/// `localParticipantID` — not anything on `viewModel` itself, since
/// `ChatViewModel` has no notion of "me" — decides which side each bubble
/// renders on; see `MessageBubbleView`'s doc for why.
///
/// Kept structurally minimal on purpose: no participant rail, no permission
/// prompts, no widgets, no commands. Task 7/8 seams are called out inline
/// below, at the point each attaches.
@MainActor
public final class InlineChatView: NSView, ChatStateObserver, Themeable, NSTextFieldDelegate {

    public let viewModel: any ChatViewModel
    public let localParticipantID: String

    private let transcriptScroll = ThemedScrollView()
    private let transcriptStack = NSStackView()
    private let inputField = ThemedTextField()
    private let sendButton = NSButton()
    private let divider = ThemedSeparatorView()

    private var themeObserver: ThemePaletteObserver?
    private var isAtBottom = true
    private var lastTranscriptWidth: CGFloat = 0

    private static let maxBubbleWidthFraction: CGFloat = 0.75
    private static let minBubbleWidth: CGFloat = 200
    private static let bubbleSideInset: CGFloat = 16

    public init(viewModel: any ChatViewModel, localParticipantID: String) {
        self.viewModel = viewModel
        self.localParticipantID = localParticipantID
        super.init(frame: .zero)
        setupViews()
        viewModel.addObserver(self)
        themeObserver = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
        rebuildTranscript()
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    deinit {
        // No `viewModel.removeObserver(self)` here. `deinit` is nonisolated
        // and `ChatStateObserver` is `@MainActor`, so the call would be
        // unsound — and a view's last reference can be released off the main
        // thread, which makes `MainActor.assumeIsolated` a trap rather than a
        // fix. It is also unnecessary: `ObservableChatViewModel` holds its
        // observers in an `NSHashTable.weakObjects()`, so this entry zeroes
        // itself out and a later `notify` skips it.
        NotificationCenter.default.removeObserver(self)
    }

    private func setupViews() {
        transcriptStack.orientation = .vertical
        transcriptStack.spacing = 12
        transcriptStack.alignment = .leading
        transcriptStack.edgeInsets = NSEdgeInsets(top: 20, left: 16, bottom: 20, right: 16)
        transcriptStack.translatesAutoresizingMaskIntoConstraints = false

        transcriptScroll.documentView = transcriptStack
        transcriptScroll.hasVerticalScroller = true
        transcriptScroll.drawsBackground = true
        transcriptScroll.translatesAutoresizingMaskIntoConstraints = false
        transcriptScroll.contentView.postsBoundsChangedNotifications = true
        NotificationCenter.default.addObserver(
            self, selector: #selector(transcriptDidScroll),
            name: NSView.boundsDidChangeNotification, object: transcriptScroll.contentView)

        inputField.placeholderString = "Type a message..."
        inputField.delegate = self
        inputField.translatesAutoresizingMaskIntoConstraints = false

        sendButton.image = NSImage(systemSymbolName: "arrow.up.circle.fill", accessibilityDescription: "Send")
        sendButton.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 18, weight: .regular)
        sendButton.isBordered = false
        sendButton.target = self
        sendButton.action = #selector(sendTapped)
        sendButton.translatesAutoresizingMaskIntoConstraints = false

        let inputRow = NSStackView(views: [inputField, sendButton])
        inputRow.orientation = .horizontal
        inputRow.spacing = 10
        inputRow.edgeInsets = NSEdgeInsets(top: 14, left: 16, bottom: 14, right: 16)
        inputRow.translatesAutoresizingMaskIntoConstraints = false

        addSubview(transcriptScroll)
        addSubview(divider)
        addSubview(inputRow)

        NSLayoutConstraint.activate([
            transcriptScroll.topAnchor.constraint(equalTo: topAnchor),
            transcriptScroll.leadingAnchor.constraint(equalTo: leadingAnchor),
            transcriptScroll.trailingAnchor.constraint(equalTo: trailingAnchor),
            transcriptScroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 200),
            transcriptStack.widthAnchor.constraint(equalTo: transcriptScroll.widthAnchor),

            divider.topAnchor.constraint(equalTo: transcriptScroll.bottomAnchor),
            divider.leadingAnchor.constraint(equalTo: leadingAnchor),
            divider.trailingAnchor.constraint(equalTo: trailingAnchor),

            inputRow.topAnchor.constraint(equalTo: divider.bottomAnchor),
            inputRow.leadingAnchor.constraint(equalTo: leadingAnchor),
            inputRow.trailingAnchor.constraint(equalTo: trailingAnchor),
            inputRow.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    public func applyTheme(_ palette: SemanticPalette) {
        wantsLayer = true
        layer?.backgroundColor = palette.nsColor(.chatSurface).cgColor
    }

    public override func layout() {
        super.layout()
        let width = transcriptScroll.contentView.bounds.width
        if width > 0, abs(width - lastTranscriptWidth) > 1 {
            lastTranscriptWidth = width
            rebuildTranscript()
        }
    }

    // MARK: ChatStateObserver

    public func chatDidUpdate(_ update: ChatUpdate) {
        switch update {
        case .messagesChanged, .activeDraftsChanged, .typingChanged:
            rebuildTranscript()
        case .participantsChanged, .readMarkersChanged, .pendingPermissionsChanged,
             .pendingWidgetsChanged, .displayConfigChanged, .error:
            // Task 7/8 seams: a participant rail, unread badges from
            // `readMarkers`, permission prompts, inline widgets, and
            // surfaced transport errors all attach here.
            break
        }
    }

    // MARK: Transcript

    private func rebuildTranscript() {
        transcriptStack.arrangedSubviews.forEach {
            transcriptStack.removeArrangedSubview($0)
            $0.removeFromSuperview()
        }

        let scrollWidth = transcriptScroll.contentView.bounds.width
        let maxBubbleWidth = max(scrollWidth * Self.maxBubbleWidthFraction, Self.minBubbleWidth)

        for message in viewModel.messages {
            addBubbleRow(for: message, isLocalUser: message.senderID == localParticipantID, maxBubbleWidth: maxBubbleWidth)
        }
        for draft in viewModel.activeDrafts where !draft.text.isEmpty {
            let adapter = DraftMessageAdapter(draft: draft)
            addBubbleRow(for: adapter, isLocalUser: draft.participantID == localParticipantID, maxBubbleWidth: maxBubbleWidth)
        }

        if !viewModel.typingParticipants.isEmpty {
            let indicator = ThinkingIndicatorView()
            transcriptStack.addArrangedSubview(indicator)
            indicator.startAnimating()
        }

        if isAtBottom {
            DispatchQueue.main.async { [weak self] in self?.scrollToBottom() }
        }
    }

    /// Lays a single bubble into the transcript, aligned right (with a
    /// leading spacer) for the local user and left otherwise — the same
    /// side-alignment structure AgenticToolkit's `ChatView` uses, keyed here
    /// off `isLocalUser` rather than a message role.
    private func addBubbleRow(for message: any Message, isLocalUser: Bool, maxBubbleWidth: CGFloat) {
        let bubble = MessageBubbleView(message: message, maxWidth: maxBubbleWidth, isLocalUser: isLocalUser)
        bubble.setContentHuggingPriority(.required, for: .horizontal)

        if isLocalUser {
            let spacer = NSView()
            spacer.translatesAutoresizingMaskIntoConstraints = false
            spacer.widthAnchor.constraint(greaterThanOrEqualToConstant: 60).isActive = true
            let row = NSStackView(views: [spacer, bubble])
            row.orientation = .horizontal
            row.alignment = .top
            row.spacing = 0
            row.translatesAutoresizingMaskIntoConstraints = false
            transcriptStack.addArrangedSubview(row)
            row.widthAnchor.constraint(equalTo: transcriptStack.widthAnchor, constant: -Self.bubbleSideInset * 2).isActive = true
        } else {
            transcriptStack.addArrangedSubview(bubble)
        }
    }

    @objc private func transcriptDidScroll() {
        let contentView = transcriptScroll.contentView
        let visibleMaxY = contentView.bounds.origin.y + contentView.bounds.height
        let documentHeight = transcriptScroll.documentView?.frame.height ?? 0
        isAtBottom = documentHeight - visibleMaxY < 40
    }

    private func scrollToBottom() {
        guard let documentView = transcriptScroll.documentView else { return }
        let targetY = max(documentView.frame.height - transcriptScroll.contentView.bounds.height, 0)
        transcriptScroll.contentView.scroll(to: NSPoint(x: 0, y: targetY))
        transcriptScroll.reflectScrolledClipView(transcriptScroll.contentView)
    }

    // MARK: Composer

    @objc private func sendTapped() {
        let text = inputField.stringValue
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        inputField.stringValue = ""
        let viewModel = viewModel
        Task { @MainActor in
            do {
                _ = try await viewModel.submitMessage(text: text, attachments: [])
            } catch {
                // Task 7/8 seam: surface send failures in the composer
                // (inline error text, retry affordance) rather than dropping
                // them silently.
            }
        }
    }

    public func control(_ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
        guard control === inputField, commandSelector == #selector(NSResponder.insertNewline(_:)) else { return false }
        sendTapped()
        return true
    }
}

/// Adapts an in-progress `ActiveDraft` to `Message` so `InlineChatView` can
/// render a streaming draft through the same `MessageBubbleView` it uses for
/// committed messages, rather than a second bubble implementation.
private struct DraftMessageAdapter: Message {
    let draft: any ActiveDraft

    var id: String? { nil }
    var localID: String { draft.participantID }
    var senderID: String { draft.participantID }
    var text: String { draft.text }
    var timestamp: Date? { nil }
    var attachments: [any Attachment] { draft.attachments }
    var deliveryStatus: MessageDeliveryStatus { .composing }
}
