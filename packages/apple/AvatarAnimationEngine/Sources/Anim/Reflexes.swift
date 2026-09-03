import Foundation

/// `TweenSpec.init`'s own ease default, spelled out because an optional that is
/// nil cannot ask for a Swift default argument. Internal rather than private so
/// `ReflexesTests` can prove the two have not drifted apart.
let DEFAULT_EASE = "power3.out"

/// One PRNG draw from a `[lo, hi]` config pair, whatever arity the pair has.
///
/// Six sites in this file read a config array as a pair — `reachIdle`,
/// `durationRange` twice, `rearm.gapMs`, `rearmMs`, `firstDelayMs` — and every
/// one of them used to index `[0]` and `[1]` directly. Nothing between the JSON
/// and here guarantees two elements: `Loader.swift` arity-checks no pair field
/// and `schema.json` puts no `minItems`/`maxItems` on any of them, so
/// `"rearmMs": [4000]` loads clean, passes every config test, and then traps
/// with `Index out of range` minutes into a session, on whichever branch
/// happens to be taken first — a crash arbitrarily far from the config that
/// caused it. The TypeScript twin does not trap: it computes
/// `range(4000, undefined)`, gets `NaN`, and schedules an event that can never
/// come due, so the same config silently deletes the behaviour there instead.
/// Two different wrong answers to one bad pair.
///
/// This is the second line of defence, not the first — the loader is where a
/// bad pair should be named and refused, and this file cannot reach the loader.
/// What it can do is make the two engines fail the SAME way: a pair short of an
/// element degrades to the degenerate range built from what is actually there
/// (`[4000]` reads as 4000...4000, `[]` as 0...0), and the draw still happens,
/// so the PRNG stream stays in step across the two platforms and across the
/// good and bad configs alike. Anything the pair does not say is missing
/// behaviour, never a trap and never a `NaN`.
func pairRange(_ prng: Prng, _ pair: [Double]) -> Double {
    let lo = pair.first ?? 0
    let hi = pair.count > 1 ? pair[1] : lo
    return prng.range(lo, hi)
}

public struct ReflexDeps {
    public var ctx: AnimContext
    public var prng: Prng
    public var mood: () -> String
    public var reducedMotion: () -> Bool
    public var mutter: (Double) -> Void

    public init(ctx: AnimContext, prng: Prng,
                mood: @escaping () -> String,
                reducedMotion: @escaping () -> Bool,
                mutter: @escaping (Double) -> Void) {
        self.ctx = ctx
        self.prng = prng
        self.mood = mood
        self.reducedMotion = reducedMotion
        self.mutter = mutter
    }
}

public final class Reflexes {
    private let ctx: AnimContext
    /// `let`, because `Prng` is a class: this is the engine's ONE stream, shared
    /// with `randomSaying`, not a private copy of it.
    private let prng: Prng
    private let moodOf: () -> String
    private let reducedMotion: () -> Bool
    private let mutter: (Double) -> Void

    private let b: BehaviorFile
    private let poll: Double

    /// Every one-shot this class schedules, so `stop` can cancel it.
    private var pending: Set<Int> = []

    private var running: [String: Bool] = [:]
    private var signs: [String: Double] = [:]

    /// The generation each loop's chain is currently on.
    ///
    /// A loop's chain schedules its own next cycle through `at`, which hands
    /// back no scheduler id, so `stopLoop` cannot cancel that pending event.
    /// Before Ruling 39 it never had to: a loop only ever stopped from INSIDE
    /// its chain, so the stop and the chain's death were the same instant. The
    /// poll can now stop a loop between two of its own ticks, and if the gate
    /// reopens before that orphaned event fires, the poll has already armed a
    /// fresh chain — the orphan then arms a SECOND one and the loop oscillates
    /// on two chains at a fractional offset, forever, each cancelling the
    /// other mid-stroke. Reachable whenever a loop's period exceeds `pollMs`:
    /// the sways are 0.97 s with their delay against a 400 ms poll, and 0.97
    /// and 0.4 share no useful factor, so the two cadences drift into that
    /// window on their own.
    ///
    /// The generation is what lets a pending event ask whether the chain that
    /// scheduled it is still the current one. Every arm mints one; every stop
    /// invalidates whatever is outstanding.
    private var gen: [String: Int] = [:]

    private var target: (x: Double, y: Double) = (0, 0)
    private var pointerAt = -Double.infinity

    private var fidgetRunning = false
    private var breathRunning = false
    private var breathUp = false

    private var activeEffect: String?
    private var touched: Set<String> = []
    /// The stir chain's generation, the same device `gen` is for the ambient
    /// loops and for exactly the same reason: `stir` re-arms itself, so every
    /// `startEffect` that did not first orphan the outstanding event left a
    /// SECOND self-perpetuating chain running beside the first. A mood round
    /// trip is all it takes, and the chains never merge — three round trips left
    /// four of them, each drawing its own PRNG and stacking its own tweens on
    /// the same channels. `activeEffect` cannot stand in for this: it is a
    /// single mood name, so both chains read it and both find themselves live.
    private var effectGen = 0

