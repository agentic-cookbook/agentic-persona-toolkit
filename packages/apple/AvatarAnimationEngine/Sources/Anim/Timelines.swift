import Foundation

public struct TimelineHandle {
    public let name: String
    public let startedAt: Double
    public let endsAt: Double
    private let ids: [Int]
    private let scheduler: Scheduler
    private let channels: Channels
    private let tweens: Tweens
    private let config: CharacterConfig
    /// What each concrete `.shape` channel held immediately BEFORE a promote
    /// step rewrote it, keyed by the node whose family that step snapped.
    ///
    /// A reference type, and it has to be: the recording happens inside the
    /// scheduler closures, which run long after this struct was handed back,
    /// and a struct's copy would leave every one of them writing into a value
    /// `cancel` never sees. The TypeScript twin closes over a `Map` for the
    /// same reason (`timeline.ts`).
    private let promoted: PromotedShapes
    /// Every node a step of this timeline snaps into a different shape family,
    /// gathered at construction time regardless of whether that step has fired
    /// yet. `cancel` needs this list because a family channel is engine-managed
    /// state that outlives the timeline's own bookkeeping — see `cancel` below.
    private let snapped: [String]

    init(name: String, startedAt: Double, endsAt: Double, ids: [Int], scheduler: Scheduler,
         channels: Channels, tweens: Tweens, config: CharacterConfig, snapped: [String],
         promoted: PromotedShapes) {
        self.name = name
        self.startedAt = startedAt
        self.endsAt = endsAt
        self.ids = ids
        self.scheduler = scheduler
        self.channels = channels
        self.tweens = tweens
        self.config = config
        self.snapped = snapped
        self.promoted = promoted
    }

    /// Drop every pending one-shot, then hand each family this timeline snapped
    /// back to what the rig declares.
    ///
    /// A family channel is not an ordinary channel: it is engine-managed state
    /// that names which shape the sibling `.shape` tween is allowed to land on,
    /// and nothing else in the engine ever repaints it once a timeline has moved
    /// it. Cancelling mid-flight (say, right after the opening snap of a morph
    /// but before the closing one) would otherwise strand that node claiming a
    /// family the rig never declared for its rest pose — a claim nothing else
    /// undoes, because the next pose or timeline may not touch that channel at
    /// all. Restoring the declared family on cancel is what keeps "cancelled"
    /// mean the same thing as "never played" for every node this timeline
    /// touched, matching the TypeScript exactly (`timeline.ts`'s `cancel`).
    ///
    /// Restoring the family alone is only half a restore, and the other half is
    /// what this used to get wrong. A promote does not merely rename the family
    /// a shape belongs to — it REWRITES the shape, from the polyline the rig
    /// declares into the all-cubic path of the family the timeline is crossing
    /// into. Hand the family back without handing the shape back and the node
    /// holds an `MCCCC` path while its family channel says `mouth`, a pair no
    /// pose, no rig and no other timeline ever produces. The next promote out of
    /// that node then reads the cubic it left behind and `promotePolyline`
    /// refuses it — in Swift a trap, on the web a throw out of `engine.tick`.
    ///
    /// `onDone` can never fire after a cancel — its completion is a scheduled
    /// one-shot like any other step, so it is dropped with them.
    public func cancel() {
        for id in ids { scheduler.cancel(id) }
        // Sorted, not the bare array-insertion order the builder below already
        // produces uniqued-but-unsorted: two steps of the same timeline can name
        // the same node, and de-duplication happens through a `Set` at
        // construction time, whose own iteration order is not what feeds this
        // array (see `playTimeline`) — sorting here is what keeps the write
        // order deterministic regardless of how that set later changes shape.
        for node in snapped.sorted() {
            guard let declared = config.families[node] else { continue }
            // The family channel is the flag. While it still names a family this
            // timeline snapped it into, the crossing is standing and this handle
            // owes both halves of the restore. Once the timeline's own closing
            // snap has put it back — the yawn does that at `at: 1.85`, a quarter
            // second before it ends — the crossing is already undone and a
            // cancel arriving afterwards must touch nothing: the arbiter cancels
            // every choreo handle on the next mood change whether it ran to
            // completion or not, and a restore there would drag the shape back
            // to the one the timeline deliberately animated away from.
            if channels.get("\(node).family") == .text(declared) { continue }
            channels.set("\(node).family", .text(declared))
            guard let held = promoted.byNode[node] else { continue }
            for concrete in held.keys.sorted() {
                // `tweens.cancel` first, then a raw write. The tween the promote
                // step added — or whichever later step of this timeline
                // superseded it — is still live, and `tweens.tick` runs after
                // `scheduler.tick` on this very frame, so a write with the tween
                // left standing is overwritten before anything sees it.
                // `freezeLoop` in `Reflexes.swift` takes a channel off an
                // animation the same way and for the same reason.
                tweens.cancel(concrete)
                channels.set(concrete, .text(held[concrete]!))
            }
        }
    }
}

