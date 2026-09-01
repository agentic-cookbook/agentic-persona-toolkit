import Foundation

/// The ease vocabulary, matching GSAP's numerically.
///
///     powerN.in(t)    = t^(N+1)
///     powerN.out(t)   = 1 - (1-t)^(N+1)
///     powerN.inOut(t) = t < .5 ? 2^N * t^(N+1) : 1 - 2^N * (1-t)^(N+1)
///     a bare `powerN` means `.out` (GSAP's default direction) — only power3
///     is bare
///
///     sine.in    = 1 - cos(t*pi/2)
///     sine.out   = sin(t*pi/2)
///     sine.inOut = -(cos(pi*t) - 1) / 2
///
///     back.out(s): with p = t - 1,  p*p*((s+1)*p + s) + 1     default s = 1.70158
///
/// The web asserts every one of these against real GSAP at 201 sample points;
/// this file is a transcription of that file, and `EaseTests` pins ten of the
/// curves so the transcription cannot drift.
///
/// The vocabulary is closed to exactly 24 names — no synthesis at runtime.
/// `back.out(s)` is six explicit overshoot values plus the bare default, not a
/// parsed expression: the web's own `resolveEase` rejects `back.out(2.2)` and
/// bare `power2` even though both would evaluate cleanly, because an ease name
/// that loads on one platform and not the other is exactly the failure this
/// closed table exists to prevent.
public enum Ease {
    public enum Failure: Error, CustomStringConvertible {
        case unknown(String)
        public var description: String {
            switch self {
            case .unknown(let name): "unknown ease: \(name)"
            }
        }
    }

    private static let backDefault = 1.70158

    private static func power(_ n: Int, _ dir: String) -> @Sendable (Double) -> Double {
        let p = Double(n + 1)
        let k = pow(2, Double(n))
        switch dir {
        case "in":  return { pow($0, p) }
        case "out": return { 1 - pow(1 - $0, p) }
        default:    return { $0 < 0.5 ? k * pow($0, p) : 1 - k * pow(1 - $0, p) }
        }
    }

    private static func backOut(_ s: Double) -> @Sendable (Double) -> Double {
        { t in
            let p = t - 1
            return p * p * ((s + 1) * p + s) + 1
        }
    }

    /// `static let`, never `static var` — the table is built once, immutably,
    /// which is what lets it be shared under strict concurrency without a lock.
    private static let table: [String: @Sendable (Double) -> Double] = {
        var t: [String: @Sendable (Double) -> Double] = [
            "none": { $0 },
            "sine.in": { 1 - cos($0 * .pi / 2) },
            "sine.out": { sin($0 * .pi / 2) },
            "sine.inOut": { -(cos(.pi * $0) - 1) / 2 },
            "back.out": backOut(backDefault),
            "back.out(1.5)": backOut(1.5),
            "back.out(1.6)": backOut(1.6),
            "back.out(1.7)": backOut(1.7),
            "back.out(2)": backOut(2),
            "back.out(2.4)": backOut(2.4),
            "back.out(3)": backOut(3),
            "power3": power(3, "out"),   // the one bare power name GSAP defaults
        ]
        for n in 1...4 {
            t["power\(n).in"] = power(n, "in")
            t["power\(n).out"] = power(n, "out")
            t["power\(n).inOut"] = power(n, "inOut")
        }
        return t
    }()

    public static func resolve(_ name: String) throws -> @Sendable (Double) -> Double {
        guard let fn = table[name] else { throw Failure.unknown(name) }
        return fn
    }
}
