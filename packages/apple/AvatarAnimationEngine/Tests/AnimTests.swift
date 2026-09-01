import XCTest
@testable import AvatarAnimationEngine

private func near(_ a: Double, _ b: Double, _ tol: Double = 1e-12,
                  file: StaticString = #filePath, line: UInt = #line) {
    XCTAssertLessThan(abs(a - b), tol, "\(a) !≈ \(b)", file: file, line: line)
}

/// The fixture, a seeded channel store, live tweens and a scheduler — the state
/// every frame starts from, rebuilt per test so no test can inherit another's
/// half-finished tween.
private func ctx() throws -> AnimContext {
    let d = try Fixture.all()
    let config = try CharacterConfig.load(RawFiles(
        character: d["character"]!, rig: d["rig"]!, poses: d["poses"]!,
        timelines: d["timelines"]!, behavior: d["behavior"]!, sayings: d["sayings"]!))
    let channels = Channels()
    config.seed(into: channels)
    return AnimContext(config: config, channels: channels,
                       tweens: Tweens(channels: channels), scheduler: Scheduler())
}

/// Drive the clock from `from` to `to` at 60 Hz, landing exactly on `to`.
///
/// The trailing pair is not redundant: the accumulating loop stops just short of
/// `to`, and several assertions below pin a value at an exact instant.
private func drive(_ c: AnimContext, from: Double, to: Double) {
    var t = from
    while t <= to + 1e-12 {
        c.scheduler.tick(t)
        c.tweens.tick(t)
        t += 1.0 / 60.0
    }
    c.scheduler.tick(to)
    c.tweens.tick(to)
}

final class PoseTests: XCTestCase {
    func testReadsTheDelayLadderFromBehaviorJSON() throws {
        let config = try ctx().config
        near(channelDelay(config, "eye.scaleY"), 0)
        near(channelDelay(config, "pupil.scaleY"), 0)
        near(channelDelay(config, "limb.bend"), 0.04)
        near(channelDelay(config, "line.shape"), 0.08)
        // The precedence, pinned: `line` is keyed as a bare node AND `line.shape`
        // is keyed exactly, with different values, so exact-wins and node-wins give
        // different answers here. Without a colliding pair the two orderings are
        // indistinguishable and reversing them breaks nothing — which is exactly
        // the gap the web's own ladder test had.
        near(channelDelay(config, "line.rotation"), 0.02)
        // `body` appears in the table under no key at all.
        near(channelDelay(config, "body.ink"), 0)
        near(channelDelay(config, "spark.rotation"), 0)
    }

    func testFansAGroupChannelOutToEveryMember() throws {
        let c = try ctx()
        _ = try applyPose(c, "out", now: 0)
        c.tweens.tick(1)
        near(c.channels.get("eye.scaleY")!.number!, 0.05)
        near(c.channels.get("pupil.scaleY")!.number!, 0.05)
        // The group itself is never a channel: `expand` fans it out and nothing
        // ever writes the name it was authored under.
        XCTAssertNil(c.channels.get("eyes.scaleY"))
    }

    func testSettlesOnThePosesExactValuesAfterTheFullDuration() throws {
        let c = try ctx()
        _ = try applyPose(c, "calm", now: 0)
        c.tweens.tick(2.0)                     // longest delay + duration, with room
        let pose = c.config.poses.poses["calm"]!
        for channel in pose.channels.keys.sorted() {
            for concrete in c.config.expand(channel) {
                XCTAssertEqual(c.channels.get(concrete), pose.channels[channel], concrete)
            }
        }
        // `body.ink` settles on the LOADER'S value, `#112233` — `calm` authored the
        // palette key `"ink"`, and `colourise` resolved it at load time. This is
        // also the one assertion that proves `Color.mix(_, _, 1)` returns `to`
        // rather than an OKLab round-trip of it.
        XCTAssertEqual(c.channels.get("body.ink"), .text("#112233"))
        XCTAssertEqual(c.tweens.active, 0)
    }