/// The pre-promote content of every `.shape` channel a running timeline has
/// rewritten, so `TimelineHandle.cancel` can hand it back. See the field on the
/// handle for why this is a class and not a dictionary.
final class PromotedShapes {
    private(set) var byNode: [String: [String: String]] = [:]

    /// Records only the FIRST promote of a run on a given channel: that is the
    /// one that took the channel out of its declared family, so it is the one to
    /// undo. Later steps of the same timeline write over a shape that is already
    /// across the crossing.
    func record(node: String, channel: String, held: String) {
        if byNode[node]?[channel] == nil { byNode[node, default: [:]][channel] = held }
    }
}

/// The promoted form of `held`, or `nil` if it has none.
///
/// Split out so that the ONE place a promote can fail on live channel content is
/// named, rather than a pair of `try?`s buried in the middle of a loop — and so
/// it reads as the deliberate refusal it is next to the `try!` it replaces. The
/// TypeScript twin has the same function under the same name (`timeline.ts`).
private func tryPromote(_ held: String, _ segments: Int) -> String? {
    guard let parsed = try? parsePath(held),
          let promoted = try? promotePolyline(parsed, segments: segments) else { return nil }
    return emitPath(promoted)
}

/// Re-express an open polyline as an all-cubic path of `segments` segments,
/// drawing the identical ink. The ONLY representation change the engine
/// performs: a straight segment IS the cubic whose controls sit at the 1/3
/// and 2/3 points of its chord, so the rewrite is exact and has no free
/// choices. `segments` must be a whole multiple of the polyline's own line
/// count — Task 29's promotion check already guarantees that for every
/// authored `promote` step. `playTimeline` still goes through `tryPromote`
/// rather than `try!`, because what a promote step actually reads at fire time
/// is live channel content, which no static check covers.
func promotePolyline(_ p: ParsedPath, segments: Int) throws -> ParsedPath {
    guard p.kind.hasPrefix("M"), p.kind.count > 1,
          p.kind.dropFirst().allSatisfy({ $0 == "L" }) else {
        throw AnimError("can only promote an open polyline, not \"\(p.kind)\"")
    }
    let lines = p.kind.count - 1
    guard segments >= lines, segments % lines == 0 else {
        throw AnimError(
            "cannot promote \(lines) line(s) into \(segments) segment(s): not a whole multiple")
    }
    let per = Double(segments / lines)
    var points: [Double] = [p.points[0], p.points[1]]
    for i in 0..<lines {
        let ax = p.points[i * 2], ay = p.points[i * 2 + 1]
        let bx = p.points[i * 2 + 2], by = p.points[i * 2 + 3]
        for s in 0..<(segments / lines) {
            // The sub-segment's own ends, then its controls at a third and two
            // thirds of it. Both ends are computed against the WHOLE line
            // rather than by walking, so the last one lands on `b` exactly and
            // the anchors two platforms compute cannot drift apart along the
            // run.
            let sD = Double(s)
            let x0 = ax + (bx - ax) * sD / per, y0 = ay + (by - ay) * sD / per
            let x1 = ax + (bx - ax) * (sD + 1) / per, y1 = ay + (by - ay) * (sD + 1) / per
            points.append(contentsOf: [
                x0 + (x1 - x0) / 3, y0 + (y1 - y0) / 3,
                x0 + 2 * (x1 - x0) / 3, y0 + 2 * (y1 - y0) / 3,
                x1, y1,
            ])
        }
    }
    return ParsedPath(kind: "M" + String(repeating: "C", count: segments), points: points)
}

