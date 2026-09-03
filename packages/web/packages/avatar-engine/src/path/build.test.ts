import { describe, expect, it } from "vitest";
import { parsePath } from "./parse";
import { arc, bezier, cubicO, disc, polyline, ring } from "./build";

describe("build", () => {
  it("emits an arc as four cubics with no A command", () => {
    const d = arc(152, 200, 45, 233.1301, 306.8699);
    expect(d).not.toMatch(/A/);
    const p = parsePath(d);
    expect(p.kind.startsWith("M")).toBe(true);
    expect(p.kind.slice(1)).toMatch(/^C+$/);
  });

  it("places the brow endpoints at cx +/- 27, y 164", () => {
    const p = parsePath(arc(152, 200, 45, 233.1301, 306.8699));
    const [x0, y0] = [p.points[0]!, p.points[1]!];
    const [x1, y1] = [p.points.at(-2)!, p.points.at(-1)!];
    expect(Math.abs(x0 - 125)).toBeLessThan(1e-3);
    expect(Math.abs(y0 - 164)).toBeLessThan(1e-3);
    expect(Math.abs(x1 - 179)).toBeLessThan(1e-3);
    expect(Math.abs(y1 - 164)).toBeLessThan(1e-3);
  });

  it("builds a ring as two concentric circles, outer then inner reversed", () => {
    const p = parsePath(ring(152, 200, 35, 8));
    expect(p.kind).toBe("MCCCCZMCCCCZ");
  });

  it("builds a disc as one closed 4-anchor circle", () => {
    expect(parsePath(disc(152, 200, 9)).kind).toBe("MCCCCZ");
  });

  it("builds cubicO with K = 0.5523", () => {
    const p = parsePath(cubicO(200, 235, 13, 1.4));
    expect(p.kind).toBe("MCCCCZ");
    expect(Math.abs(p.points[2]! - (200 + 13 * 0.5523))).toBeLessThan(1e-9);
  });

  it("rounds through the same `fmt` the emitter does", () => {
    // `build.ts` carried a verbatim COPY of `fmt`, so the negative half-step
    // divergence lived in two places at once -- and this one runs on every
    // ring, disc and arc every frame. It imports the emitter's `fmt` now, and
    // this asserts the shared rounding rather than the copy's.
    expect(polyline([[-1.5e-6, -5e-7], [0, 0]])).toBe("M-0.000002,-0.000001L0,0");
  });

  it("builds polylines and beziers", () => {
    expect(parsePath(polyline([[187, 233], [200, 246], [213, 233]])).kind).toBe("MLL");
    expect(parsePath(bezier([[183, 169], [180, 148], [175, 126], [179, 105]])).kind).toBe("MC");
  });
});
