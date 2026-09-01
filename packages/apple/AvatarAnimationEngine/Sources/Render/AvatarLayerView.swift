import QuartzCore

/// `CADisplayLink` retains its target. If the view were its own target, a
/// running link would hold it alive for the life of the run loop, its `deinit`
/// would never fire, and it could never stop the link that was keeping it
/// alive — a host that forgot `stop()` would leak the view, its engine and its
/// config. This proxy holds the view weakly, so the view deinits on schedule
/// and its own `deinit` tears the link down.
///
/// `@MainActor`: `start()` adds the link to `.main`, so `step(_:)` always
/// fires there. Without the annotation the compiler cannot see that — a
/// `CADisplayLink` argument crossing from this nonisolated callback to
/// `AvatarLayerView.step`, which inherits its `@MainActor` isolation from
/// `PlatformView`, would need `CADisplayLink` to be `Sendable`, which it is
/// not. Stating the true isolation here removes the crossing instead of
/// working around it.
@MainActor
private final class DisplayLinkProxy: NSObject {
    weak var view: AvatarLayerView?
    @objc func step(_ link: CADisplayLink) { view?.step(link) }
}

/// One `CAShapeLayer` per display item, created on the first `render` and
/// thereafter only written to. Holds no animation state: everything it draws
/// comes from the display list it was handed.
public final class AvatarLayerView: PlatformView {
    public let engine: Engine

    /// Called once, after `render` has stopped the loop. See `step`.
    public var onError: ((Error) -> Void)?

    /// One shape layer plus the last values written to it. The two strings are
    /// cache keys: `d` gates a `CGPath` rebuild and `ink` a `CGColor` rebuild,
    /// which are the only two allocating writes in the frame.
    private struct Painted {
        let layer: CAShapeLayer
        var d = ""
        var ink = ""
        var fill: Bool?
    }

    private lazy var host: CALayer = Platform.hostLayer(of: self)
    private var painted: [Painted] = []
    private let proxy = DisplayLinkProxy()
    private var link: CADisplayLink?

    public init(engine: Engine, frame: CGRect = .zero) {
        self.engine = engine
        super.init(frame: frame)
        proxy.view = self
    }

    required init?(coder: NSCoder) {
        fatalError("AvatarLayerView is created in code, never from a nib")
    }

    // `isolated`: this class's isolation is inherited from `PlatformView`
    // (`@MainActor`), and `CADisplayLink` is not `Sendable` — a plain,
    // nonisolated `deinit` could not touch `link` at all under complete
    // concurrency checking. `isolated deinit` runs synchronously on the main
    // actor instead, which is exactly where `link` was created and used.
    isolated deinit { link?.invalidate() }

    /// The layer tree, in display-list order. Internal: the tests assert on it;
    /// a host has no business reaching in.
    var shapeLayers: [CAShapeLayer] { painted.map(\.layer) }

    // MARK: - the loop