    func testStaggersTheLadderTheBodyArrivesBeforeTheLine() throws {
        let c = try ctx()
        let rest = c.channels.get("line.shape")
        _ = try applyPose(c, "eager", now: 0)
        c.tweens.tick(0.079)
        // 79 ms in: `line.shape` (delay 0.08) has not started, `limb.bend` (0.04)
        // is half way, and `body.scaleX` (no delay) is nearly there.
        XCTAssertEqual(c.channels.get("line.shape"), rest)
        // back.out(1.7) at p = 0.079/0.3 = 0.26333333333333336 is
        // 0.8431661222222223; then 1 + 0.05 × that.
        near(c.channels.get("body.scaleX")!.number!, 1.0421583061111113)
        // The same ease at p = (0.079 − 0.04)/0.3 = 0.13 is 0.5087718999999997,
        // and the tween runs 0 -> 6.
        near(c.channels.get("limb.bend")!.number!, 3.0526313999999983)
    }

    func testSpinsAWholeNumberOfTurnsAndReportsTheNormalisation() throws {
        let c = try ctx()
        let result = try applyPose(c, "eager", now: 0)
        c.tweens.tick(0.3)
        // The pose's own `spark.rotation: 200` tween was cancelled by the spin's
        // `add` before it ever ticked, so the sweep runs 0 -> 560 and 200 never
        // lands on the channel. 0.3/0.6 is exactly 0.5; `powerN` raises to
        // `n + 1`, so power2.out(0.5) is 1 − 0.5³ = 0.875, and 560 × 0.875 is
        // exactly 490.
        near(c.channels.get("spark.rotation")!.number!, 490)
        c.tweens.tick(0.6)
        near(c.channels.get("spark.rotation")!.number!, 560, 1e-9)
        XCTAssertEqual(result.resetAt,
                       PoseReset(at: 0.6, channel: "spark.rotation", value: -160))
        // Task 32's engine hands `resetAt` to the scheduler; apply it by hand here.
        c.channels.set(result.resetAt!.channel, .number(result.resetAt!.value))
        near(c.channels.get("spark.rotation")!.number!, -160)
    }

    func testRunsACarriedChannelAtTheSpinsPaceNotThePoses() throws {
        let c = try ctx()
        let pose = c.config.poses.poses["eager"]!
        let spin = pose.spin!
        XCTAssertEqual(spin.carries, ["spark.y"])
        let target = pose.channels["spark.y"]!.number!
        _ = try applyPose(c, "eager", now: 0)
        c.tweens.tick(pose.duration)
        // At 0.3 s the pose's OWN channels are finished — `back.out(1.7)` at p = 1
        // is exactly 1, so `body.scale` sits on its target.
        near(c.channels.get("body.scaleX")!.number!, 1.05)
        // `spark.y` is not: it rides the spin's 0.6 s and `power2.out` instead of
        // the pose's 0.3 s and `back.out(1.7)`, so it is seven eighths of the way
        // there. p = 0.3/0.6 = 0.5 and power2.out(0.5) = 1 − 0.5³ = 0.875.
        //
        // Why this is a channel list in data and not a rule in code: one node is
        // one matrix, and a node the spin turns while a pose also moves it is
        // being written by two clocks. Whichever finishes first parks its half of
        // the matrix while the other is still travelling, and the node reads
        // wrong for the whole overlap — 14% too big on a spinning pose with a
        // long carry, for the entire 0.9 s. Naming the passengers in `poses.json`
        // keeps the engine
        // anatomy-agnostic: it never has to know that a body scaling under a spin
        // is different from a brow raising under one.
        near(c.channels.get("spark.y")!.number!, target * 0.875)
        c.tweens.tick(spin.duration)
        near(c.channels.get("spark.y")!.number!, target, 1e-9)
    }

    func testLetsALaterPoseInterruptAnEarlierOneMidFlight() throws {
        let c = try ctx()
        _ = try applyPose(c, "eager", now: 0)
        c.tweens.tick(0.2)
        _ = try applyPose(c, "out", now: 0.2)
        c.tweens.tick(2.0)
        // `out` names these, so its tweens replaced `eager`'s under newest-wins.
        XCTAssertEqual(c.channels.get("line.shape"), .text("M40,72L50,72L60,72"))
        XCTAssertEqual(c.channels.get("body.ink"), .text("#112233"))
        // `out` does NOT name these, so `eager`'s tweens were never cancelled and
        // ran to completion. An interrupt replaces channels, not whole poses —
        // which is exactly why `applyPose` needs no notion of a "current" pose.
        near(c.channels.get("body.scaleX")!.number!, 1.05)
        near(c.channels.get("limb.bend")!.number!, 6)
        XCTAssertEqual(c.tweens.active, 0)
    }

    func testThrowsOnAnUnknownMood() throws {
        let c = try ctx()
        XCTAssertThrowsError(try applyPose(c, "smug", now: 0)) { error in
            XCTAssertEqual(error as? AnimError, AnimError("unknown mood: smug"))
        }
    }
}

