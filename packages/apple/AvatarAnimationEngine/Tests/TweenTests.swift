import XCTest
@testable import AvatarAnimationEngine

final class TweenTests: XCTestCase {
    private func near(_ a: Double, _ b: Double, _ eps: Double = 1e-9,
                      file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertLessThan(abs(a - b), eps, "\(a) !≈ \(b)", file: file, line: line)
    }

    func testInterpolatesANumberOverAbsoluteTime() {
        let ch = Channels(["eye.scaleY": 1])
        let tw = Tweens(channels: ch)
        tw.add(TweenSpec(channel: "eye.scaleY", to: 0.1, duration: 0.4, ease: "none"), now: 10)

        tw.tick(10)
        near(ch.get("eye.scaleY")!.number!, 1)
        tw.tick(10.2)
        near(ch.get("eye.scaleY")!.number!, 0.55)
        tw.tick(10.4)
        near(ch.get("eye.scaleY")!.number!, 0.1)
        XCTAssertEqual(tw.active, 0)
    }

    func testSnapsAPivotToItsTargetAtAddTimeHoweverLongADurationItIsGiven() {
        let ch = Channels(["body.pivotY": 50])
        let tw = Tweens(channels: ch)
        // A pivot is not a quantity that moves — it is WHERE the moving happens.
        // Slide one across a tween and every frame in between composes a rotation
        // about an origin nobody authored, dragging the whole subtree sideways
        // for the length of the tween. GSAP says the same by construction:
        // `transformOrigin` is applied when a tween starts, never interpolated.
        tw.add(TweenSpec(channel: "body.pivotY", to: 74, duration: 0.9), now: 0)
        near(ch.get("body.pivotY")!.number!, 74)
        XCTAssertEqual(tw.active, 0)
    }

    func testStillWaitsOutAPivotsDelayAndThenJumps() {
        let ch = Channels(["body.pivotX": 50])
        let tw = Tweens(channels: ch)
        tw.add(TweenSpec(channel: "body.pivotX", to: 80, duration: 0.9, delay: 0.2),
               now: 0)
        // The jump lands where the tween would have STARTED — exactly where GSAP
        // puts it — so the channel holds its old origin until then and is never
        // at a value in between.
        tw.tick(0.1)
        near(ch.get("body.pivotX")!.number!, 50)
        tw.tick(0.2)
        near(ch.get("body.pivotX")!.number!, 80)
    }

    func testLandsOnTheSameValueRegardlessOfFrameRate() {
        func run(_ step: Double) -> Double {
            let ch = Channels(["x": 0])
            let tw = Tweens(channels: ch)
            tw.add(TweenSpec(channel: "x", to: 100, duration: 1, ease: "power3.out"), now: 0)
            // Index-multiplied rather than accumulated, so the sample times
            // themselves carry no drift for the tween to be credited with.
            var i = 0
            while Double(i) * step <= 0.7 + 1e-12 {
                tw.tick(Double(i) * step)
                i += 1
            }
            tw.tick(0.7)
            return ch.get("x")!.number!
        }
        near(run(1.0 / 60), run(1.0 / 240), 1e-12)
    }

    func testHonoursADelayByHoldingTheFromValue() {
        let ch = Channels(["x": 0])
        let tw = Tweens(channels: ch)
        tw.add(TweenSpec(channel: "x", to: 1, duration: 0.2, delay: 0.08, ease: "none"), now: 0)
        tw.tick(0.05)
        near(ch.get("x")!.number!, 0)
        tw.tick(0.18)
        near(ch.get("x")!.number!, 0.5)   // 0.49999999999999994 — inside 1e-9
    }

    // Mirrors the TS suite's "starts from an explicit `from` instead of the
    // channel's current value" — not in the brief's own list, but present in
    // tween.test.ts and exercising a path (`from` overriding the channel's
    // current value, with no `respond`) that nothing else here covers.
    func testStartsFromAnExplicitFromInsteadOfTheChannelsCurrentValue() {
        let ch = Channels(["x": 5])
        let tw = Tweens(channels: ch)
        tw.add(TweenSpec(channel: "x", to: 10, duration: 1, ease: "none", from: 0), now: 0)
        tw.tick(0.5)
        near(ch.get("x")!.number!, 5)
        tw.tick(1)
        near(ch.get("x")!.number!, 10)
    }

