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
    // MCCCCZ -> MCCCCZ. Without rule 4 this would be MLL -> MCCCCZ and throw.
    expect(() => tw.tick(0.425)).not.toThrow();
    tw.tick(0.85);
    expect(tw.active()).toBe(0);
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
});