    private var pinpricksShown: Bool?

    private var lastMood: String?
    private var lastReduced = false
    private var pollId: Int?

    public init(_ deps: ReflexDeps) {
        ctx = deps.ctx
        prng = deps.prng
        moodOf = deps.mood
        reducedMotion = deps.reducedMotion
        mutter = deps.mutter
        b = deps.ctx.config.behavior
        poll = deps.ctx.config.behavior.ladder.pollMs / 1000
    }

    // MARK: - the small helpers everything else is written in

    private var scope: ParamScope {
        ParamScope(mood: moodOf())
    }

    private func rest(_ channel: String) -> Double {
        ctx.config.rest[channel]?.number ?? 0
    }

    private func live(_ channel: String) -> Double {
        ctx.channels.get(channel)?.number ?? rest(channel)
    }

    /// Schedules a one-shot and remembers it, so `stop` can cancel it; a fired
    /// entry removes itself, so the set stays bounded by what is actually
    /// pending. `run` is handed `self` rather than closing over it: the
    /// scheduler holds the closure and `self` holds the scheduler, so a
    /// captured `self` would be a retain cycle per pending event. Resolving it
    /// once here, weakly, also makes an event that fires after teardown a no-op.
    private func at(_ t: Double, _ run: @escaping (Reflexes, Double) -> Void) {
        // `id` is assigned after `once` returns and read from inside the
        // closure. Swift boxes a captured `var`, so the closure sees the
        // assigned value; the closure cannot run before `once` returns.
        var id = 0
        id = ctx.scheduler.once(at: t) { [weak self] fired in
            guard let self else { return }
            self.pending.remove(id)
            run(self, fired)
        }
        pending.insert(id)
    }

    // MARK: - ambient loops

    private func nextGen(_ loop: LoopDef) -> Int {
        let g = (gen[loop.id] ?? 0) + 1
        gen[loop.id] = g
        return g
    }

    private func settleLoop(_ loop: LoopDef, _ when: Double) {
        for channel in ctx.config.expand(loop.channel) {
            ctx.tweens.add(TweenSpec(channel: channel, to: .number(loop.restValue),
                                     duration: loop.restDuration ?? 0,
                                     ease: loop.restEase ?? DEFAULT_EASE), now: when)
        }
    }

    /// Whether a loop should be oscillating at this instant.
    ///
    /// A ZERO AMPLITUDE IS NOT A LOOP THAT SWINGS BY NOTHING — it is a loop
    /// that must not run at all, and the difference is visible. `faceBob`'s
    /// amplitude is the active pose's `bob`, zero for eleven of the fourteen
    /// moods, and `faceWiggle`'s is `wiggle`, zero for nine. A zero-amplitude
    /// loop that keeps re-arming rewrites its channel to `restValue` every
    /// cycle, and by tween rule 1 — newest wins — that write cancels whatever
    /// else is driving the channel. What else drives it is the mood effect on
    /// the same channel: `boredSag` yoyos `face.y` out to 2.5 over 3.5 s while
    /// `faceBob` writes it back to 0 every 0.5 s, so the sag peaks around 0.12
    /// and never completes one cycle. The original had no such conflict because
    /// it never started the loop — `if (bob > 0)` started it, and `else` ran ONE
    /// settle tween and then left `face.y` alone for the sag to own. This
    /// predicate is that `if`.
    ///
    /// `-0.0 != 0.0` is false in Swift and `-0 !== 0` is false in JS, so the
    /// `{ "param": "bob", "scale": -1 }` amplitude reads as zero on both.
    private func loopLive(_ loop: LoopDef, _ s: ParamScope) -> Bool {
        !reducedMotion()
            && amplitude(ctx.config, s, loop.amplitude) != 0
            && gateOpen(ctx.config, s, enabledWhen: loop.enabledWhen,
                        disabledWhen: loop.disabledWhen)
    }

    /// Settle a running loop and take it out of the chain. Idempotent — a loop
    /// already stopped writes nothing, so the poll can call it every tick
    /// without re-settling a channel something else has since taken over.
    private func stopLoop(_ loop: LoopDef, _ when: Double) {
        _ = nextGen(loop) // orphan any pending chain event, running or not
        guard running[loop.id] == true else { return }
        running[loop.id] = false
        settleLoop(loop, when)
    }

