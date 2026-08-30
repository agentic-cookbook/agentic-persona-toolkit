import AppKit
import AgenticDeveloperToolkit

/// The AppKit half of `ThemeManager`: drives `NSApplication.shared.appearance`
/// from the theme's light/dark/auto and repaints themable window backgrounds.
/// Behaviour is verbatim what `ThemeManager` used to do inline before the
/// manager's core moved to `SourcesUI/Shared` to compile for iOS too.
@MainActor
public final class AppKitAppearanceDriver: ThemeAppearanceDriver {

    public init() {}

    public func apply(_ theme: ColorTheme, palette: SemanticPalette) {
        NSApplication.shared.appearance = theme.appearance.nsAppearance
        let background = NSColor(palette.windowBackground)
        for window in NSApplication.shared.windows where ThemeManager.shouldThemeBackground(of: window) {
            window.backgroundColor = background
        }
    }
}

extension ThemeManager {

    /// The macOS default: drive app-wide appearance through AppKit. Keeps every
    /// `ThemeManager(storage:)` call site behaving exactly as it did when the
    /// AppKit work lived inside the manager.
    public convenience init(storage: any ThemeStorage) {
        self.init(storage: storage, appearanceDriver: AppKitAppearanceDriver())
    }

    /// When true (the default on macOS), the manager drives
    /// `NSApplication.shared.appearance` and repaints themable window
    /// backgrounds as the active theme changes.
    ///
    /// Strictly "is *the AppKit* driver installed?", never "is *a* driver
    /// installed?" — this property owns `AppKitAppearanceDriver` and nothing
    /// else. A host that injected its own `ThemeAppearanceDriver` reads `false`
    /// here and keeps its driver through a write in either direction: the
    /// convenience of a boolean toggle is not worth silently discarding a
    /// driver it knows nothing about. Such a host manages `appearanceDriver`
    /// directly.
    ///
    /// Setting `true` when the AppKit driver is already installed is a no-op
    /// rather than a fresh allocation. Like before, flipping it does not itself
    /// repaint; the next theme change does.
    public var drivesApplicationAppearance: Bool {
        get { appearanceDriver is AppKitAppearanceDriver }
        set {
            if newValue {
                // Only the empty slot is ours to fill: a non-nil driver is
                // either already the AppKit one (no-op) or the host's (theirs).
                if appearanceDriver == nil { appearanceDriver = AppKitAppearanceDriver() }
            } else if appearanceDriver is AppKitAppearanceDriver {
                appearanceDriver = nil
            }
        }
    }

    /// Filters out panels (color/font pickers, etc.) that should keep the
    /// system's own chrome rather than the app's theme.
    static func shouldThemeBackground(of window: NSWindow) -> Bool {
        guard window.styleMask.contains(.titled) else { return false }
        if window is NSColorPanel || window is NSFontPanel { return false }
        return true
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
