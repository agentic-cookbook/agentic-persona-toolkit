import { describe, expect, it } from "vitest";
import { emitPath, parsePath } from "./parse";
import { morphPath } from "./morph";

describe("morphPath", () => {
  it("interpolates two same-kind mouths", () => {
    const a = parsePath("M187,233 L200,246 L213,233");
    const b = parsePath("M189,235 L200,235 L211,235");
    const mid = morphPath(a, b, 0.5);
    expect(mid.kind).toBe("MLL");
    expect(mid.points).toEqual([188, 234, 200, 240.5, 212, 234]);
  });

  it("returns the endpoints exactly", () => {
    const a = parsePath("M187,233 L200,246 L213,233");
    const b = parsePath("M189,235 L200,235 L211,235");
    expect(emitPath(morphPath(a, b, 0))).toBe(emitPath(a));
    expect(emitPath(morphPath(a, b, 1))).toBe(emitPath(b));
  });

  it("refuses to morph across shape families", () => {
    const poly = parsePath("M187,233 L200,246 L213,233");
    const o = parsePath(
      "M200,224C204.97,224 209,228.97 209,235C209,241.03 204.97,246 200,246" +
      "C195.03,246 191,241.03 191,235C191,228.97 195.03,224 200,224Z",
    );
    expect(() => morphPath(poly, o, 0.5)).toThrow(/MLL.*MCCCCZ/);
  });
});