    /// Take a loop out of the chain WITHOUT writing its channel.
    ///
    /// `stopLoop` settles, because it is the eyes-shutting case: the original
    /// tweens each antenna back to bend 0 over half a second when the character
    /// falls asleep, and `restValue`/`restDuration`/`restEase` are that tween,
    /// copied. Entering a choreographed mood is a different case with a
    /// different answer. There the original kills the loop tweens outright, and
    /// a killed GSAP tween writes nothing more: the antenna stays at whatever
    /// bend the half cycle had reached and the timeline owns the channel
    /// unchallenged. Settling here would put a half-second sway-to-centre
    /// underneath the yawn that the original never draws.
    ///
    /// Cancelling the channel's tweens is what makes the freeze a freeze rather
    /// than a pause: an in-flight sway tween left running would keep writing.
    private func freezeLoop(_ loop: LoopDef) {
        _ = nextGen(loop) // orphan any pending chain event, running or not
        guard running[loop.id] == true else { return }
        running[loop.id] = false
        for channel in ctx.config.expand(loop.channel) { ctx.tweens.cancel(channel) }
    }

    /// Whether a choreographed mood suppresses this loop outright.
    ///
    /// A CHOREOGRAPHED MOOD RUNS NO AMBIENT LOOP AT ALL. In the original every
    /// ambient loop is created inside `applyPose`, and the pose effect returns
    /// before `applyPose` when the mood has a timeline — so the suppression is
    /// structural and covers every ambient loop uniformly, which is why it is
    /// expressed here and not as a `disabledWhen` each loop opts into one at a
    /// time. Measured on a forced 10s `yawning` take: the original never writes
    /// `antennaLeft.bend` (tip x is 179.000 on all 601 frames) while the port
    /// swung the full calm amplitude, 10.64 units, throughout.
    ///
    /// It is the AMBIENT loops and only those. A mood effect's loop reaches its
    /// channels through its own hook in the original, not through the pose, so
    /// a timeline never suppressed it and neither does this.
    private lazy var ambient: Set<String> = Set(b.loops.map { $0.id })

    private func suppressed(_ loop: LoopDef, _ s: ParamScope) -> Bool {
        ambient.contains(loop.id) && predicate(ctx.config, s, "choreographed")
    }

    private func armLoop(_ loop: LoopDef, _ when: Double) {
        let s = scope
        if suppressed(loop, s) {
            freezeLoop(loop)
            return // the poll re-arms it when the timeline's mood ends
        }
        if !loopLive(loop, s) {
            // The poll re-arms it; nothing idles in a chain it cannot use.
            stopLoop(loop, when)
            return
        }
        // Whether this arm OPENS a chain rather than continuing one.
        //
        // The original states an ambient loop as ONE tween, created the instant
        // the pose lands and left to repeat itself. So everything about that
        // loop which happens once happens here and nowhere else: the phase it
        // begins at, the jump onto that phase, and the loop's start delay. A
        // re-arm is one repeat of that same tween — no delay, no jump, and it
        // picks up the phase the previous half cycle left.
        let opening = running[loop.id] != true
        running[loop.id] = true
        // A REOPENED chain begins at the phase the config names, never at
        // whichever extreme the last one happened to stop on. Reopening is a
        // pose landing, and the original's pose apply always re-states the same
        // starting side.
        let sign = (opening ? nil : signs[loop.id])
            ?? (loop.phase == "negativeFirst" ? -1 : 1)
        let amp = amplitude(ctx.config, s, loop.amplitude)
        let duration = amplitude(ctx.config, s, loop.duration)
        // A symmetric yoyo swings BETWEEN two extremes, so it has to be standing
        // on one of them before the swing starts. The original puts it there
        // with an instantaneous set and only then runs the tween across to the
        // far side, so `phase` names the side it stands on and the stroke this
        // arm plays runs to the other one. Easing out of rest instead leaves the
        // port half a cycle behind for as long as the pose lasts, and on the
        // pose's very first frame it sits at zero where the original sits at
        // full amplitude — around five degrees of whole-face rotation on
        // `silly`, and the antennae start bent the wrong way in every mood.
        //
        // `zeroTo` has no such jump and must not be given one: its rest value IS
        // one of its two ends, so the original starts it exactly where the
        // channel already is — `faceBob` runs to `-bob` with no set of any kind
        // first.
        let swings = loop.mode == "symmetric" && loop.yoyo == true
        let to = loop.mode == "symmetric"
            ? (swings ? -sign : sign) * amp
            : (sign > 0 ? amp : loop.restValue)
        // The delay positions the loop's START. It is not a gap between repeats
        // — charging it every half cycle stretches the antenna sway's period by
        // its own 0.12 s and puts the two implementations permanently out of
        // step.
        let delay = opening ? (loop.delay ?? 0) : 0
        for channel in ctx.config.expand(loop.channel) {
            if swings && opening {
                ctx.tweens.add(TweenSpec(channel: channel, to: .number(sign * amp),
                                         duration: 0), now: when)
            }
            ctx.tweens.add(TweenSpec(
                channel: channel, to: .number(to), duration: duration,
                delay: delay, ease: loop.ease,
                // A non-yoyo loop replays the same stroke each cycle, so it
                // starts from rest rather than from wherever the last one ended.
                from: loop.yoyo == true ? nil : .number(loop.restValue)), now: when)
        }
        signs[loop.id] = loop.yoyo == true ? -sign : sign
        let g = nextGen(loop)
        at(when + delay + duration) { me, t in
            if me.gen[loop.id] == g { me.armLoop(loop, t) }
        }
    }

