import { describe, expect, it } from "vitest";
import { emitPath, fmt, parsePath } from "./parse";

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
  // `fmt` is the one function `ParsedPath.swift` says both platforms must agree
  // on character-for-character, and `Math.round` is half-toward-+Infinity where
  // Swift's `Double.rounded()` is half-away-from-zero. Positive half-steps agree;
  // every negative one used to diverge. `morph` EXTRAPOLATES past t=1 for a
  // `back.out` easing, which is the realistic route to a negative coordinate.
  it("rounds negative half-steps the way Swift does", () => {
    // `(-1.5).rounded()` is -2, where `Math.round(-1.5)` is -1.
    expect(fmt(-1.5e-6)).toBe("-0.000002");
    // `(-0.5).rounded()` is -1, where `Math.round(-0.5)` is -0 -> "0".
    expect(fmt(-5e-7)).toBe("-0.000001");
    // At design-unit scale: the emitter used to print "-187".
    expect(fmt(-187.0000005)).toBe("-187.000001");
    // Positives are unchanged, which is why no golden moves.
    expect(fmt(1.5e-6)).toBe("0.000002");
    expect(fmt(5e-7)).toBe("0.000001");
    expect(fmt(187.0000005)).toBe("187.000001");
    // Below the grid, and -0, still print as a bare "0" -- never "-0".
    expect(fmt(-4e-7)).toBe("0");
    expect(fmt(-0)).toBe("0");
    // SVG path data has no exponent form, and Swift never emits one.
    expect(fmt(1e-6)).toBe("0.000001");
    expect(fmt(-1e-6)).toBe("-0.000001");
    for (const v of [1e-6, -1e-6, 1e21, -1e21, 5e-7, -5e-7]) {
      expect(fmt(v), String(v)).not.toMatch(/e/);
    }
  });

  it("emits a negative coordinate the same way Swift does", () => {
    expect(emitPath({ kind: "ML", points: [-0.0000005, 0, 1, -1.5e-6] }))
      .toBe("M-0.000001,0L1,-0.000002");
  });

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
