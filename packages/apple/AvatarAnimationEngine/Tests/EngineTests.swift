import XCTest
@testable import AvatarAnimationEngine

final class EngineTests: XCTestCase {
    private var config: CharacterConfig!

    override func setUpWithError() throws {
        let d = try Fixture.all()
        config = try CharacterConfig.load(RawFiles(
            character: d["character"]!, rig: d["rig"]!, poses: d["poses"]!,
            timelines: d["timelines"]!, behavior: d["behavior"]!, sayings: d["sayings"]!))
    }

    private func engine(seed: UInt32 = 1,
                        env: AvatarEnvironment = AvatarEnvironment(),
                        variant: String? = nil) throws -> Engine {
        try Engine(EngineOptions(config: config, seed: seed, env: env, variant: variant))
    }

    /// Frame times as exact rationals. `t += 1 / fps` accumulates error, and two
    /// runs at different rates would then not share a single sample instant —
    /// which is the very thing the frame-rate test is trying to compare.
    private func frames(fps: Int, seconds: Double) -> [Double] {
        (0...Int(seconds * Double(fps))).map { Double($0) / Double(fps) }
    }

    private func run(_ e: Engine, fps: Int, seconds: Double) throws -> DisplayList {
        var last: DisplayList = []
        for t in frames(fps: fps, seconds: seconds) { last = try e.tick(t) }
        return last
    }

    private func trace(_ e: Engine, fps: Int, seconds: Double) throws -> [DisplayList] {
        try frames(fps: fps, seconds: seconds).map { try e.tick($0) }
    }

    private func item(_ list: DisplayList, _ id: String) throws -> DisplayItem {
        try XCTUnwrap(list.first { $0.id == id }, "no display item \"\(id)\"")
    }

    // MARK: - the frame

    func testTickReturnsEveryPaintableNodeWithAResolvedPaint() throws {
        let list = try engine().tick(0)
        // Five, not four: `spark` rests at alpha 0 and is emitted anyway. The
        // golden diff checks list length structurally.
        XCTAssertEqual(list.count, 5)
        for i in list {
            XCTAssertFalse(i.d.isEmpty, i.id)
            // `parseHex` throwing IS the assertion: it accepts `#rrggbb` and
            // nothing else, so an ink that reached the display list still
            // holding a palette key or an unresolved `@alias` fails here.
            XCTAssertNoThrow(try Color.parseHex(i.paint.ink), "\(i.id) ink \(i.paint.ink)")
            for n in [i.m.a, i.m.b, i.m.c, i.m.d, i.m.e, i.m.f] {
                XCTAssertTrue(n.isFinite, i.id)
            }
        }
    }

    // MARK: - determinism

    func testNeverReadsAClockOfItsOwn() throws {
        // Two engines, the same seed, the same tick sequence, and a default
        // environment whose `now()` is 0 — so if anything inside reached for a
        // real clock instead of the argument, these would drift apart.
        let a = try engine(), b = try engine()
        XCTAssertEqual(try trace(a, fps: 60, seconds: 4),
                       try trace(b, fps: 60, seconds: 4))
    }

    func testReachesTheSameFrameAtTheSameTimeAtAnyFrameRate() throws {
        // Rule 2 and rule 3 together: progress comes from absolute time and the
        // scheduler hands each closure its SCHEDULED time, so a 240 Hz run and a
        // 60 Hz run place every tween start at the same instant and sample it at
        // the same instant. The frames at t = 20 are therefore identical, not
        // merely close — a `toBeCloseTo` here would hide exactly the drift the
        // test exists to catch.
        let slow = try engine(), fast = try engine()
        XCTAssertEqual(try run(slow, fps: 60, seconds: 20),
                       try run(fast, fps: 240, seconds: 20))
        XCTAssertEqual(slow.state, fast.state)
    }

    func testDiffersBetweenSeeds() throws {
        let a = try engine(seed: 1), b = try engine(seed: 99)
        XCTAssertNotEqual(try trace(a, fps: 60, seconds: 4),
                          try trace(b, fps: 60, seconds: 4))
    }

    func testEngineOptionsVariantReachesTheSceneItBuilds() throws {
        // `dot`'s "bold" variant thickens the "body" ink from 4 to 7; `limb`
        // paints with "body". This is the engine's own, single-package proof
        // that `EngineOptions.variant` actually reaches `Scene` — separate
        // from `$OA`'s golden replay, which only catches this because it
        // happens to consume this package. If `Engine.init` stopped passing
        // `options.variant` to `Scene(config, variant:)`, `limb` would render
        // at width 4 under "bold" too, and only this assertion would fail.
        let plain = try item(try engine().tick(0), "limb")
        let bold = try item(try engine(variant: "bold").tick(0), "limb")
        XCTAssertEqual(plain.paint.width, 4)
        XCTAssertEqual(bold.paint.width, 7)
    }