    // MARK: - blink

    /// Arms every lid. The original runs a separate `useBlink` hook per eye
    /// (`$GSAP/src/engine.ts:106-107`), so the lids are never in step;
    /// expanding inside `blink` instead -- as this did -- shuts them on the
    /// same frame with the same tween, which reads as a graphic rather than a
    /// face. `expand` returns `[channel]` for a name it does not know, so a
    /// one-eyed character gets exactly one chain from the same code.
    private func armBlink(_ when: Double) {
        for channel in ctx.config.expand(b.blink.channel) { armLid(when, channel) }
    }

    /// One lid's self-perpetuating chain. The gap is drawn off the engine's one
    /// shared `Prng` in `expand`'s declared order, which is what keeps the
    /// recorded goldens reproducible.
    private func armLid(_ when: Double, _ channel: String) {
        at(when + prng.range(b.blink.minMs, b.blink.maxMs) / 1000) { me, t in
            me.blink(t, channel)
        }
    }

    private func blink(_ when: Double, _ channel: String) {
        if !b.blink.suppressedIn.contains(moodOf()) {
            // Captured before the close, so the eye reopens to whatever the
            // pose asked for rather than to the rig's rest.
            let open = live(channel)
            ctx.tweens.add(TweenSpec(channel: channel, to: .number(b.blink.shut),
                                     duration: b.blink.tweenDuration,
                                     ease: b.blink.ease), now: when)
            at(when + b.blink.durationMs / 1000) { me, t in
                me.ctx.tweens.add(TweenSpec(channel: channel, to: .number(open),
                                            duration: me.b.blink.tweenDuration,
                                            ease: me.b.blink.ease), now: t)
            }
        }
        armLid(when, channel)
    }

    // MARK: - gaze

    /// Asleep is dead still: no tracking, no tilt, no lean, and no saccade.
    private func gazeShut() -> Bool {
        guard let name = b.gaze.disabledWhen else { return false }
        return predicate(ctx.config, scope, name)
    }

    /// Where the irises point. Dispatched on the channel's suffix, never on its
    /// index: the look channels are eyes x axes, and an index would silently
    /// swap them the day a third eye or a different order appears in the rig.
    private func lookAt(_ when: Double, _ tx: Double, _ ty: Double) {
        let g = b.gaze
        for channel in g.look.allChannels {
            let value = (channel.hasSuffix(".y") ? ty : tx) * g.gazeMax
            ctx.tweens.add(TweenSpec(channel: channel, to: .number(value),
                                     duration: g.look.duration,
                                     ease: g.look.ease), now: when)
        }
    }

    /// The head's own layer, in degrees — already signed by the caller.
    private func tiltTo(_ when: Double, _ deg: Double) {
        let g = b.gaze
        for channel in g.tilt.allChannels {
            ctx.tweens.add(TweenSpec(channel: channel, to: .number(deg),
                                     duration: g.tilt.duration,
                                     ease: g.tilt.ease), now: when)
        }
    }

    /// The whole glyph's drift, in normalised units the caller has clamped.
    private func leanTo(_ when: Double, _ nx: Double, _ ny: Double) {
        let g = b.gaze
        for channel in g.lean.allChannels {
            let value = (channel.hasSuffix(".y") ? ny : nx) * g.leanMax
            ctx.tweens.add(TweenSpec(channel: channel, to: .number(value),
                                     duration: g.lean.duration,
                                     ease: g.lean.ease), now: when)
        }
    }

    /// Eyes, head and glyph all aimed at the current target — what a POINTER
    /// (or a deliberate gaze) does. A wander is deliberately not this.
    private func applyGaze(_ when: Double) {
        guard !gazeShut() else { return }
        let (tx, ty) = target
        lookAt(when, tx, ty)
        // NEGATED, and the sign is the whole point: the head leans INTO whatever
        // it is watching, not away from it. The original web implementation
        // spells it `-x * tiltMax` at both of its call sites, and `tiltMax` stays
        // positive in the config so the field keeps reading as a magnitude rather
        // than smuggling a direction into one named "max". Flip this and the
        // character mirrors — the exact class of difference this port exists to
        // not have.
        tiltTo(when, -tx * b.gaze.tiltMax)
        leanTo(when, tx, ty)
    }

