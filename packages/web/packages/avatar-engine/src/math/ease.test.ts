import gsap from "gsap";
import { describe, expect, it } from "vitest";
import { resolveEase, EASE_NAMES } from "./ease";

const NAMES = [
  "none",
  "power1.in", "power1.out", "power1.inOut",
  "power2.in", "power2.out", "power2.inOut",
  "power3", "power3.in", "power3.out", "power3.inOut",
  "power4.in", "power4.out", "power4.inOut",
  "sine.in", "sine.out", "sine.inOut",
  "back.out", "back.out(1.5)", "back.out(1.6)", "back.out(1.7)",
  "back.out(2)", "back.out(2.4)", "back.out(3)",
];

describe("resolveEase", () => {
  it.each(NAMES)("matches GSAP for %s across the unit interval", (name) => {
    const ours = resolveEase(name);
    const theirs = gsap.parseEase(name);
    for (let i = 0; i <= 200; i += 1) {
      const t = i / 200;
      expect(Math.abs(ours(t) - theirs(t))).toBeLessThan(1e-9);
    }
  });

  it("pins the endpoints to within 1e-12", () => {
    // 1e-12 rather than exact equality, and deliberately so: three of the 24
    // carry a floating-point residue at an endpoint. `back.out` and
    // `back.out(1.7)` evaluate to 2.2e-16 at t=0 (because `-(s+1) + s` is not
    // exactly -1 in IEEE754); `sine.in` lands 1ulp below 1 at t=1. GSAP
    // special-cases those two boundaries in its own source (`p === 1 ? 1 : ...`
    // for Sine, `p ? ... : 0` for Back), so GSAP lands exactly on 0 and 1 where
    // this port does not — the tolerance is what lets both be correct against
    // each other. Asserting `.toBe(0)` here would pin a rounding accident.
    for (const name of NAMES) {
      const e = resolveEase(name);
      expect(Math.abs(e(0))).toBeLessThan(1e-12);
      expect(Math.abs(e(1) - 1)).toBeLessThan(1e-12);
    }
  });

  it("rejects anything outside the vocabulary", () => {
    expect(() => resolveEase("elastic.out")).toThrow(/unknown ease/);
    expect(() => resolveEase("back.in(2)")).toThrow(/unknown ease/);
    expect(() => resolveEase("back.out(2.2)")).toThrow(/unknown ease/);
    expect(() => resolveEase("power2")).toThrow(/unknown ease/);
  });

  it("has exactly 24 names in the vocabulary", () => {
    const easeNames = EASE_NAMES.slice().sort();
    const expectedNames = NAMES.slice().sort();
    expect(easeNames).toEqual(expectedNames);
    expect(easeNames).toHaveLength(24);
  });
});
