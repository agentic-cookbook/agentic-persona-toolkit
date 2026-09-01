import XCTest
@testable import AvatarAnimationEngine

/// The four things a reflex test drives by hand. A separate object, not the
/// harness itself: the harness owns `Reflexes`, `Reflexes` owns the closures,
/// and closures that read the harness would close the loop into a retain cycle.
private final class Knobs {
    var mood: String
    var reduced = false
    var mutters: [Double] = []
    init(mood: String) { self.mood = mood }
}

private struct Harness {
    let config: CharacterConfig
    let channels: Channels
    let scheduler: Scheduler
    let tweens: Tweens
    let knobs: Knobs
    let reflexes: Reflexes

    init(seed: UInt32 = 7) throws {
        let d = try Fixture.all()
        let config = try CharacterConfig.load(RawFiles(
            character: d["character"]!, rig: d["rig"]!, poses: d["poses"]!,
            timelines: d["timelines"]!, behavior: d["behavior"]!, sayings: d["sayings"]!))
        self.config = config
        channels = Channels()
        config.seed(into: channels)
        scheduler = Scheduler()
        tweens = Tweens(channels: channels, respond: config.respond)
        let k = Knobs(mood: config.behavior.ladder.moods["active"]!)
        knobs = k
        reflexes = Reflexes(ReflexDeps(
            ctx: AnimContext(config: config, channels: channels,
                             tweens: tweens, scheduler: scheduler),
            prng: Prng(seed: seed),
            mood: { k.mood },
            reducedMotion: { k.reduced },
            mutter: { k.mutters.append($0) }))
    }

    var behavior: BehaviorFile { config.behavior }

    var lively: String {
        config.poses.order.first { (config.poses.poses[$0]?.loops?["wiggle"] ?? 0) > 0 }!
    }

    var calm: String {
        config.poses.order.first {
            (config.poses.poses[$0]?.loops?["wiggle"] ?? 0) == 0
                && $0 != config.behavior.eyesShutMood
        }!
    }

    /// A 60 Hz walk. `from + i/60` rather than `t += 1/60`, so the sample times
    /// are exact and two harnesses stepped over different windows still land on
    /// the same instants.
    func run(from: Double, to: Double) {
        var i = 0
        while from + Double(i) / 60 <= to + 1e-12 {
            let t = from + Double(i) / 60
            scheduler.tick(t)
            tweens.tick(t)
            i += 1
        }
    }

    /// The extreme a channel reaches over a window — how an ambient loop is measured.
    func swing(_ channel: String, from: Double, to: Double) -> Double {
        var peak = 0.0
        var i = 0
        while from + Double(i) / 60 <= to + 1e-12 {
            let t = from + Double(i) / 60
            scheduler.tick(t)
            tweens.tick(t)
            peak = max(peak, abs(number(channel)))
            i += 1
        }
        return peak
    }

    func number(_ channel: String) -> Double { channels.get(channel)?.number ?? 0 }
    func rest(_ channel: String) -> Double { config.rest[channel]?.number ?? 0 }

    /// The largest magnitude a list of effect steps can reach — a `{"rnd": n}`
    /// channel is bounded by n, a literal by itself.
    func bound(_ steps: [EffectStep]?) -> Double {
        var m = 0.0
        for step in steps ?? [] {
            for key in step.channels.keys.sorted() {
                switch step.channels[key]! {
                case .number(let v): m = max(m, abs(v))
                case .rnd(let r): m = max(m, r)
                }
            }
        }
        return m
    }
}

final class ReflexesTests: XCTestCase {

    // MARK: - ambient loops

    func testDrivesTheSwayWithTheCalmAmplitudeAtRest() throws {
        let h = try Harness()
        h.knobs.mood = h.calm
        h.reflexes.start(0)
        guard case .select(_, _, let calmAmp)? = h.behavior.params["swayAmp"] else {
            return XCTFail("swayAmp is not a select param")
        }
        // One full calm stroke is 3.2 s, so a 4 s window contains its peak.
        let peak = h.swing("body.x", from: 0, to: 4)
        XCTAssertGreaterThan(peak, calmAmp * 0.9)
        XCTAssertLessThanOrEqual(peak, calmAmp + 1e-6)
    }

