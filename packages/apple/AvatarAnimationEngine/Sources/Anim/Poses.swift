import Foundation

public struct AnimError: Error, Equatable, CustomStringConvertible {
    public let message: String
    public init(_ message: String) { self.message = message }
    public var description: String { "avatar anim: \(message)" }
}

/// Everything a pose or a timeline is allowed to touch, and nothing else.
///
/// A struct of four references rather than a class with methods: neither
/// `applyPose` nor `playTimeline` owns any state of its own, and giving them a
/// `self` would invent a fourth owner of the frame alongside the channel store,
/// the tween list and the scheduler.
public struct AnimContext {
    public var config: CharacterConfig
    public var channels: Channels
    public var tweens: Tweens
    public var scheduler: Scheduler

    public init(config: CharacterConfig, channels: Channels,
                tweens: Tweens, scheduler: Scheduler) {
        self.config = config
        self.channels = channels
        self.tweens = tweens
        self.scheduler = scheduler
    }
}

public struct PoseReset: Equatable {
    public var at: Double
    public var channel: String
    public var value: Double

    public init(at: Double, channel: String, value: Double) {
        self.at = at
        self.channel = channel
        self.value = value
    }
}

public struct PoseResult: Equatable {
    /// Set when the pose spins: the engine schedules this normalisation for `at`.
    public var resetAt: PoseReset?

    public init(resetAt: PoseReset? = nil) { self.resetAt = resetAt }
}

/// The node half of a channel name — `"body.ink"` -> `"body"`. A channel with no
/// dot is its own node, which no config can currently produce but which is the
/// only answer that cannot crash.
///
/// Internal rather than `private`: `Timelines.swift` needs it too, to find the
/// `.family` channel a timeline step's node owns, and a second copy there is a
/// second place for the two files to disagree about what a node name is.
func nodeOf(_ channel: String) -> String {
    guard let dot = channel.firstIndex(of: ".") else { return channel }
    return String(channel[channel.startIndex..<dot])
}

/// The per-channel delay ladder. The face does not snap into a mood all at once:
/// some parts lead and others lag, and that stagger is most of why a character
/// reads as alive rather than mechanical. The whole ladder lives in data
/// (`behavior.json.channelDelays`) rather than hard-coded here, and an exact
/// channel key takes precedence over a bare node key so one channel of a node can
/// be singled out for its own timing.
public func channelDelay(_ config: CharacterConfig, _ channel: String) -> Double {
    let table = config.behavior.channelDelays
    // Exact channel wins over the node, so `body.ink` can lag while `body.rotation`
    // does not. Anything unlisted is 0 — the eyes lead, and they lead by default.
    if let exact = table[channel] { return exact }
    return table[nodeOf(channel)] ?? 0
}

public func applyPose(_ ctx: AnimContext, _ mood: String, now: Double) throws -> PoseResult {
    guard let pose = ctx.config.poses.poses[mood] else {
        throw AnimError("unknown mood: \(mood)")
    }

    // Duration and ease are per-pose and REQUIRED (Task 29) — a snappy `startled`
    // and a slow `sad` are the character, so there is no global to fall back to.

    // Channels the spin re-times, and the timing each inherits.
    //
    // A node has ONE transform matrix, so a scale or an offset stated alongside a
    // whirl is not a second animation running beside it — it is the same
    // animation, and it moves at the whirl's pace. Without this, a spinning pose
    // reaches its scale in the pose's own duration while the spin is still a
    // third of the way round, and the body is visibly too big for most of the
    // transition — 14% too big on a spinning pose with a long carry, for the
    // whole 0.9 s.
    //
    // Naming the channels in data rather than inferring them keeps the rule
    // anatomy-agnostic: nothing here has to know that a scale and a rotation
    // happen to share a matrix in SVG.
    var carried: [String: (duration: Double, ease: String)] = [:]
    if let spin = pose.spin, let names = spin.carries {
        for name in names {
            for concrete in ctx.config.expand(name) {
                carried[concrete] = (spin.duration, spin.ease)
            }
        }
    }

    // `keys.sorted()`, never a bare `for (k, v) in`: a Dictionary's order is
    // seeded per process, so an unsorted walk here is a golden that only
    // reproduces within one launch (Task 28, rule 5).
    for channel in pose.channels.keys.sorted() {
        let target = pose.channels[channel]!
        for concrete in ctx.config.expand(channel) {
            let rides = carried[concrete]
            ctx.tweens.add(TweenSpec(channel: concrete,
                                     to: target,
                                     duration: rides?.duration ?? pose.duration,
                                     delay: channelDelay(ctx.config, concrete),
                                     ease: rides?.ease ?? pose.ease), now: now)
        }
    }

    guard let spin = pose.spin else { return PoseResult() }

    // A whole number of turns, then normalised back, so repeated spins never
    // accumulate into an ever-growing rotation the goldens would drift on.
    //
    // `applyPose` does NOT schedule the normalisation itself. A second tween on the
    // same channel would immediately cancel the spin (newest wins), so the reset is
    // reported to the caller and Task 32's engine hands it to the scheduler as a
    // one-shot. Keeping the one-tween-per-channel rule absolute is worth more than
    // saving a return value.
    //
    // The spin runs from the pose's OWN target for that channel, not from wherever
    // the channel is right now, so a pose that also rotates lands on its rotation
    // plus the turns. Starting from the live value would make a second spin during
    // the first one land somewhere the goldens could not predict.
    //
    // Note what this `add` does to the pose's own tween on the same channel: it
    // cancels it, so the posed value never reaches the channel at all. It exists
    // purely as the arithmetic origin on the next line.
    //
    // There is deliberately no `expand` call here: the loader rejects a group as
    // `spin.channel`, so this name is always concrete. Do not "fix" it by fanning
    // out — `resetAt` is one normalisation and cannot become a list.
    let from = pose.channels[spin.channel]?.number
        ?? ctx.channels.get(spin.channel)?.number
        ?? 0
    let end = from + spin.turns * 360
    ctx.tweens.add(TweenSpec(channel: spin.channel,
                             to: .number(end),
                             duration: spin.duration,
                             ease: spin.ease), now: now)

    let wrapped = (end.truncatingRemainder(dividingBy: 360) + 360)
        .truncatingRemainder(dividingBy: 360)
    return PoseResult(resetAt: PoseReset(at: now + spin.duration,
                                         channel: spin.channel,
                                         value: wrapped > 180 ? wrapped - 360 : wrapped))
}