    private func wander(_ when: Double) {
        let g = b.gaze
        if !gazeShut() && when - pointerAt >= g.wanderAfterMs / 1000 {
            // The head LEVELS and the glyph re-centres before the eyes pick
            // their own target. A wander is the irises drifting so the face
            // never stares blankly — it is not the head turning to watch
            // something, because by definition there is nothing to watch: the
            // pointer has been still for `wanderAfterMs`. Aiming the head at a
            // wander target instead (as `applyGaze` does) rotates the ENTIRE
            // rig by up to `tiltMax` degrees, on nothing, for as long as the
            // mood lasts — every node in a recorded frame shifted by one
            // common angle, with no matching motion anywhere in the original.
            tiltTo(when, 0)
            leanTo(when, 0, 0)
            let curious = predicate(ctx.config, scope, "curious")
            if prng.chance(curious ? g.centreChanceCurious : g.centreChanceIdle) {
                target = (0, 0)
            } else {
                let reach = curious ? g.reachCurious : g.reachIdle
                let angle = prng.range(0, Double.pi * 2)
                let r = pairRange(prng, reach)
                target = (cos(angle) * r, sin(angle) * r)
            }
            lookAt(when, target.x, target.y)
        }
        at(when + prng.range(g.wanderMinMs, g.wanderMaxMs) / 1000) { me, t in me.wander(t) }
    }

    // MARK: - idle fidget and breath

    private func fidgetActive() -> Bool {
        !reducedMotion() && predicate(ctx.config, scope, b.idleFidget.activeWhen)
    }

    /// channel -> the +/- magnitude it jitters by, and whether a pose owns it
    /// too. An ARRAY in the config's own order, not a dictionary: one PRNG
    /// value is drawn per entry, so the order is part of the determinism
    /// contract.
    ///
    /// The sway lives on a layer no pose writes, so the fidget is the only
    /// thing that can put it back. The brows are ordinary pose channels the
    /// fidget only BORROWS while curious, and that is how the original hands
    /// them over when a mood arrives: it settles its own layer to neutral and
    /// lets the pose reset the brows. A settle that fired after the mood
    /// landed would drag that mood's brows back to the idle ones half a second
    /// in.
    private func fidgetTargets() -> [(channel: String, amp: Double, poseOwned: Bool)] {
        let f = b.idleFidget
        var out = ctx.config.expand(f.sway.channel).map { ($0, f.sway.amplitude, false) }
        for node in f.brow.nodes {
            out.append(("\(node).rotation", f.brow.rotationAmplitude, true))
            out.append(("\(node).y", f.brow.yAmplitude, true))
        }
        return out
    }

    private func fidget(_ when: Double) {
        let f = b.idleFidget
        guard fidgetActive() else {
            fidgetRunning = false
            // Every fidget settles itself, so there is nothing to unwind.
            return
        }
        fidgetRunning = true
        let duration = pairRange(prng, f.durationRange)
        for (channel, amp, poseOwned) in fidgetTargets() {
            let base = live(channel)
            let to = base + prng.signed(amp)
            ctx.tweens.add(TweenSpec(channel: channel, to: .number(to),
                                     duration: duration, ease: f.ease), now: when)
            at(when + duration) { me, t in
                // The mood can change while a fidget is in flight. `base` is
                // the idle value this jitter started from, so once the fidget
                // is no longer active a pose-owned channel must be left where
                // the new pose put it.
                if poseOwned && !me.fidgetActive() { return }
                me.ctx.tweens.add(TweenSpec(channel: channel, to: .number(base),
                                            duration: f.settle.duration,
                                            ease: f.settle.ease), now: t)
            }
        }
        let gap = pairRange(prng, f.rearm.gapMs) + prng.signed(f.rearm.jitterMs)
        at(when + duration + gap / 1000) { me, t in me.fidget(t) }
    }

    private func breathe(_ when: Double) {
        let br = b.idleFidget.breath
        guard fidgetActive() else {
            breathRunning = false
            for channel in ctx.config.expand(br.channel) {
                ctx.tweens.add(TweenSpec(channel: channel, to: .number(br.from),
                                         duration: b.idleFidget.settle.duration,
                                         ease: b.idleFidget.settle.ease), now: when)
            }
            return
        }
        breathRunning = true
        breathUp = br.yoyo ? !breathUp : true
        for channel in ctx.config.expand(br.channel) {
            ctx.tweens.add(TweenSpec(channel: channel,
                                     to: .number(breathUp ? br.to : br.from),
                                     duration: br.duration, ease: br.ease), now: when)
        }
        at(when + br.duration) { me, t in me.breathe(t) }
    }

    // MARK: - mood effects

    /// An effect's loop is a `LoopDef` in everything but its `id`, which the
    /// effect supplies, and its `restValue`, which defaults to the rig's rest.
    /// Written out field by field rather than spread, so a field added to
    /// `LoopDef` and forgotten here is a compile error rather than a silent zero.
    private func effectLoop(_ def: EffectDef) -> LoopDef {
        let l = def.loop!
        return LoopDef(id: def.id, channel: l.channel, mode: l.mode,
                       amplitude: l.amplitude, duration: l.duration, ease: l.ease,
                       yoyo: l.yoyo, delay: l.delay, phase: l.phase,
                       restValue: l.restValue ?? 0, restDuration: l.restDuration,
                       restEase: l.restEase, enabledWhen: l.enabledWhen,
                       disabledWhen: l.disabledWhen)
    }

