import { describe, expect, it } from "vitest";
import { applyPoint, fromTransform, IDENTITY, multiply, type Mat } from "./mat";

const near = (a: number, b: number): void => expect(Math.abs(a - b)).toBeLessThan(1e-9);
const nearMat = (m: Mat, want: readonly number[]): void =>
  m.forEach((v, i) => near(v, want[i]!));

describe("mat", () => {
  it("multiplies identity to a no-op", () => {
    const m: Mat = [2, 0, 0, 3, 10, 20];
    nearMat(multiply(IDENTITY, m), m);
    nearMat(multiply(m, IDENTITY), m);
  });

  it("rotates about an absolute pivot, leaving the pivot fixed", () => {
    const m = fromTransform({ rotation: 90, pivot: [200, 200] });
    const [x, y] = applyPoint(m, 200, 200);
    near(x, 200);
    near(y, 200);
    const [px, py] = applyPoint(m, 200, 100); // straight up from the pivot
    near(px, 300);                            // a +90 turn (screen y-down) sends it right
    near(py, 200);
  });

  it("scales about an absolute pivot", () => {
    const m = fromTransform({ scaleX: 2, scaleY: 2, pivot: [200, 200] });
    nearMat(m, [2, 0, 0, 2, -200, -200]);
    const [x, y] = applyPoint(m, 300, 200);
    near(x, 400);
    near(y, 200);
  });

  it("orders translate, then rotate, then scale about the pivot", () => {
    // The composition must match GSAP's: x/y translate the whole element AFTER
    // the pivoted rotate+scale, exactly as an SVG `transform` list would read
    // `translate(x,y) translate(px,py) rotate(r) scale(s) translate(-px,-py)`.
    const m = fromTransform({ x: 5, y: 7, rotation: 180, scaleX: 2, scaleY: 2, pivot: [10, 10] });
    const [x, y] = applyPoint(m, 20, 10);
    near(x, -5);   // 20 -> mirrored to 0, scaled to -10 about 10 => 0-20+10 = -10; +5 = -5
    near(y, 17);
  });

  it("composes parent-then-child", () => {
    const parent = fromTransform({ x: 100 });
    const child = fromTransform({ scaleX: 2, scaleY: 2, pivot: [0, 0] });
    const [x, y] = applyPoint(multiply(parent, child), 3, 4);
    near(x, 106);
    near(y, 8);
  });
});
