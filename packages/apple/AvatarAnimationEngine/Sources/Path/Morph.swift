/// Interpolate two paths anchor-for-anchor. The guard is the point of the whole
/// design: two paths may only morph when their command sequence is identical,
/// so every platform maps the same anchor to the same anchor with no resampling
/// and no heuristics. A cross-family morph is a configuration bug, and it fails
/// loudly at the moment it is attempted rather than wobbling on screen.
public func morphPath(_ a: ParsedPath, _ b: ParsedPath, _ t: Double) throws -> ParsedPath {
    guard a.kind == b.kind else {
        throw PathError.badPointCount(
            "cannot morph across shape families: \(a.kind) -> \(b.kind)")
    }
    // `== 0` and `== 1`, NOT `<= 0` and `>= 1`. These two lines exist to make
    // the endpoints exact -- `v + (b - v) * 1` is not always `b` in floating
    // point -- and for nothing else. Written as bounds they also CLAMP, and an
    // overshooting ease is exactly where that shows: `startled` is
    // `back.out(3)`, whose eased value crosses 1 a quarter of the way through
    // the tween and stays above it for the remaining three quarters. The
    // original animates the polyline's coordinates as ordinary numbers, so the
    // mouth swings past its target and settles back; a clamp here parks it on
    // the target instead and deletes the pop -- 3.16 design units on
    // `startled`, 2.26 on `surprised`, and a visibly softer mouth on every
    // `back.out` pose.
    //
    // A morph is a lerp of coordinates, so it extrapolates the way every other
    // channel does. Nothing downstream needs `t` bounded: a point off the far
    // side of the target is a point like any other.
    if t == 0 { return a }
    if t == 1 { return b }
    var points = a.points
    for i in points.indices { points[i] += (b.points[i] - points[i]) * t }
    return ParsedPath(kind: a.kind, points: points)
}