    func testLetsANewerTweenCancelTheOlderOneOnTheSameChannel() {
        let ch = Channels(["x": 0])
        let tw = Tweens(channels: ch)
        tw.add(TweenSpec(channel: "x", to: 100, duration: 1, ease: "none"), now: 0)
        tw.tick(0.5)
        tw.add(TweenSpec(channel: "x", to: 0, duration: 1, ease: "none"), now: 0.5)
        XCTAssertEqual(tw.active, 1)
        tw.tick(1)
        near(ch.get("x")!.number!, 25)    // from 50, half way back to 0
    }

    func testInterpolatesColoursAndPaths() {
        let ch = Channels([
            "body.ink": "#00ff41",
            "mouth.shape": "M187,233L200,246L213,233",
        ])
        let tw = Tweens(channels: ch)
        tw.add(TweenSpec(channel: "body.ink", to: "#ff2d2d", duration: 1, ease: "none"), now: 0)
        tw.add(TweenSpec(channel: "mouth.shape", to: "M189,235L200,235L211,235",
                         duration: 1, ease: "none"), now: 0)
        tw.tick(1)
        XCTAssertEqual(ch.get("body.ink"), .text("#ff2d2d"))
        XCTAssertEqual(ch.get("mouth.shape"), .text("M189,235L200,235L211,235"))
    }

    func testMapsAnEndpointThroughRespondAndThenLerpsInTheMappedSpace() {
        // The antenna sway, exactly: a symmetric swing whose inward half is
        // damped to 0.72. The original tweens the two PATHS, so the rendered
        // deflection runs -10.64 to +7.66 in a straight line. Damping the LIVE
        // value instead would fold the outward half over at the zero crossing
        // and read +0.14 at the midpoint, where the straight lerp reads -1.49.
        let damp: (String, ChannelValue) -> ChannelValue = { _, v in
            guard case let .number(n) = v, n > 0 else { return v }
            return .number(n * 0.72)
        }
        let ch = Channels(["antennaLeft.bend": 0])
        let tw = Tweens(channels: ch, respond: damp)
        tw.add(TweenSpec(channel: "antennaLeft.bend", to: -10.64, duration: 0), now: 0)
        near(ch.get("antennaLeft.bend")!.number!, -10.64)

        tw.add(TweenSpec(channel: "antennaLeft.bend", to: 10.64,
                         duration: 1, ease: "none"), now: 0)
        tw.tick(0.5)
        near(ch.get("antennaLeft.bend")!.number!, (-10.64 + 10.64 * 0.72) / 2)
        tw.tick(1)
        near(ch.get("antennaLeft.bend")!.number!, 10.64 * 0.72)
    }

    func testMapsAnExplicitFromThroughRespondToo() {
        let damp: (String, ChannelValue) -> ChannelValue = { _, v in
            guard case let .number(n) = v, n > 0 else { return v }
            return .number(n * 0.72)
        }
        let ch = Channels(["b": 0])
        let tw = Tweens(channels: ch, respond: damp)
        tw.add(TweenSpec(channel: "b", to: 0, duration: 1, ease: "none", from: 10), now: 0)
        tw.tick(0)
        near(ch.get("b")!.number!, 7.2)
    }

    func testAppliesAZeroDurationTweenAtAddTimeBeforeAnyTick() {
        let ch = Channels(["mouth.family": "mouth"])
        let tw = Tweens(channels: ch)
        tw.add(TweenSpec(channel: "mouth.family", to: "mouthO", duration: 0), now: 3)
        XCTAssertEqual(ch.get("mouth.family"), .text("mouthO"))   // no tick has run yet
        XCTAssertEqual(tw.active, 0)                              // nothing left live
        tw.tick(3)
        XCTAssertEqual(ch.get("mouth.family"), .text("mouthO"))
    }