    func testSwitchesToTheLivelyAmplitudeWhenThePoseSuppliesAWiggle() throws {
        let h = try Harness()
        h.knobs.mood = h.lively
        h.reflexes.start(0)
        guard case .select(_, let livelyAmp, let calmAmp)? = h.behavior.params["swayAmp"] else {
            return XCTFail("swayAmp is not a select param")
        }
        let peak = h.swing("body.x", from: 0, to: 4)
        XCTAssertGreaterThan(peak, calmAmp + 1)
        XCTAssertLessThanOrEqual(peak, livelyAmp + 1e-6)
    }

    func testRestsTheSwayWhenTheEyesShutAndReArmsItOnWaking() throws {
        let h = try Harness()
        h.knobs.mood = h.calm
        h.reflexes.start(0)
        h.run(from: 0, to: 2)
        h.knobs.mood = h.behavior.eyesShutMood
        // The gate is read at the next cycle boundary (3.2 s), and the settle
        // takes restDuration (0.4 s) after that — so 7 s is a wide margin.
        h.run(from: 2, to: 7)
        XCTAssertEqual(h.number("body.x"), 0, accuracy: 1e-6)

        h.knobs.mood = h.lively
        XCTAssertGreaterThan(h.swing("body.x", from: 7, to: 12), 1)
    }

    func testRunsNoAmbientLoopAtAllInAChoreographedMood() throws {
        // `armLoop` never even opens the chain: a choreographed mood is
        // suppressed from the first arm, not settled into place a cycle later.
        let h = try Harness()
        h.knobs.mood = "flipping"
        h.reflexes.start(0)
        XCTAssertLessThan(h.swing("body.x", from: 0, to: 4), 1e-9)
        XCTAssertLessThan(h.swing("pupil.rotation", from: 0, to: 4), 1e-9)
    }

    func testFreezesAnAmbientLoopEnteringAChoreographedModeRatherThanSettlingIt() throws {
        let h = try Harness()
        h.reflexes.start(0)
        h.run(from: 0, to: 2)
        h.knobs.mood = "flipping"
        // The poll is 200 ms in this fixture, so the freeze has landed well
        // inside this window.
        h.run(from: 2, to: 3)
        let held = h.number("body.x")
        // `freezeLoop` kills the sway tween outright, and a cancelled tween
        // writes nothing more: the channel keeps whatever the half cycle had
        // reached. Settling it to `restValue` instead would draw a sway-to-
        // centre under the timeline the engine never draws.
        XCTAssertGreaterThan(abs(held), 1e-3, "the sway should have moved off centre before the freeze")
        h.run(from: 3, to: 8)
        XCTAssertEqual(h.number("body.x"), held, accuracy: 1e-12)

        h.knobs.mood = h.lively
        guard case .select(_, let livelyAmp, _)? = h.behavior.params["swayAmp"] else {
            return XCTFail("swayAmp is not a select param")
        }
        XCTAssertGreaterThan(h.swing("body.x", from: 8, to: 13), livelyAmp * 0.5)
    }

    // MARK: - the opening stroke (Ruling 73)

    func testStandsASymmetricLoopOnItsPhasesExtremeBeforeItsFirstStroke() throws {
        let h = try Harness()
        h.knobs.mood = h.lively
        let scope = ParamScope(mood: h.lively)
        let sway = h.behavior.loops.first { $0.id == "sway" }!
        let wiggle = h.behavior.loops.first { $0.id == "faceWiggle" }!
        // Two symmetric loops on opposite phases — a pair of antennae on a
        // rig is exactly this shape, and `phase` is the only thing that makes
        // them read as two antennae rather than one drawn twice.
        XCTAssertEqual(sway.mode, "symmetric")
        XCTAssertNil(sway.phase)                     // absent means positiveFirst
        XCTAssertEqual(wiggle.mode, "symmetric")
        XCTAssertEqual(wiggle.phase, "negativeFirst")

        h.reflexes.start(0)
        // BEFORE a single tick. A symmetric yoyo opens by STANDING on the extreme
        // its phase names and swinging across to the other one; easing out of
        // rest instead leaves the port half a cycle behind for as long as the
        // pose lasts, and on the pose's first frame it sits at zero where the
        // original sits at full amplitude.
        let swayAmp = amplitude(h.config, scope, sway.amplitude)
        let wiggleAmp = amplitude(h.config, scope, wiggle.amplitude)
        XCTAssertGreaterThan(swayAmp, 0)
        XCTAssertGreaterThan(wiggleAmp, 0)
        XCTAssertEqual(h.number(sway.channel), swayAmp, accuracy: 1e-9)
        XCTAssertEqual(h.number(wiggle.channel), -wiggleAmp, accuracy: 1e-9)

        // The opening stroke runs to the OTHER extreme over one duration — the
        // jump is the start of the swing, not a swing of its own.
        h.run(from: 0, to: amplitude(h.config, scope, sway.duration))
        XCTAssertEqual(h.number(sway.channel), -swayAmp, accuracy: 1e-6)
    }

