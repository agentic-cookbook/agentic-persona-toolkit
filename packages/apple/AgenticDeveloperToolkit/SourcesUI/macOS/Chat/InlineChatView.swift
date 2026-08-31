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
/// Command activity renders as a row of `ToolCallPillView`s below the
/// transcript.
///
/// Kept structurally minimal on purpose: no participant rail, no permission
/// prompts, no widgets. Task 8 seams are called out inline below, at the
/// point each attaches.
@MainActor
public final class InlineChatView: NSView, ChatStateObserver, Themeable, NSTextFieldDelegate {

    public let viewModel: any ChatViewModel
    public let localParticipantID: String

    /// How the box resizes between its active (engaged) and inactive
    /// states. Defaulted so every existing call site is unchanged: with no
    /// `inactive` configured, `resolve(engaged:)` never tracks engagement,
    /// so `applySizing()` always applies `active` and reproduces today's
    /// fixed `>= 200` height exactly — see `InlineChatSizing`'s doc.
    public var sizing: InlineChatSizing = InlineChatSizing() { didSet { applySizing() } }

    /// Whether the box is currently "engaged" — focused, or otherwise the
    /// thing the user is interacting with. Internal rather than public: it
    /// exists so tests can drive and assert on engagement transitions
    /// directly (`InlineChatViewSizingTests`) without synthesizing real
    /// AppKit focus/click events, and a host reads `sizing`/`applySizing()`
    /// results instead of this flag.
    var engaged: Bool = false {
        didSet {
            guard engaged != oldValue else { return }
            applySizing()
        }
    }

    let transcriptScroll = ThemedScrollView()
    private let transcriptStack = NSStackView()
    private let inputField = ThemedTextField()
    private let sendButton = NSButton()
    private let divider = ThemedSeparatorView()

    private var themeObserver: ThemePaletteObserver?
    private var isAtBottom = true
    private var lastTranscriptWidth: CGFloat = 0

    /// The transcript's height constraint currently in effect, carrying the
    /// resolved height: a floor for `.fixed`, a cap for `.contentHugging`,
    /// an exact zero for `.minimal`.
    ///
    /// Rebuilt by `applySizing()` rather than mutated, because those three
    /// behaviours need three different *relations* and
    /// `NSLayoutConstraint.relation` is immutable after creation — writing a
    /// cap into a `>=` constraint would turn a maximum into a minimum.
    /// Internal rather than private so `InlineChatViewSizingTests` can assert
    /// on both its constant and its relation.
    private(set) var transcriptHeightConstraint: NSLayoutConstraint!

    /// The companion constraint that makes `.contentHugging` actually hug:
    /// the scroll view has no intrinsic content size, so its height is tied
    /// to the document stack's at `.defaultHigh`, leaving the required cap in
    /// `transcriptHeightConstraint` free to win when content overflows it.
    /// `nil` for every other behaviour.
    private var transcriptHugConstraint: NSLayoutConstraint?

    /// Watches for a click outside the view while engaged — the AppKit
    /// reading of the web hook's `pointerdown` half of its
    /// `focusin`/`pointerdown`/`Escape` engagement triad. Removed in
    /// `deinit` via a direct `NSEvent.removeMonitor` call, which — like the
    /// existing `NotificationCenter.default.removeObserver(self)` below —
    /// is safe to call from a nonisolated `deinit`.
    private var clickOutsideMonitor: Any?

    private static let maxBubbleWidthFraction: CGFloat = 0.75
    private static let minBubbleWidth: CGFloat = 200
    private static let bubbleSideInset: CGFloat = 16
    private static let defaultTranscriptHeight: CGFloat = 200

    /// The narrowest width at which this view is still a chat: one minimum
    /// bubble plus the transcript's side insets. Every horizontal constraint
    /// in `setupViews()` pins a subview to *this* view's edges, so without
    /// this floor the view's `fittingSize.width` is 0 — and a host that lets
    /// auto layout size its container (an `NSWindow` whose `contentView` this
    /// becomes, most of all) collapses to a zero-width window that renders
    /// nothing and cannot be dragged back open.
    private static let minContentWidth: CGFloat = minBubbleWidth + bubbleSideInset * 2

