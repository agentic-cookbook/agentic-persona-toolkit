import Foundation

public protocol ChatStateObserver: AnyObject, Sendable {
    func chatDidUpdate(_ update: ChatUpdate)
}