    func testReopensALoopOnItsConfiguredPhaseNotOnTheSideItStoppedAt() throws {
        let h = try Harness()
        h.knobs.mood = h.lively
        let scope = ParamScope(mood: h.lively)
        let sway = h.behavior.loops.first { $0.id == "sway" }!
        let amp = amplitude(h.config, scope, sway.amplitude)
        let dur = amplitude(h.config, scope, sway.duration)
        h.reflexes.start(0)
        // Stop it PART WAY THROUGH a stroke, so the side it settles from is not
        // the side it started on.
        h.run(from: 0, to: dur * 0.5)
        h.knobs.mood = h.behavior.eyesShutMood
        let settled = dur * 2 + (sway.restDuration ?? 0) + 1
        h.run(from: dur * 0.5, to: settled)
        XCTAssertEqual(h.number(sway.channel), sway.restValue, accuracy: 1e-6)

        // Reopening is a pose landing, and the original's pose apply always
        // re-states the same starting side. Carrying the stopped sign over
        // instead would put a paired antennae rig's two loops in step for the
        // rest of the run.
        h.knobs.mood = h.lively
        var first = 0.0
        var i = 0
        let deadline = settled + h.behavior.ladder.pollMs / 1000 + dur + 1
        while settled + Double(i) / 60 <= deadline + 1e-12 {
            let t = settled + Double(i) / 60
            h.scheduler.tick(t)
            h.tweens.tick(t)
            // Past half amplitude is the opening jump itself — the settle's
            // residue never gets there, and a stroke from the wrong extreme
            // would trip this on the negative side.
            if first == 0, abs(h.number(sway.channel)) > amp * 0.5 {
                first = h.number(sway.channel)
            }
            i += 1
        }
        // Not 1e-9: the poll's own `nextAt` is an independently accumulated
        // clock (23 successive `+= poll` additions from `start`), and it need
        // only be a single ULP ahead of this loop's directly-computed `t` for
        // `Scheduler.tick`'s `now >= entry.nextAt` to defer the fire by one
        // whole 1/60 s grid step. `sine.inOut` has zero slope at the extreme,
        // so even a full frame's worth of that slip only costs about
        // `amp * 5e-4` here — nowhere near the `amp` (or sign-flip) a real
        // opening-stroke bug would produce.
        XCTAssertEqual(first, amp, accuracy: amp * 0.01)
    }

    func testChargesALoopsStartDelayOnceSoItsPeriodStaysItsOwnDuration() throws {
        let h = try Harness()
        h.knobs.mood = h.lively
        let scope = ParamScope(mood: h.lively)
        let wiggle = h.behavior.loops.first { $0.id == "faceWiggle" }!
        let delay = wiggle.delay ?? 0
        XCTAssertGreaterThan(delay, 0, "faceWiggle is the fixture's delayed loop")
        let dur = amplitude(h.config, scope, wiggle.duration)
        h.reflexes.start(0)

        // A quarter of the way into the second stroke, and again a full cycle
        // (two strokes) later. Sampled off a quarter rather than a half so a
        // channel parked at zero could not pass.
        let probe = delay + dur + dur / 4
        h.run(from: 0, to: probe)
        h.scheduler.tick(probe)
        h.tweens.tick(probe)
        let first = h.number(wiggle.channel)
        XCTAssertGreaterThan(abs(first),
                             amplitude(h.config, scope, wiggle.amplitude) * 0.5)

        // The delay positions the loop's START. Charging it again on every
        // re-arm stretches the period to `dur + delay`, and these two readings
        // stop matching — on a paired antennae rig that is 0.12 s added to each
        // antenna's half cycle, which walks the pair permanently out of step
        // with the original.
        h.run(from: probe, to: probe + dur * 2)
        h.scheduler.tick(probe + dur * 2)
        h.tweens.tick(probe + dur * 2)
        XCTAssertEqual(h.number(wiggle.channel), first, accuracy: 1e-3)
    }

