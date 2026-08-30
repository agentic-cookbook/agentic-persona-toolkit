import Testing
import AppKit
import Foundation
import AgenticDeveloperToolkit
@testable import AgenticDeveloperToolkitUI

@MainActor
@Suite("MessageBubbleView")
struct MessageBubbleViewTests {

    private func makeManager(activeThemeID: String) -> ThemeManager {
        ThemeManager(storage: InMemoryThemeStorage(activeThemeID: activeThemeID))
    }

    @Test("constructs and lays out without crashing, sized to the given maxWidth")
    func constructsAndLaysOut() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let message = FixtureMessage(id: "1", localID: "1", senderID: "persona-1", text: "hello world", timestamp: Date())
        let bubble = MessageBubbleView(message: message, maxWidth: 300, isLocalUser: false)
        bubble.frame = NSRect(x: 0, y: 0, width: 300, height: 80)
        bubble.layoutSubtreeIfNeeded()
        #expect(bubble.frame.width <= 300)
        #expect(bubble.message.text == "hello world")
        #expect(bubble.isLocalUser == false)
    }

    @Test("repaints its layer background when the active theme changes")
    func repaintsOnThemeChange() {
        let manager = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let message = FixtureMessage(id: "1", localID: "1", senderID: "persona-1", text: "hi", timestamp: Date())
        let bubble = MessageBubbleView(message: message, maxWidth: 300, isLocalUser: false)

        let before = bubble.layer?.backgroundColor
        manager.selectTheme(id: BuiltInThemes.dracula.id)
        pumpRunLoop()
        let after = bubble.layer?.backgroundColor

        #expect(before != nil)
        #expect(before != after)
    }

    @Test("local-user and persona bubbles resolve to different bubble colors")
    func localUserAndPersonaDifferInColor() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let message = FixtureMessage(id: "1", localID: "1", senderID: "x", text: "hi", timestamp: Date())
        let userBubble = MessageBubbleView(message: message, maxWidth: 300, isLocalUser: true)
        let personaBubble = MessageBubbleView(message: message, maxWidth: 300, isLocalUser: false)
        #expect(userBubble.layer?.backgroundColor != personaBubble.layer?.backgroundColor)
    }
}
