import { describe, expect, it } from "vitest";
import { browserEnvironment, defaultEnvironment } from "./env";

describe("environment", () => {
  it("defaults every answer to the inert one", () => {
    // The golden recorder builds an engine with no environment at all and drives
    // it entirely through `tick(now)`. That is only deterministic if each default
    // here is the answer that changes nothing.
    expect(defaultEnvironment.now()).toBe(0);
    expect(defaultEnvironment.reducedMotion()).toBe(false);
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

  it("reports the host clock in seconds", () => {
    // `tick` is given seconds, so `now()` owes it seconds. A milliseconds slip
    // here would run every animation a thousand times fast, and nothing else in
    // the suite would notice — every other test supplies its own clock.
    const before = performance.now() / 1000;
    const t = browserEnvironment().now();
    const after = performance.now() / 1000;
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });
});