    // MARK: - blink

    func testBlinksShutAndBackOpenAndNotAtAllInASuppressedMood() throws {
        let h = try Harness()
        let b = h.behavior.blink
        let channel = h.config.expand(b.channel)[0]
        h.reflexes.start(0)

        var low = Double.infinity
        var lastDip = 0.0
        var i = 0
        while Double(i) / 60 <= b.maxMs / 1000 + 1 {
            let t = Double(i) / 60
            h.scheduler.tick(t)
            h.tweens.tick(t)
            let v = h.number(channel)
            low = min(low, v)
            if v < 0.5 { lastDip = t }
            i += 1
        }
        XCTAssertLessThan(low, b.shut + 0.05, "the eye never shut")

        // Let THAT blink finish, rather than asserting at a fixed time: blinks
        // are drawn from [minMs, maxMs], so a fixed end lands mid-close whenever
        // one happens to fire near it. The next blink cannot start for another
        // minMs, so this window is guaranteed to be open.
        h.run(from: b.maxMs / 1000 + 1,
              to: lastDip + b.durationMs / 1000 + 2 * b.tweenDuration + 0.05)
        XCTAssertEqual(h.number(channel), 1, accuracy: 1e-6)

        let quiet = try Harness()
        quiet.knobs.mood = quiet.behavior.blink.suppressedIn[0]
        quiet.reflexes.start(0)
        var dip = Double.infinity
        var j = 0
        while Double(j) / 60 <= b.maxMs / 1000 * 3 {
            let t = Double(j) / 60
            quiet.scheduler.tick(t)
            quiet.tweens.tick(t)
            dip = min(dip, quiet.number(channel))
            j += 1
        }
        XCTAssertEqual(dip, 1, accuracy: 1e-6, "a suppressed mood blinked anyway")
    }

    // MARK: - gaze

    func testFollowsALookAndThenWandersWithinGazeMax() throws {
        let h = try Harness()
        let g = h.behavior.gaze
        h.reflexes.start(0)
        h.reflexes.look(1, -1, now: 0)
        h.run(from: 0, to: 1)
        XCTAssertEqual(h.number("pupil.x"), g.gazeMax, accuracy: 1e-4)
        XCTAssertEqual(h.number("pupil.y"), -g.gazeMax, accuracy: 1e-4)
        // Negated against the look: the head turns toward the pointer, not away.
        XCTAssertEqual(h.number("body.rotation"), -g.tiltMax, accuracy: 1e-4)
        XCTAssertEqual(h.number("body.y"), -g.leanMax, accuracy: 1e-4)

        // No further look: after wanderAfterMs the gaze picks its own targets,
        // and every one of them stays inside the configured reach.
        XCTAssertLessThanOrEqual(h.swing("pupil.x", from: 1, to: 12), g.gazeMax + 1e-6)
    }

    func testLevelsTheHeadOnAWanderInsteadOfTurningItTowardNothing() throws {
        let h = try Harness()
        let g = h.behavior.gaze
        h.reflexes.start(0)
        // The pointer aims eyes AND head once, and then never moves again.
        // Every wander after that is the irises drifting on their own, so the
        // head must come back level and stay level: there is nothing left to
        // watch.
        h.reflexes.look(1, -1, now: 0)
        h.run(from: 0, to: 1)
        XCTAssertEqual(h.number("body.rotation"), -g.tiltMax, accuracy: 1e-4)

        // The first wander fires at `wanderAfterMs` (1.5 s) and immediately
        // starts levelling BOTH layers, but `tilt` and `lean` settle over
        // their own separate durations (0.5 s and 0.6 s in this fixture) —
        // not the same one. Starting the scan at a fixed 2 s only clears
        // `tilt`'s: `lean` is still 1/54 of the way through its own decay at
        // that instant (`4 * (1 - (1 - 0.5/0.6)^3)`, the fixture's
        // `power2.out`), a fully deterministic residue and not a scheduling
        // fluke. The scan has to wait for whichever settle is the LONGER one.
        var tilt = 0.0
        var lean = 0.0
        var iris = 0.0
        var i = 0
        let settleStart = g.wanderAfterMs / 1000 + max(g.tilt.duration, g.lean.duration) + 0.05
        while settleStart + Double(i) / 60 <= 20 {
            let t = settleStart + Double(i) / 60
            h.scheduler.tick(t)
            h.tweens.tick(t)
            tilt = max(tilt, abs(h.number("body.rotation")))
            lean = max(lean, abs(h.number("body.y")))
            iris = max(iris, abs(h.number("pupil.x")))
            i += 1
        }
        XCTAssertLessThan(tilt, 1e-9)
        XCTAssertLessThan(lean, 1e-9)
        // …and the wanders really did run, so the two assertions above are
        // not measuring a gaze that never moved at all.
        XCTAssertGreaterThan(iris, g.gazeMax * g.reachIdle[0])
    }

