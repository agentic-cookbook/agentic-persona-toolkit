import Foundation

/// The host's clock and its accessibility state, injected rather than reached
/// for. Deliberately NOT named `Environment`: SwiftUI publishes that name, and a
/// host importing both would have to spell out which one it meant every time.
///
/// `live()` — the real clock and the real reduced-motion flag — is an extension
/// in `Render/PlatformShims.swift` (Task 35), not here. It needs AppKit or
/// UIKit, and this package keeps every `#if` in that one file so the core stays
/// compilable in any context.
public struct AvatarEnvironment {
    /// The system's reduce-motion preference. Read fresh on every use, never
    /// cached — a viewer can change it while the app is running.
    ///
    /// It is the ONLY thing in here. There is deliberately no `now`: the
    /// engine's single clock is the argument to `tick` (Ruling 48), and an
    /// environment able to report a second, unrelated time would be an
    /// invitation to the bug that ruling removed — the golden recorder driving
    /// frames on scenario time while every command it scripted landed at this
    /// struct's default of zero. One time source cannot disagree with itself.
    public var reducedMotion: () -> Bool

    /// The parameter is defaulted, which is the honest Swift equivalent of the
    /// web's `Partial<Environment>` merge: `AvatarEnvironment()` is the headless
    /// one, `AvatarEnvironment(reducedMotion: { true })` the other.
    ///
    /// There is deliberately no `static let` default. Under
    /// `SWIFT_STRICT_CONCURRENCY: complete` a public static would have to be
    /// `Sendable`, which would force the closure to be `@Sendable` and make a
    /// host closure that reads a view a compile error for no benefit.
    /// `AvatarEnvironment()` is the default, and it is a fresh value each time.
    public init(reducedMotion: @escaping () -> Bool = { false }) {
        self.reducedMotion = reducedMotion
    }
}
