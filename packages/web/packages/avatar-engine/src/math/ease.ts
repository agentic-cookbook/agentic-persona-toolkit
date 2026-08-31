/**
 * The ease vocabulary, matching GSAP's numerically.
 *
 *   powerN.in(t)    = t^(N+1)
 *   powerN.out(t)   = 1 - (1-t)^(N+1)
 *   powerN.inOut(t) = t < .5 ? 2^N * t^(N+1)
 *                            : 1 - 2^N * (1-t)^(N+1)
 *   a bare `powerN` means `.out` (GSAP's default direction) — only power3 is bare
 *
 *   sine.in    = 1 - cos(t*pi/2)
 *   sine.out   = sin(t*pi/2)
 *   sine.inOut = -(cos(pi*t) - 1) / 2
 *
 *   back.out(s): with p = t - 1,  p*p*((s+1)*p + s) + 1     default s = 1.70158
 *
 * `src/math/ease.test.ts` asserts every one of these against real GSAP at 201
 * sample points; that test is the specification, this file is the copy.
 * The vocabulary is closed to exactly 24 names — no synthesis at runtime.
 */
export type EaseFn = (t: number) => number;

const HALF_PI = Math.PI / 2;
const BACK_DEFAULT = 1.70158;

const power = (n: number, dir: "in" | "out" | "inOut"): EaseFn => {
  const p = n + 1;
  if (dir === "in") return (t) => t ** p;
  if (dir === "out") return (t) => 1 - (1 - t) ** p;
  const k = 2 ** n;
  return (t) => (t < 0.5 ? k * t ** p : 1 - k * (1 - t) ** p);
};

const backOut = (s: number): EaseFn => (t) => {
  const p = t - 1;
  return p * p * ((s + 1) * p + s) + 1;
};

const TABLE: Record<string, EaseFn> = {
  none: (t) => t,
  // power1 family
  "power1.in": power(1, "in"),
  "power1.out": power(1, "out"),
  "power1.inOut": power(1, "inOut"),
  // power2 family
  "power2.in": power(2, "in"),
  "power2.out": power(2, "out"),
  "power2.inOut": power(2, "inOut"),
  // power3 family (power3 bare is .out)
  power3: power(3, "out"),
  "power3.in": power(3, "in"),
  "power3.out": power(3, "out"),
  "power3.inOut": power(3, "inOut"),
  // power4 family
  "power4.in": power(4, "in"),
  "power4.out": power(4, "out"),
  "power4.inOut": power(4, "inOut"),
  // sine family
  "sine.in": (t) => 1 - Math.cos(t * HALF_PI),
  "sine.out": (t) => Math.sin(t * HALF_PI),
  "sine.inOut": (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  // back.out family (explicit overshoots only)
  "back.out": backOut(BACK_DEFAULT),
  "back.out(1.5)": backOut(1.5),
  "back.out(1.6)": backOut(1.6),
  "back.out(1.7)": backOut(1.7),
  "back.out(2)": backOut(2),
  "back.out(2.4)": backOut(2.4),
  "back.out(3)": backOut(3),
};

export const EASE_NAMES = Object.keys(TABLE);

export function resolveEase(name: string): EaseFn {
  const ease = TABLE[name];
  if (ease) return ease;
  throw new Error(`unknown ease: ${name}`);
}
