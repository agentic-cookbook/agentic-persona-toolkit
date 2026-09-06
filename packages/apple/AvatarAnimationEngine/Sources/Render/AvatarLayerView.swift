import Foundation
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
public final class AvatarLayerView: AvatarHostView {
    public let engine: Engine

    /// Called once, after `render` has stopped the loop. See `step`.
    public var onError: ((Error) -> Void)?

    /// Whether this view feeds the host's pointer and clicks into the engine.
    /// On by default: in the original these are reflexes the avatar owns, not
    /// host features ($GSAP/src/gaze.ts:120, $GSAP/src/reflexes.ts:67-69). A
    /// host that wants a decorative, non-reacting olylo turns it off.
    public var tracksPointer = true

    /// How much of the view the canvas box is allowed to fill, 0...1.
    ///
    /// The original never clips: its SVG carries `overflow: visible` precisely
    /// because emotional `scale` and `rotation` push the glyph outside the
    /// design box ($GSAP/src/Bitbag.tsx:210-213). A layer tree has no such
    /// escape — whatever leaves the view's bounds is sheared off — so the
    /// equivalent is to fit the canvas into less than the whole view and let
    /// the overflow use the margin. bitbag's `silly` is the case that needs
    /// it: a 180° turn about a pivot below centre puts his stems a third of a
    /// canvas below the bottom edge.
    ///
    /// 1 is the historical behaviour (canvas fills the binding dimension
    /// exactly) and stays the default: a host that has sized its view to the
    /// canvas is asking for the canvas, and silently shrinking it would move
    /// every existing avatar.
    /// No invalidation on write: `fit` is recomputed from this on every frame
    /// the display link draws, so the next frame already carries the change.
    public var overscan: CGFloat = 1

    /// The last point `pointerLocation` reported, so a still cursor is not
    /// re-reported every frame. Re-reporting would call `notice()` 60 times a
    /// second and pin the idle ladder to rung 0 forever.
    private var lastPointer: CGPoint?

