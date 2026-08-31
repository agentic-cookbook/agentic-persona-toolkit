/**
 * xoshiro128** — 32-bit state, 32-bit output, spec'd down to the integer ops so
 * TypeScript and Swift produce the identical stream.
 *
 * Two rules make it deterministic across platforms and refresh rates:
 *  - every arithmetic step is forced back into uint32 with `>>> 0`;
 *  - the engine draws from it ONLY at scheduled events, never per tick. A 120 Hz
 *    display must consume exactly the same numbers as a 60 Hz one.
 *
 * The seed is expanded with splitmix32 so a small seed (1, 2, 3) still fills the
 * state; a zero state would be a fixed point and is stepped away from.
 */
export interface Prng {
  next(): number;
  float(): number;
  range(lo: number, hi: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
  signed(m: number): number;
}

const rotl = (x: number, k: number): number =>
  (((x << k) | (x >>> (32 - k))) >>> 0);

function splitmix32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let t = a;
    t = (Math.imul(t ^ (t >>> 15), 0x85ebca6b)) >>> 0;
    t = (Math.imul(t ^ (t >>> 13), 0xc2b2ae35)) >>> 0;
    return (t ^ (t >>> 16)) >>> 0;
  };
}

export function createPrng(seed: number): Prng {
  const mix = splitmix32(seed);
  let s0 = mix();
  let s1 = mix();
  let s2 = mix();
  let s3 = mix();
  if ((s0 | s1 | s2 | s3) === 0) s0 = 1;

  const next = (): number => {
    const result = (Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0);
    const t = (s1 << 9) >>> 0;
    s2 = (s2 ^ s0) >>> 0;
    s3 = (s3 ^ s1) >>> 0;
    s1 = (s1 ^ s2) >>> 0;
    s0 = (s0 ^ s3) >>> 0;
    s2 = (s2 ^ t) >>> 0;
    s3 = rotl(s3, 11);
    return result;
  };

  const float = (): number => next() / 4294967296;

  return {
    next,
    float,
    range: (lo, hi) => lo + float() * (hi - lo),
    pick: <T,>(items: readonly T[]): T => items[Math.floor(float() * items.length)]!,
    chance: (p) => float() < p,
    signed: (m) => (float() * 2 - 1) * m,
  };
}
