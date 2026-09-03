import Foundation

public typealias Rgb = (r: Double, g: Double, b: Double)

/// sRGB ⇄ OKLab (Björn Ottosson's matrices), and a perceptual mix.
///
/// The engine interpolates every colour here rather than componentwise in
/// sRGB, because a saturated palette is exactly where the two disagree: an
/// sRGB lerp between two fully saturated mood colours dips through grey. Both
/// endpoints are identical in either space, so only the middle of a transition
/// differs from the original implementation — the second of the three
/// deviations the spec's deletion criterion 1 names.
public enum Color {
    public enum Failure: Error, CustomStringConvertible {
        case badHex(String)
        public var description: String {
            switch self {
            case .badHex(let h): "bad hex colour: \(h)"
            }
        }
    }

    /// NaN-safe, and that is the whole point of the first clause: a min/max
    /// pair passes NaN straight through (every comparison against NaN is
    /// false), and `toHex` then evaluates `Int(Double.nan.rounded())`, which
    /// TRAPS — on the per-frame render path, for a value that should at worst
    /// render as a wrong colour. NaN reaches a colour channel from any
    /// divide-by-zero upstream in an interpolation. Clamping it to 0 is also
    /// what makes this side agree with the web again: `Math.round(NaN)` there
    /// is NaN and `toHex` prints "#NaNNaNNaN", so both platforms now say
    /// "#000000" for the same input rather than one crashing and one lying.
    private static func clamp01(_ v: Double) -> Double {
        v.isNaN ? 0 : (v < 0 ? 0 : (v > 1 ? 1 : v))
    }

    /// The web's guard is `/[^0-9a-fA-F]/.test(full)` — ASCII-only. Swift's
    /// `Character.isHexDigit` follows Unicode's `Hex_Digit` property, which is
    /// also true for the fullwidth digit and letter blocks (U+FF10-FF19,
    /// U+FF21-FF26, U+FF41-FF46); using it here would accept a string the web
    /// rejects, and one `UInt8(_:radix:)` then fails to parse.
    private static func isAsciiHexDigit(_ c: Character) -> Bool {
        ("0"..."9").contains(c) || ("a"..."f").contains(c) || ("A"..."F").contains(c)
    }

    public static func parseHex(_ hex: String) throws -> Rgb {
        var h = hex.trimmingCharacters(in: .whitespaces)
        if h.hasPrefix("#") { h.removeFirst() }
        if h.count == 3 { h = h.map { "\($0)\($0)" }.joined() }
        guard h.count == 6, h.allSatisfy(isAsciiHexDigit) else { throw Failure.badHex(hex) }
        // No force-unwrap: a string that somehow slips past the guard above
        // throws the same `Failure.badHex` rather than trapping the process —
        // a crash is a strictly worse failure mode than the web's catchable
        // `Error` on the same malformed input.
        func byte(_ lo: Int) throws -> Double {
            let s = h.index(h.startIndex, offsetBy: lo)
            let e = h.index(s, offsetBy: 2)
            guard let v = UInt8(h[s..<e], radix: 16) else { throw Failure.badHex(hex) }
            return Double(v) / 255
        }
        return (try byte(0), try byte(2), try byte(4))
    }

    public static func toHex(_ rgb: Rgb) -> String {
        func part(_ v: Double) -> String {
            String(format: "%02x", Int((clamp01(v) * 255).rounded()))
        }
        return "#\(part(rgb.r))\(part(rgb.g))\(part(rgb.b))"
    }

    private static func toLinear(_ c: Double) -> Double {
        c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
    }

    private static func toGamma(_ c: Double) -> Double {
        c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1 / 2.4) - 0.055
    }

    public static func srgbToOklab(_ rgb: Rgb) -> Rgb {
        let r = toLinear(rgb.r), g = toLinear(rgb.g), b = toLinear(rgb.b)
        let l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
        let m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
        let s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
        return (
            0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
        )
    }

    public static func oklabToSrgb(_ lab: Rgb) -> Rgb {
        let (L, a, bb) = lab
        let l = pow(L + 0.3963377774 * a + 0.2158037573 * bb, 3)
        let m = pow(L - 0.1055613458 * a - 0.0638541728 * bb, 3)
        let s = pow(L - 0.0894841775 * a - 1.291485548 * bb, 3)
        return (
            toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
            toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
            toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
        )
    }

    public static func mix(_ a: String, _ b: String, _ t: Double) throws -> String {
        if t <= 0 { return toHex(try parseHex(a)) }
        if t >= 1 { return toHex(try parseHex(b)) }
        let la = srgbToOklab(try parseHex(a))
        let lb = srgbToOklab(try parseHex(b))
        return toHex(oklabToSrgb((
            la.r + (lb.r - la.r) * t,
            la.g + (lb.g - la.g) * t,
            la.b + (lb.b - la.b) * t
        )))
    }
}
