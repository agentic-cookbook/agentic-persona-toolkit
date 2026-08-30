import Foundation

public enum ChatUpdate: Sendable {
    case messagesChanged
    case participantsChanged
    case typingChanged
    case readMarkersChanged
    case activeDraftsChanged
    case pendingPermissionsChanged
    case pendingWidgetsChanged
    case displayConfigChanged

    /// `commandActivity` changed: a command was invoked, or one already
    /// running produced a result. One case covers both because a pill
    /// re-renders from the whole array either way — the running/finished
    /// split lives on `CommandActivity.isRunning`, not in the update.
    case commandActivityChanged

    case error(message: String)
}