    func testLetsASameInstantFamilySnapSurviveTheMorphThatSupersedesIt() {
        // The yawn authors both of these at `at: 0` on `mouth.shape`: a duration-0
        // snap into family `mouthO`, then the 0.85s morph that opens it. Both fire
        // inside ONE scheduler.tick, so rule 1 cancels the snap before it could ever
        // have ticked. Rule 4 is the only reason the mouth ANIMATES open rather
        // than popping open at t=0 (see below).
        let poly = "M189,235L200,235L211,235"
        let closed = "M200,233.6C207.18,233.6 213,234.37 213,235C213,235.63 207.18,236.4 "
            + "200,236.4C192.82,236.4 187,235.63 187,235C187,234.37 192.82,233.6 200,233.6Z"
        let small = "M200,225C204.97,225 209,229.97 209,236C209,242.03 204.97,247 200,247C"
            + "195.03,247 191,242.03 191,236C191,229.97 195.03,225 200,225Z"
        let ch = Channels(["mouth.shape": .text(poly)])
        let tw = Tweens(channels: ch)
        tw.add(TweenSpec(channel: "mouth.shape", to: .text(closed), duration: 0), now: 0)
        XCTAssertEqual(ch.get("mouth.shape"), .text(closed))   // verbatim, not re-emitted
        tw.add(TweenSpec(channel: "mouth.shape", to: .text(small),
                         duration: 0.85, ease: "none"), now: 0)
        XCTAssertEqual(tw.active, 1)
        // MCCCCZ -> MCCCCZ, so it really interpolates: the exact midpoint of
        // `closed` and `small` under `ease: "none"` at half of 0.85. Without
        // rule 4 the pair is MLL -> MCCCCZ, which `lerpValue` snaps — the channel
        // would hold `small` here, and this assertion is what catches it.
        // "it ran without trapping" would NOT: nothing traps any more, which is
        // exactly why this test asserts a value instead.
        tw.tick(0.425)
        XCTAssertEqual(ch.get("mouth.shape"), .text(
            "M200,229.3C206.075,229.3,211,232.17,211,235.5C211,238.83,206.075,"
            + "241.7,200,241.7C193.925,241.7,189,238.83,189,235.5C189,232.17,"
            + "193.925,229.3,200,229.3Z"))
        tw.tick(0.85)
        XCTAssertEqual(tw.active, 0)
    }

    func testSnapsAPathAcrossShapeFamiliesInsteadOfTrapping() {
        // The crossing nobody authored. `yawn` holds `mouth.shape` in family
        // `mouthO` ("MCCCCZ") for 1.85s; every one of the 14 poses drives that
        // same channel with an "MLL" polyline. A poke during a yawn — which
        // `behavior.waking` makes reachable — asks for MCCCCZ -> MLL, and the
        // reverse is asked when the yawn's own later steps fire after the pose.
        // Neither may trap, and both must land on `to` at once.
        let poly = "M189,235L200,235L211,235"
        let open = "M200,225C204.97,225 209,229.97 209,236C209,242.03 204.97,247 200,247C"
            + "195.03,247 191,242.03 191,236C191,229.97 195.03,225 200,225Z"
        let ch = Channels(["mouth.shape": .text(open)])
        let tw = Tweens(channels: ch)
        tw.add(TweenSpec(channel: "mouth.shape", to: .text(poly),
                         duration: 0.3, ease: "none"), now: 0)
        // Written on the FIRST tick, not held until the end: a family crossing is
        // a snap, and a snap that waited 300ms would read as a freeze.
        tw.tick(0.1)
        XCTAssertEqual(ch.get("mouth.shape"), .text(poly))
        tw.tick(0.3)
        XCTAssertEqual(ch.get("mouth.shape"), .text(poly))
        XCTAssertEqual(tw.active, 0)
        // ...and back the other way.
        tw.add(TweenSpec(channel: "mouth.shape", to: .text(open),
                         duration: 0.3, ease: "none"), now: 0.3)
        tw.tick(0.4)
        XCTAssertEqual(ch.get("mouth.shape"), .text(open))
    }

