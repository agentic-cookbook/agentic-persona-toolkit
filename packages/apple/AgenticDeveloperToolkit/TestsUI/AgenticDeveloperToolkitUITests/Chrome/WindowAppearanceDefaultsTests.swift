import Testing
import AppKit
import Foundation
import AgenticDeveloperToolkit
@testable import AgenticDeveloperToolkitUI

/// The four switches behind a chat window's gear: what they remember, and what
/// they do to the window when they come back.
@MainActor
@Suite("Window appearance")
struct WindowAppearanceDefaultsTests {

    /// A suite of its own per test, so nothing here can read or write the
    /// running app's real preferences.
    private func makeDefaults(_ namespace: String = "test.window") -> WindowAppearanceDefaults {
        let suite = UserDefaults(suiteName: "adt.tests.\(UUID().uuidString)")!
        return WindowAppearanceDefaults(namespace: namespace, defaults: suite)
    }

    private func makeManager() -> ThemeManager {
        ThemeManager(storage: InMemoryThemeStorage(activeThemeID: terminalThemeID))
    }

    private func makeChat() -> InlineChatView {
        let viewModel = ObservableChatViewModel(backend: FakeBackend(), localParticipantID: "user")
        return InlineChatView(viewModel: viewModel, localParticipantID: "user")
    }

    // MARK: Storage

    @Test("an untouched window opens at the theme's own settings")
    func defaultsAreTheThemesOwn() {
        let defaults = makeDefaults()
        // `UserDefaults` answers 0 for an absent double, and a text scale of 0
        // lays a window out at no height at all — hence the explicit fallback.
        #expect(defaults.textScale == 1)
        #expect(defaults.transparency == 1)
        #expect(defaults.isFloating == false)
        // On, the way web's caret blinks unconditionally.
        #expect(defaults.blinksCaret)
    }

    @Test("each switch survives being written and read back")
    func valuesRoundTrip() {
        let defaults = makeDefaults()
        defaults.textScale = 1.25
        defaults.transparency = 0.6
        defaults.isFloating = true
        defaults.blinksCaret = false

        #expect(defaults.textScale == 1.25)
        #expect(defaults.transparency == 0.6)
        #expect(defaults.isFloating)
        #expect(defaults.blinksCaret == false)
    }

    @Test("a value edited outside the app is clamped rather than obeyed")
    func storedValuesAreClamped() {
        let suite = UserDefaults(suiteName: "adt.tests.\(UUID().uuidString)")!
        suite.set(9.0, forKey: "test.window.textScale")
        suite.set(-3.0, forKey: "test.window.transparency")
        let defaults = WindowAppearanceDefaults(namespace: "test.window", defaults: suite)

        #expect(defaults.textScale == WindowAppearanceDefaults.textScaleRange.upperBound)
        #expect(defaults.transparency == WindowAppearanceDefaults.transparencyRange.lowerBound)
    }

    /// The namespace is the whole reason two apps can build on this toolkit
    /// without one's gear moving the other's window.
    @Test("two namespaces in one suite do not see each other")
    func namespacesAreIndependent() {
        let suite = UserDefaults(suiteName: "adt.tests.\(UUID().uuidString)")!
        let first = WindowAppearanceDefaults(namespace: "app.one", defaults: suite)
        let second = WindowAppearanceDefaults(namespace: "app.two", defaults: suite)

        first.textScale = 1.5
        #expect(second.textScale == 1)
    }

    // MARK: Restoring

    @Test("what was saved is on the window and the chat before either is shown")
    func restoreReplaysEverySwitch() {
        let manager = makeManager()
        let defaults = makeDefaults()
        defaults.textScale = 1.5
        defaults.transparency = 0.5
        defaults.isFloating = true
        defaults.blinksCaret = false

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 300, height: 300),
            styleMask: [.titled], backing: .buffered, defer: true)
        let chat = makeChat()
        let controller = ChatWindowAppearanceController(
            window: window, chatView: chat, defaults: defaults, title: "Test Window")
        controller.restore()

        #expect(manager.textScale == 1.5)
        #expect(window.alphaValue == 0.5)
        #expect(window.level == .floating)
        #expect(chat.inputField.caretBlinks == false)
        withExtendedLifetime(manager) {}
    }

    /// The gear's *position* is the convention this component exists to keep —
    /// a reader who finds it at the trailing edge of one window's title bar
    /// looks for it there in the next.
    @Test("installing puts a right-hand titlebar accessory on the window")
    func installAddsTheGear() {
        let manager = makeManager()
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 300, height: 300),
            styleMask: [.titled], backing: .buffered, defer: true)
        let controller = ChatWindowAppearanceController(
            window: window, chatView: makeChat(), defaults: makeDefaults(), title: "Test Window")
        controller.install()

        let accessory = window.titlebarAccessoryViewControllers.first
        #expect(accessory != nil)
        #expect(accessory?.layoutAttribute == .right)
        withExtendedLifetime(manager) {}
    }
}
