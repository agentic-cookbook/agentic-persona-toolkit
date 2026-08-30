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
/// called; the script never reacts to them; it plays start to finish exactly
/// once, from `init`. Driving replies from the submitted text (matching a
/// keyword the way `MockBackend.ts` does) is a real feature this type could
/// grow, but widening today's "play this script" contract into "respond to
/// this input" is not what either call site needs yet.
///
/// Modeled on `PersonaChatCoordinator`, the toolkit's other `Backend`
/// conformer: a `public actor` whose `inboundEvents` and its
/// `AsyncStream.Continuation` are `nonisolated let`, established in `init`.
/// `Backend` is `Sendable` and not `@MainActor`, so an `@unchecked Sendable`
/// wrapper here would silence the compiler rather than prove the isolation —
/// the actor is what actually holds it.
public actor ScriptedBackend: Backend {
    public nonisolated let inboundEvents: AsyncStream<InboundEvent>

    private nonisolated let events: AsyncStream<InboundEvent>.Continuation
    private nonisolated let localIDPrefix: String

    private var localIDSequence = 0

    /// Every `send` call, in arrival order. The script never reads this back
    /// — it exists so a test or a demo host can assert on what the local
    /// participant submitted.
    public private(set) var sent: [(localID: String, text: String, attachments: [any Attachment])] = []
    public private(set) var typingCalls: [Bool] = []
    public private(set) var widgetResponses: [any WidgetResponse] = []

    /// - Parameters:
    ///   - script: Replayed in order onto `inboundEvents`, once, starting
    ///     immediately at `init`.
    ///   - delayBetweenEvents: Pause before each event after the first.
    ///     `.zero` (the default) replays the whole script on the next run
    ///     loop turn, which is what a test wants; a demo host passes
    ///     something felt — see `ScriptedBackend.olyloDemo`.
    ///   - localIDPrefix: Prefix for the deterministic ids `send` mints:
    ///     `"\(localIDPrefix)-1"`, `"\(localIDPrefix)-2"`, and so on.
    public init(
        script: [InboundEvent],
        delayBetweenEvents: Duration = .zero,
        localIDPrefix: String = "local"
    ) {
        self.localIDPrefix = localIDPrefix
        let (stream, continuation) = AsyncStream<InboundEvent>.makeStream(
            of: InboundEvent.self,
            bufferingPolicy: .unbounded
        )
        self.inboundEvents = stream
        self.events = continuation

        // Captures no `self` — only the three local values above — so this
        // is safe to start before `init` finishes and needs no `[weak self]`.
        // `AsyncStream`'s buffering is unbounded, so nothing is lost even if
        // this races ahead of whatever starts consuming `inboundEvents`.
        Task {
            for (index, event) in script.enumerated() {
                if index > 0, delayBetweenEvents > .zero {
                    try? await Task.sleep(for: delayBetweenEvents)
                }
                continuation.yield(event)
            }
            continuation.finish()
        }
    }

    public func send(text: String, attachments: [any Attachment]) async throws -> String {
        localIDSequence += 1
        let localID = "\(localIDPrefix)-\(localIDSequence)"
        sent.append((localID: localID, text: text, attachments: attachments))
        return localID
    }

    /// The script drives everything; there is no local-typing channel to
    /// report on, so this only records the call.
    public func setLocalTyping(_ isTyping: Bool) async throws {
        typingCalls.append(isTyping)
    }

    /// The script drives everything; there is no live widget to respond
    /// into, so this only records the call.
    public func submitWidgetResponse(_ response: any WidgetResponse) async throws {
        widgetResponses.append(response)
    }
}
