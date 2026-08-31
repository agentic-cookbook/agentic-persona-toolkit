/**
 * The ease vocabulary, matching GSAP's numerically.
 *
 *   powerN.in(t)    = t^(N+1)
 *   powerN.out(t)   = 1 - (1-t)^(N+1)
 *   powerN.inOut(t) = t < .5 ? 2^N * t^(N+1)
 *                            : 1 - 2^N * (1-t)^(N+1)
 *   a bare `powerN` means `.out` (GSAP's default direction)
 *
 *   sine.in    = 1 - cos(t*pi/2)
 *   sine.out   = sin(t*pi/2)
 *   sine.inOut = -(cos(pi*t) - 1) / 2
 *
 *   back.out(s): with p = t - 1,  p*p*((s+1)*p + s) + 1     default s = 1.70158
 *
 * `src/math/ease.test.ts` asserts every one of these against real GSAP at 201
 * sample points; that test is the specification, this file is the copy.
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
  "sine.in": (t) => 1 - Math.cos(t * HALF_PI),
  "sine.out": (t) => Math.sin(t * HALF_PI),
  "sine.inOut": (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

for (let n = 1; n <= 4; n += 1) {
  TABLE[`power${n}.in`] = power(n, "in");
  TABLE[`power${n}.out`] = power(n, "out");
  TABLE[`power${n}.inOut`] = power(n, "inOut");
  TABLE[`power${n}`] = power(n, "out"); // GSAP's bare default direction
}

const BACK_CALL = /^back\.out\(\s*(-?\d+(?:\.\d+)?)\s*\)$/;

export function resolveEase(name: string): EaseFn {
  const direct = TABLE[name];
  if (direct) return direct;
  if (name === "back.out") return backOut(BACK_DEFAULT);
  const m = BACK_CALL.exec(name);
  if (m) return backOut(Number(m[1]));
  throw new Error(`unknown ease: ${name}`);
}