    private func playSteps(_ steps: [EffectStep], _ i: Int, _ when: Double,
                           _ done: @escaping (Reflexes, Double) -> Void) {
        guard i < steps.count else {
            done(self, when)
            return
        }
        let step = steps[i]
        let duration = step.duration ?? step.durationRange.map { pairRange(prng, $0) } ?? 0
        // SORTED, and the PRNG is why: an `{"rnd": n}` channel draws one value
        // per channel in walk order, so this order IS part of the determinism
        // contract. JS walks the object in the JSON's key order; a Swift
        // `Dictionary` walks it in a per-process random one. The web sorts here
        // too (Plan A Task 16), and channel names are ASCII, so a code-unit sort
        // and `sorted()` agree.
        for channel in step.channels.keys.sorted() {
            let to: Double
            switch step.channels[channel]! {
            case .number(let value): to = value
            case .rnd(let r): to = prng.range(-r, r)
            }
            // EXPANDED, exactly as `settleLoop` and `armLoop` expand theirs. The
            // loader's `requireChannel` accepts a group name here — it is the
            // same check a loop's channel goes through, and a loop's channel is
            // routinely a group — so `"channel": "eyes.scale"` on an effect step
            // validates cleanly. Writing the raw name instead put the tween on a
            // channel nothing renders: the step was silently dead in both
            // directions, and `stopEffect` then settled that phantom to rest
            // while the two eyes it was supposed to move never learned of it.
            //
            // The draw happens ONCE, above, and every member of the group shares
            // its value — the same shape as `armLoop`, which computes one
            // amplitude and one duration and hands them to every expanded
            // channel. Drawing per member instead would make the number of PRNG
            // values consumed depend on how many members the rig's group happens
            // to have, which is not something the determinism contract can say.
            for concrete in ctx.config.expand(channel) {
                touched.insert(concrete)
                ctx.tweens.add(TweenSpec(channel: concrete, to: .number(to),
                                         duration: duration, ease: step.ease), now: when)
            }
        }
        // Sequential, not delayed: one tween per channel and newest wins, so two
        // steps touching the same channel must be separated by the scheduler.
        at(when + duration) { me, t in me.playSteps(steps, i + 1, t, done) }
    }

    /// The step list a branch key names, or `nil` when this effect defines none
    /// under that name.
    ///
    /// Total, and that is the whole point. The expression this replaces —
    /// `key == "drift" ? def.drift : def.twitch` — answered two different
    /// questions with one ternary and got both wrong. It mapped EVERY key that
    /// was not `"drift"` onto `twitch`, so `"branch": { "then": "twich" }`
    /// played the drift list's opposite rather than saying anything; and paired
    /// with `?? []` at the call site it made an ABSENT list indistinguishable
    /// from an authored empty one. `Loader.swift` validates only that a branch
    /// key spells `"twitch"` or `"drift"`, never that the list it names exists,
    /// so deleting olylo's `drift` block loads clean and then produces silence
    /// on roughly 40% of stirs — half the authored behaviour gone, with nothing
    /// anywhere saying so.
    private func stepList(_ def: EffectDef, _ key: String) -> [EffectStep]? {
        switch key {
        case "twitch": return def.twitch
        case "drift": return def.drift
        default: return nil
        }
    }

    /// Checked on the way in AND again at the re-arm, like `armLoop`: a chain
    /// can be orphaned at any point, including in the middle of the `playSteps`
    /// walk it is already inside.
    private func stir(_ when: Double, _ g: Int) {
        guard g == effectGen, let active = activeEffect,
              let def = b.moodEffects[active] else { return }
        let key = def.branch.map { prng.chance($0.probability) ? $0.then : $0.else } ?? "twitch"
        // A branch naming a list this effect does not define ENDS the chain, and
        // the difference from `?? []` is the re-arm. `?? []` played nothing and
        // then armed the next stir anyway, so the chain went on drawing a branch
        // value and a re-arm gap forever for a behaviour that could never
        // happen: an intermittent silence that also walks the shared PRNG
        // stream out of step with every golden, which is the worst of the
        // available failures because it is invisible in both directions.
        // Stopping is visible — the effect goes quiet outright, at once, the
        // first time the bad branch is drawn — and it consumes nothing further.
        //
        // An authored EMPTY list is a different thing and keeps its old
        // behaviour: `stepList` hands back `[]`, `playSteps` completes
        // immediately, and the chain re-arms. Absent and empty were the two
        // cases `?? []` collapsed together.
        guard let steps = stepList(def, key) else { return }
        playSteps(steps, 0, when) { me, t in
            guard g == me.effectGen, let rearm = def.rearmMs else { return }
            me.at(t + pairRange(me.prng, rearm) / 1000) { me2, t2 in me2.stir(t2, g) }
        }
    }

