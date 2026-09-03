import { describe, expect, it } from "vitest";
import { createPrng } from "./prng";

describe("createPrng", () => {
  it("is reproducible from a seed", () => {
    const a = createPrng(0x9e3779b9);
    const b = createPrng(0x9e3779b9);
    for (let i = 0; i < 1000; i += 1) expect(a.next()).toBe(b.next());
  });

  it("emits the pinned reference stream for seed 1", () => {
    // These five uint32s are the cross-platform contract: Swift must produce the
    // same five. Regenerate them ONLY by changing the algorithm deliberately.
    const p = createPrng(1);
    expect([p.next(), p.next(), p.next(), p.next(), p.next()]).toEqual([
      1144403687, 1290228702, 3651710282, 626043614, 3583050788,
    ]);
  });

  it("diverges for different seeds", () => {
    expect(createPrng(1).next()).not.toBe(createPrng(2).next());
  });

  it("floats stay in [0,1)", () => {
    const p = createPrng(42);
    for (let i = 0; i < 10_000; i += 1) {
      const f = p.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it("range and signed are centred correctly", () => {
    const p = createPrng(7);
    let sum = 0;
    for (let i = 0; i < 20_000; i += 1) sum += p.signed(4);
    expect(Math.abs(sum / 20_000)).toBeLessThan(0.1);
    const q = createPrng(7);
    for (let i = 0; i < 1000; i += 1) {
      const v = q.range(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThan(5);
    }
  });

  it("pick never indexes out of bounds", () => {
    const p = createPrng(3);
    const items = ["a", "b", "c"];
    for (let i = 0; i < 5000; i += 1) expect(items).toContain(p.pick(items));
  });

  /**
   * `pick` cannot be total — `T` has no empty case — so it used to hand the
   * caller `items[...]` (`undefined`) with a non-null assertion waving it
   * through as a `T`: a saying that renders as the string "undefined", or a
   * lookup that fails frames later naming nothing. The contract is now stated
   * (`loadConfig` rejects every empty list-typed field that reaches it) and
   * `pickOrUndefined` is the total form for a caller holding no such
   * guarantee. The Swift twin is `Prng.pickOrNil`; its `pick` states the same
   * contract with a `preconditionFailure`, which XCTest cannot catch, so the
   * throwing half of this is tested on the web side alone.
   */
  it("pick names the broken contract instead of returning undefined as a T", () => {
    const p = createPrng(3);
    expect(() => p.pick([])).toThrow(/Prng\.pick on an empty array/);
  });

  it("pickOrUndefined answers undefined for an empty array and draws nothing", () => {
    const p = createPrng(3);
    expect(p.pickOrUndefined([])).toBeUndefined();
    expect(p.pickOrUndefined<string>([])).toBeUndefined();
    // No draw was consumed, so the stream is where it started: the same first
    // value a fresh generator gives.
    expect(p.next()).toBe(createPrng(3).next());
  });

  it("pickOrUndefined consumes the same stream as pick", () => {
    const items = ["a", "b", "c", "d", "e"];
    const a = createPrng(7);
    const b = createPrng(7);
    for (let i = 0; i < 200; i += 1) expect(a.pick(items)).toBe(b.pickOrUndefined(items));
  });
});
