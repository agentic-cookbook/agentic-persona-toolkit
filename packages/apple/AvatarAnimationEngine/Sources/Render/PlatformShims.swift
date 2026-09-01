import QuartzCore

#if canImport(AppKit)
import AppKit

public typealias PlatformView = NSView
public typealias PlatformColor = NSColor

/// THE `#if` (Global Constraints). Everything AppKit and UIKit disagree about is
/// named here, as one constant and three functions with no logic in them. No
/// other file in this package imports either framework.
///
/// `@MainActor`: every member either touches a view (AppKit/UIKit types are
/// main-actor isolated under Swift 6) or, like `viewSpaceIsBottomLeft`, is
/// only ever read from a main-actor context (`AvatarLayerView` itself is
/// main-actor isolated by inheriting `PlatformView`). Isolating the enum
/// states that once instead of forcing every call site to cross.
@MainActor
enum Platform {
    /// AppKit's default view space has its origin bottom-left; the design space
    /// is y-down. `AvatarLayerView.fit` composes the flip from this.
    static let viewSpaceIsBottomLeft = true

    static func reduceMotion() -> Bool {
        NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
    }

    /// `NSView` is layer-backed only on request. The force-unwrap is safe on the
    /// line after `wantsLayer = true`, which is the documented contract.
    static func hostLayer(of view: PlatformView) -> CALayer {
        view.wantsLayer = true
        return view.layer!
    }

    static func displayLink(on view: PlatformView, target: AnyObject,
                            selector: Selector) -> CADisplayLink {
        view.displayLink(target: target, selector: selector)
    }
}

#else
import UIKit

public typealias PlatformView = UIView
public typealias PlatformColor = UIColor

@MainActor
enum Platform {
    static let viewSpaceIsBottomLeft = false

    static func reduceMotion() -> Bool { UIAccessibility.isReduceMotionEnabled }

    /// `UIView` is always layer-backed.
    static func hostLayer(of view: PlatformView) -> CALayer { view.layer }

    static func displayLink(on view: PlatformView, target: AnyObject,
                            selector: Selector) -> CADisplayLink {
        CADisplayLink(target: target, selector: selector)
    }
}
#endif

public extension AvatarEnvironment {
    /// The real accessibility setting — and only that. The clock the host feeds
    /// `tick` is `CADisplayLink.targetTimestamp`, and it is the engine's only
    /// one (Ruling 48), so there is no second time source to keep on the same
    /// time base as it.
    ///
    /// - Important: the returned closure must be CALLED on the main actor. It
    ///   reads AppKit/UIKit accessibility state through
    ///   `MainActor.assumeIsolated`, which traps off the main actor — and the
    ///   trap fires where the engine samples the setting, inside `tick`, not
    ///   here. `Engine` is deliberately not actor-isolated, so nothing in the
    ///   type system enforces this: a host that drives `tick` from a
    ///   background queue must pass its own `AvatarEnvironment` instead of
    ///   this one. `AvatarLayerView` drives it from a `CADisplayLink`, which
    ///   is already on the main actor.
    static func live() -> AvatarEnvironment {
        // `reducedMotion` is a plain, non-isolated `() -> Bool` (Task 34): the
        // engine may sample it from any context. `Platform.reduceMotion()` is
        // main-actor isolated, like every AppKit/UIKit accessor. This host is
        // driven by a `CADisplayLink` on the main run loop (Six, `start()`), so
        // the read always happens there in practice; `assumeIsolated` states
        // that known fact synchronously instead of forcing this closure's type
        // to become `async` and rippling that into every caller of `reducedMotion`.
        AvatarEnvironment(reducedMotion: {
            MainActor.assumeIsolated { Platform.reduceMotion() }
        })
    }
}

public extension CGAffineTransform {
    /// `Mat` and `CGAffineTransform` are the same row-vector 2x3 affine in the
    /// same field order — `x' = a*x + c*y + tx` on both sides — so this is a
    /// rename, not a conversion. It is also the one place a `Double` becomes a
    /// `CGFloat`.
    init(_ m: Mat) {
        self.init(a: CGFloat(m.a), b: CGFloat(m.b), c: CGFloat(m.c),
                  d: CGFloat(m.d), tx: CGFloat(m.e), ty: CGFloat(m.f))
    }
}

extension CGColor {
    /// `#rrggbb` -> sRGB. Alpha is deliberately NOT baked in: `paint.alpha`
    /// animates, and folding it in here would rebuild a `CGColor` on every
    /// frame of every fade. It belongs on the layer's `opacity`.
    static func avatarInk(_ hex: String) -> CGColor? {
        guard let rgb = try? Color.parseHex(hex) else { return nil }
        return CGColor(srgbRed: CGFloat(rgb.r), green: CGFloat(rgb.g),
                       blue: CGFloat(rgb.b), alpha: 1)
    }
}
