import Testing
import AppKit
import Foundation
import AgenticDeveloperToolkit
@testable import AgenticDeveloperToolkitUI

/// Text size is a *window's* setting, not the app's.
///
/// It used to be `ThemeManager.textScale`, which is one number for the whole
/// process: dragging one chat window's slider resized the text in every other
/// window that had ever been opened. `ThemeScope` is the fix — a scale that a
/// themed view finds by walking up its own view tree — and these are the tests
/// that say so.
@MainActor
@Suite("Theme scope")
struct ThemeScopeTests {

    private func makeManager() -> ThemeManager {
        ThemeManager(storage: InMemoryThemeStorage(activeThemeID: terminalThemeID))
    }

    private func makeChat() -> InlineChatView {
        let viewModel = ObservableChatViewModel(backend: FakeBackend(), localParticipantID: "user")
        return InlineChatView(viewModel: viewModel, localParticipantID: "user")
    }

    // MARK: Resolution

    /// A view with nothing above it falls back to the app's scope, so a themed
    /// view that is not inside a chat still gets a palette rather than nothing.
    @Test("a loose view resolves to the app scope")
    func looseViewFallsBackToTheApp() {
        let view = NSView()
        #expect(view.resolvedThemeScope === ThemeScope.app)
    }

    @Test("a view inside a chat resolves to that chat's scope")
    func nestedViewFindsItsChat() {
        let chat = makeChat()
        let inner = NSView()
        let deeper = NSView()
        inner.addSubview(deeper)
        chat.addSubview(inner)

        #expect(deeper.resolvedThemeScope === chat.themeScope)
        #expect(chat.resolvedThemeScope === chat.themeScope)
    }

    // MARK: Isolation

    /// The bug this type exists to kill.
    @Test("one chat's text size leaves another chat alone")
    func scalesDoNotLeakBetweenWindows() {
        let first = makeChat()
        let second = makeChat()

        first.themeScope.textScale = 1.6

        #expect(first.themeScope.textScale == 1.6)
        #expect(second.themeScope.textScale == 1)
        #expect(ThemeScope.app.textScale == 1)
    }

    /// Scaling is applied to the palette on the way out, so a scoped view sees
    /// bigger type without any theme having been edited.
    @Test("a scaled scope hands back a bigger palette")
    func scaledScopeScalesThePalette() {
        let manager = makeManager()
        let scope = ThemeScope()
        let plain = scope.palette

        scope.textScale = 1.5
        let scaled = scope.palette

        #expect(scaled.theme.typography.sizeScale > plain.theme.typography.sizeScale)
        withExtendedLifetime(manager) {}
    }

    // MARK: Notification

    /// The observer delivers on the main run loop rather than inside the
    /// `didSet` that started it, so a synchronous assertion would run before
    /// the palette ever arrives.
    private func pump() {
        RunLoop.main.run(until: Date().addingTimeInterval(0.05))
    }

    /// A themed view re-reads its palette when *its* scope changes and ignores
    /// every other scope's — otherwise the isolation above would be undone by
    /// the very mechanism that delivers it.
    @Test("an observer wakes for its own scope and no other")
    func observerListensToItsOwnScopeOnly() {
        let manager = makeManager()
        let chat = makeChat()
        let other = makeChat()
        let inner = NSView()
        chat.addSubview(inner)

        var sizes: [Double] = []
        let observer = ThemePaletteObserver(host: inner) { palette in
            sizes.append(palette.theme.typography.sizeScale)
        }
        let initial = sizes.count

        other.themeScope.textScale = 1.5
        pump()
        #expect(sizes.count == initial, "a sibling window's slider is not this view's business")

        chat.themeScope.textScale = 1.5
        pump()
        #expect(sizes.count == initial + 1)
        #expect(sizes.last! > sizes.first!)
        withExtendedLifetime((manager, observer)) {}
    }
}
