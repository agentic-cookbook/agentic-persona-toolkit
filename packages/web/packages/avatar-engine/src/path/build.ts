/**
 * Primitive builders. Every rig shape becomes one of these, and every one emits
 * only M/L/C/Z, so the whole system speaks one path grammar.
 *
 * `ring` takes an OUTER radius and a BAND, not an outer and an inner radius:
 * a character drawn at a single stroke weight holds that band constant across
 * every ring it has, and making the band the datum means the invariant lives in
 * the data rather than in a comment.
 */
const K = 0.5523; // cubic approximation of a quarter circle
const DEG = Math.PI / 180;

const fmt = (v: number): string => {
  const r = Math.round(v * 1e6) / 1e6;
  return Object.is(r, -0) ? "0" : String(r);
};
const pt = (x: number, y: number): string => `${fmt(x)},${fmt(y)}`;

export function cubicO(cx: number, cy: number, rx: number, ry: number): string {
  const ox = rx * K;
  const oy = ry * K;
  return (
    `M${pt(cx, cy - ry)}` +
    `C${pt(cx + ox, cy - ry)} ${pt(cx + rx, cy - oy)} ${pt(cx + rx, cy)}` +
    `C${pt(cx + rx, cy + oy)} ${pt(cx + ox, cy + ry)} ${pt(cx, cy + ry)}` +
    `C${pt(cx - ox, cy + ry)} ${pt(cx - rx, cy + oy)} ${pt(cx - rx, cy)}` +
    `C${pt(cx - rx, cy - oy)} ${pt(cx - ox, cy - ry)} ${pt(cx, cy - ry)}Z`
  );
}

export const disc = (cx: number, cy: number, r: number): string => cubicO(cx, cy, r, r);

/** Outer circle then inner circle reversed: an even-odd/nonzero-safe annulus. */
export function ring(cx: number, cy: number, r: number, band: number): string {
  const inner = r - band;
  const outer = cubicO(cx, cy, r, r);
  const hole = cubicO(cx, cy, -inner, inner); // negative rx reverses the winding
  return outer + hole;
}

/** A circular arc from `from` to `to` (degrees, screen-space, y down), as cubics. */
export function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const a0 = from * DEG;
  const a1 = to * DEG;
  const span = a1 - a0;
  const segments = Math.max(1, Math.ceil(Math.abs(span) / (Math.PI / 2)));
  const step = span / segments;
  const k = (4 / 3) * Math.tan(step / 4);

  let a = a0;
  let out = `M${pt(cx + r * Math.cos(a), cy + r * Math.sin(a))}`;
  for (let i = 0; i < segments; i += 1) {
    const b = a + step;
    const [x0, y0] = [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const [x1, y1] = [cx + r * Math.cos(b), cy + r * Math.sin(b)];
    out +=
      `C${pt(x0 - k * r * Math.sin(a), y0 + k * r * Math.cos(a))} ` +
      `${pt(x1 + k * r * Math.sin(b), y1 - k * r * Math.cos(b))} ${pt(x1, y1)}`;
    a = b;
  }
  return out;
}

export function polyline(points: readonly (readonly [number, number])[]): string {
  if (points.length < 2) throw new Error("polyline needs at least 2 points");
  const [first, ...rest] = points;
  return `M${pt(first![0], first![1])}` + rest.map(([x, y]) => `L${pt(x, y)}`).join("");
}

export function bezier(points: readonly (readonly [number, number])[]): string {
  if (points.length < 4 || (points.length - 1) % 3 !== 0) {
    throw new Error(`bezier needs 3n+1 points, got ${points.length}`);
  }
  const [first, ...rest] = points;
  let out = `M${pt(first![0], first![1])}`;
  for (let i = 0; i < rest.length; i += 3) {
    out += `C${pt(rest[i]![0], rest[i]![1])} ${pt(rest[i + 1]![0], rest[i + 1]![1])} ${pt(rest[i + 2]![0], rest[i + 2]![1])}`;
  }
  return out;
}
