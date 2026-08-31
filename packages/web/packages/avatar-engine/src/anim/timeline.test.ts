import { describe, expect, it } from "vitest";
import character from "@character/character.json";
import rig from "@character/rig.json";
import poses from "@character/poses.json";
import timelines from "@character/timelines.json";
import behavior from "@character/behavior.json";
import sayings from "@character/sayings.json";
import { loadConfig } from "../config/load";
import { createChannels } from "../runtime/channels";
import { createScheduler } from "../runtime/scheduler";
import { createTweens } from "../runtime/tween";
import { seedChannels } from "../scene/rig";
import { playTimeline } from "./timeline";

const config = loadConfig({ character, rig, poses, timelines, behavior, sayings });

const ctx = () => {
  const channels = createChannels();
  seedChannels(config, channels);
  return { config, channels, tweens: createTweens(channels), scheduler: createScheduler() };
};

const step = (c: ReturnType<typeof ctx>, from: number, to: number): void => {
  for (let t = from; t <= to + 1e-12; t += 1 / 60) {
    c.scheduler.tick(t);
    c.tweens.tick(t);
  }
  c.scheduler.tick(to);
  c.tweens.tick(to);
};

describe("playTimeline", () => {
  it("reports the yawn's span", () => {
    const c = ctx();
    const h = playTimeline(c, "yawn", 10);
    expect(h.startedAt).toBe(10);
    expect(h.endsAt).toBeCloseTo(12.1, 12);
  });

  it("snaps the mouth family at 0 and back at 1.85, never tweening it", () => {
    const c = ctx();
    expect(c.channels.get("mouth.family")).toBe("mouth");   // the rest seed
    playTimeline(c, "yawn", 0);
    // The snap is authored at `at: 0`, sharing its instant with the 0.85s morph
    // that opens the O; it survives that morph's `add` only because a
    // duration-0 tween lands at add time (Task 10, rule 4).
    step(c, 0, 0.5);
    expect(c.channels.get("mouth.family")).toBe("mouthO");
    // The EXACT curve the 0.85s open reaches at 0.5, not merely "some closed
    // path". `/^M.*Z$/` is true of the closing snap too, so it stays true when
    // the steps are expanded in the wrong order and the open never happens.
    expect(c.channels.get("mouth.shape")).toBe(
      "M200,231.849542C206.730236,231.849542,212.185834,233.351128,212.185834,235.203542C212.185834,237.055956,206.730236,238.557541,200,238.557541C193.269764,238.557541,187.814166,237.055956,187.814166,235.203542C187.814166,233.351128,193.269764,231.849542,200,231.849542Z",
    );
    step(c, 0.5, 1.8);
    expect(c.channels.get("mouth.family")).toBe("mouthO");   // still open at 1.8
    step(c, 1.8, 1.9);
    expect(c.channels.get("mouth.family")).toBe("mouth");
    // Written verbatim by the snap — and equal to the seeded rest string only
    // because the loader canonicalised the yawn's spaced-out literal.
    expect(c.channels.get("mouth.shape")).toBe("M189,235L200,235L211,235");
  });

  it("never asks the morph to cross families", () => {
    const c = ctx();
    playTimeline(c, "yawn", 0);
    // If any step tried to tween between an "MLL" and an "MCCCCZ", the morph
    // guard throws — so simply running the whole timeline is the assertion.
    expect(() => step(c, 0, 2.1)).not.toThrow();
  });

  it("ends on the asleep mouth, back in family `mouth`", () => {
    // NOT the rig's resting mouth. The rig rests on the `idle` V
    // (`M187,233L200,246L213,233`); the yawn's closing snap at t=1.85 writes the
    // `asleep` polyline, because a yawn ends with the character asleep. Reading
    // `mouth.shape` before playing and asserting the timeline returns to it
    // would compare the V against the flat line and fail.
    const c = ctx();
    expect(c.channels.get("mouth.shape")).toBe("M187,233L200,246L213,233");
    playTimeline(c, "yawn", 0);
    step(c, 0, 2.1);
    expect(c.channels.get("mouth.shape")).toBe("M189,235L200,235L211,235");
    expect(c.channels.get("mouth.family")).toBe("mouth");
  });

  it("calls onDone exactly once, at the end", () => {
    const c = ctx();
    let done = 0;
    playTimeline(c, "yawn", 0, () => { done += 1; });
    step(c, 0, 2.0);
    expect(done).toBe(0);
    step(c, 2.0, 2.2);
    expect(done).toBe(1);
    step(c, 2.2, 5);
    expect(done).toBe(1);
  });

  it("cancels cleanly without firing onDone", () => {
    const c = ctx();
    let done = 0;
    const h = playTimeline(c, "yawn", 0, () => { done += 1; });
    step(c, 0, 1.0);
    h.cancel();
    step(c, 1.0, 5);
    expect(done).toBe(0);
  });

  it("holds each phase at the instant it was authored for", () => {
    // t = 1.775 is 0.325s into the `back.out(1.6)` settle authored at 1.45 — deep
    // enough into the overshoot to be a number no other schedule produces. If the
    // expansion loses each step's own start instant (scheduling every tween at the
    // timeline's start rather than at `fired`), the whole 2.1s structure collapses
    // onto t=0 and this is the assertion that notices.
    const c = ctx();
    playTimeline(c, "yawn", 0);
    step(c, 0, 1.775);
    expect(c.channels.get("body.scaleX") as number).toBeCloseTo(0.991, 12);
    expect(c.channels.get("body.scaleY") as number).toBeCloseTo(0.991, 12);
  });

  it("keeps the pose delay ladder out of a timeline", () => {
    // `browLeft` carries a 0.06s ladder delay in behavior.json. The yawn authors
    // its brow lift at `at: 0`, so under the ladder the tween would not have
    // started at t = 0.04 and the channel would still read its rest 0. Timelines
    // place their own steps in time; the ladder is a POSE mechanism, and applying
    // it here would smear every phase by up to 80ms.
    const c = ctx();
    playTimeline(c, "yawn", 0);
    step(c, 0, 0.04);
    expect(c.channels.get("browLeft.rotation") as number)
      .toBeCloseTo(-0.0006252798697333604, 15);
  });

  it("throws on an unknown timeline", () => {
    const c = ctx();
    expect(() => playTimeline(c, "shrug", 0)).toThrow("unknown timeline: shrug");
  });

  it("lands on identical numbers at 60 and 240 fps", () => {
    // The whole store, not one channel, and MID-FLIGHT as well as at the end.
    // An end-state-only comparison is true by construction under rule 2 — every
    // tween has finished and written its literal `to` — so it passes no matter
    // what the engine did in between. t = 1.0 sits 0.15s into the apex phase
    // authored at 0.85, where every value depends both on when that phase fired
    // and on what the phase it replaced had reached at that instant: it is rule
    // 5's guarantee, read through the real config.
    const snapshot = (fps: number, until: number): string => {
      const c = ctx();
      playTimeline(c, "yawn", 0);
      for (let t = 0; t <= until + 1e-12; t += 1 / fps) { c.scheduler.tick(t); c.tweens.tick(t); }
      c.scheduler.tick(until); c.tweens.tick(until);
      // `names()` sorts, so the snapshot is stable and a diff names the channel.
      return JSON.stringify(c.channels.names().map((k) => [k, c.channels.get(k)]));
    };
    expect(snapshot(60, 1.0)).toBe(snapshot(240, 1.0));
    expect(snapshot(60, 2.1)).toBe(snapshot(240, 2.1));
  });
});