    func testCentresTheEyesAndLevelsTheHeadTheMomentAMoodShutsThem() throws {
        let h = try Harness()
        let g = h.behavior.gaze
        h.reflexes.start(0)
        h.reflexes.look(1, -1, now: 0)
        h.run(from: 0, to: 0.6)
        XCTAssertGreaterThan(abs(h.number("body.rotation")), 1)

        h.knobs.mood = h.behavior.eyesShutMood
        // Past the poll that notices the mood, plus the tilt's own settle.
        h.run(from: 0.6, to: 0.6 + h.behavior.ladder.pollMs / 1000 + g.tilt.duration + 0.2)
        XCTAssertEqual(h.number("body.rotation"), 0, accuracy: 1e-6)
        XCTAssertEqual(h.number("body.y"), 0, accuracy: 1e-6)
        XCTAssertEqual(h.number("pupil.x"), 0, accuracy: 1e-6)
    }

    // MARK: - reduced motion

    func testSuppressesTheAmbientLoopsAndTheFidgetUnderReducedMotion() throws {
        let h = try Harness()
        h.knobs.mood = h.lively
        h.knobs.reduced = true
        h.reflexes.start(0)
        XCTAssertLessThan(h.swing("body.x", from: 0, to: 5), 1e-6)
        XCTAssertLessThan(h.swing(h.behavior.idleFidget.sway.channel, from: 0, to: 5), 1e-6)

        // And it is a switch, not a one-way door.
        h.knobs.reduced = false
        XCTAssertGreaterThan(h.swing("body.x", from: 5, to: 10), 1)
    }

    // MARK: - idle fidget

    func testSkipsAPoseOwnedFidgetChannelsSettleOnceTheFidgetHasGoneInactiveButStillSettlesTheSway() throws {
        let h = try Harness()
        h.knobs.mood = h.lively
        h.reflexes.start(0)
        // The mood turns away from `lively` in the SAME instant the fidget's
        // jitter is scheduled, before either tween has ticked once — so by the
        // time the settle closures fire, `fidgetActive()` has already read
        // false for the whole cycle. This pins the guard itself rather than a
        // race against it.
        h.knobs.mood = h.calm

        // `durationRange` tops out at 1.1 s, so this is past every jitter's
        // own end AND past its settle's own duration (0.4 s), whichever the
        // draw landed on.
        let deadline = 1.1 + h.behavior.idleFidget.settle.duration + 0.5
        h.run(from: 0, to: deadline)

        // The sway lives on a layer no pose writes: the guard never applies to
        // it, so it always settles back to rest once the fidget stops.
        XCTAssertEqual(h.number(h.behavior.idleFidget.sway.channel),
                       h.rest(h.behavior.idleFidget.sway.channel), accuracy: 1e-5)

        // The brows are pose-owned. With `fidgetActive()` already false when
        // the settle closure fires, `fidget()`'s guard must skip the write and
        // leave the channel exactly where the jitter tween put it, rather than
        // dragging it back to the fidget's own base.
        let brow = "\(h.behavior.idleFidget.brow.nodes[0]).rotation"
        let jittered = h.number(brow)
        XCTAssertGreaterThan(abs(jittered - h.rest(brow)), 1e-6,
                             "the jitter should have actually moved the brow")
        h.run(from: deadline, to: deadline + 1)
        XCTAssertEqual(h.number(brow), jittered, accuracy: 1e-9,
                       "nothing may write a skipped brow again later")
    }

