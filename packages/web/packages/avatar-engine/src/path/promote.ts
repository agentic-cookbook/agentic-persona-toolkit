import type { ParsedPath } from "./parse";

/**
 * Re-express an open polyline as an all-cubic path of `segments` segments,
 * drawing the identical ink.
 *
 * This is the ONLY representation change the engine performs, and it earns its
 * place by what the alternative looked like. A yawn opens the mouth by morphing
 * the resting V into an ellipse, and the two are different families — three
 * anchors against thirteen — so the port faked the crossing: flatten the V
 * inside its own family, then snap into the ellipse and grow it. On screen that
 * read as the mouth SHUTTING for a third of a second before it opened, which is
 * not what a yawn does. With this, the V is re-expressed as thirteen anchors and
 * the whole inhale is one ordinary morph inside one family.
 *
 * The rewrite is exact and has no free choices, which is what keeps it short of
 * a general path morph. A straight segment IS the cubic whose controls sit at
 * the 1/3 and 2/3 points of its chord; a segment splits at equal steps of its
 * parameter; and `segments` must be a whole multiple of the polyline's own
 * count, so no segment is ever favoured over another and there is nothing to
 * tune. The result is open, because a polyline has two ends and redrawing it
 * cannot join them.
 */
export function promotePolyline(p: ParsedPath, segments: number): ParsedPath {
  if (!/^ML+$/.test(p.kind)) {
    throw new Error(`can only promote an open polyline, not "${p.kind}"`);
  }
  const lines = p.kind.length - 1;
  if (segments < lines || segments % lines !== 0) {
    throw new Error(
      `cannot promote ${lines} line(s) into ${segments} segment(s): not a whole multiple`,
    );
  }
  const per = segments / lines;
  const points: number[] = [p.points[0]!, p.points[1]!];
  for (let i = 0; i < lines; i += 1) {
    const ax = p.points[i * 2]!;
    const ay = p.points[i * 2 + 1]!;
    const bx = p.points[i * 2 + 2]!;
    const by = p.points[i * 2 + 3]!;
    for (let s = 0; s < per; s += 1) {
      // The sub-segment's own ends, then its controls at a third and two
      // thirds of it. Both ends are computed against the WHOLE line rather
      // than by walking, so the last one lands on `b` exactly and the anchors
      // two platforms compute cannot drift apart along the run.
      const x0 = ax + ((bx - ax) * s) / per;
      const y0 = ay + ((by - ay) * s) / per;
      const x1 = ax + ((bx - ax) * (s + 1)) / per;
      const y1 = ay + ((by - ay) * (s + 1)) / per;
      points.push(
        x0 + (x1 - x0) / 3, y0 + (y1 - y0) / 3,
        x0 + (2 * (x1 - x0)) / 3, y0 + (2 * (y1 - y0)) / 3,
        x1, y1,
      );
    }
  }
  return { kind: `M${"C".repeat(segments)}`, points };
}
