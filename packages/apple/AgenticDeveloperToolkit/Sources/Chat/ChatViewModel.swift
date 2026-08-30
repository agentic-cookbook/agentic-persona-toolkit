import Foundation

public protocol ChatViewModel: AnyObject, Sendable {
    var conversation: any Conversation { get }
    var participants: [any Participant] { get }
    var messages: [any Message] { get }
    var displayConfig: any DisplayConfig { get }
    var pendingPermissions: [any PermissionPrompt] { get }
    var pendingWidgets: [any InteractiveWidget] { get }
    var typingParticipants: [String] { get }

    /// One cursor per participant who has read something in this
    /// conversation. Absence of a participant means they have read
    /// nothing yet. UIs derive unread state by comparing each cursor's
    /// `upToMessageID` against `messages`.
    var readMarkers: [any ReadReceipt] { get }

    /// In-progress, uncommitted drafts. One per participant who is
    /// currently composing or streaming. Drafts commit into `messages`
    /// as immutable `Message` values; they never live in `messages`
    /// themselves.
    var activeDrafts: [any ActiveDraft] { get }

    func addObserver(_ observer: any ChatStateObserver)
    func removeObserver(_ observer: any ChatStateObserver)

    func submitMessage(text: String, attachments: [any Attachment]) async throws -> String

    /// Advance the local participant's read cursor to `messageID`.
    /// Implicitly marks everything earlier as read.
    func markRead(messageID: String) async throws

    func setLocalTyping(_ isTyping: Bool) async throws
    func respondToWidget(_ response: any WidgetResponse) async throws
    func respondToPermission(promptID: String, decision: PermissionDecision) async throws

    func listCommands() -> [any Command]
}
