import XCTest
@testable import AvatarAnimationEngine

final class ParseTests: XCTestCase {
    /// The grammar contract, as a corpus rather than as prose: every string
    /// here is accepted by BOTH platforms with the same result, or rejected by
    /// both, and Plan A Task 8 carries the identical list. Every entry was
    /// checked by running the real `Double` initialiser and the real JS regex,
    /// not reasoned about: `Double("5.")` is 5.0 and `Double("5.e2")` is 500.0,
    /// which is why `flushNumber` needs its own decimal-point guard, and web's
    /// tokeniser silently skipped whatever it could not match, which is why it
    /// now rejects every unconsumed non-separator character.
    func testAgreesWithTheWebOnTheWholeGrammar() throws {
        let accepted: [(String, String, [Double])] = [
            ("M187,233 L200,246 L213,233", "MLL", [187, 233, 200, 246, 213, 233]),
            ("M0,0L1,1", "ML", [0, 0, 1, 1]),
            ("M0,0\rL1,1", "ML", [0, 0, 1, 1]),
            ("M0,0\tL1,1", "ML", [0, 0, 1, 1]),
            ("M0,0\nL1,1", "ML", [0, 0, 1, 1]),
            ("M.5,.5", "M", [0.5, 0.5]),
            ("M1e2,3", "M", [100, 3]),
            ("M1E2,3", "M", [100, 3]),
            ("M1e-2,3", "M", [0.01, 3]),
            ("M-1,-2", "M", [-1, -2]),
            ("M-1-2", "M", [-1, -2]),
            ("M0,0Z", "MZ", [0, 0]),
        ]
        for (d, kind, points) in accepted {
            let p = try parsePath(d)
            XCTAssertEqual(p.kind, kind, d)
            XCTAssertEqual(p.points, points, d)
        }

        // Rejected by both. The middle five are the ones web used to swallow:
        // its tokeniser skipped any character it could not match, so a dangling
        // sign or exponent vanished and the path parsed as if it were clean.
        for d in ["m0,0", "M0,0 Q1,1", "M0", "0,0", "M1,2 3,4",
                  "M5.,3", "M5..3", "M0,0-", "M0,0e", "M0,0\u{000B}L1,1",
                  "M1+2,3", "M0,0 C1,1"] {
            XCTAssertThrowsError(try parsePath(d), d)
        }
    }

    func testReadsAThreePointMouthPolyline() throws {
        let p = try parsePath("M187,233 L200,246 L213,233")
        XCTAssertEqual(p.kind, "MLL")
        XCTAssertEqual(p.points, [187, 233, 200, 246, 213, 233])
    }

    func testReadsAClosedFourAnchorCubicO() throws {
        let p = try parsePath(
            "M200,224C204.97,224 209,228.97 209,235C209,241.03 204.97,246 200,246"
            + "C195.03,246 191,241.03 191,235C191,228.97 195.03,224 200,224Z"
        )
        XCTAssertEqual(p.kind, "MCCCCZ")
        XCTAssertEqual(p.points.count, 2 + 4 * 6)
    }

    func testRoundTrips() throws {
        let d = "M183,169 C180,148 175,126 179,105"
        let once = try parsePath(d)
        XCTAssertEqual(try parsePath(emitPath(once)).points, once.points)
    }

    func testRejectsCommandsOutsideTheSubset() {
        // `A` is deliberately out of the grammar: the brows are declared as
        // `{kind:"arc"}` in the rig and `Build.arc` turns them into cubics
        // before anything parses them, so no arc ever reaches here.
        XCTAssertThrowsError(try parsePath("M0,0 A45,45 0 0 1 10,10"))
        XCTAssertThrowsError(try parsePath("m0,0 l1,1"))
    }
}

final class BuildTests: XCTestCase {
    func testEmitsAnArcAsCubicsWithNoACommand() throws {
        let d = Build.arc(cx: 152, cy: 200, r: 45, from: 233.1301, to: 306.8699)
        XCTAssertFalse(d.contains("A"))
        let p = try parsePath(d)
        XCTAssertTrue(p.kind.hasPrefix("M"))
        XCTAssertTrue(p.kind.dropFirst().allSatisfy { $0 == "C" })
    }

