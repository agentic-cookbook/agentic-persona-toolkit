import Foundation

/// The switches behind a window's gear, and their persistence.
///
/// A plain `UserDefaults` shim rather than anything grander because that is
/// the whole of the requirement: four values, one window, no sync, no
/// migration. It is a `struct` of computed properties so there is no cached
/// copy to fall out of step with the defaults — every read is the current
/// value, which is what makes the gear correct after a relaunch without a load
/// step to remember.
///
/// The `namespace` is the host app's, so two apps built on this toolkit (or
/// two windows in one app) never write over each other, and neither collides
/// with a key the toolkit itself might add to the same suite.
public struct WindowAppearanceDefaults: Sendable {

    /// Deliberately the ranges Stenographer uses: a reader who has both apps
    /// open should find the same slider means the same thing in each.
    public static let textScaleRange: ClosedRange<Double> = 0.85...1.75
    public static let transparencyRange: ClosedRange<Double> = 0.3...1.0

    private let namespace: String
    private let defaults: UserDefaults

    public init(namespace: String, defaults: UserDefaults = .standard) {
        self.namespace = namespace
        self.defaults = defaults
    }

    private func key(_ name: String) -> String { "\(namespace).\(name)" }

    /// Multiplier over the theme's own type size. `1` is the theme as its
    /// designer scaled it.
    public var textScale: Double {
        get { value(for: key("textScale"), default: 1, in: Self.textScaleRange) }
        nonmutating set { defaults.set(newValue, forKey: key("textScale")) }
    }

    /// Window opacity. `1` is the theme's own alpha and nothing further —
    /// `old-school-terminal` is already `rgba(5, 8, 5, 0.8)`, so this thins
    /// what the theme chose rather than introducing translucency.
    public var transparency: Double {
        get { value(for: key("transparency"), default: 1, in: Self.transparencyRange) }
        nonmutating set { defaults.set(newValue, forKey: key("transparency")) }
    }

    /// Whether the window floats above other apps' windows.
    public var isFloating: Bool {
        get { defaults.bool(forKey: key("floating")) }
        nonmutating set { defaults.set(newValue, forKey: key("floating")) }
    }

    /// Whether the composer's block caret blinks. Defaults to on, which is
    /// what web does unconditionally — hence the inverted key:
    /// `bool(forKey:)` answers `false` for a key nobody has written, and the
    /// default has to be the other one.
    public var blinksCaret: Bool {
        get { !defaults.bool(forKey: key("blinkCaret.off")) }
        nonmutating set { defaults.set(!newValue, forKey: key("blinkCaret.off")) }
    }

    /// A stored double, or `fallback` when the key is absent — `UserDefaults`
    /// answers `0` for both, which as a text scale would lay the window out at
    /// no height. Clamped as well, so a hand-edited plist cannot do the same.
    private func value(for key: String, default fallback: Double, in range: ClosedRange<Double>) -> Double {
        guard defaults.object(forKey: key) != nil else { return fallback }
        return Swift.max(range.lowerBound, Swift.min(range.upperBound, defaults.double(forKey: key)))
    }
}