    /// Every channel the running effect moved, tweened back to the rig's rest.
    ///
    /// One function rather than a loop inside `stopEffect`, because `touched` is
    /// a record of channels that are OFF REST, and every place that record is
    /// dropped owes the same settle first. `startEffect` used to drop it with a
    /// bare `touched.removeAll()`: a `stop()` that left a twitch standing on
    /// `spark.x` at 0.7, followed by a `start()`, erased the only note of where
    /// that channel had been taken, and nothing put it back for the life of the
    /// session.
    ///
    /// Sorted for the same reason `playSteps` sorts, though nothing here depends
    /// on it: no PRNG is drawn and every channel gets exactly one tween at the
    /// same instant.
    private func settleTouched(_ when: Double, _ settle: Settle) {
        for channel in touched.sorted() {
            ctx.tweens.add(TweenSpec(channel: channel, to: .number(rest(channel)),
                                     duration: settle.duration,
                                     ease: settle.ease), now: when)
        }
        touched.removeAll()
    }

    private func startEffect(_ mood: String, _ when: Double) {
        guard let def = b.moodEffects[mood] else { return }
        // SETTLED, not merely forgotten. On the ordinary path `pollTick` has
        // just run `stopEffect`, so `touched` is already empty and this writes
        // nothing — which is why no golden moves. The path that is not ordinary
        // is `stop()` then `start()`: `stop` used to leave `touched` populated
        // and `activeEffect` nil, so `stopEffect` could never claim those
        // channels again, and the `touched.removeAll()` that stood here was the
        // moment the engine forgot a channel it had walked off rest. `stop` now
        // puts them back itself, and this is the second door onto the same
        // record — a `start` called twice without a `stop` between.
        //
        // The NEW effect's settle timing, because it is the only one still in
        // reach: whichever effect took those channels off rest is gone, and the
        // alternative is the raw write `stop` uses, which would pop mid-session.
        settleTouched(when, def.settle)
        activeEffect = mood
        effectGen += 1
        let g = effectGen
        if let once = def.once { playSteps(once, 0, when) { _, _ in } }
        if def.loop != nil { armLoop(effectLoop(def), when) }
        if let first = def.firstDelayMs {
            at(when + pairRange(prng, first) / 1000) { me, t in me.stir(t, g) }
        }
    }

    private func stopEffect(_ when: Double) {
        guard let active = activeEffect else { return }
        let def = b.moodEffects[active]
        activeEffect = nil
        effectGen += 1   // orphan any pending stir event, mid-chain or re-arming
        guard let def else { return }
        // Through `stopLoop`, not by hand: an effect's loop is a chain like
        // any other, so its pending event needs orphaning too (see `gen`).
        if def.loop != nil { stopLoop(effectLoop(def), when) }
        settleTouched(when, def.settle)
    }

    // MARK: - pinpricks

    private func pinprickTick(_ when: Double) {
        let p = b.pinpricks
        let show = predicate(ctx.config, scope, p.shownWhen)
        if show == pinpricksShown { return }
        pinpricksShown = show
        for node in p.nodes {
            let channel = "\(node).alpha"
            ctx.tweens.add(TweenSpec(channel: channel,
                                     to: .number(show ? p.alpha : rest(channel)),
                                     duration: show ? p.showDuration : p.hideDuration,
                                     ease: p.ease), now: when)
        }
    }

    // MARK: - muttering

    private func mutterTick(_ when: Double) {
        if b.speech.loopingIn.contains(moodOf()) { mutter(when) }
        at(when + b.speech.mutterMs / 1000) { me, t in me.mutterTick(t) }
    }

    // MARK: - the one poll

