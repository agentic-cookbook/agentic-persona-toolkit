import Foundation

/// A 2x3 affine, laid out the way SVG and CoreGraphics both spell it:
///
///     | a c e |
///     | b d f |
///     | 0 0 1 |
///
/// The engine composes every node's transform down to one of these and hands
/// the renderer the result, so no renderer ever has to know what a pivot is.
///
/// This is a plain struct of `Double` rather than a `CGAffineTransform` for one
/// reason: `CGAffineTransform`'s storage is `CGFloat`, which is `Float` on some
/// architectures and would quietly cost us the 1e-6 golden tolerance. The
/// bridge below is the only place the two meet.
public struct Mat: Equatable, Sendable {
    public var a: Double
    public var b: Double
    public var c: Double
    public var d: Double
    public var e: Double
    public var f: Double

    public init(a: Double, b: Double, c: Double, d: Double, e: Double, f: Double) {
        self.a = a; self.b = b; self.c = c; self.d = d; self.e = e; self.f = f
    }

    public static let identity = Mat(a: 1, b: 0, c: 0, d: 1, e: 0, f: 0)

    /// Parent on the left, child on the right — the same argument order as the
    /// web's `multiply(parent, child)`.
    public static func * (m: Mat, n: Mat) -> Mat {
        Mat(
            a: m.a * n.a + m.c * n.b,
            b: m.b * n.a + m.d * n.b,
            c: m.a * n.c + m.c * n.d,
            d: m.b * n.c + m.d * n.d,
            e: m.a * n.e + m.c * n.f + m.e,
            f: m.b * n.e + m.d * n.f + m.f
        )
    }

    public func apply(x: Double, y: Double) -> (x: Double, y: Double) {
        (a * x + c * y + e, b * x + d * y + f)
    }

    /// Rotation is in degrees and the pivot is in absolute design units, both
    /// matching the config format. Composition is
    /// `T(x,y) . T(p) . R . S . T(-p)`.
    public static func from(
        x: Double = 0,
        y: Double = 0,
        rotation: Double = 0,
        scaleX: Double = 1,
        scaleY: Double = 1,
        pivot: (Double, Double) = (0, 0)
    ) -> Mat {
        let r = rotation * .pi / 180
        let cos = Foundation.cos(r)
        let sin = Foundation.sin(r)
        let (px, py) = pivot
        let a = cos * scaleX
        let b = sin * scaleX
        let c = -sin * scaleY
        let d = cos * scaleY
        return Mat(
            a: a, b: b, c: c, d: d,
            e: px - (a * px + c * py) + x,
            f: py - (b * px + d * py) + y
        )
    }
}
