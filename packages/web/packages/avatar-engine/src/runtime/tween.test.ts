import { describe, expect, it } from "vitest";
import { createChannels } from "./channels";
import { createTweens } from "./tween";

const near = (a: number, b: number, eps = 1e-9): void =>
  expect(Math.abs(a - b)).toBeLessThan(eps);

describe("tweens", () => {
  it("interpolates a number over absolute time", () => {
    const ch = createChannels({ "eye.scaleY": 1 });
    const tw = createTweens(ch);
    tw.add({ channel: "eye.scaleY", to: 0.1, duration: 0.4, ease: "none" }, 10);

    tw.tick(10);
    near(ch.get("eye.scaleY") as number, 1);
    tw.tick(10.2);
    near(ch.get("eye.scaleY") as number, 0.55);
    tw.tick(10.4);
    near(ch.get("eye.scaleY") as number, 0.1);
    expect(tw.active()).toBe(0);
  });

  it("maps an endpoint through `respond` and then lerps in the mapped space", () => {
    // The antenna sway, exactly: a symmetric swing whose inward half is damped
    // to 0.72. The original tweens the two PATHS, so the rendered deflection
    // runs -10.64 to +7.66 in a straight line. Damping the LIVE value instead
    // would fold the outward half over at the zero crossing and read +0.14
    // here, where the straight lerp reads -1.49.
    const damp = (_c: string, v: number | string): number | string =>
      typeof v === "number" && v > 0 ? v * 0.72 : v;
    const ch = createChannels({ "antennaLeft.bend": 0 });
    const tw = createTweens(ch, damp);
    tw.add({ channel: "antennaLeft.bend", to: -10.64, duration: 0 }, 0);
    near(ch.get("antennaLeft.bend") as number, -10.64);

    tw.add({ channel: "antennaLeft.bend", to: 10.64, duration: 1, ease: "none" }, 0);
    tw.tick(0.5);
    near(ch.get("antennaLeft.bend") as number, (-10.64 + 10.64 * 0.72) / 2);
    tw.tick(1);
    near(ch.get("antennaLeft.bend") as number, 10.64 * 0.72);
  });

  it("maps an explicit `from` through `respond` too", () => {
    const damp = (_c: string, v: number | string): number | string =>
      typeof v === "number" && v > 0 ? v * 0.72 : v;
    const ch = createChannels({ b: 0 });
    const tw = createTweens(ch, damp);
    tw.add({ channel: "b", from: 10, to: 0, duration: 1, ease: "none" }, 0);
    tw.tick(0);
    near(ch.get("b") as number, 7.2);
  });

  it("lands on the same value regardless of frame rate", () => {
    const run = (step: number): number => {
      const ch = createChannels({ x: 0 });
      const tw = createTweens(ch);
      tw.add({ channel: "x", to: 100, duration: 1, ease: "power3.out" }, 0);
      for (let t = 0; t <= 0.7 + 1e-12; t += step) tw.tick(t);
      tw.tick(0.7);
      return ch.get("x") as number;
    };
    near(run(1 / 60), run(1 / 240), 1e-12);
  });

  it("honours a delay by holding the from value", () => {
    const ch = createChannels({ x: 0 });
    const tw = createTweens(ch);
    tw.add({ channel: "x", to: 1, duration: 0.2, delay: 0.08, ease: "none" }, 0);
    tw.tick(0.05);
    near(ch.get("x") as number, 0);
    tw.tick(0.18);
    near(ch.get("x") as number, 0.5);
  });

  it("starts from an explicit `from` instead of the channel's current value", () => {
    // `from` is the escape hatch for a tween that must not begin where the
    // channel happens to sit — a mood cross-fade that always starts neutral,
    // say. Without it the tween would read 5 and land halfway at 7.5; with it
    // the channel's value is ignored entirely and halfway is 5.
    const ch = createChannels({ x: 5 });
    const tw = createTweens(ch);
    tw.add({ channel: "x", from: 0, to: 10, duration: 1, ease: "none" }, 0);
    tw.tick(0.5);
    near(ch.get("x") as number, 5);
    tw.tick(1);
    near(ch.get("x") as number, 10);
  });

  it("lets a newer tween cancel the older one on the same channel", () => {
    const ch = createChannels({ x: 0 });
    const tw = createTweens(ch);
    tw.add({ channel: "x", to: 100, duration: 1, ease: "none" }, 0);
    tw.tick(0.5);
    tw.add({ channel: "x", to: 0, duration: 1, ease: "none" }, 0.5);
    expect(tw.active()).toBe(1);
    tw.tick(1);
    near(ch.get("x") as number, 25); // from 50, half way back to 0
  });

  it("interpolates colours and paths", () => {
    const ch = createChannels({
      "body.ink": "#00ff41",
      "mouth.shape": "M187,233L200,246L213,233",
    });
    const tw = createTweens(ch);
    tw.add({ channel: "body.ink", to: "#ff2d2d", duration: 1, ease: "none" }, 0);
    tw.add({ channel: "mouth.shape", to: "M189,235L200,235L211,235", duration: 1, ease: "none" }, 0);
    tw.tick(1);
    expect(ch.get("body.ink")).toBe("#ff2d2d");
    expect(ch.get("mouth.shape")).toBe("M189,235L200,235L211,235");
  });

  it("applies a zero-duration tween at add time, before any tick", () => {
    const ch = createChannels({ "mouth.family": "mouth" });
    const tw = createTweens(ch);
    tw.add({ channel: "mouth.family", to: "mouthO", duration: 0 }, 3);
    expect(ch.get("mouth.family")).toBe("mouthO");   // no tick has run yet
    expect(tw.active()).toBe(0);                     // and nothing is left live
    tw.tick(3);
    expect(ch.get("mouth.family")).toBe("mouthO");
  });

  it("lets a same-instant family snap survive the morph that supersedes it", () => {
    // The yawn authors both of these at `at: 0` on `mouth.shape`: a duration-0
    // snap into family `mouthO`, then the 0.85s morph that opens it. Both fire
    // inside ONE scheduler.tick, so rule 1 cancels the snap before it could ever
    // have ticked. Rule 4 is the only reason this does not throw.
    const POLY = "M189,235L200,235L211,235";
    const CLOSED = "M200,233.6C207.18,233.6 213,234.37 213,235C213,235.63 207.18,236.4 200,236.4C192.82,236.4 187,235.63 187,235C187,234.37 192.82,233.6 200,233.6Z";
    const SMALL = "M200,225C204.97,225 209,229.97 209,236C209,242.03 204.97,247 200,247C195.03,247 191,242.03 191,236C191,229.97 195.03,225 200,225Z";
    const ch = createChannels({ "mouth.shape": POLY });
    const tw = createTweens(ch);
    tw.add({ channel: "mouth.shape", to: CLOSED, duration: 0 }, 0);
    expect(ch.get("mouth.shape")).toBe(CLOSED);      // verbatim, not re-emitted
    tw.add({ channel: "mouth.shape", to: SMALL, duration: 0.85, ease: "none" }, 0);
    expect(tw.active()).toBe(1);
    // MCCCCZ -> MCCCCZ, so it really interpolates: the exact midpoint of CLOSED
    // and SMALL under `ease: "none"` at half of 0.85. Without rule 4 the pair is
    // MLL -> MCCCCZ, which `lerpValue` snaps — the channel would hold SMALL here
    // and the assertion is what catches it. `not.toThrow()` would NOT: nothing
    // throws any more, which is exactly why this test asserts a value instead.
    tw.tick(0.425);
    expect(ch.get("mouth.shape")).toBe(
      "M200,229.3C206.075,229.3,211,232.17,211,235.5C211,238.83,206.075,241.7,200,241.7C193.925,241.7,189,238.83,189,235.5C189,232.17,193.925,229.3,200,229.3Z",
    );
    tw.tick(0.85);
    expect(tw.active()).toBe(0);
  });

  it("snaps a path across shape families instead of throwing", () => {
    // The crossing nobody authored. `yawn` holds `mouth.shape` in family
    // `mouthO` ("MCCCCZ") for 1.85s; every one of the 14 poses drives that same
    // channel with an "MLL" polyline. A poke during a yawn — which
    // `behavior.waking` makes reachable — therefore asks for MCCCCZ -> MLL, and
    // the reverse asks for MLL -> MCCCCZ when the yawn's own later steps fire
    // after the pose. Neither may throw, and both must land on `to` at once.
    const POLY = "M189,235L200,235L211,235";
    const OPEN = "M200,225C204.97,225 209,229.97 209,236C209,242.03 204.97,247 200,247C195.03,247 191,242.03 191,236C191,229.97 195.03,225 200,225Z";
    const ch = createChannels({ "mouth.shape": OPEN });
    const tw = createTweens(ch);
    tw.add({ channel: "mouth.shape", to: POLY, duration: 0.3, ease: "none" }, 0);
    // Written on the FIRST tick, not held until the end: a family crossing is a
    // snap, and a snap that waited 300ms would read as a freeze.
    expect(() => tw.tick(0.1)).not.toThrow();
    expect(ch.get("mouth.shape")).toBe(POLY);
    tw.tick(0.3);
    expect(ch.get("mouth.shape")).toBe(POLY);
    expect(tw.active()).toBe(0);
    // ...and back the other way.
    tw.add({ channel: "mouth.shape", to: OPEN, duration: 0.3, ease: "none" }, 0.3);
    expect(() => tw.tick(0.4)).not.toThrow();
    expect(ch.get("mouth.shape")).toBe(OPEN);
  });

  it("settles the tween it replaces at the instant of the handoff", () => {
    // Rule 5. The outgoing tween writes what it shows AT the handoff instant, so
    // the incoming tween's `from` is that value and not whatever the last tick
    // left behind. Here the handoff at 0.75 falls between ticks on purpose.
    const ch = createChannels({ x: 0 });
    const tw = createTweens(ch);
    tw.add({ channel: "x", to: 10, duration: 1, ease: "none" }, 0);
    tw.tick(0.5);
    near(ch.get("x") as number, 5);
    tw.add({ channel: "x", to: 0, duration: 1, ease: "none" }, 0.75);
    near(ch.get("x") as number, 7.5);    // settled to 0.75 — NOT left at 5
    tw.tick(1.25);
    near(ch.get("x") as number, 3.75);   // half way back from 7.5
  });

  it("hands off to the same value at 60, 240 and 1000 fps", () => {
    // Rule 5 is what makes rule 2's promise survive an interrupt. Without it the
    // incoming tween reads whichever tick happened to land last, so the same
    // animation on the same clock ends up somewhere different at each rate:
    // 0.5184 / 0.5514796875 / 0.5541852249. The interrupt instant 0.41 is
    // deliberately off all three grids — an on-grid one hides the defect.
    const at = (fps: number): number => {
      const ch = createChannels({ x: 0 });
      const tw = createTweens(ch);
      tw.add({ channel: "x", to: 10, duration: 1, ease: "power2.in" }, 0);
      for (let t = 0; t < 0.41; t += 1 / fps) tw.tick(t);
      tw.add({ channel: "x", to: 0, duration: 1, ease: "none" }, 0.41);
      for (let t = 0.41; t <= 0.6; t += 1 / fps) tw.tick(t);
      tw.tick(0.6);
      return ch.get("x") as number;
    };
    // 0.41^3 * 10 = 0.68921, then 81% of the way back: the value is analytic,
    // not recorded from a run.
    near(at(60), 0.5582601);
    near(at(240), at(60));
    near(at(1000), at(60));
  });
});