/// Expand a declarative timeline into scheduled tweens.
///
/// Each step is scheduled as a one-shot at `startedAt + step.at`, which then adds
/// the tween. Scheduling the tween at its own moment (rather than adding every
/// tween up front with a long delay) is what lets a step read the channel's value
/// as it actually is when the step fires — the yawn's return-to-rest steps depend
/// on that — and it is also what makes cancellation clean: an unfired one-shot is
/// simply removed.
///
/// Timelines deliberately do NOT apply the pose delay ladder. A timeline author
/// has already placed every step in time; adding 40-80ms of stagger on top would
/// smear the yawn's phases — and it would do worse than that, because a delayed
/// `duration: 0` snap stops qualifying for rule 4, so the morph that supersedes
/// it is handed a family it cannot cross and `lerpValue` snaps it: the shape
/// pops instead of animating, with nothing thrown to say so.
public func playTimeline(_ ctx: AnimContext, _ name: String, now: Double,
                         onDone: (() -> Void)? = nil) throws -> TimelineHandle {
    guard let timeline = ctx.config.timelines.timelines[name] else {
        throw AnimError("unknown timeline: \(name)")
    }

    // Captured as locals rather than as `ctx`. `AnimContext` is a struct, so each
    // closure would otherwise carry its own copy of four references — harmless
    // today, and exactly the thing that stops being harmless the first time the
    // context grows a mutable field.
    let config = ctx.config
    let channels = ctx.channels
    let tweens = ctx.tweens
    var ids: [Int] = []
    // The nodes this timeline snaps into a different shape family, gathered at
    // construction time — the same set the TypeScript builds via a `Set` while
    // walking `timeline.steps` (`timeline.ts`). Built as an array with manual
    // de-duplication, not a `Set<String>`, because a `Set`'s own iteration order
    // is seeded per process and `cancel` above sorts before writing anyway, but
    // starting from something already order-stable keeps this file's one Swift
    // collection choice honest with the rest of the package's rule against
    // reading an unordered collection's raw order.
    var snapped: [String] = []
    var snappedSeen: Set<String> = []
    let promoted = PromotedShapes()

    // Authored order, front to back. Scheduler ids are monotonic and `tick`
    // iterates them sorted, so insertion order IS firing order among events that
    // come due in the same tick — which is what puts a family snap ahead of the
    // morph authored at the same instant.
    for s in timeline.steps {
        if s.family != nil {
            let node = nodeOf(s.channel)
            if snappedSeen.insert(node).inserted { snapped.append(node) }
        }
        ids.append(ctx.scheduler.once(at: now + s.at) { fired in
            // `family` on a step is a SNAP into a different shape family, and the
            // loader has already guaranteed `duration == 0` for it. The channel is
            // engine-managed — this is the ONLY place it is ever written after the
            // rest seed — and it is written before the tween so anything reading
            // the pair within this frame sees the family the new path belongs to.
            if let family = s.family {
                channels.set("\(nodeOf(s.channel)).family", .text(family))
            }
            for concrete in config.expand(s.channel) {
                // A promote is still an ordinary snap — it just works out its
                // own target instead of being told one. It has to run here, at
                // fire time, for the same reason the step is expressed this
                // way at all: what the channel holds depends on the mood the
                // timeline interrupted, and the whole point is to cross
                // families out of THAT shape rather than a guess at it.
                var to = s.to
                if let segments = s.promote {
                    // A promote that cannot be performed leaves the channel
                    // EXACTLY where it is — no tween, no write, nothing thrown
                    // and nothing trapped. The same answer, and for the same
                    // reason, as the family crossing `Tweens.swift` snaps rather
                    // than morphs: every promote an author can write is checked
                    // statically by the loader, so a refusal reaching here is one
                    // nobody authored — a channel already sitting in the promoted
                    // family because a previous play of this timeline is still
                    // standing. Trapping would be a worse answer than doing
                    // nothing, and it is the only other one available: this
                    // closure is the scheduler's `(Double) -> Void`, which cannot
                    // throw, so `try!` here took the host process down for a
                    // state the engine can simply decline to act on.
                    guard case .text(let held)? = channels.get(concrete) else { continue }
                    guard let target = tryPromote(held, segments) else { continue }
                    promoted.record(node: nodeOf(s.channel), channel: concrete, held: held)
                    to = .text(target)
                }
                tweens.add(TweenSpec(channel: concrete,
                                     to: to!,
                                     duration: s.duration,
                                     ease: s.ease), now: fired)
            }
        })
    }

    let endsAt = now + timeline.duration
    if let onDone {
        ids.append(ctx.scheduler.once(at: endsAt) { _ in onDone() })
    }

    return TimelineHandle(name: name, startedAt: now, endsAt: endsAt,
                          ids: ids, scheduler: ctx.scheduler,
                          channels: channels, tweens: tweens, config: config,
                          snapped: snapped, promoted: promoted)
}
