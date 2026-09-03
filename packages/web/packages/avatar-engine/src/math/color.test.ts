import { describe, expect, it } from "vitest";
import { mixColor, oklabToSrgb, parseHex, srgbToOklab, toHex } from "./color";

const near = (a: number, b: number, eps = 1e-6): void =>
  expect(Math.abs(a - b)).toBeLessThan(eps);

describe("color", () => {
  it("parses and re-emits every palette entry", () => {
    for (const hex of ["#00ff41", "#ff9500", "#ffd400", "#fffce0", "#ff2d2d",
                       "#4f7cff", "#5f7a64", "#4f6e57", "#33ccff", "#06140d"]) {
      expect(toHex(parseHex(hex))).toBe(hex);
    }
  });

  it("round-trips sRGB through OKLab", () => {
    // 1e-5, and NOT tighter: Ottosson's published matrices are given to ten
    // decimal places and are not exact inverses of each other at that
    // precision, so a correct implementation still round-trips with about
    // 1e-6 of error (worst case 9.3e-7, on #00ff41). The tolerance is a
    // property of the published constants, not of this port, and Swift
    // inherits it because it uses the identical constants. It still has
    // teeth: transposing one coefficient pair moves the round-trip error to
    // ~19, and flipping one sign to ~3.9 -- six orders of magnitude clear of
    // this bound. Do not "tighten" this to 1e-9; that asserts a precision the
    // matrices do not have and the task cannot pass.
    for (const hex of ["#00ff41", "#ff2d2d", "#4f7cff", "#000000", "#ffffff"]) {
      const rgb = parseHex(hex);
      const back = oklabToSrgb(srgbToOklab(rgb));
      rgb.forEach((v, i) => near(v, back[i]!, 1e-5));
    }
  });

  it("pins OKLab L for white and black", () => {
    near(srgbToOklab(parseHex("#ffffff"))[0], 1, 1e-6);
    near(srgbToOklab(parseHex("#000000"))[0], 0, 1e-9);
  });

  it("renders a NaN channel as black rather than as the string \"NaN\"", () => {
    // `clamp01` is a comparison pair, and every comparison against NaN is
    // false, so NaN used to pass straight through: `Math.round(NaN).toString(16)`
    // is "NaN" and `toHex` emitted "#NaNNaNNaN" — not a colour, not an error,
    // and nothing downstream rejects it. Swift's twin does worse than lie:
    // `Int(Double.nan.rounded())` TRAPS, on the per-frame render path. NaN
    // reaches a colour channel from any divide-by-zero upstream in an
    // interpolation, so both platforms now answer black for it.
    expect(toHex([NaN, NaN, NaN])).toBe("#000000");
    expect(toHex([NaN, 1, 0])).toBe("#00ff00");
  });

  it("mixes endpoints exactly", () => {
    expect(mixColor("#00ff41", "#ff2d2d", 0)).toBe("#00ff41");
    expect(mixColor("#00ff41", "#ff2d2d", 1)).toBe("#ff2d2d");
  });

  it("keeps green-to-red saturated at the midpoint", () => {
    // The whole reason for OKLab: an sRGB midpoint of #00ff41 and #ff2d2d is
    // #809637 (a muddy olive), chroma 0.35. The OKLab midpoint is #cead37,
    // chroma 0.59 -- which is what this asserts.
    const mid = mixColor("#00ff41", "#ff2d2d", 0.5);
    const [r, g, b] = parseHex(mid);
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    expect(chroma).toBeGreaterThan(0.55);
  });
});
