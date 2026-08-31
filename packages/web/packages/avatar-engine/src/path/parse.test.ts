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

  // The grammar contract, as a corpus rather than as prose: every string here is
  // accepted by BOTH platforms with the same result, or rejected by both, and
  // `PathTests.swift`'s `testAgreesWithTheWebOnTheWholeGrammar` carries the
  // identical list. Every entry was checked by running the real `Double`
  // initialiser and the real regex, not reasoned about — reasoning is what put
  // "M5.,3" on the wrong side of this list the first time round.
  it("agrees with Swift on the whole grammar", () => {
    const accepted: [string, string, number[]][] = [
      ["M187,233 L200,246 L213,233", "MLL", [187, 233, 200, 246, 213, 233]],
      ["M0,0L1,1", "ML", [0, 0, 1, 1]],
      ["M0,0\rL1,1", "ML", [0, 0, 1, 1]],
      ["M0,0\tL1,1", "ML", [0, 0, 1, 1]],
      ["M0,0\nL1,1", "ML", [0, 0, 1, 1]],
      ["M.5,.5", "M", [0.5, 0.5]],
      ["M1e2,3", "M", [100, 3]],
      ["M1E2,3", "M", [100, 3]],
      ["M1e-2,3", "M", [0.01, 3]],
      ["M-1,-2", "M", [-1, -2]],
      ["M-1-2", "M", [-1, -2]],
      ["M0,0Z", "MZ", [0, 0]],
    ];
    for (const [d, kind, points] of accepted) {
      const p = parsePath(d);
      expect(p.kind, d).toBe(kind);
      expect(p.points, d).toEqual(points);
    }

    // Rejected by both. The middle four are the ones this parser used to
    // swallow: `matchAll` skipped any character it could not match, so a
    // dangling sign, a stray exponent or a doubled decimal point vanished and
    // the path parsed as if it were clean. The vertical tab is the other half
    // of that story: the old guard tested `\s`, which admits it, while Swift's
    // separator set never did.
    const vtab = String.fromCharCode(11);
    const rejected = [
      "m0,0", "M0,0 Q1,1", "M0", "0,0", "M1,2 3,4",
      "M5.,3", "M5..3", "M0,0-", "M0,0e", "M0,0" + vtab + "L1,1",
      "M1+2,3", "M0,0 C1,1",
    ];
    for (const d of rejected) {
      expect(() => parsePath(d), d).toThrow();
    }
  });
});
