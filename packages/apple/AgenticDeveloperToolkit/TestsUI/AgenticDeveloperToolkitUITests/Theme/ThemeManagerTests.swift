import Testing
import Foundation
import AgenticDeveloperToolkit
@testable import AgenticDeveloperToolkitUI

@MainActor
@Suite("ThemeManager")
struct ThemeManagerTests {

    // Each test gets its own storage and manager, so nothing leaks between
    // tests and nothing touches real application state (NSApplication.shared
    // isn't driven here — `drivesApplicationAppearance` is left at its
    // default, which is harmless under `xctest`'s headless run).
    private func makeManager(activeThemeID: String? = nil) -> (ThemeManager, InMemoryThemeStorage) {
        let storage = InMemoryThemeStorage(activeThemeID: activeThemeID)
        let manager = ThemeManager(storage: storage)
        return (manager, storage)
    }

    @Test("with no stored selection, falls back to Solarized Dark")
    func defaultActive() {
        let (manager, _) = makeManager()
        #expect(manager.currentTheme.id == BuiltInThemes.solarizedDark.id)
    }

    @Test("an unknown stored id falls back to Solarized Dark")
    func unknownFallback() {
        let (manager, _) = makeManager(activeThemeID: "not-a-real-id")
        #expect(manager.currentTheme.id == BuiltInThemes.solarizedDark.id)
    }

    @Test("a previously stored id is honored at init")
    func honorsStoredSelection() {
        let (manager, _) = makeManager(activeThemeID: BuiltInThemes.dracula.id)
        #expect(manager.currentTheme.id == BuiltInThemes.dracula.id)
    }

    @Test("selectTheme updates currentTheme and persists through storage")
    func selectsTheme() {
        let (manager, storage) = makeManager()
        manager.selectTheme(id: BuiltInThemes.dracula.id)
        #expect(manager.currentTheme.id == BuiltInThemes.dracula.id)
        #expect(storage.activeThemeID == BuiltInThemes.dracula.id)
    }

    @Test("selecting an unknown id persists it but falls back the resolved theme")
    func selectsUnknownFallsBack() {
        let (manager, storage) = makeManager(activeThemeID: BuiltInThemes.dracula.id)
        manager.selectTheme(id: "not-a-real-id")
        #expect(storage.activeThemeID == "not-a-real-id")
        #expect(manager.currentTheme.id == BuiltInThemes.solarizedDark.id)
    }

    @Test("selecting the already-active theme posts nothing")
    func reselectingActiveThemePostsNothing() async {
        let (manager, _) = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        var posted = false
        let observer = NotificationCenter.default.addObserver(
            forName: ThemeManager.didChangeNotification, object: nil, queue: nil
        ) { _ in posted = true }
        defer { NotificationCenter.default.removeObserver(observer) }

        manager.selectTheme(id: BuiltInThemes.solarizedDark.id)
        #expect(posted == false)
    }

    @Test("selecting a different theme posts didChangeNotification")
    func postsNotification() async {
        let (manager, _) = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        var posted = false
        let observer = NotificationCenter.default.addObserver(
            forName: ThemeManager.didChangeNotification, object: nil, queue: nil
        ) { _ in posted = true }
        defer { NotificationCenter.default.removeObserver(observer) }

        manager.selectTheme(id: BuiltInThemes.dracula.id)
        #expect(posted == true)
    }
}