final class TimelineTests: XCTestCase {
    func testReportsTheFlipsSpan() throws {
        let c = try ctx()
        let h = try playTimeline(c, "flip", now: 10)
        XCTAssertEqual(h.name, "flip")
        near(h.startedAt, 10)
        near(h.endsAt, 10.5)
    }

    func testSnapsTheLineFamilyAtZeroAndBackAtPoint3NeverTweeningIt() throws {
        let c = try ctx()
        XCTAssertEqual(c.channels.get("line.family"), .text("line"))   // the rest seed
        _ = try playTimeline(c, "flip", now: 0)
        // The snap is authored at `at: 0`, sharing its instant with the 0.2s morph
        // that bows the line; it survives that morph's `add` only because a
        // duration-0 tween lands at add time (Task 28, rule 4).
        drive(c, from: 0, to: 0.1)
        XCTAssertEqual(c.channels.get("line.family"), .text("arcLine"))
        // sine.inOut at p = 0.5, so exactly half way between the two cubics.
        XCTAssertEqual(c.channels.get("line.shape"), .text("M40,74C44,64,56,64,60,74"))
        drive(c, from: 0.1, to: 0.25)
        XCTAssertEqual(c.channels.get("line.family"), .text("arcLine"))   // still bowed
        XCTAssertEqual(c.channels.get("line.shape"), .text("M40,76C44,62,56,62,60,76"))
        drive(c, from: 0.25, to: 0.35)
        XCTAssertEqual(c.channels.get("line.family"), .text("line"))
        // Written verbatim by the snap — and equal to the seeded rest string only
        // because the loader canonicalised the authored literal.
        XCTAssertEqual(c.channels.get("line.shape"), .text("M40,70L50,74L60,70"))
    }

    func testNeverAsksTheMorphToCrossFamilies() throws {
        let c = try ctx()
        _ = try playTimeline(c, "flip", now: 0)
        // A step that DID cross families would not trap — `lerpValue` snaps such
        // a pair (Task 28) — so "it ran and reached the end" proves nothing, and
        // neither does the endpoint, which a snap also reaches. What a snap
        // cannot fake is movement: it writes one value and holds it. Sampling
        // inside the morph and requiring every sample to differ is the assertion.
        // All three instants sit inside `flip`'s 0.2s morph on purpose — past
        // 0.3 the closing family snap has landed and every later sample is the
        // same "M40,70L50,74L60,70", which would make this vacuous again.
        var seen = Set<String>()
        var at = 0.0
        for t in [0.05, 0.1, 0.15] {
            drive(c, from: at, to: t)
            seen.insert(c.channels.get("line.shape")?.text ?? "")
            at = t
        }
        XCTAssertEqual(seen.count, 3)
        drive(c, from: at, to: 0.6)
        XCTAssertEqual(c.channels.get("line.shape"), .text("M40,70L50,74L60,70"))
    }

    func testDoesNotApplyThePoseDelayLadder() throws {
        let c = try ctx()
        _ = try playTimeline(c, "flip", now: 0)
        drive(c, from: 0, to: 0.05)
        // `line.shape`'s ladder delay is 0.08. Under the ladder nothing here would
        // have moved yet — and worse, the opening snap would have carried the same
        // non-zero delay, so rule 4 would not have fired it and this run would have
        // trapped. sine.inOut at p = 0.25 is 0.1464466094067262.
        XCTAssertEqual(c.channels.get("line.shape"),
                       .text("M40,72.585786C44,65.414214,56,65.414214,60,72.585786"))
    }

    func testFansAGroupChannelOutToEveryMember() throws {
        let c = try ctx()
        _ = try playTimeline(c, "wink", now: 0)
        drive(c, from: 0, to: 0.05)
        // power2.in(t) = t^3 (Ease.swift: powerN.in raises to N+1), and
        // p = 0.05/0.08 = 0.625, so power2.in(p) = 0.244140625;
        // 1 + (0.1 − 1) × that = 0.7802734375.
        near(c.channels.get("eye.scaleY")!.number!, 0.7802734375)
        near(c.channels.get("pupil.scaleY")!.number!, 0.7802734375)
        drive(c, from: 0.05, to: 0.25)
        near(c.channels.get("eye.scaleY")!.number!, 1)
        near(c.channels.get("pupil.scaleY")!.number!, 1)
    }

