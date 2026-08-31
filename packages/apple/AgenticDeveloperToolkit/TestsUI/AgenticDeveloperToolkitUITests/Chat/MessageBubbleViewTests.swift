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

    // MARK: Markdown

    @Test("renders the message text as markdown: a code span takes the code font")
    func rendersMessageTextAsMarkdown() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let palette = ThemePaletteObserver.currentPalette
        let message = FixtureMessage(
            id: "1", localID: "1", senderID: "persona-1", text: "run `ls` now", timestamp: nil)
        let bubble = MessageBubbleView(message: message, maxWidth: 300, isLocalUser: false)

        let rendered = bubble.renderedText
        #expect(rendered.string == "run ls now")
        let location = (rendered.string as NSString).range(of: "ls").location
        #expect(rendered.attributes(at: location, effectiveRange: nil)[.font] as? NSFont == palette.font(.code))
    }

    // MARK: Delivery status

    @Test("a failed message borders the bubble in danger and appends its reason")
    func failedMessageBordersAndAppendsReason() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let palette = ThemePaletteObserver.currentPalette
        let message = FixtureMessage(
            id: nil, localID: "1", senderID: "user-1", text: "hi", timestamp: nil,
            deliveryStatus: .failed(reason: "network unreachable"))
        let bubble = MessageBubbleView(message: message, maxWidth: 300, isLocalUser: true)

        #expect(bubble.renderedText.string.contains("network unreachable"))
        #expect((bubble.layer?.borderWidth ?? 0) > 0)
        #expect(bubble.layer?.borderColor == palette.nsColor(.danger).cgColor)
    }

    @Test("the failure reason is styled in the caption font and the danger color")
    func failureReasonIsStyledDanger() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let palette = ThemePaletteObserver.currentPalette
        let message = FixtureMessage(
            id: nil, localID: "1", senderID: "user-1", text: "hi", timestamp: nil,
            deliveryStatus: .failed(reason: "boom"))
        let bubble = MessageBubbleView(message: message, maxWidth: 300, isLocalUser: true)

        let rendered = bubble.renderedText
        let reasonRange = (rendered.string as NSString).range(of: "boom")
        #expect(reasonRange.location != NSNotFound)
        let attributes = rendered.attributes(at: reasonRange.location, effectiveRange: nil)
        #expect(attributes[.font] as? NSFont == palette.font(.caption))
        #expect(attributes[.foregroundColor] as? NSColor == palette.nsColor(.danger))
    }

    // MARK: Bubble outline

    /// Solarized Dark declares no `personaBubbleBorder`, and on the website a
    /// theme that declares none draws none — every role still *derives* an
    /// opaque colour, so the outline has to follow what the theme said, not
    /// what its palette resolves to.
    @Test("a delivered message has no border and no failure text")
    func deliveredMessageHasNoBorder() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let message = FixtureMessage(
            id: "1", localID: "1", senderID: "user-1", text: "hi", timestamp: nil,
            deliveryStatus: .delivered)
        let bubble = MessageBubbleView(message: message, maxWidth: 300, isLocalUser: true)

        #expect((bubble.layer?.borderWidth ?? 0) == 0)
        #expect(bubble.renderedText.string == "hi")
    }

    /// The other half of that rule: `techy` ports web's
    /// `--pc-persona-border: rgba(0, 255, 136, 0.3)`, so its persona bubbles
    /// are outlined in exactly that colour.
    @Test("a theme that declares a bubble border draws it in that color")
    func declaredBubbleBorderIsDrawn() throws {
        // By name rather than by symbol: the web-ported themes are
        // `internal` on `BuiltInThemes`, and `all` is the public way in.
        let techy = try #require(BuiltInThemes.all.first { $0.name == "Techy" })
        // Held, not discarded: `ThemeManager.shared` is weak, so a manager
        // nobody retains is gone before the bubble asks for its palette and
        // the view falls back to the Solarized Dark default.
        let manager = makeManager(activeThemeID: techy.id)
        let palette = manager.currentPalette
        let message = FixtureMessage(
            id: "1", localID: "1", senderID: "persona-1", text: "hi", timestamp: nil,
            deliveryStatus: .received)
        let bubble = MessageBubbleView(message: message, maxWidth: 300, isLocalUser: false)

        #expect(palette.declares(.personaBubbleBorder))
        #expect(bubble.layer?.borderWidth == 1)
        #expect(bubble.layer?.borderColor == palette.nsColor(.personaBubbleBorder).cgColor)
        withExtendedLifetime(manager) {}
    }

    @Test("a composing message appends a streaming caret in the persona-name color")
    func composingMessageAppendsCaret() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let palette = ThemePaletteObserver.currentPalette
        let message = FixtureMessage(
            id: nil, localID: "d", senderID: "persona-1", text: "streaming", timestamp: nil,
            deliveryStatus: .composing)
        let bubble = MessageBubbleView(message: message, maxWidth: 300, isLocalUser: false)

        let rendered = bubble.renderedText
        #expect(rendered.string.hasSuffix(MessageBubbleView.streamingCaret))
        let caretLocation = rendered.length - (MessageBubbleView.streamingCaret as NSString).length
        let attributes = rendered.attributes(at: caretLocation, effectiveRange: nil)
        #expect(attributes[.foregroundColor] as? NSColor == palette.nsColor(.personaName))
    }

    @Test("a settled message carries no caret")
    func settledMessageHasNoCaret() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let message = FixtureMessage(
            id: "1", localID: "1", senderID: "persona-1", text: "done", timestamp: nil,
            deliveryStatus: .received)
        let bubble = MessageBubbleView(message: message, maxWidth: 300, isLocalUser: false)
        #expect(!bubble.renderedText.string.contains(MessageBubbleView.streamingCaret))
    }
}
