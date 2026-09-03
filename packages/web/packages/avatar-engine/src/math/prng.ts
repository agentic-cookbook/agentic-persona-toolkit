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
  pickOrUndefined<T>(items: readonly T[]): T | undefined;
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

  /**
   * `undefined` for an empty array, and one draw otherwise — so the stream a
   * caller consumes is identical to `pick`'s.
   *
   * The total form exists because `pick` cannot be total: `T` has no empty
   * case, so an empty array leaves it nothing to return. The Swift twin is
   * `Prng.pickOrNil`, which returns the same thing spelled `T?`.
   */
  const pickOrUndefined = <T,>(items: readonly T[]): T | undefined =>
    items.length === 0 ? undefined : items[Math.floor(float() * items.length)];

  return {
    next,
    float,
    range: (lo, hi) => lo + float() * (hi - lo),
    pickOrUndefined,
    /**
     * One of `items`, which must not be empty.
     *
     * Emptiness is a CONFIG fault, and `loadConfig` is where it is
     * caught and named — it rejects an empty saying list, an empty group, and
     * an active mood with no sayings, which is every list that reaches here.
     * Reaching this line means that contract was broken, so it says so.
     * Without the check, `items[...]` is `undefined` and the non-null
     * assertion waves it through as a `T`: the caller gets a saying that
     * renders as the string "undefined", or a shape lookup that fails several
     * frames later naming nothing. A caller with no such guarantee wants
     * `pickOrUndefined`.
     */
    pick: <T,>(items: readonly T[]): T => {
      const picked = pickOrUndefined(items);
      if (picked === undefined) {
        throw new Error(
          "Prng.pick on an empty array — the config that supplied it should have been "
          + "rejected by loadConfig; use pickOrUndefined where no such guarantee holds",
        );
      }
      return picked;
    },
    chance: (p) => float() < p,
    signed: (m) => (float() * 2 - 1) * m,
  };
}
