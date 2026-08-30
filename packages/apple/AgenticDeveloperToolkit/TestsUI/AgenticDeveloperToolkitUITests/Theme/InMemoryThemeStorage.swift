import Foundation
import AgenticDeveloperToolkit

/// A `ThemeStorage` that keeps the active theme and custom themes in memory
/// for the duration of a test — mirrors
/// `AgenticDeveloperToolkitTests/Theme/InMemoryThemeStorage.swift`, duplicated
/// here because it isn't `@testable`-visible across the framework boundary.
@MainActor
final class InMemoryThemeStorage: ThemeStorage {
    var customThemes: [ColorTheme]
    var activeThemeID: String?

    init(customThemes: [ColorTheme] = [], activeThemeID: String? = nil) {
        self.customThemes = customThemes
        self.activeThemeID = activeThemeID
    }
}