    // MARK: - pinpricks

    func testFadesThePinpricksInWhenTheEyesShutAndBackOutWhenTheyOpen() throws {
        let h = try Harness()
        let p = h.behavior.pinpricks
        let channel = "\(p.nodes[0]).alpha"
        let hidden = h.rest(channel)
        h.reflexes.start(0)
        h.run(from: 0, to: 1)
        XCTAssertEqual(h.number(channel), hidden, accuracy: 1e-6)

        h.knobs.mood = h.behavior.eyesShutMood
        h.run(from: 1, to: 3)
        XCTAssertEqual(h.number(channel), p.alpha, accuracy: 1e-6)

        h.knobs.mood = h.lively
        h.run(from: 3, to: 5)
        XCTAssertEqual(h.number(channel), hidden, accuracy: 1e-6)
    }

    // MARK: - mood effects

    func testStirsTheSparkWhileEagerAndReturnsItToRestWhenTheMoodTurns() throws {
        let h = try Harness()
        h.knobs.mood = h.lively
        h.reflexes.start(0)
        let def = h.behavior.moodEffects[h.lively]!
        let limit = max(h.bound(def.twitch), h.bound(def.drift))

        var moved = 0.0
        var i = 0
        while Double(i) / 60 <= 20 {
            let t = Double(i) / 60
            h.scheduler.tick(t)
            h.tweens.tick(t)
            moved = max(moved, abs(h.number("spark.x")), abs(h.number("spark.y")))
            i += 1
        }
        XCTAssertGreaterThan(moved, 1e-6, "the spark never stirred")
        // Every draw is `prng.range(-n, n)` for the step's own n, so nothing the
        // stirrer produces may exceed the widest bound the config declares.
        XCTAssertLessThanOrEqual(moved, limit + 1e-6)

        h.knobs.mood = h.calm
        h.run(from: 20, to: 23)
        XCTAssertEqual(h.number("spark.x"), h.rest("spark.x"), accuracy: 1e-5)
        XCTAssertEqual(h.number("spark.y"), h.rest("spark.y"), accuracy: 1e-5)
    }

    func testPlaysAOnceListOnEntryAndRunsTheEffectsOwnLoopUntilTheMoodTurns() throws {
        let h = try Harness()
        h.knobs.mood = h.calm
        h.reflexes.start(0)
        let def = h.behavior.moodEffects[h.calm]!
        let step = def.once![0]
        let onceChannel = step.channels.keys.sorted()[0]
        guard case .number(let target) = step.channels[onceChannel]! else {
            return XCTFail("the once step should be a literal, not a draw")
        }

        h.run(from: 0, to: 1)
        XCTAssertEqual(h.number(onceChannel), target, accuracy: 1e-6)

        // The effect's own loop is a `LoopDef` in everything but its id, and it
        // swings to the amplitude the param language resolves for this mood.
        let loop = def.loop!
        let amp = amplitude(h.config, ParamScope(mood: h.calm), loop.amplitude)
        let peak = h.swing(loop.channel, from: 1, to: 6)
        XCTAssertGreaterThan(peak, amp * 0.25)
        XCTAssertLessThanOrEqual(peak, amp + 1e-6)

        // Both come home when the mood turns: the once-channels through
        // `settle`, the loop through `settleLoop`. The mood to turn to is the
        // eyes-shut one, NOT the lively one: `wiggle` is 0 there too, so
        // `pupilBob` stays gated off and the channel really does come to rest.
        // Turn to the lively mood instead and `pupilBob` takes the channel over
        // by design (Ruling 39), which is a different assertion — the one
        // `testHandsTheChannelOverOnAMoodChange` makes, from the other side.
        h.knobs.mood = h.config.behavior.eyesShutMood
        h.run(from: 6, to: 10)
        XCTAssertEqual(h.number(onceChannel), h.rest(onceChannel), accuracy: 1e-5)
        XCTAssertEqual(h.number(loop.channel), loop.restValue ?? 0, accuracy: 1e-5)
    }

