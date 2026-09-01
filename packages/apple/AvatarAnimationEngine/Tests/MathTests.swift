import XCTest
@testable import AvatarAnimationEngine

private func near(_ a: Double, _ b: Double, _ tol: Double = 1e-9,
                  file: StaticString = #filePath, line: UInt = #line) {
    XCTAssertLessThan(abs(a - b), tol, "\(a) vs \(b)", file: file, line: line)
}

final class MatTests: XCTestCase {
    func testIdentityIsANoOp() {
        let m = Mat(a: 2, b: 0, c: 0, d: 3, e: 10, f: 20)
        XCTAssertEqual(Mat.identity * m, m)
        XCTAssertEqual(m * Mat.identity, m)
    }

    func testRotatesAboutAnAbsolutePivotLeavingThePivotFixed() {
        let m = Mat.from(rotation: 90, pivot: (200, 200))
        let fixed = m.apply(x: 200, y: 200)
        near(fixed.x, 200)
        near(fixed.y, 200)
        // Straight up from the pivot; a +90 turn in screen space (y down) sends
        // it right.
        let up = m.apply(x: 200, y: 100)
        near(up.x, 300)
        near(up.y, 200)
    }

    func testScalesAboutAnAbsolutePivot() {
        let m = Mat.from(scaleX: 2, scaleY: 2, pivot: (200, 200))
        XCTAssertEqual(m, Mat(a: 2, b: 0, c: 0, d: 2, e: -200, f: -200))
        let p = m.apply(x: 300, y: 200)
        near(p.x, 400)
        near(p.y, 200)
    }

    func testOrdersTranslateThenRotateThenScaleAboutThePivot() {
        // Must match the web's composition, which matches GSAP's: x/y translate
        // the whole node AFTER the pivoted rotate+scale.
        let m = Mat.from(x: 5, y: 7, rotation: 180, scaleX: 2, scaleY: 2, pivot: (10, 10))
        let p = m.apply(x: 20, y: 10)
        near(p.x, -5)
        near(p.y, 17)
    }

    func testComposesParentThenChild() {
        let parent = Mat.from(x: 100)
        let child = Mat.from(scaleX: 2, scaleY: 2, pivot: (0, 0))
        let p = (parent * child).apply(x: 3, y: 4)
        near(p.x, 106)
        near(p.y, 8)
    }
}

final class EaseTests: XCTestCase {
    /// The web's vocabulary, verbatim. Any name outside it is a load error on
    /// both platforms, which is what stops a pose author inventing a curve one
    /// platform can render and the other cannot.
    static let names = [
        "none",
        "power1.in", "power1.out", "power1.inOut",
        "power2.in", "power2.out", "power2.inOut",
        "power3", "power3.in", "power3.out", "power3.inOut",
        "power4.in", "power4.out", "power4.inOut",
        "sine.in", "sine.out", "sine.inOut",
        "back.out", "back.out(1.5)", "back.out(1.6)", "back.out(1.7)",
        "back.out(2)", "back.out(2.4)", "back.out(3)",
    ]

    func testResolvesEveryNameInTheVocabularyAndPinsTheEndpoints() throws {
        for name in Self.names {
            let e = try Ease.resolve(name)
            // 1e-12, not exact equality: `back.out(s)`'s closed form evaluates
            // to 2.2e-16 at t=0 and `sine.in` to 1-1e-16 at t=1, in IEEE754 on
            // both platforms alike. An exact assertion here would be asserting
            // a rounding accident, not the curve.
            near(e(0), 0, 1e-12)
            near(e(1), 1, 1e-12)
        }
    }

    /// Ten curves sampled at five points, copied from the web implementation's
    /// own output. These are the cross-platform contract: the web asserts the
    /// same expressions against real GSAP (Plan A Task 6), so matching these
    /// matches GSAP transitively, without Swift needing GSAP.
    func testMatchesTheWebAtPinnedSamplePoints() throws {
        let cases: [(String, [Double])] = [
            ("none",         [0, 0.25, 0.5, 0.75, 1]),
            ("power1.in",    [0, 0.0625, 0.25, 0.5625, 1]),
            ("power1.out",   [0, 0.4375, 0.75, 0.9375, 1]),
            ("power1.inOut", [0, 0.125, 0.5, 0.875, 1]),
            ("power2.in",    [0, 0.015625, 0.125, 0.421875, 1]),
            ("power2.out",   [0, 0.578125, 0.875, 0.984375, 1]),
            ("power3.inOut", [0, 0.03125, 0.5, 0.96875, 1]),
            ("sine.in",      [0, 0.07612046748871326, 0.2928932188134524,
                              0.6173165676349102, 1]),
            ("sine.out",     [0, 0.3826834323650898, 0.7071067811865475,
                              0.9238795325112867, 1]),
            ("back.out",     [0, 0.8174096875, 1.0876975, 1.0641365625, 1]),
        ]
        for (name, want) in cases {
            let e = try Ease.resolve(name)
            for (i, expected) in want.enumerated() {
                near(e(Double(i) / 4), expected, 1e-12)
            }
        }
    }

    func testRejectsAnythingOutsideTheVocabulary() {
        XCTAssertThrowsError(try Ease.resolve("elastic.out"))
        XCTAssertThrowsError(try Ease.resolve("back.in(2)"))
    }
}

final class PrngTests: XCTestCase {
    func testEmitsThePinnedReferenceStreamForSeedOne() {
        // The same five uint32s Plan A Task 7 pins in TypeScript. If these
        // differ, the whole determinism contract is already broken and every
        // golden comparison below is meaningless.
        let p = Prng(seed: 1)
        let got = (0..<5).map { _ in p.next() }
        XCTAssertEqual(got, [1144403687, 1290228702, 3651710282, 626043614, 3583050788])
    }

    func testIsReproducibleFromASeed() {
        let a = Prng(seed: 0x9e37_79b9)
        let b = Prng(seed: 0x9e37_79b9)
        for _ in 0..<1000 { XCTAssertEqual(a.next(), b.next()) }
    }

    func testFloatsStayInTheUnitInterval() {
        let p = Prng(seed: 42)
        for _ in 0..<10_000 {
            let f = p.float()
            XCTAssertGreaterThanOrEqual(f, 0)
            XCTAssertLessThan(f, 1)
        }
    }

    func testRangeAndSignedAreCentredCorrectly() {
        let p = Prng(seed: 7)
        var sum = 0.0
        for _ in 0..<20_000 { sum += p.signed(4) }
        XCTAssertLessThan(abs(sum / 20_000), 0.1)
        let q = Prng(seed: 7)
        for _ in 0..<1000 {
            let v = q.range(2, 5)
            XCTAssertGreaterThanOrEqual(v, 2)
            XCTAssertLessThan(v, 5)
        }
    }

    func testPickNeverIndexesOutOfBounds() {
        let p = Prng(seed: 3)
        let items = ["a", "b", "c"]
        for _ in 0..<5000 { XCTAssertTrue(items.contains(p.pick(items))) }
    }
}