    // MARK: - the commands

    func testAMoodAppliesOnTheNextTick() throws {
        let e = try engine()
        _ = try e.tick(0)
        try e.setMood("out")
        XCTAssertEqual(e.state.mood, "out")
        XCTAssertEqual(e.state.source, .app)
        _ = try e.tick(1)
        // `out` poses `eyes.scaleY` at 0.05, and the group fans out to both eyes.
        let posed = try XCTUnwrap(config.poses.poses["out"]?.channels["eyes.scaleY"]?.number)
        XCTAssertEqual(try XCTUnwrap(e.channels.get("eye.scaleY")?.number),
                       posed, accuracy: 1e-9)
    }

    func testAnUnknownMoodIsRefusedAtTheDoorAndChangesNothing() throws {
        let e = try engine()
        _ = try e.tick(0)
        let before = e.state
        XCTAssertThrowsError(try e.setMood("nope")) { error in
            XCTAssertEqual((error as? AnimError)?.message, "unknown mood: nope")
        }
        XCTAssertEqual(e.state, before)
    }

    func testPlaysANamedTimelineAndReturnsToRest() throws {
        // `flip` is the family-snap timeline: it snaps `line.shape` into
        // `arcLine`, morphs within it, and snaps back to the authored polyline.
        // Naming it here rather than hardcoding "yawn" is the point of `play`.
        let e = try engine()
        let rest = try item(try e.tick(0), "line").d
        try e.play("flip")

        var moved = false
        for t in frames(fps: 60, seconds: 0.5) {
            if try item(try e.tick(t), "line").d != rest { moved = true }
        }
        XCTAssertTrue(moved, "the timeline never touched `line`")

        let span = try XCTUnwrap(config.timelines.timelines["flip"]?.duration)
        XCTAssertEqual(try item(try e.tick(span + 0.2), "line").d, rest)
    }

    func testAnUnknownTimelineThrows() throws {
        let e = try engine()
        _ = try e.tick(0)
        XCTAssertThrowsError(try e.play("yawn")) { error in
            XCTAssertEqual((error as? AnimError)?.message, "unknown timeline: yawn")
        }
    }

    // MARK: - sayings

    func testFallsBackToTheActiveMoodsListForAMoodThatHasNone() throws {
        let active = try XCTUnwrap(config.behavior.ladder.moods["active"])
        let shut = config.behavior.eyesShutMood
        XCTAssertNil(config.sayings.sayings[shut], "fixture no longer exercises the fallback")

        let e = try engine()
        XCTAssertEqual(e.randomSaying(shut), e.randomSaying(active))
    }

    func testRandomSayingDrawsFromTheSAMEStreamAsTheReflexes() throws {
        // The web shares ONE `createPrng(seed)` object between the reflexes and
        // `pickSaying`, so a saying consumes a draw the reflexes would have taken
        // and everything after it shifts. This asserts Swift does the same — and
        // it is the only test in either plan that can see it. Were `Prng` a
        // struct, `ReflexDeps` would copy it, these two traces would be equal,
        // and nothing would fail until Task 38 replayed a scenario that speaks.
        let quiet = try engine()
        let spoken = try engine()
        _ = try spoken.tick(0)
        _ = spoken.randomSaying()

        XCTAssertNotEqual(try trace(quiet, fps: 60, seconds: 4).dropFirst(),
                          try trace(spoken, fps: 60, seconds: 4).dropFirst())
    }

    // MARK: - accessibility

    func testReducedMotionStillsTheAmbientLoops() throws {
        // `sway` drives `body.x` off `swayAmp`, which is 9 in a lively mood. The
        // reduced-motion gate settles the chain to `restValue` and the poll never
        // re-arms it, so the channel is pinned at 0 for the whole run.
        func spread(_ e: Engine) throws -> Double {
            var lo = Double.infinity, hi = -Double.infinity
            for t in frames(fps: 60, seconds: 8) {
                _ = try e.tick(t)
                let x = e.channels.get("body.x")?.number ?? 0
                lo = min(lo, x); hi = max(hi, x)
            }
            return hi - lo
        }
        XCTAssertGreaterThan(try spread(try engine()), 1)
        XCTAssertEqual(
            try spread(try engine(env: AvatarEnvironment(reducedMotion: { true }))),
            0, accuracy: 1e-9)
    }
}
