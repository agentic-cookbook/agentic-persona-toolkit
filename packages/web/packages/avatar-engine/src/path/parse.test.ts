import { describe, expect, it } from "vitest";
import { emitPath, parsePath } from "./parse";

describe("parsePath", () => {
  it("reads a 3-point mouth polyline", () => {
    const p = parsePath("M187,233 L200,246 L213,233");
    expect(p.kind).toBe("MLL");
    expect(p.points).toEqual([187, 233, 200, 246, 213, 233]);
  });

  it("reads a closed 4-anchor cubic O", () => {
    const p = parsePath(
      "M200,224C204.97,224 209,228.97 209,235C209,241.03 204.97,246 200,246" +
      "C195.03,246 191,241.03 191,235C191,228.97 195.03,224 200,224Z",
    );
    expect(p.kind).toBe("MCCCCZ");
    expect(p.points).toHaveLength(2 + 4 * 6);
  });

  it("round-trips", () => {
    const d = "M183,169 C180,148 175,126 179,105";
    expect(parsePath(emitPath(parsePath(d))).points).toEqual(parsePath(d).points);
  });

  it("rejects commands outside the subset", () => {
    expect(() => parsePath("M0,0 A45,45 0 0 1 10,10")).toThrow(/unsupported/);
    expect(() => parsePath("m0,0 l1,1")).toThrow(/unsupported/);
  });
});