    func testPlacesTheBrowEndpointsAtCxPlusMinus27AtY164() throws {
        let p = try parsePath(Build.arc(cx: 152, cy: 200, r: 45,
                                        from: 233.1301, to: 306.8699))
        XCTAssertLessThan(abs(p.points[0] - 125), 1e-3)
        XCTAssertLessThan(abs(p.points[1] - 164), 1e-3)
        XCTAssertLessThan(abs(p.points[p.points.count - 2] - 179), 1e-3)
        XCTAssertLessThan(abs(p.points[p.points.count - 1] - 164), 1e-3)
    }

    func testBuildsARingAsTwoConcentricCirclesOuterThenInnerReversed() throws {
        XCTAssertEqual(try parsePath(Build.ring(cx: 152, cy: 200, r: 35, band: 8)).kind,
                       "MCCCCZMCCCCZ")
    }

    func testBuildsADiscAsOneClosedFourAnchorCircle() throws {
        XCTAssertEqual(try parsePath(Build.disc(cx: 152, cy: 200, r: 9)).kind, "MCCCCZ")
    }

    func testBuildsCubicOWithKPointFiveFiveTwoThree() throws {
        let p = try parsePath(Build.cubicO(cx: 200, cy: 235, rx: 13, ry: 1.4))
        XCTAssertEqual(p.kind, "MCCCCZ")
        XCTAssertLessThan(abs(p.points[2] - (200 + 13 * 0.5523)), 1e-9)
    }

    func testBuildsPolylinesAndBeziers() throws {
        XCTAssertEqual(
            try parsePath(Build.polyline([[187, 233], [200, 246], [213, 233]])).kind, "MLL")
        XCTAssertEqual(
            try parsePath(Build.bezier([[183, 169], [180, 148], [175, 126], [179, 105]])).kind,
            "MC")
    }

    func testMatchesTheWebsTextByteForByte() throws {
        // Not a formatting nicety: `.shape` channel values ARE these strings, and
        // Task 38 replays goldens recorded by the web. `String(13.0)` is "13.0"
        // in Swift and "13" in JS, so a naive formatter diverges on every
        // integral coordinate — which is most of them.
        XCTAssertEqual(Build.disc(cx: 152, cy: 200, r: 9),
                       "M152,191C156.9707,191 161,195.0293 161,200"
                       + "C161,204.9707 156.9707,209 152,209"
                       + "C147.0293,209 143,204.9707 143,200"
                       + "C143,195.0293 147.0293,191 152,191Z")
    }
}

final class MorphTests: XCTestCase {
    func testInterpolatesTwoSameKindMouths() throws {
        let a = try parsePath("M187,233 L200,246 L213,233")
        let b = try parsePath("M189,235 L200,235 L211,235")
        let mid = try morphPath(a, b, 0.5)
        XCTAssertEqual(mid.kind, "MLL")
        XCTAssertEqual(mid.points, [188, 234, 200, 240.5, 212, 234])
    }

    func testReturnsTheEndpointsExactly() throws {
        let a = try parsePath("M187,233 L200,246 L213,233")
        let b = try parsePath("M189,235 L200,235 L211,235")
        XCTAssertEqual(emitPath(try morphPath(a, b, 0)), emitPath(a))
        XCTAssertEqual(emitPath(try morphPath(a, b, 1)), emitPath(b))
    }

    func testExtrapolatesPastTheTargetWhenTheEaseOvershoots() throws {
        // `back.out(3)` crosses 1 a quarter of the way through and peaks near
        // 1.11, so the mouth has to be allowed past its own target and back.
        let a = try parsePath("M187,233 L200,246 L213,233")
        let b = try parsePath("M195,230 L200,235 L205,230")
        // 246 + (235 - 246) * 1.1
        XCTAssertEqual(try morphPath(a, b, 1.1).points[3], 233.9, accuracy: 1e-9)
        // 246 + (235 - 246) * -0.1
        XCTAssertEqual(try morphPath(a, b, -0.1).points[3], 247.1, accuracy: 1e-9)
    }

    func testRefusesToMorphAcrossShapeFamilies() throws {
        let poly = try parsePath("M187,233 L200,246 L213,233")
        let o = try parsePath(
            "M200,224C204.97,224 209,228.97 209,235C209,241.03 204.97,246 200,246"
            + "C195.03,246 191,241.03 191,235C191,228.97 195.03,224 200,224Z"
        )
        XCTAssertThrowsError(try morphPath(poly, o, 0.5)) { error in
            XCTAssertTrue("\(error)".contains("MLL"))
            XCTAssertTrue("\(error)".contains("MCCCCZ"))
        }
    }
}
