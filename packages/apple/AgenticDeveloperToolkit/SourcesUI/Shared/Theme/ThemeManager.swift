import Foundation
import OSLog
import AgenticDeveloperToolkit

/// Owns the app-wide active theme. Resolves the selected `ColorTheme` and its
/// `SemanticPalette` from an injected `ThemeStorage`, applies the saved
/// selection at init, and reacts to live changes made through
/// `selectTheme(id:)` (from a theme settings panel).
///
/// Themeable controls read `ThemeManager.shared?.currentPalette` and observe
/// `didChangeNotification` to repaint when the theme changes.
///
/// This class also reacts to changes made *outside* `selectTheme(id:)` — a
/// settings panel bound straight to the underlying setting, or a sync arriving
/// from another device — via `storage.onExternalChange`, which it hooks in
/// `init` to call `reload()`. Without that hook, such a change persists but
/// nothing repaints until relaunch.
///
/// Platform-neutral by construction: everything AppKit-shaped lives behind
/// `ThemeAppearanceDriver`, the same seam shape `ThemeStorage` uses for
/// persistence. macOS callers get `AppKitAppearanceDriver` installed for them
/// by `init(storage:)`; see `AppKitAppearanceDriver.swift`.
@MainActor
public final class ThemeManager {

    public static let didChangeNotification = Notification.Name("AgenticDeveloperToolkitUI.ThemeManager.didChange")

    /// The live instance. **Weak** — something upstream (the app delegate, a
    /// scene delegate) must hold the strong reference, or every themed view
    /// silently falls back to the default palette the next time it asks.
    public private(set) static weak var shared: ThemeManager?

    public let store: ThemeStore

    public private(set) var currentTheme: ColorTheme
    public private(set) var currentPalette: SemanticPalette

    /// Applies the active theme to app-wide chrome. `nil` means the manager
    /// tracks the theme but paints no chrome of its own.
    public var appearanceDriver: (any ThemeAppearanceDriver)?

    private let storage: any ThemeStorage

    private static let logger = Logger(subsystem: "com.mikefullerton.AgenticDeveloperToolkitUI", category: "ThemeManager")

    public init(storage: any ThemeStorage, appearanceDriver: (any ThemeAppearanceDriver)?) {
        self.storage = storage
        let store = ThemeStore(storage: storage)
        let theme = store.theme(withID: storage.activeThemeID ?? "") ?? BuiltInThemes.solarizedDark
        self.store = store
        self.currentTheme = theme
        self.currentPalette = SemanticPalette(theme: theme)
        self.appearanceDriver = appearanceDriver
        ThemeManager.shared = self
        applyApplicationAppearance()

        // React to a different theme being selected, or the active theme's
        // definition being edited in place, from outside `selectTheme(id:)`.
        storage.onExternalChange = { [weak self] in self?.reload() }
    }

    private func applyApplicationAppearance() {
        appearanceDriver?.apply(currentTheme, palette: currentPalette)
    }

    /// Selects a theme by id (built-in or custom), persists the selection, and
    /// applies it. A no-op if `id` is already the active theme.
    public func selectTheme(id: String) {
        storage.activeThemeID = id
        reload()
    }

    private func reload() {
        let theme = store.theme(withID: storage.activeThemeID ?? "") ?? BuiltInThemes.solarizedDark
        // `selectTheme` both writes `storage.activeThemeID` (which fires
        // `onExternalChange` → `reload()`, typically on a later runloop tick)
        // and calls `reload()` synchronously itself, so `reload()` can run
        // twice per selection. Bail when nothing actually changed: the second
        // call is then a no-op (no duplicate notification / repaint), while an
        // in-place edit of the active theme's own definition still differs and
        // proceeds.
        guard theme != currentTheme else { return }
        currentTheme = theme
        currentPalette = SemanticPalette(theme: theme)
        applyApplicationAppearance()
        Self.logger.info("Active theme: \(theme.name, privacy: .public)")
        NotificationCenter.default.post(name: Self.didChangeNotification, object: self)
    }
}