    func testLetsAMoodEffectOwnAChannelWhoseAmbientLoopHasZeroAmplitude() throws {
        // `pupilBob` is armed for every mood and its amplitude is the active
        // pose's `wiggle`, which this one sets to 0. Before Ruling 39 that
        // zero-amplitude loop kept re-arming and rewriting `pupil.rotation` to 0
        // every 0.5 s; by tween rule 1 each write cancelled the drift, which
        // peaked at a twentieth of its amplitude and then sat flat. The lower
        // bound is what fails if that loop comes back.
        let h = try Harness()
        h.knobs.mood = h.calm
        h.reflexes.start(0)
        let loop = h.behavior.moodEffects[h.calm]!.loop!
        let amp = amplitude(h.config, ParamScope(mood: h.calm), loop.amplitude)
        // `start` arms the effect directly, so no poll is needed to begin; the
        // window is one out-and-back of the drift.
        let dur = amplitude(h.config, ParamScope(mood: h.calm), loop.duration)
        let peak = h.swing(loop.channel, from: 0, to: dur * 2 + 1)
        XCTAssertGreaterThan(peak, amp * 0.9)
        XCTAssertLessThanOrEqual(peak, amp + 1e-6)
    }

    func testHandsTheChannelOverOnAMoodChangeNotOnlyWhenItStartsThere() throws {
        // The stop side of the same ruling, and the one that needs the poll:
        // nothing tells the reflexes a pose was applied, so the loop whose
        // amplitude just went to zero is noticed by `pollTick` and by nothing else.
        let h = try Harness()
        let loop = h.behavior.moodEffects[h.calm]!.loop!
        let amp = amplitude(h.config, ParamScope(mood: h.calm), loop.amplitude)
        let dur = amplitude(h.config, ParamScope(mood: h.calm), loop.duration)
        h.knobs.mood = h.lively
        h.reflexes.start(0)
        XCTAssertGreaterThan(h.swing(loop.channel, from: 0, to: 2), 0.5)
        h.knobs.mood = h.calm
        // Deliberately NOT asserting a return to rest in between: the drift arms
        // in the same poll that stops the bob and is the newer tween, so it takes
        // the channel over from wherever the bob left it — which is what the
        // original did too, both of its writes carrying `overwrite: "auto"`.
        let peak = h.swing(loop.channel, from: 2, to: 2 + dur * 2 + 1)
        XCTAssertGreaterThan(peak, amp * 0.9)
    }

    func testSuppressesAMoodEffectUnderReducedMotionAndRestoresItWhenItClears() throws {
        let h = try Harness()
        let loop = h.behavior.moodEffects[h.calm]!.loop!
        let amp = amplitude(h.config, ParamScope(mood: h.calm), loop.amplitude)
        let dur = amplitude(h.config, ParamScope(mood: h.calm), loop.duration)
        h.knobs.mood = h.calm
        h.knobs.reduced = true
        h.reflexes.start(0)
        XCTAssertLessThan(h.swing(loop.channel, from: 0, to: dur * 2), 1e-6)
        h.knobs.reduced = false
        // The poll treats the setting exactly like a mood change, so the effect
        // restarts from the top and runs a whole cycle rather than resuming
        // mid-stroke — which is also why a once-shaped effect gets replayed.
        XCTAssertGreaterThan(h.swing(loop.channel, from: dur * 2, to: dur * 4 + 1),
                             amp * 0.9)
    }

