import Foundation

public struct TweenSpec {
    public var channel: String
    public var to: ChannelValue
    public var duration: Double
    public var delay: Double
    public var ease: String
    public var from: ChannelValue?

    public init(channel: String, to: ChannelValue, duration: Double,
                delay: Double = 0, ease: String = "power3.out", from: ChannelValue? = nil) {
        self.channel = channel
        self.to = to
        self.duration = duration
        self.delay = delay
        self.ease = ease
        self.from = from
    }
}

private struct Live {
    var channel: String
    var start: Double
    var end: Double
    var from: ChannelValue?
    var to: ChannelValue
    var easeFn: @Sendable (Double) -> Double
}

/// `#rrggbb` (or the three-digit short form) — the only string shape `Color.mix`
/// accepts. Hand-scanned rather than regex-matched, for the same reason
/// `parsePath` is: this runs once per tween per frame.
private func isHex(_ v: ChannelValue) -> Bool {
    guard let s = v.text, s.hasPrefix("#") else { return false }
    let body = s.dropFirst()
    guard body.count == 3 || body.count == 6 else { return false }
    return body.allSatisfy { $0.isHexDigit }
}

private func isPath(_ v: ChannelValue) -> Bool {
    guard let s = v.text, let first = s.first else { return false }
    return first == "M" || first == "m"
}

/// Interpolate whatever kind of value this is; unknown strings snap at t >= 1.
private func lerpValue(_ from: ChannelValue, _ to: ChannelValue, _ t: Double) -> ChannelValue {
    if let a = from.number, let b = to.number { return .number(a + (b - a) * t) }
    if isHex(from), isHex(to) {
        return .text(try! Color.mix(from.text!, to.text!, t))
    }
    if isPath(from), isPath(to) {
        let a = try! parsePath(from.text!)
        let b = try! parsePath(to.text!)
        // Two paths in different shape families cannot morph — there is no
        // anchor-for-anchor mapping between "MLL" and "MCCCCZ", which is what
        // `morphPath` refuses. So the crossing SNAPS: the same answer rule 4
        // gives an authored crossing, arrived at from the other direction. In
        // Swift the stakes are higher than on the web, because the `try!` below
        // does not throw — it TRAPS, taking the whole process with it.
        //
        // This is not a softening of the morph guard. Every crossing an author
        // can write is caught statically by the loader (Task 29), on both sides:
        // `poseKind` forces every pose driving a channel to share the rig's rest
        // command signature, precisely because the arbiter may morph between
        // any two poses; and a timeline's family change must be a duration-0 step
        // whose paths match the family it declares. A mismatch that reaches HERE
        // is one nobody authored — a pose applied while a timeline holds the
        // mouth open, or a timeline step landing after a pose took the mouth
        // back. Both are legitimate and both are reachable, so the only answer
        // that is defined, identical to the web's, and not a crash is the snap.
        // `morphPath` keeps its `throws` — it is that function's contract and
        // `MorphTests` still covers it; it stops being reachable from here.
        if a.kind != b.kind { return to }
        return .text(emitPath(try! morphPath(a, b, t)))
    }
    return t >= 1 ? to : from
}

public final class Tweens {
    private let channels: Channels
    private let respond: (String, ChannelValue) -> ChannelValue
    private var live: [Live] = []

    /// `respond` maps a value to what the rig renders for it, once, where it is
    /// written — see `CharacterConfig.respond`. It belongs here because `add` is
    /// the single funnel every animated value passes through, and applying it
    /// any later would interpolate in a space the original never interpolates
    /// in. The default is identity, so a test that has no config still builds.
    public init(channels: Channels,
                respond: @escaping (String, ChannelValue) -> ChannelValue = { _, v in v }) {
        self.channels = channels
        self.respond = respond
    }

    public var active: Int { live.count }

    public func cancel(_ channel: String) {
        live.removeAll { $0.channel == channel }
    }

    /// Advance one tween to `now`: write what it shows at that instant, and report
    /// whether it is finished there. `from` resolves on the first call rather than
    /// at `add`, which is what makes a delayed tween pick up the channel as it is
    /// when it actually starts. Indexed rather than passed by value — `Live` is a
    /// struct, so a copy would resolve `from` on the copy and throw it away.
    private func write(_ i: Int, _ now: Double) -> Bool {
        if live[i].from == nil { live[i].from = channels.get(live[i].channel) ?? live[i].to }
        let span = live[i].end - live[i].start
        // Absolute, never accumulated — rule 2.
        let p = span <= 0 ? 1 : min(1, (now - live[i].start) / span)
        let eased = p >= 1 ? 1 : live[i].easeFn(p)
        channels.set(live[i].channel, lerpValue(live[i].from!, live[i].to, eased))
        return p >= 1
    }

    /// Rule 5. Before a tween is replaced, the one it replaces writes the value it
    /// would have shown AT `now` — the instant of the handoff, not the instant of
    /// the last tick. Without this the incoming tween resolves its `from` against a
    /// frame-quantised snapshot, so the same animation on the same clock lands
    /// somewhere different at 60 fps than at 240.
    private func settle(_ channel: String, _ now: Double) {
        for i in live.indices where live[i].channel == channel && now >= live[i].start {
            _ = write(i, now)
        }
    }

    public func add(_ spec: TweenSpec, now: Double) {
        settle(spec.channel, now)
        cancel(spec.channel)
        let to = respond(spec.channel, spec.to)
        // A snapping channel (`snaps`, in Channels.swift) ignores whatever
        // duration its caller asked for. The rule lives HERE rather than at each
        // of the dozen call sites that build a tween, because a pivot that
        // tweened at even one of them would be a silent whole-subtree drift, not
        // a visible error.
        let duration = snaps(spec.channel) ? 0 : spec.duration
        // Rule 4. A snap lands HERE, not at the next tick, and it writes `spec.to`
        // verbatim rather than routing through `lerpValue` — a family snap's two
        // paths are by definition un-morphable, so `lerpValue(from, to, 1)` would
        // throw on exactly the step whose job is to make that crossing safe.
        if duration == 0 && spec.delay == 0 {
            channels.set(spec.channel, to)
            return
        }
        let start = now + spec.delay
        live.append(Live(
            channel: spec.channel,
            start: start,
            end: start + duration,
            // `from` is resolved when the tween STARTS, not when it is scheduled, so a
            // delayed tween picks up whatever the channel holds at that moment. That is
            // what makes the per-channel delay ladder read as a wave rather than as a
            // set of tweens that all secretly began at the same value.
            from: spec.from.map { respond(spec.channel, $0) },
            to: to,
            // Resolved here rather than per frame. The name cannot change once the
            // tween exists, so the eased values are identical either way, and this
            // is one dictionary lookup per tween instead of one per frame. The
            // force-try is deliberate: `CharacterConfig.load` (Task 29) rejects
            // every unknown ease name in the config, so an unknown name reaching
            // this line is a bug in engine code, not bad data — and it should die
            // where the bad tween is created, not ease linearly for ever.
            easeFn: try! Ease.resolve(spec.ease)
        ))
    }

    public func tick(_ now: Double) {
        var i = live.count - 1
        while i >= 0 {
            defer { i -= 1 }
            if now < live[i].start { continue }
            if write(i, now) { live.remove(at: i) }
        }
    }
}