    func testSnapsAColourPairParseHexCannotReadInsteadOfTrapping() {
        // `isHex` gated a `try!`, and the two disagreed about what a hex digit
        // is: `Character.isHexDigit` follows Unicode's `Hex_Digit` property, so
        // the FULLWIDTH DIGIT ZERO below is a hex digit to the gate and a throw
        // to `Color.parseHex`. The result was a trap on the per-frame tween
        // path. The gate is now ASCII-only, and the mix is fallible either way:
        // an unmixable pair snaps to `to`, exactly as a shape-family crossing
        // does, so the frame keeps rendering.
        // Both shapes the two platforms' gates used to disagree about: the
        // fullwidth zero (Swift's, which trapped) and a 4-digit body (the web's,
        // whose `{3,6}` regex admitted it and threw). Neither is mixable, so
        // both take the uninterpolatable path -- hold `from`, snap at t=1 --
        // which is the answer `lerpValue`'s last line already gives, and the
        // one `tween.ts` now gives for the same two inputs.
        for bad in ["#\u{FF10}0ff41", "#abcd"] {
            let ch = Channels(["body.ink": .text(bad)])
            let tw = Tweens(channels: ch)
            tw.add(TweenSpec(channel: "body.ink", to: .text("#ff2d2d"),
                             duration: 1, ease: "none"), now: 0)
            tw.tick(0.5)
            XCTAssertEqual(ch.get("body.ink"), .text(bad))
            tw.tick(1)
            XCTAssertEqual(ch.get("body.ink"), .text("#ff2d2d"))
        }
    }

    func testSettlesTheTweenItReplacesAtTheInstantOfTheHandoff() {
        // Rule 5. The outgoing tween writes what it shows AT the handoff instant,
        // so the incoming tween's `from` is that value and not whatever the last
        // tick left behind. The handoff at 0.75 falls between ticks on purpose.
        let ch = Channels(["x": 0])
        let tw = Tweens(channels: ch)
        tw.add(TweenSpec(channel: "x", to: 10, duration: 1, ease: "none"), now: 0)
        tw.tick(0.5)
        near(ch.get("x")!.number!, 5)
        tw.add(TweenSpec(channel: "x", to: 0, duration: 1, ease: "none"), now: 0.75)
        near(ch.get("x")!.number!, 7.5)    // settled to 0.75 — NOT left at 5
        tw.tick(1.25)
        near(ch.get("x")!.number!, 3.75)   // half way back from 7.5
    }

    func testHandsOffToTheSameValueAt60And240And1000fps() {
        // Rule 5 is what makes rule 2's promise survive an interrupt. Without it
        // the incoming tween reads whichever tick happened to land last, so the
        // same animation on the same clock ends up somewhere different at each
        // rate: 0.5184 / 0.5514796875 / 0.5541852249. The interrupt instant 0.41
        // is deliberately off all three grids — an on-grid one hides the defect.
        func at(_ fps: Double) -> Double {
            let ch = Channels(["x": 0])
            let tw = Tweens(channels: ch)
            tw.add(TweenSpec(channel: "x", to: 10, duration: 1, ease: "power2.in"), now: 0)
            var t = 0.0
            while t < 0.41 { tw.tick(t); t += 1 / fps }
            tw.add(TweenSpec(channel: "x", to: 0, duration: 1, ease: "none"), now: 0.41)
            t = 0.41
            while t <= 0.6 { tw.tick(t); t += 1 / fps }
            tw.tick(0.6)
            return ch.get("x")!.number!
        }
        // 0.41^3 * 10 = 0.68921, then 81% of the way back. The value is analytic,
        // not recorded from a run, and TypeScript produces the identical bits.
        near(at(60), 0.5582601)
        near(at(240), at(60))
        near(at(1000), at(60))
    }
}
