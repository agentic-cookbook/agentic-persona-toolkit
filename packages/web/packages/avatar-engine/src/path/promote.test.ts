import { describe, it, expect } from "vitest";
import { parsePath, emitPath } from "./parse";
import { promotePolyline } from "./promote";

const promote = (d: string, n: number): string =>
  emitPath(promotePolyline(parsePath(d), n));

describe("promotePolyline", () => {
  it("rewrites one line as the cubic that draws it", () => {
    // Controls at the 1/3 and 2/3 points: the definition of a straight cubic.
    expect(promote("M0,0L9,9", 1)).toBe("M0,0C3,3,6,6,9,9");
  });

  it("splits a line into equal segments", () => {
    expect(promote("M0,0L12,0", 3)).toBe(
      "M0,0C" + [
        "1.333333,0,2.666667,0,4,0",
        "5.333333,0,6.666667,0,8,0",
        "9.333333,0,10.666667,0,12,0",
      ].join("C"),
    );
  });

  it("reproduces MorphSVG's normalisation of the resting mouth", () => {
    // Not an invented shape: this is the thirteen-anchor path the original's
    // MorphSVG builds when it morphs the V into the yawn's ellipse, measured
    // off the running original to within 0.02 units. The port's inhale is a
    // plain lerp out of this path, so if this drifts the yawn stops matching.
    expect(promote("M187,233L200,246L213,233", 4)).toBe(
      "M187,233"
      + "C189.166667,235.166667,191.333333,237.333333,193.5,239.5"
      + "C195.666667,241.666667,197.833333,243.833333,200,246"
      + "C202.166667,243.833333,204.333333,241.666667,206.5,239.5"
      + "C208.666667,237.333333,210.833333,235.166667,213,233",
    );
  });

  it("draws the same ink: every original anchor survives as an anchor", () => {
    const p = promotePolyline(parsePath("M10,20L30,40L50,20"), 4);
    const anchors = [];
    for (let i = 2; i < p.points.length; i += 6) anchors.push([p.points[i + 4], p.points[i + 5]]);
    expect([[p.points[0], p.points[1]], ...anchors]).toEqual(
      [[10, 20], [20, 30], [30, 40], [40, 30], [50, 20]],
    );
  });

  it("refuses anything but an open polyline", () => {
    expect(() => promote("M0,0C1,1,2,2,3,3", 2)).toThrow(/open polyline/);
    expect(() => promote("M0,0L9,9Z", 2)).toThrow(/open polyline/);
  });

  it("refuses a segment count that is not a whole multiple", () => {
    // Splitting 2 lines into 3 would have to favour one of them, and which one
    // is a choice — exactly the kind of choice this function exists not to make.
    expect(() => promote("M0,0L5,5L10,0", 3)).toThrow(/whole multiple/);
    expect(() => promote("M0,0L5,5L10,0", 1)).toThrow(/whole multiple/);
  });
});