    /// The last unit vector `pointerMoved` handed to `engine.look`. Internal:
    /// the tests assert on it; a host has no business reading it.
    var lastLook: (x: Double, y: Double) = (0, 0)

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
        addGestureRecognizer(Platform.makeTapRecognizer(target: self,
                                                        action: #selector(handleTap)))
        for r in Platform.makeDragRecognizers(target: self, action: #selector(handleDrag(_:))) {
            addGestureRecognizer(r)
        }
    }

    required init?(coder: NSCoder) {
        fatalError("AvatarLayerView is created in code, never from a nib")
    }

    // `isolated`: this class's isolation is inherited from `PlatformView`
    // (`@MainActor`), and `CADisplayLink` is not `Sendable` — a plain,
    // nonisolated `deinit` could not touch `link` at all under complete
    // concurrency checking. `isolated deinit` runs synchronously on the main
    // actor instead, which is exactly where `link` was created and used.
    isolated deinit {
        link?.invalidate()
        // The run loop holds the timer, and the timer's block holds this view
        // weakly — so without this the beat outlives the view it was watching.
        watchdog?.invalidate()
        if let occlusionObserver { NotificationCenter.default.removeObserver(occlusionObserver) }
    }

    /// The layer tree, in display-list order. Internal: the tests assert on it;
    /// a host has no business reaching in.
    var shapeLayers: [CAShapeLayer] { painted.map(\.layer) }

    // MARK: - the loop

    /// True between `start()` and `stop()`: the host wants the character
    /// running. Whether it actually ticks is `isTicking`, which also needs
    /// the view to be on screen.
    public private(set) var isStarted = false
    var isTicking: Bool { link != nil }
    private var occlusionObserver: NSObjectProtocol?

    /// When the last frame arrived, on `CACurrentMediaTime`'s clock — or when
    /// the current link was armed, so a link that has not had time to deliver
    /// yet is not mistaken for one that never will. `nil` while nothing is
    /// armed. Internal: the tests back-date it to stall the loop on purpose.
    private(set) var lastFrameAt: CFTimeInterval?

    /// How many display links this view has built. A host never needs it; it is
    /// what lets a test tell "the same link kept running" from "a dead one was
    /// replaced", which is the whole of the watchdog's contract.
    private(set) var linkGeneration = 0

    private var watchdog: Timer?

    /// How long the view waits for a frame before deciding the link is dead
    /// rather than merely idle.
    ///
    /// Two seconds is hundreds of missed frames at any refresh rate, so it is
    /// never a hitch, a slow frame or a run loop busy with something else; and
    /// it is short enough that a reader who looks up after a display wake sees
    /// the character moving rather than stuck.
    static let frameStallAfter: CFTimeInterval = 2

    /// How often the view checks. Also the beat that re-runs
    /// `reconcileTicking`, which is what makes visibility level-triggered
    /// rather than resting on the single edge `didChangeOcclusionState`
    /// delivers — a missed edge is otherwise permanent.
    private static let watchdogInterval: TimeInterval = 1

    /// The colour painted under the mark. `nil` leaves the host layer clear.
    public var plateColor: CGColor? {
        didSet { host.backgroundColor = plateColor }
    }

    public func start() {
        isStarted = true
        reconcileTicking()
        startWatchdog()
    }

    public func stop() {
        isStarted = false
        stopWatchdog()
        reconcileTicking()
    }

    public override func hostVisibilityChanged() {
        observeOcclusion()
        reconcileTicking()
    }

    private func reconcileTicking() {
        let shouldTick = isStarted && Platform.isOnScreen(self)
        if shouldTick, link == nil {
            let l = Platform.displayLink(on: self, target: proxy,
                                         selector: #selector(DisplayLinkProxy.step(_:)))
            l.add(to: .main, forMode: .common)
            link = l
            linkGeneration += 1
            lastFrameAt = CACurrentMediaTime()
        } else if !shouldTick, let l = link {
            l.invalidate()
            link = nil
            lastFrameAt = nil
        }
    }

    /// One beat of the watchdog: is this view still being drawn?
    ///
    /// A display link is an object, not a promise. `NSView`'s is bound to the
    /// display the view is on, and AppKit's own contract for it is that "if the
    /// view is hidden, or not on any display, the callback will not be invoked"
    /// — a delivery gate the view can neither see nor query. So a display that
    /// goes away and comes back (an external monitor powering down overnight)
    /// takes the callbacks with it, and nothing throws, nothing is notified,
    /// and the link is still there. A liveness test of `link == nil` reports a
    /// healthy loop forever.
    ///
    /// Both halves of the check are therefore level-triggered, deliberately.
    /// `reconcileTicking` re-reads the window's live occlusion state, so a
    /// `didChangeOcclusionState` edge that never arrived stops being permanent;
    /// and liveness is then measured in FRAMES rather than in objects, so a
    /// link that exists but has gone quiet is torn down and rebuilt.
    ///
    /// Internal so the tests can drive a beat without waiting on the run loop.
    func checkFrames(_ now: CFTimeInterval) {
        reconcileTicking()
        guard let l = link, let last = lastFrameAt,
              now - last > Self.frameStallAfter else { return }
        // Frames are owed and are not arriving: the link is dead, not idle.
        // Rebuilding costs one object and one run-loop source, so if the fault
        // is something this cannot fix the next beat simply tries again.
        l.invalidate()
        link = nil
        lastFrameAt = nil
        reconcileTicking()
    }

    /// The beat itself. A `Timer` rather than anything the display drives,
    /// because what has failed IS the display's own callback: the run loop kept
    /// pumping through the whole freeze — its other timers went on firing — so
    /// a timer is the one signal source proven to survive it.
    private func startWatchdog() {
        guard watchdog == nil else { return }
        let t = Timer(timeInterval: Self.watchdogInterval, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.checkFrames(CACurrentMediaTime()) }
        }
        // Half the interval: the check is a coarse "has a second gone by with
        // no frames", so letting the system coalesce it costs nothing.
        t.tolerance = Self.watchdogInterval / 2
        // `.common`, like the link itself, so a menu tracking or resize loop
        // does not suspend the one thing watching for a stall.
        RunLoop.main.add(t, forMode: .common)
        watchdog = t
    }

    private func stopWatchdog() {
        watchdog?.invalidate()
        watchdog = nil
    }

    private func observeOcclusion() {
        if let occlusionObserver {
            NotificationCenter.default.removeObserver(occlusionObserver)
            self.occlusionObserver = nil
        }
        guard let name = Platform.occlusionNotificationName, let window else { return }
        occlusionObserver = NotificationCenter.default.addObserver(
            forName: name, object: window, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.reconcileTicking() }
        }
    }

