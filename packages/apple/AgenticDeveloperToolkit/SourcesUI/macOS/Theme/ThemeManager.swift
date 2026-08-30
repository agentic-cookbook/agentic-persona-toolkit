import AppKit
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
/// This class does not observe `storage` for changes made outside itself —
/// every live call site that changes the active theme already goes through
/// `selectTheme(id:)` directly, so a passive observer would be dead weight.
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

    /// When true (the default), the manager drives `NSApplication.shared.appearance`
    /// and repaints themable window backgrounds as the active theme changes.
    public var drivesApplicationAppearance = true

    private let storage: any ThemeStorage

    private static let logger = Logger(subsystem: "com.mikefullerton.AgenticDeveloperToolkitUI", category: "ThemeManager")

    public init(storage: any ThemeStorage) {
        self.storage = storage
        let store = ThemeStore(storage: storage)
        let theme = store.theme(withID: storage.activeThemeID ?? "") ?? BuiltInThemes.solarizedDark
        self.store = store
        self.currentTheme = theme
        self.currentPalette = SemanticPalette(theme: theme)
        ThemeManager.shared = self
        applyApplicationAppearance()
    }

    private func applyApplicationAppearance() {
        guard drivesApplicationAppearance else { return }
        NSApplication.shared.appearance = currentTheme.appearance.nsAppearance
        applyWindowBackgrounds()
    }

    private func applyWindowBackgrounds() {
        let background = NSColor(currentPalette.windowBackground)
        for window in NSApplication.shared.windows where Self.shouldThemeBackground(of: window) {
            window.backgroundColor = background
        }
    }

    /// Filters out panels (color/font pickers, etc.) that should keep the
    /// system's own chrome rather than the app's theme.
    static func shouldThemeBackground(of window: NSWindow) -> Bool {
        guard window.styleMask.contains(.titled) else { return false }
        if window is NSColorPanel || window is NSFontPanel { return false }
        return true
    }

    /// Selects a theme by id (built-in or custom), persists the selection, and
    /// applies it. A no-op if `id` is already the active theme.
    public func selectTheme(id: String) {
        storage.activeThemeID = id
        reload()
    }

    private func reload() {
        let theme = store.theme(withID: storage.activeThemeID ?? "") ?? BuiltInThemes.solarizedDark
        guard theme != currentTheme else { return }
        currentTheme = theme
        currentPalette = SemanticPalette(theme: theme)
        applyApplicationAppearance()
        Self.logger.info("Active theme: \(theme.name, privacy: .public)")
        NotificationCenter.default.post(name: Self.didChangeNotification, object: self)
    }
}

extension ThemeAppearance {
    var nsAppearance: NSAppearance? {
        switch self {
        case .auto: return nil
        case .dark: return NSAppearance(named: .darkAqua)
        case .light: return NSAppearance(named: .aqua)
        }
    }
}
