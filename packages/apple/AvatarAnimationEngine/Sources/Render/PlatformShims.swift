import QuartzCore

#if canImport(AppKit)
import AppKit

public typealias PlatformView = NSView
public typealias PlatformColor = NSColor
public typealias PlatformGestureRecognizer = NSGestureRecognizer

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

    static func makeTapRecognizer(target: AnyObject,
                                  action: Selector) -> PlatformGestureRecognizer {
        NSClickGestureRecognizer(target: target, action: action)
    }

    /// The recognizers that report a moving finger. macOS has a real cursor,
    /// which `pointerLocation` samples every frame instead, so there are none.
    static func makeDragRecognizers(target: AnyObject,
                                    action: Selector) -> [PlatformGestureRecognizer] { [] }

    /// Where the cursor is, in `view`'s own space -- `nil` when there is no
    /// cursor to sample or the view is not in a window yet.
    static func pointerLocation(in view: PlatformView) -> CGPoint? {
        guard let window = view.window else { return nil }
        return view.convert(window.convertPoint(fromScreen: NSEvent.mouseLocation), from: nil)
    }

    /// `document.hasFocus()`. The original gates the idle-ladder reset on it
    /// ($GSAP/src/reflexes.ts:55) so a stray move over a background window will
    /// not rouse him -- but NOT the gaze, which follows the cursor either way.
    static func isFocused(_ view: PlatformView) -> Bool { view.window?.isKeyWindow ?? false }
}

#else
import UIKit

public typealias PlatformView = UIView
public typealias PlatformColor = UIColor
public typealias PlatformGestureRecognizer = UIGestureRecognizer

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

    static func makeTapRecognizer(target: AnyObject,
                                  action: Selector) -> PlatformGestureRecognizer {
        UITapGestureRecognizer(target: target, action: action)
    }

    /// iOS has no cursor to sample, so the finger IS the pointer: a drag
    /// reports its location the way `pointermove` does on a touch device, and
    /// the hover recognizer covers an iPad trackpad or Pencil.
    static func makeDragRecognizers(target: AnyObject,
                                    action: Selector) -> [PlatformGestureRecognizer] {
        [UIPanGestureRecognizer(target: target, action: action),
         UIHoverGestureRecognizer(target: target, action: action)]
    }

    static func pointerLocation(in view: PlatformView) -> CGPoint? { nil }

    /// A foreground iOS app is the focused one; there is no second window to
    /// steal key from.
    static func isFocused(_ view: PlatformView) -> Bool { true }
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

public extension CGColor {
    /// `#rrggbb` -> sRGB. Alpha is deliberately NOT baked in: `paint.alpha`
    /// animates, and folding it in here would rebuild a `CGColor` on every
    /// frame of every fade. It belongs on the layer's `opacity`.
    static func avatarInk(_ hex: String) -> CGColor? {
        guard let rgb = try? Color.parseHex(hex) else { return nil }
        return CGColor(srgbRed: CGFloat(rgb.r), green: CGFloat(rgb.g),
                       blue: CGFloat(rgb.b), alpha: 1)
    }
}

public extension CGPath {
    /// A display item's `d`, as a `CGPath`.
    ///
    /// The one door a renderer outside this package needs. The alternative is
    /// making `parsePath`, `ParsedPath` and `cgPath` public — three types
    /// exposed to hide one string — or letting each host write its own path
    /// builder, which means each host reproducing the cubic argument order
    /// `cgPath` carries a comment about: a version that compiles, runs, and
    /// draws every curve wrong.
    static func avatarItem(_ d: String) throws -> CGPath {
        AvatarLayerView.cgPath(try parsePath(d))
    }
}

public extension StrokeStyle {
    /// `character.strokeStyle`'s cap and join vocabulary is Core Animation's
    /// verbatim, and Core Graphics spells the same three values as an enum with
    /// no string door. `AvatarLayerView` needs the Core Animation spelling and a
    /// static renderer needs this one, so the mapping lives here beside the
    /// other bridges rather than in whichever host happens to want it first.
    ///
    /// An unrecognised value falls back to Core Graphics' own default rather
    /// than throwing: the loader is where a bad vocabulary is caught, and a
    /// renderer that refused to draw would report it in the least useful place.
    var cgLineCap: CGLineCap {
        switch linecap {
        case "round": return .round
        case "square": return .square
        default: return .butt
        }
    }

    var cgLineJoin: CGLineJoin {
        switch linejoin {
        case "round": return .round
        case "bevel": return .bevel
        default: return .miter
        }
    }
}