    fileprivate func step(_ link: CADisplayLink) {
        // Proof of life for `checkFrames`, taken before the work rather than
        // after it: a frame that throws still happened.
        lastFrameAt = CACurrentMediaTime()
        do {
            // The original samples the cursor once per frame too -- its
            // `pointermove` handler throttles itself to one `requestAnimationFrame`
            // ($GSAP/src/gaze.ts:97-99) -- so polling here is the same rate, not a
            // shortcut.
            if tracksPointer { pointerSampled(Platform.pointerLocation(in: self)) }
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

    // MARK: - the pointer

    /// One frame's pointer sample -- `Platform.pointerLocation(in:)`'s result,
    /// already in this view's own space. `nil` on the non-nil -> nil edge
    /// relaxes the gaze to centre ONCE, mirroring the original's
    /// `document.addEventListener("mouseleave", () => look(0, 0))`
    /// ($GSAP/src/gaze.ts:120) -- `pointerLocation` has no view-space "outside
    /// the window" left to test once its own conversion is applied, so it
    /// reports the leave as `nil` instead, and this is where that edge is
    /// caught. `lastPointer` already exists to skip re-reporting a still
    /// cursor; the same field doubles as the one-shot latch here, since
    /// setting it back to `nil` is exactly what stops a second `nil` sample
    /// (the cursor still away next frame) from calling `look(0, 0)` again.
    ///
    /// Extracted from `step(_:)` so the edge can be exercised without a live
    /// `CADisplayLink`.
    func pointerSampled(_ point: CGPoint?) {
        guard let p = point else {
            guard lastPointer != nil else { return }
            lastPointer = nil
            lastLook = (x: 0, y: 0)
            engine.look(0, 0)
            return
        }
        guard p != lastPointer else { return }
        lastPointer = p
        pointerMoved(to: p)
    }

    /// The pointer is at `point`, in this view's own coordinate space.
    ///
    /// The engine's `look` takes a UNIT vector and applies `gaze.gazeMax`
    /// itself, so what this owes it is the normalised direction from the
    /// view's centre -- which is what the original computes
    /// ($GSAP/src/gaze.ts:104-109) before applying the same maximum.
    public func pointerMoved(to point: CGPoint) {
        guard tracksPointer, bounds.width > 0, bounds.height > 0 else { return }
        let dx = point.x - bounds.midX
        let raw = point.y - bounds.midY
        // The engine's y is DOWN, like the design canvas. A bottom-left host
        // space has y up, so the sign flips in exactly the place `fit` flips
        // the drawing.
        let dy = Platform.viewSpaceIsBottomLeft ? -raw : raw
        // `$GSAP`'s `|| 1`: dead centre is a zero-length vector, and dividing
        // by it would make him stare at NaN.
        let len = max(hypot(dx, dy), .leastNormalMagnitude)
        lastLook = (x: Double(dx / len), y: Double(dy / len))
        engine.look(lastLook.x, lastLook.y)
        // Gated, unlike the gaze: a move over a background window turns his
        // head but does not count as activity ($GSAP/src/reflexes.ts:55).
        if Platform.isFocused(self) { engine.notice() }
    }

    /// A click or a tap. Pokes AND wakes -- the original binds both to
    /// `pointerdown` ($GSAP/src/reflexes.ts:69 plus the click reaction), and it
    /// is not gated on focus the way `pointerMoved`'s `notice()` is: a click
    /// on a background window is unambiguously deliberate. It IS gated on
    /// `tracksPointer`, like every other pointer reflex -- a host that turns
    /// tracking off wants a decorative, non-reacting olylo, clicks included.
    public func pointerPressed() {
        guard tracksPointer else { return }
        engine.poke()
        engine.notice()
    }

    @objc private func handleTap() { pointerPressed() }

    @objc private func handleDrag(_ r: PlatformGestureRecognizer) {
        pointerMoved(to: r.location(in: self))
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
                           flipY: Platform.viewSpaceIsBottomLeft,
                           overscan: overscan)

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
                           flipY: Bool, overscan: CGFloat = 1) -> CGAffineTransform {
        // Uniform, so the character never stretches; the leftover is letterbox.
        // `overscan` below 1 turns part of that leftover into room for motion
        // that leaves the canvas box — see the property of the same name. The
        // canvas stays centred either way, so the margin is split evenly and a
        // pose overflowing in one direction gets half of it.
        // Zero or negative would collapse or mirror the avatar rather than
        // scale it, which is never what a host meant to ask for.
        let s = min(size.width / CGFloat(canvas.w), size.height / CGFloat(canvas.h))
            * max(overscan, 0.01)
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
