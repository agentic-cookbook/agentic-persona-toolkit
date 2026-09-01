import Foundation

/// Primitive builders. Every rig shape becomes one of these, and every one
/// emits only M/L/C/Z, so the whole system speaks one path grammar.
///
/// `ring` takes an OUTER radius and a BAND, not an outer and an inner radius:
/// a character drawn at a single stroke weight holds that band constant across
/// every ring it has, and making the band the datum means the invariant lives
/// in the data rather than in a comment. `Variant`'s optical cut then patches
/// one number instead of two.
public enum Build {
    /// Cubic approximation of a quarter circle. Pinned to the web's four
    /// digits, deliberately: the mathematically better 0.5522847498 would move
    /// every circle by ~1e-5 units and fail the golden comparison.
    static let k = 0.5523

    private static func pt(_ x: Double, _ y: Double) -> String { "\(fmt(x)),\(fmt(y))" }

    public static func cubicO(cx: Double, cy: Double, rx: Double, ry: Double) -> String {
        let ox = rx * k
        let oy = ry * k
        return "M\(pt(cx, cy - ry))"
            + "C\(pt(cx + ox, cy - ry)) \(pt(cx + rx, cy - oy)) \(pt(cx + rx, cy))"
            + "C\(pt(cx + rx, cy + oy)) \(pt(cx + ox, cy + ry)) \(pt(cx, cy + ry))"
            + "C\(pt(cx - ox, cy + ry)) \(pt(cx - rx, cy + oy)) \(pt(cx - rx, cy))"
            + "C\(pt(cx - rx, cy - oy)) \(pt(cx - ox, cy - ry)) \(pt(cx, cy - ry))Z"
    }

    public static func disc(cx: Double, cy: Double, r: Double) -> String {
        cubicO(cx: cx, cy: cy, rx: r, ry: r)
    }

    /// Outer circle then inner circle reversed — an annulus that reads the same
    /// under either fill rule. The negative `rx` is what reverses the winding.
    public static func ring(cx: Double, cy: Double, r: Double, band: Double) -> String {
        cubicO(cx: cx, cy: cy, rx: r, ry: r)
            + cubicO(cx: cx, cy: cy, rx: -(r - band), ry: r - band)
    }

    /// A circular arc from `from` to `to` (degrees, screen space, y down), as
    /// cubics — never an `A` command.
    public static func arc(cx: Double, cy: Double, r: Double,
                           from: Double, to: Double) -> String {
        let a0 = from * .pi / 180
        let a1 = to * .pi / 180
        let span = a1 - a0
        let segments = max(1, Int(ceil(abs(span) / (.pi / 2))))
        let step = span / Double(segments)
        let kk = (4.0 / 3.0) * tan(step / 4)

        var a = a0
        var out = "M\(pt(cx + r * cos(a), cy + r * sin(a)))"
        for _ in 0..<segments {
            let b = a + step
            let x0 = cx + r * cos(a), y0 = cy + r * sin(a)
            let x1 = cx + r * cos(b), y1 = cy + r * sin(b)
            out += "C\(pt(x0 - kk * r * sin(a), y0 + kk * r * cos(a))) "
                + "\(pt(x1 + kk * r * sin(b), y1 - kk * r * cos(b))) \(pt(x1, y1))"
            a = b
        }
        return out
    }

    public static func polyline(_ points: [[Double]]) throws -> String {
        guard points.count >= 2 else {
            throw PathError.badPointCount("polyline needs at least 2 points")
        }
        var out = "M\(pt(points[0][0], points[0][1]))"
        for p in points.dropFirst() { out += "L\(pt(p[0], p[1]))" }
        return out
    }

    public static func bezier(_ points: [[Double]]) throws -> String {
        guard points.count >= 4, (points.count - 1) % 3 == 0 else {
            throw PathError.badPointCount("bezier needs 3n+1 points, got \(points.count)")
        }
        var out = "M\(pt(points[0][0], points[0][1]))"
        var i = 1
        while i < points.count {
            out += "C\(pt(points[i][0], points[i][1])) "
                + "\(pt(points[i + 1][0], points[i + 1][1])) "
                + "\(pt(points[i + 2][0], points[i + 2][1]))"
            i += 3
        }
        return out
    }
}
