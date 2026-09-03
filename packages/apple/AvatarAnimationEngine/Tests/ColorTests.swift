import XCTest
@testable import AvatarAnimationEngine

final class ColorTests: XCTestCase {
    func testParsesAndReEmitsEveryPaletteEntry() throws {
        for hex in ["#00ff41", "#ff9500", "#ffd400", "#fffce0", "#ff2d2d",
                    "#4f7cff", "#5f7a64", "#4f6e57", "#33ccff", "#06140d"] {
            XCTAssertEqual(Color.toHex(try Color.parseHex(hex)), hex)
        }
    }

    func testRoundTripsSrgbThroughOklab() throws {
        for hex in ["#00ff41", "#ff2d2d", "#4f7cff", "#000000", "#ffffff"] {
            let rgb = try Color.parseHex(hex)
            let back = Color.oklabToSrgb(Color.srgbToOklab(rgb))
            // 1e-5, and NOT tighter -- the same bound Plan A Task 8 uses, for
            // the same reason: Ottosson's published matrices are not exact
            // inverses at ten decimal places, so a correct implementation
            // round-trips with ~1e-6 of error. This is a property of the
            // constants, which both platforms share verbatim. Transposing a
            // coefficient pair moves the error to ~19, so the bound still
            // catches every mistake that matters.
            XCTAssertLessThan(abs(rgb.r - back.r), 1e-5)
            XCTAssertLessThan(abs(rgb.g - back.g), 1e-5)
            XCTAssertLessThan(abs(rgb.b - back.b), 1e-5)
        }
    }

    func testPinsOklabLForWhiteAndBlack() throws {
        XCTAssertLessThan(abs(Color.srgbToOklab(try Color.parseHex("#ffffff")).r - 1), 1e-6)
        XCTAssertLessThan(abs(Color.srgbToOklab(try Color.parseHex("#000000")).r), 1e-9)
    }

    /// `clamp01` was a min/max pair, and every comparison against NaN is false,
    /// so NaN passed straight through to `Int(Double.nan.rounded())` -- which
    /// TRAPS, on the per-frame render path, for a value that should at worst
    /// render as a wrong colour. NaN reaches a colour channel from any
    /// divide-by-zero upstream in an interpolation. The web's twin does not
    /// crash but lies, printing "#NaNNaNNaN"; clamping to 0 makes both say
    /// black for the same input.
    func testRendersANaNChannelAsBlackRatherThanCrashing() {
        XCTAssertEqual(Color.toHex((Double.nan, Double.nan, Double.nan)), "#000000")
        XCTAssertEqual(Color.toHex((Double.nan, 1, 0)), "#00ff00")
    }

    func testMixesEndpointsExactly() throws {
        XCTAssertEqual(try Color.mix("#00ff41", "#ff2d2d", 0), "#00ff41")
        XCTAssertEqual(try Color.mix("#00ff41", "#ff2d2d", 1), "#ff2d2d")
    }

    func testKeepsGreenToRedSaturatedAtTheMidpoint() throws {
        let mid = try Color.mix("#00ff41", "#ff2d2d", 0.5)
        let (r, g, b) = try Color.parseHex(mid)
        XCTAssertGreaterThan(max(r, g, b) - min(r, g, b), 0.55)
    }

    func testAgreesWithTheWebOnTheMidpointHex() throws {
        // The one assertion that catches a transposed OKLab matrix coefficient:
        // a round-trip test passes with the inverse of a wrong forward matrix.
        XCTAssertEqual(try Color.mix("#00ff41", "#ff2d2d", 0.5), "#cead37")
    }

    /// Caught by code review: Swift's `Character.isHexDigit` follows Unicode's
    /// `Hex_Digit` property, which is also true for the fullwidth digit block
    /// (U+FF10 here), unlike the web's ASCII-only `/[^0-9a-fA-F]/` guard. A
    /// naive port lets this string past validation and then force-unwraps a
    /// failed `UInt8(_:radix:)` parse, trapping the process; it must throw a
    /// catchable error instead, the way the web does for the same input.
    func testRejectsANonAsciiHexDigitInsteadOfCrashing() {
        XCTAssertThrowsError(try Color.parseHex("#\u{FF10}0ff41"))
    }
}
