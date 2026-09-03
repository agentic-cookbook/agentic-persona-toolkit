/**
 * sRGB <-> OKLab (Bjorn Ottosson's matrices), and a perceptual mix.
 *
 * The engine interpolates every colour channel here rather than componentwise in
 * sRGB, because a saturated palette is exactly where the two disagree: an sRGB
 * lerp between two fully saturated mood colours dips through grey. Both endpoints
 * are identical in either space, so only the middle of a transition differs from
 * the original.
 */
export type Rgb = readonly [number, number, number];

/** NaN-safe, and that is the whole point of the first clause: a min/max pair
 *  passes NaN straight through (every comparison against NaN is false), and
 *  `toHex` then prints "#NaNNaNNaN" — a string no consumer can render and
 *  nothing downstream rejects. Swift's twin does not merely lie: `Int(nan)`
 *  TRAPS the process on the per-frame render path. Clamping to 0 makes both
 *  platforms answer "#000000" for the same input. */
const clamp01 = (v: number): number => (Number.isNaN(v) ? 0 : v < 0 ? 0 : v > 1 ? 1 : v);

export function parseHex(hex: string): Rgb {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) {
    throw new Error(`bad hex colour: ${hex}`);
  }
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ];
}

export function toHex(rgb: Rgb): string {
  const part = (v: number): string =>
    Math.round(clamp01(v) * 255).toString(16).padStart(2, "0");
  return `#${part(rgb[0])}${part(rgb[1])}${part(rgb[2])}`;
}

const toLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toGamma = (c: number): number =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;

export function srgbToOklab(rgb: Rgb): Rgb {
  const r = toLinear(rgb[0]);
  const g = toLinear(rgb[1]);
  const b = toLinear(rgb[2]);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToSrgb(lab: Rgb): Rgb {
  const [L, a, bb] = lab;
  const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3;

  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export function mixColor(a: string, b: string, t: number): string {
  if (t <= 0) return toHex(parseHex(a));
  if (t >= 1) return toHex(parseHex(b));
  const la = srgbToOklab(parseHex(a));
  const lb = srgbToOklab(parseHex(b));
  return toHex(oklabToSrgb([
    la[0] + (lb[0] - la[0]) * t,
    la[1] + (lb[1] - la[1]) * t,
    la[2] + (lb[2] - la[2]) * t,
  ]));
}