    public func start() {
        guard link == nil else { return }
        let l = Platform.displayLink(on: self, target: proxy,
                                     selector: #selector(DisplayLinkProxy.step(_:)))
        l.add(to: .main, forMode: .common)
        link = l
    }

    public func stop() {
        link?.invalidate()
        link = nil
    }

    fileprivate func step(_ link: CADisplayLink) {
        do {
            // `targetTimestamp`, not `timestamp`: the frame being built is the
            // one displayed at that instant, so sampling the animation there is
            // what puts the motion on screen on time. `timestamp` renders one
            // frame into the past, every frame.
            render(try engine.tick(link.targetTimestamp))
        } catch {
            // A throw from `compose` is a config bug (Task 30), not a dropped
            // frame — it will throw again on every tick after this one. Stop,
            // report once, let the host decide.
            stop()
            onError?(error)
        }
    }

    // MARK: - the dumb half

    public func render(_ list: DisplayList) {
        let size = bounds.size
        guard size.width > 0, size.height > 0 else { return }

        // The list's length is invariant (Task 30), so this rebuilds exactly
        // once. Keeping it a comparison rather than an `isEmpty` check means a
        // config swapped under the view redraws instead of half-rendering.
        if painted.count != list.count { build(list) }

        let character = engine.config.character
        let fit = Self.fit(canvas: character.canvas, into: size,
                           flipY: Platform.viewSpaceIsBottomLeft)

        CATransaction.begin()
        CATransaction.setDisableActions(true)
        for (i, item) in list.enumerated() {
            apply(item, to: &painted[i], stroke: character.strokeStyle, fit: fit)
        }
        CATransaction.commit()
    }

    private func build(_ list: DisplayList) {
        painted.forEach { $0.layer.removeFromSuperlayer() }
        let canvas = engine.config.character.canvas
        painted = list.map { item in
            let l = CAShapeLayer()
            l.name = item.id
            // An SVG `transform` acts about the coordinate space's ORIGIN; a
            // layer's acts about its `anchorPoint`, which defaults to the middle
            // of its bounds. Pinning anchor and position to zero is what makes
            // `setAffineTransform` mean the same thing as `transform="matrix()"`.
            l.anchorPoint = .zero
            l.position = .zero
            l.bounds = CGRect(origin: .zero,
                              size: CGSize(width: canvas.w, height: canvas.h))
            // `ring` is two closed subpaths of opposite winding; nonzero is what
            // makes the hole. It is also the default on both sides, so this line
            // exists to stop it drifting.
            l.fillRule = .nonZero
            // No implicit animation, ever: the engine already produced the
            // in-between frames, and a quarter-second CA animation toward each
            // one would smear them together.
            l.actions = ["path": NSNull(), "transform": NSNull(),
                         "opacity": NSNull(), "fillColor": NSNull(),
                         "strokeColor": NSNull(), "lineWidth": NSNull()]
            host.addSublayer(l)
            return Painted(layer: l)
        }
    }

    private func apply(_ item: DisplayItem, to p: inout Painted,
                       stroke: StrokeStyle, fit: CGAffineTransform) {
        let l = p.layer

        if p.d != item.d, let parsed = try? parsePath(item.d) {
            p.d = item.d
            l.path = Self.cgPath(parsed)
        }

        if p.ink != item.paint.ink || p.fill != item.paint.fill,
           let colour = CGColor.avatarInk(item.paint.ink) {
            p.ink = item.paint.ink
            p.fill = item.paint.fill
            l.fillColor = item.paint.fill ? colour : nil
            l.strokeColor = item.paint.fill ? nil : colour
        }

        // Cap and join are the character's, not the item's, and the config's
        // vocabulary is Core Animation's raw values verbatim. `paint.width` is
        // per-ink and falls back to the character's stroke width.
        l.lineWidth = CGFloat(item.paint.width ?? stroke.width)
        l.lineCap = CAShapeLayerLineCap(rawValue: stroke.linecap)
        l.lineJoin = CAShapeLayerLineJoin(rawValue: stroke.linejoin)
        l.opacity = Float(item.paint.alpha)
        l.setAffineTransform(CGAffineTransform(item.m).concatenating(fit))
    }

    // MARK: - geometry

    public static func fit(canvas: Canvas, into size: CGSize,
                           flipY: Bool) -> CGAffineTransform {
        // Uniform, so the character never stretches; the leftover is letterbox.
        let s = min(size.width / CGFloat(canvas.w), size.height / CGFloat(canvas.h))
        let centred = CGAffineTransform(scaleX: s, y: s)
            .concatenating(CGAffineTransform(
                translationX: (size.width - CGFloat(canvas.w) * s) / 2,
                y: (size.height - CGFloat(canvas.h) * s) / 2))
        guard flipY else { return centred }
        return centred.concatenating(
            CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: size.height))
    }

    /// `ParsedPath` -> `CGPath`. `kind` is Task 27's `M`/`L`/`C`/`Z` alphabet and
    /// `points` is flat, x,y interleaved.
    ///
    /// `nonisolated`: this touches no view state and no AppKit/UIKit type, so
    /// there is no reason for it to inherit the class's main-actor isolation.
    /// Task 39's `CGPath.avatarItem` (`PlatformShims.swift`) is the first
    /// caller outside the main-actor-isolated render path — a static renderer
    /// with no view of its own — and would otherwise have to become
    /// main-actor-isolated itself just to reach a function that never touches
    /// the actor it would be isolated to.
    nonisolated static func cgPath(_ p: ParsedPath) -> CGPath {
        let out = CGMutablePath()
        var i = 0
        func next() -> CGPoint {
            defer { i += 2 }
            return CGPoint(x: p.points[i], y: p.points[i + 1])
        }
        for command in p.kind {
            switch command {
            case "M": out.move(to: next())
            case "L": out.addLine(to: next())
            case "C":
                // Bound to locals in THIS order deliberately. SVG writes a cubic
                // as `C c1 c2 end`, `addCurve` takes `to:` first, and `next()`
                // advances a cursor — so writing the three reads inline as
                // arguments would put the endpoint in the first control point's
                // slot. It compiles, runs, and draws every curve wrong.
                let c1 = next(), c2 = next(), end = next()
                out.addCurve(to: end, control1: c1, control2: c2)
            case "Z": out.closeSubpath()
            default: break     // `parsePath` emits no other letter
            }
        }
        return out
    }
}
