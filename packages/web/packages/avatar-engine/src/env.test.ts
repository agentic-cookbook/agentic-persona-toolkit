import { describe, expect, it } from "vitest";
import { browserEnvironment, defaultEnvironment } from "./env";

describe("environment", () => {
  it("defaults every answer to the inert one, and offers no clock", () => {
    // The golden recorder builds an engine with no environment at all and drives
    // it entirely through `tick(now)`. That is only deterministic if each default
    // here is the answer that changes nothing.
    expect(defaultEnvironment.reducedMotion()).toBe(false);
    // And there is exactly one answer to default. `Environment` carries no
    // `now()` by construction (Ruling 48) — the engine's only clock is `tick`'s
    // argument — so this asserts the *absence*, which a type alone cannot: a
    // host object with a stray `now` would still satisfy the interface
    // structurally, and this is what would catch one being re-added by habit.
    expect(Object.keys(defaultEnvironment)).toEqual(["reducedMotion"]);
    expect(Object.keys(browserEnvironment())).toEqual(["reducedMotion"]);
  });

  it("asks the platform for reduced motion with the right query, and reports both answers", () => {
    // The media query is the one string in this package that a typo turns
    // silently into "the user has expressed no preference" — forever, on every
    // platform, with nothing downstream able to tell a misspelled query from an
    // unset one. So the query text is asserted, not just the boolean.
    const asked: string[] = [];
    const g = globalThis as { matchMedia?: unknown };
    const saved = g.matchMedia;
    try {
      for (const answer of [true, false]) {
        g.matchMedia = (query: string) => {
          asked.push(query);
          return { matches: answer };
        };
        // Constructed AFTER the stub is installed, deliberately: the environment
        // reads `matchMedia` off `globalThis` once, when it is built.
        expect(browserEnvironment().reducedMotion()).toBe(answer);
      }
      expect(asked).toEqual([
        "(prefers-reduced-motion: reduce)",
        "(prefers-reduced-motion: reduce)",
      ]);
    } finally {
      if (saved === undefined) delete g.matchMedia;
      else g.matchMedia = saved;
    }
  });

  it("reports no preference on a host that has no matchMedia", () => {
    // Node, a worker, a server render. The engine has to construct and run there,
    // and "no way to ask" has to read as "no preference" rather than throw.
    const g = globalThis as { matchMedia?: unknown };
    const saved = g.matchMedia;
    delete g.matchMedia;
    try {
      expect(browserEnvironment().reducedMotion()).toBe(false);
    } finally {
      if (saved !== undefined) g.matchMedia = saved;
    }
  });
});