    public init(viewModel: any ChatViewModel, localParticipantID: String) {
        self.viewModel = viewModel
        self.localParticipantID = localParticipantID
        super.init(frame: .zero)
        setupViews()
        viewModel.addObserver(self)
        themeObserver = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
        rebuildTranscript()
        clickOutsideMonitor = NSEvent.addLocalMonitorForEvents(matching: .leftMouseDown) { [weak self] event in
            self?.disengageIfClickOutside(event)
            return event
        }
        applySizing()
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
        if let clickOutsideMonitor {
            NSEvent.removeMonitor(clickOutsideMonitor)
        }
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

        // A floor on this view's own width. Required, unlike the transcript
        // height `applySizing()` owns: that one yields to a host that pins a
        // height because a shorter transcript is still a chat, while yielding
        // on width produced a zero-width window — `NSWindow` sizes a content
        // view whose width nothing else determines down to its fitting width,
        // and at priority 999 this floor did not raise it off 0.
        let minWidth = widthAnchor.constraint(greaterThanOrEqualToConstant: Self.minContentWidth)

        // No height constraint here: `applySizing()` — called at the end of
        // `init`, right after this — owns it, and owns which relation it has.
        NSLayoutConstraint.activate([
            minWidth,

            transcriptScroll.topAnchor.constraint(equalTo: topAnchor),
            transcriptScroll.leadingAnchor.constraint(equalTo: leadingAnchor),
            transcriptScroll.trailingAnchor.constraint(equalTo: trailingAnchor),
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
        updateContainerOffsetCapIfNeeded()
        let width = transcriptScroll.contentView.bounds.width
        if width > 0, abs(width - lastTranscriptWidth) > 1 {
            lastTranscriptWidth = width
            rebuildTranscript()
        }
    }

    // MARK: ChatStateObserver

    public func chatDidUpdate(_ update: ChatUpdate) {
        switch update {
        case .messagesChanged, .activeDraftsChanged, .typingChanged, .commandActivityChanged:
            rebuildTranscript()
        case .participantsChanged, .readMarkersChanged, .pendingPermissionsChanged,
             .pendingWidgetsChanged, .displayConfigChanged, .error:
            // Task 8 seams: a participant rail, unread badges from
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

        // Pills sit below the transcript rather than interleaved with it:
        // `CommandActivity` carries no position in the message stream (only
        // `invocation.requestedAt`), so anchoring a pill between two bubbles
        // would be a guess. They stay in invocation order, above the
        // thinking indicator that is usually spinning because of them.
        for activity in viewModel.commandActivity {
            transcriptStack.addArrangedSubview(ToolCallPillView(activity: activity))
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
        // Escape disengages regardless of which control is reporting it —
        // the third leg of the web hook's `focusin`/`pointerdown`/`Escape`
        // engagement triad is about the view's engagement state, not about
        // which field first-respondered the key event.
        if commandSelector == #selector(NSResponder.cancelOperation(_:)) {
            engaged = false
            return true
        }
        guard control === inputField, commandSelector == #selector(NSResponder.insertNewline(_:)) else { return false }
        sendTapped()
        return true
    }

    // MARK: Sizing & engagement

    public func controlTextDidBeginEditing(_ obj: Notification) {
        engaged = true
    }

    public func controlTextDidEndEditing(_ obj: Notification) {
        guard !shouldStayEngaged(afterFocusMovingTo: window?.firstResponder) else { return }
        engaged = false
    }

    /// Disengages when `event` (a `.leftMouseDown`) lands outside this
    /// view's bounds. Internal rather than private so
    /// `InlineChatViewSizingTests` can drive it directly with a synthesized
    /// `NSEvent` — a local event monitor is not reliably triggerable from a
    /// headless unit test.
    func disengageIfClickOutside(_ event: NSEvent) {
        guard engaged, let window else { return }
        guard event.window === window else {
            engaged = false
            return
        }
        let locationInView = convert(event.locationInWindow, from: nil)
        if !bounds.contains(locationInView) {
            engaged = false
        }
    }

    /// Applies `sizing.resolve(engaged:)` to the transcript: hides it when
    /// `collapsed`, sizes its height constraint from the resolved
    /// behaviour, and wraps the change in `NSAnimationContext.runAnimationGroup`
    /// when `animates`. Called once at the end of `init` (after
    /// `setupViews()`) and on every `sizing`/`engaged` change, so a freshly
    /// constructed view with the default `InlineChatSizing()` already
    /// reflects it — reproducing today's fixed `>= 200` height exactly,
    /// since `resolve(engaged:)` with no `inactive` configured never
    /// tracks engagement.
    private func applySizing() {
        let resolved = sizing.resolve(engaged: engaged)

        let heightConstraint: NSLayoutConstraint
        var hugConstraint: NSLayoutConstraint?
        switch resolved.behavior {
        case .minimal:
            // An exact zero, not a floor of zero: `isHidden` alone leaves an
            // AppKit view's constraints in force, so the transcript would
            // keep its old height behind a hidden view.
            heightConstraint = transcriptScroll.heightAnchor.constraint(equalToConstant: 0)
        case .behavior(.fixed):
            heightConstraint = transcriptScroll.heightAnchor.constraint(
                greaterThanOrEqualToConstant: Self.defaultTranscriptHeight)
        case .behavior(.contentHugging(let cap)):
            heightConstraint = transcriptScroll.heightAnchor.constraint(
                lessThanOrEqualToConstant: capHeight(cap))
            let hug = transcriptScroll.heightAnchor.constraint(equalTo: transcriptStack.heightAnchor)
            hug.priority = .defaultHigh
            hugConstraint = hug
        }

        // Just below required. The transcript's height is also pinned by the
        // top/divider/composer chain to whatever frame the host gives this
        // view, so a host that hard-pins its height would otherwise make the
        // cap — or `.minimal`'s exact zero — unsatisfiable. Yielding to the
        // host is the honest outcome: it asked for that height, and it can
        // collapse the box by giving the view a smaller frame.
        heightConstraint.priority = .required - 1

        let apply = {
            self.transcriptScroll.isHidden = resolved.collapsed
            self.transcriptHeightConstraint?.isActive = false
            self.transcriptHugConstraint?.isActive = false
            self.transcriptHeightConstraint = heightConstraint
            self.transcriptHugConstraint = hugConstraint
            heightConstraint.isActive = true
            hugConstraint?.isActive = true
            self.layoutSubtreeIfNeeded()
        }
        if resolved.animates {
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.2
                context.allowsImplicitAnimation = true
                apply()
            }
        } else {
            apply()
        }
    }

    /// The cap in points. `.containerOffset` is measured against the view's
    /// own height, which is why `layout()` re-reads it: at `init` — the first
    /// `applySizing()` — `bounds` is still `.zero`, so a cap computed there
    /// and never revisited would pin the transcript at 0 forever.
    private func capHeight(_ cap: ChatSizeCap) -> CGFloat {
        switch cap {
        case .points(let value):
            return value
        case .containerOffset(let topInset):
            return max(bounds.height - topInset, 0)
        }
    }

    /// Keeps a `.containerOffset` cap current as the view resizes. Only the
    /// constant changes — the relation is already the `<=` `applySizing()`
    /// installed — so this cannot loop: the pass this triggers finds the
    /// constant already correct and stops.
    private func updateContainerOffsetCapIfNeeded() {
        guard case .behavior(.contentHugging(.containerOffset(let topInset))) =
            sizing.resolve(engaged: engaged).behavior else { return }
        let cap = max(bounds.height - topInset, 0)
        if abs(transcriptHeightConstraint.constant - cap) > 0.5 {
            transcriptHeightConstraint.constant = cap
        }
    }

    /// Whether focus leaving the composer should leave the box engaged.
    /// Web's triad disengages on a `pointerdown` *outside*, so a click that
    /// lands on the transcript — which on AppKit takes first responder away
    /// from the field — must not collapse the box out from under it.
    ///
    /// Deliberately scoped to `transcriptScroll` rather than the whole view:
    /// while the composer is editing, the window's first responder is its
    /// field editor, itself a descendant of `self`, so a `self`-wide test
    /// would answer "inside" for the very transition it is meant to judge.
    /// Internal so `InlineChatViewSizingTests` can pass a responder directly
    /// instead of driving real AppKit focus.
    func shouldStayEngaged(afterFocusMovingTo responder: NSResponder?) -> Bool {
        guard let view = responder as? NSView else { return false }
        return view === transcriptScroll || view.isDescendant(of: transcriptScroll)
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