    private func pollTick(_ when: Double) {
        let m = moodOf()
        let reduced = reducedMotion()
        let s = scope
        // The ambient loops are settled BEFORE the mood block claims their
        // channels, and that order is the original's: `applyPose` settled
        // `face.y` first and only then did the expression register its sag, so
        // the sag's tween is the newer one and wins. Run the mood block first
        // and the settle, being newer, would cancel a sag armed microseconds
        // earlier — leaving `face.y` flat for a whole 3.5 s cycle until the
        // sag's own chain re-armed.
        //
        // Symmetric, and it has to be: `armLoop` can only stop a loop from
        // inside its own chain, one whole cycle after the amplitude went to
        // zero — up to 1.05 s for the sway. The original stopped it the instant
        // the pose applied, by killing the loops `applyPose` had returned. The
        // poll is 400 ms, so testing both directions here is what keeps the
        // settle inside a delay the original would recognise.
        for loop in b.loops {
            if suppressed(loop, s) {
                freezeLoop(loop)
            } else if loopLive(loop, s) {
                if running[loop.id] != true { armLoop(loop, when) }
            } else {
                stopLoop(loop, when)
            }
        }
        // Reduced motion is treated exactly like a mood change, and that is the
        // whole of the mood-effect gate. `armLoop` gates a loop-shaped effect,
        // but a once-shaped one (`sadDroop`) and a stir chain (`asleepStir`)
        // reach their channels through `playSteps`, which has no gate of its
        // own — so under reduced motion the sleeping body went on twitching.
        // Stopping the effect rather than gating each shape settles every
        // channel it touched through the path that already exists, and
        // restarting it from the top when the setting clears replays the
        // once-steps too, which a per-shape flag would not.
        if m != lastMood || reduced != lastReduced {
            // The instant a mood shuts the eyes, the gaze goes dead still:
            // irises centred, head level, glyph re-centred. Nothing else would
            // do it — a pose draws nodes, and tilt and lean are layers no pose
            // owns — so a head the pointer had turned would stay turned for
            // the whole sleep. The original reaches the same state by
            // re-running `useGaze`, whose `eyesShut` branch zeroes all three
            // before it returns.
            let shutDef = b.gaze.disabledWhen
            // `start` always sets `lastMood` before the first poll can run, so
            // the nil here is a type, not a state — but naming it is cheaper
            // than a force-unwrap.
            let was = lastMood
            if let shutDef, let was,
               predicate(ctx.config, ParamScope(mood: m), shutDef),
               !predicate(ctx.config, ParamScope(mood: was), shutDef) {
                lookAt(when, 0, 0)
                tiltTo(when, 0)
                leanTo(when, 0, 0)
            }
            stopEffect(when)
            lastMood = m
            lastReduced = reduced
            if !reduced { startEffect(m, when) }
        }
        if let active = activeEffect, let def = b.moodEffects[active], def.loop != nil {
            let loop = effectLoop(def)
            if running[loop.id] != true { armLoop(loop, when) }
        }
        if !fidgetRunning && fidgetActive() { fidget(when) }
        if !breathRunning && fidgetActive() { breathe(when) }
        pinprickTick(when)
    }

    // MARK: - the three public entry points

    public func start(_ when: Double) {
        let m = moodOf()
        lastMood = m
        lastReduced = reducedMotion()
        for loop in b.loops { armLoop(loop, when) }
        breathe(when)
        fidget(when)
        armBlink(when)
        at(when + b.gaze.wanderAfterMs / 1000) { me, t in me.wander(t) }
        at(when + b.speech.mutterMs / 1000) { me, t in me.mutterTick(t) }
        if !lastReduced { startEffect(m, when) }
        pinprickTick(when)
        // `first` is ABSOLUTE, so an omitted one means "at 0.2", not "0.2
        // later". This arms in the MIDDLE of a run — `when` is whatever moment
        // the mood changed at — so an unanchored deadline is one that went by
        // long ago, and the scheduler's catch-up loop runs to its 1000-iteration
        // guard instead of the poll: ~1000 spurious polls and a visible hitch.
        // Same anchor the arbiter's poll uses in Task 32.
        //
        // Cancelled first, because a second `start` without a `stop` between —
        // a remount, a re-`play` of the whole engine — would otherwise overwrite
        // `pollId` and leave the first repeater running with nothing holding its
        // id. Two polls means every mood change is serviced twice, and the count
        // climbs with each restart.
        if let pollId { ctx.scheduler.cancel(pollId) }
        pollId = ctx.scheduler.every(poll, first: when + poll) { [weak self] at in
            self?.pollTick(at)
        }
    }

    public func look(_ x: Double, _ y: Double, now: Double) {
        target = (min(max(x, -1), 1), min(max(y, -1), 1))
        pointerAt = now
        applyGaze(now)
    }

    public func stop() {
        // Sorted, like every other set walk in the engine. Cancel order is
        // unobservable here, but "sort every dictionary and set walk" is a rule
        // that only works if it has no exceptions to remember.
        for id in pending.sorted() { ctx.scheduler.cancel(id) }
        pending.removeAll()
        if let pollId { ctx.scheduler.cancel(pollId) }
        pollId = nil
        running.removeAll()
        fidgetRunning = false
        breathRunning = false
        activeEffect = nil
        effectGen += 1   // orphan any pending stir event, as `stopEffect` does
        // Every channel the effect walked off rest, put back THIS instant.
        //
        // `stop` has no clock — it is teardown, not a moment on the timeline —
        // so the restore is `cancel` then a raw write rather than a settle
        // tween, exactly the way `TimelineHandle.cancel` hands a promoted shape
        // back, and for the same reason: the tween that is still driving the
        // channel would otherwise overwrite the value before anything saw it.
        //
        // Leaving `touched` populated here was the leak. `activeEffect` is nil
        // from this line on, so `stopEffect` returns at its guard and can never
        // reclaim these channels; the next `startEffect` cleared the record
        // outright. A twitch caught mid-stroke therefore stranded `spark.x` at
        // 0.7 for the life of the process, with nothing left that knew it was
        // there.
        for channel in touched.sorted() {
            ctx.tweens.cancel(channel)
            ctx.channels.set(channel, .number(rest(channel)))
        }
        touched.removeAll()
    }
}
