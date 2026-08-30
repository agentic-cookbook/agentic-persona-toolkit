import Foundation

/// A `Backend` that replays a fixed `[InboundEvent]` script instead of
/// talking to a server — the Swift twin of web's `MockBackend`
/// (`packages/web/packages/chat/src/backends/MockBackend.ts`), built on the
/// same `Backend`/`InboundEvent` contract as `PersonaChatCoordinator` rather
/// than the older `ChatBackend` shape `MockBackend.ts` predates.
///
/// This ships in ADT, not in any one consumer: every customer needs a way to
/// see the chat contract work with no adh endpoint configured, and a scripted
/// replayer changes only when the contract does — the folder it sits beside,
/// not the wire-format churn `PersonaChatCoordinator` absorbs in
/// `Sources/Coordinator/`. What script to replay (the words, the persona) is
/// a consumer's content, not the toolkit's — see `ScriptedBackend.olyloDemo`
/// in Olylo's `OlyloChatConfig.swift` for how a host supplies its own.
///
/// `send`/`setLocalTyping`/`submitWidgetResponse` only record what was
/// called, and the script never reads them back: it plays start to finish
/// exactly once, and `start` decides only *when* it begins. Driving replies
/// from the submitted text (matching a keyword the way `MockBackend.ts` does)
/// is a real feature this type could grow, but widening today's "play this
/// script" contract into "respond to this input" is not what either call site
/// needs yet.
///
/// Modeled on `PersonaChatCoordinator`, the toolkit's other `Backend`
/// conformer: a `public actor` whose `inboundEvents` and its
/// `AsyncStream.Continuation` are `nonisolated let`, established in `init`.
/// `Backend` is `Sendable` and not `@MainActor`, so an `@unchecked Sendable`
/// wrapper here would silence the compiler rather than prove the isolation —
/// the actor is what actually holds it.
public actor ScriptedBackend: Backend {

    /// When the script starts replaying.
    ///
    /// The distinction is not cosmetic. A demo host builds its backend when it
    /// builds its chat surface — at launch — so `.immediately` makes the
    /// persona think and answer with nothing typed, then fall silent forever
    /// because the script is spent. `.onFirstSend` is the shape a live
    /// `PersonaChatCoordinator` turn actually has, and it is what any host
    /// showing a chat to a person wants.
    public enum ScriptStart: Sendable {
        /// Replay from `init`, with no `send` required. For a test that drains
        /// `inboundEvents` to completion without submitting anything.
        case immediately

        /// Replay when `send` is first called; later sends do not replay it
        /// again. For demo hosts, and for any test asserting on the order of
        /// the local echo against the scripted reply.
        case onFirstSend
    }

    public nonisolated let inboundEvents: AsyncStream<InboundEvent>

    private nonisolated let events: AsyncStream<InboundEvent>.Continuation
    private nonisolated let localIDPrefix: String

    private let script: [InboundEvent]
    private let delayBetweenEvents: Duration

    /// Guards the script against replaying twice. Actor isolation is what
    /// makes the check race-free — two concurrent `send`s serialize here, so
    /// no lock is needed. Already `true` for `.immediately`, whose replay
    /// started in `init`.
    private var hasStarted: Bool

    private var localIDSequence = 0

    /// Every `send` call, in arrival order. The script never reads this back
    /// — it exists so a test or a demo host can assert on what the local
    /// participant submitted.
    public private(set) var sent: [(localID: String, text: String, attachments: [any Attachment])] = []
    public private(set) var typingCalls: [Bool] = []
    public private(set) var widgetResponses: [any WidgetResponse] = []

    /// - Parameters:
    ///   - script: Replayed in order onto `inboundEvents`, once.
    ///   - start: When replay begins. Defaults to `.immediately` so a test
    ///     that just drains the stream needs no ceremony; a host showing the
    ///     chat to a person wants `.onFirstSend`.
    ///   - delayBetweenEvents: Pause before *each* event, the first included.
    ///     `.zero` (the default) replays the whole script on the next run loop
    ///     turn. Pair `.onFirstSend` with a non-zero delay when ordering
    ///     matters: `ObservableChatViewModel` appends its optimistic local
    ///     echo only after `send` returns, so a zero-delay script can land its
    ///     reply into the transcript ahead of the message being replied to.
    ///   - localIDPrefix: Prefix for the deterministic ids `send` mints:
    ///     `"\(localIDPrefix)-1"`, `"\(localIDPrefix)-2"`, and so on.
    public init(
        script: [InboundEvent],
        start: ScriptStart = .immediately,
        delayBetweenEvents: Duration = .zero,
        localIDPrefix: String = "local"
    ) {
        self.localIDPrefix = localIDPrefix
        self.script = script
        self.delayBetweenEvents = delayBetweenEvents
        let (stream, continuation) = AsyncStream<InboundEvent>.makeStream(
            of: InboundEvent.self,
            bufferingPolicy: .unbounded
        )
        self.inboundEvents = stream
        self.events = continuation

        switch start {
        case .immediately:
            self.hasStarted = true
            Self.replay(script, every: delayBetweenEvents, onto: continuation)
        case .onFirstSend:
            self.hasStarted = false
        }
    }

    /// Yields the whole script and finishes the stream.
    ///
    /// `static`, taking everything it needs as parameters, so neither caller
    /// captures `self`: `init` runs before `self` is fully formed, and `send`
    /// would otherwise extend the actor's lifetime for the length of the
    /// script. `AsyncStream`'s buffering is unbounded, so nothing is lost if
    /// this races ahead of whatever consumes `inboundEvents`.
    private static func replay(
        _ script: [InboundEvent],
        every delay: Duration,
        onto continuation: AsyncStream<InboundEvent>.Continuation
    ) {
        Task {
            for event in script {
                if delay > .zero { try? await Task.sleep(for: delay) }
                continuation.yield(event)
            }
            continuation.finish()
        }
    }

    public func send(text: String, attachments: [any Attachment]) async throws -> String {
        localIDSequence += 1
        let localID = "\(localIDPrefix)-\(localIDSequence)"
        sent.append((localID: localID, text: text, attachments: attachments))
        startScriptIfNeeded()
        return localID
    }

    /// Starts the script the first time something is sent. A no-op for
    /// `.immediately`, and for every send after the first.
    private func startScriptIfNeeded() {
        guard !hasStarted else { return }
        hasStarted = true
        Self.replay(script, every: delayBetweenEvents, onto: events)
    }

    /// The script drives everything; there is no local-typing channel to
    /// report on, so this only records the call — and deliberately does not
    /// start the script, which belongs to `send`: a host that reports typing
    /// on every keystroke would otherwise fire the reply before the message
    /// was sent.
    public func setLocalTyping(_ isTyping: Bool) async throws {
        typingCalls.append(isTyping)
    }

    /// The script drives everything; there is no live widget to respond
    /// into, so this only records the call.
    public func submitWidgetResponse(_ response: any WidgetResponse) async throws {
        widgetResponses.append(response)
    }
}