    func testReArmsAStoppedLoopOnExactlyOneChain() throws {
        // Ruling 41. `stopLoop` cannot cancel the event its own chain already
        // scheduled — `at` hands back no id — so the generation is what stops
        // that orphan from arming a SECOND chain beside the one the poll armed.
        // Two chains are not a bigger swing; they are two writers on one
        // channel at a fractional offset, each cancelling the other mid-stroke.
        // So this counts DIRECTION REVERSALS, which one chain makes once per
        // cycle and two make twice as often.
        //
        // The window is constructed rather than stumbled into: the loop has to
        // arm at 0, be stopped by the poll at `poll`, be re-armed by the poll
        // at `2*poll`, and only THEN have its orphan fire — which needs
        // `period > 2*poll`, the same inequality that makes the bug reachable
        // in the shipped config at all.
        let h = try Harness()
        let b = h.behavior
        let poll = b.ladder.pollMs / 1000
        let active = b.ladder.moods["active"]!
        func cycle(_ l: LoopDef, _ m: String) -> Double {
            amplitude(h.config, ParamScope(mood: m), l.duration)
                + (l.delay ?? 0)
        }
        func live(_ l: LoopDef, _ m: String) -> Bool {
            let s = ParamScope(mood: m)
            return amplitude(h.config, s, l.amplitude) != 0
                && gateOpen(h.config, s, enabledWhen: l.enabledWhen,
                            disabledWhen: l.disabledWhen)
        }
        let gated = b.loops.first {
            live($0, active) && !live($0, b.eyesShutMood)
                && cycle($0, active) > 2 * poll
        }!
        let p = cycle(gated, active)
        let channel = h.config.expand(gated.channel)[0]

        h.knobs.mood = active
        h.reflexes.start(0)
        h.run(from: 0, to: poll / 2)
        h.knobs.mood = b.eyesShutMood // the poll at `poll` stops it
        h.run(from: poll / 2, to: poll + poll / 2)
        h.knobs.mood = active // the poll at `2*poll` arms a fresh chain
        h.run(from: poll + poll / 2, to: 3 * poll) // ... the orphan fires at `p`

        var prev = h.number(channel)
        var dir = 0.0
        var turns = 0
        var i = 0
        while 3 * poll + Double(i) / 60 <= 3 * poll + 4 * p + 1e-12 {
            let t = 3 * poll + Double(i) / 60
            h.scheduler.tick(t)
            h.tweens.tick(t)
            let v = h.number(channel)
            // The epsilon is not decoration: a `sine.inOut` stroke moves by
            // less than a float's noise either side of its extreme, and
            // counting that as a turn would find reversals in a single chain.
            let d = abs(v - prev) < 1e-9 ? 0 : (v > prev ? 1.0 : -1.0)
            if d != 0, dir != 0, d != dir { turns += 1 }
            if d != 0 { dir = d }
            prev = v
            i += 1
        }
        // One chain turns once per cycle — four cycles, four turns, and a
        // fifth only if the window's edge splits one. Two chains turn twice.
        XCTAssertGreaterThanOrEqual(turns, 3)
        XCTAssertLessThanOrEqual(turns, 5)
    }

    func testTheRestEaseFallbackMatchesTweenSpecsOwnDefault() {
        // `settleLoop` spells the default out because `restEase` is optional and
        // a nil cannot ask for a Swift default argument. If `TweenSpec` ever
        // changes its default, every loop with no `restEase` would silently
        // settle on a different curve from the web's.
        XCTAssertEqual(TweenSpec(channel: "body.x", to: .number(0), duration: 0).ease,
                       DEFAULT_EASE)
    }

    // MARK: - muttering

    func testMuttersOnlyInTheLoopingMoodsOnTheMutterMsCadence() throws {
        let h = try Harness()
        let period = h.behavior.speech.mutterMs / 1000
        h.reflexes.start(0)
        h.run(from: 0, to: period * 2 + 1)
        XCTAssertEqual(h.knobs.mutters.count, 0)

        h.knobs.mood = h.behavior.speech.loopingIn[0]
        h.run(from: period * 2 + 1, to: period * 4 + 2)
        XCTAssertGreaterThanOrEqual(h.knobs.mutters.count, 1)
    }

    // MARK: - determinism

    func testSameSeedAndSameClockProduceIdenticalChannels() throws {
        let a = try Harness(seed: 1234)
        let b = try Harness(seed: 1234)
        a.reflexes.start(0)
        b.reflexes.start(0)
        a.run(from: 0, to: 12)
        b.run(from: 0, to: 12)
        XCTAssertEqual(b.channels.names(), a.channels.names())
        for name in a.channels.names() {
            XCTAssertEqual(b.channels.get(name), a.channels.get(name),
                           "channel \(name) diverged")
        }
    }

    // MARK: - teardown

    func testCancelsEveryPendingOneShotOnStop() throws {
        let h = try Harness()
        h.reflexes.start(0)
        h.run(from: 0, to: 3)
        h.reflexes.stop()
        // `stop` cancels SCHEDULED work, not tweens already in flight — at t = 3
        // the breath is mid-cycle and so is the sway. Drain them first: the claim
        // under test is that nothing NEW gets scheduled, and snapshotting
        // mid-tween would fail against a perfectly correct `stop`.
        h.run(from: 3, to: 9)
        let frozen = h.channels.names().map { h.channels.get($0) }
        h.run(from: 9, to: 20)
        XCTAssertEqual(h.channels.names().map { h.channels.get($0) }, frozen)
    }
}