    func testCallsOnDoneExactlyOnceAtTheEnd() throws {
        let c = try ctx()
        var done = 0
        _ = try playTimeline(c, "flip", now: 0) { done += 1 }
        drive(c, from: 0, to: 0.45)
        XCTAssertEqual(done, 0)
        drive(c, from: 0.45, to: 0.55)
        XCTAssertEqual(done, 1)
        drive(c, from: 0.55, to: 3)
        XCTAssertEqual(done, 1)
    }

    func testCancelsCleanlyWithoutFiringOnDone() throws {
        let c = try ctx()
        var done = 0
        let h = try playTimeline(c, "flip", now: 0) { done += 1 }
        drive(c, from: 0, to: 0.1)
        h.cancel()
        drive(c, from: 0.1, to: 3)
        XCTAssertEqual(done, 0)
        // Cancelling drops the pending one-shots, so the closing snap never
        // fires from the timeline's own schedule — but `cancel` is not silent
        // about the family it snapped: the TypeScript (`timeline.ts`'s
        // `cancel`) hands every node this timeline moved into a non-rig family
        // back to what the rig itself declares (`config.families`), which for
        // `line` is `"line"`, the same family its rest pose is in. Leaving the
        // channel claiming `"arcLine"` — a family nothing else in the engine
        // will ever repaint — would stick the geometry to whichever pose or
        // timeline happens to touch `line.shape` next assuming a family that
        // isn't there.
        XCTAssertEqual(c.channels.get("line.family"), .text("line"))
    }

    func testHoldsEachPhaseAtTheInstantItWasAuthoredFor() throws {
        // t = 0.14 is halfway through `wink`'s second step, which is authored at
        // `at: 0.08` and therefore starts from what the FIRST step reached at
        // exactly 0.08 — rule 5's guarantee. power2.out at p = 0.5 is 0.875, and
        // the handoff value is 0.1, so 0.1 + (1 − 0.1) × 0.875 = 0.8875. If the
        // expansion loses each step's own start instant (scheduling every tween at
        // the timeline's start rather than at `fired`), both steps fire at 0, the
        // second wins immediately, and this reads 1.
        let c = try ctx()
        _ = try playTimeline(c, "wink", now: 0)
        drive(c, from: 0, to: 0.14)
        near(c.channels.get("eye.scaleY")!.number!, 0.8875, 1e-12)
        near(c.channels.get("pupil.scaleY")!.number!, 0.8875, 1e-12)
    }

    func testLandsOnIdenticalNumbersAt60And240fps() throws {
        // The whole store, not one channel, and MID-FLIGHT as well as at the end.
        // An end-state-only comparison is true by construction under rule 2 —
        // every tween has finished and written its literal `to` — so it passes no
        // matter what the engine did in between. `wink`'s handoff at 0.08 is the
        // instant that actually depends on the tick grid: without rule 5 this
        // reads 0.9348958333333335 at 60 fps and 0.8909791310628257 at 240.
        func snapshot(_ fps: Double, _ until: Double) throws -> String {
            let c = try ctx()
            _ = try playTimeline(c, "wink", now: 0)
            var t = 0.0
            while t <= until + 1e-12 {
                c.scheduler.tick(t)
                c.tweens.tick(t)
                t += 1.0 / fps
            }
            c.scheduler.tick(until)
            c.tweens.tick(until)
            // `names()` sorts, so the snapshot is stable and a diff names the
            // channel. Never `channels` itself — rule 6.
            return c.channels.names().map { "\($0)=\(c.channels.get($0)!)" }
                .joined(separator: "\n")
        }
        XCTAssertEqual(try snapshot(60, 0.14), try snapshot(240, 0.14))
        XCTAssertEqual(try snapshot(60, 0.2), try snapshot(240, 0.2))

        // `flip` ends on a verbatim snap, so its end state pins the literal the
        // TypeScript suite pins too.
        let c = try ctx()
        _ = try playTimeline(c, "flip", now: 0)
        drive(c, from: 0, to: 0.55)
        XCTAssertEqual(c.channels.get("line.shape"), .text("M40,70L50,74L60,70"))
    }

    func testThrowsOnAnUnknownTimeline() throws {
        let c = try ctx()
        XCTAssertThrowsError(try playTimeline(c, "shrug", now: 0)) { error in
            XCTAssertEqual(error as? AnimError, AnimError("unknown timeline: shrug"))
        }
    }
}
