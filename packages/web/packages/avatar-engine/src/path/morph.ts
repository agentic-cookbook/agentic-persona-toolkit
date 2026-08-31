import type { ParsedPath } from "./parse";

/**
 * Interpolate two paths anchor-for-anchor. The guard is the point of the whole
 * design: two paths may only morph when their command sequence is identical, so
 * every platform maps the same anchor to the same anchor with no resampling and
 * no heuristics. A cross-family morph is a configuration bug, and it fails loudly
 * at the moment it is attempted rather than wobbling on screen.
 */
export function morphPath(a: ParsedPath, b: ParsedPath, t: number): ParsedPath {
  if (a.kind !== b.kind) {
    throw new Error(`cannot morph across shape families: ${a.kind} -> ${b.kind}`);
  }
  if (t <= 0) return a;
  if (t >= 1) return b;
  const points = a.points.map((v, i) => v + (b.points[i]! - v) * t);
  return { kind: a.kind, points };
}
