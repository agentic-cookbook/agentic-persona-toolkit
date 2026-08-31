/**
 * A 2x3 affine, laid out the way SVG and CoreGraphics both spell it:
 *
 *   | a c e |
 *   | b d f |
 *   | 0 0 1 |
 *
 * The engine composes every node's transform down to one of these and hands the
 * renderer the result, so no renderer ever has to know what a pivot is.
 */
export type Mat = readonly [number, number, number, number, number, number];

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

const DEG = Math.PI / 180;

export function multiply(m: Mat, n: Mat): Mat {
  const [a1, b1, c1, d1, e1, f1] = m;
  const [a2, b2, c2, d2, e2, f2] = n;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export function applyPoint(m: Mat, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export function fromTransform(t: {
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  pivot?: readonly [number, number];
}): Mat {
  const sx = t.scaleX ?? 1;
  const sy = t.scaleY ?? 1;
  const r = (t.rotation ?? 0) * DEG;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const [px, py] = t.pivot ?? [0, 0];

  // rotate+scale about the pivot: T(p) . R . S . T(-p)
  const a = cos * sx;
  const b = sin * sx;
  const c = -sin * sy;
  const d = cos * sy;
  const e = px - (a * px + c * py) + (t.x ?? 0);
  const f = py - (b * px + d * py) + (t.y ?? 0);
  return [a, b, c, d, e, f];
}
