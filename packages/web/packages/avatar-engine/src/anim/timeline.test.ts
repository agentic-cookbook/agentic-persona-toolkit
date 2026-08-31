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
    expect(c.channels.get("mouth.shape")).toMatch(/^M.*Z$/);
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

  it("is frame-rate independent at the end state", () => {
    const at = (fps: number) => {
      const c = ctx();
      playTimeline(c, "yawn", 0);
      for (let t = 0; t <= 2.1; t += 1 / fps) { c.scheduler.tick(t); c.tweens.tick(t); }
      c.scheduler.tick(2.1); c.tweens.tick(2.1);
      return c.channels.get("mouth.shape");
    };
    expect(at(60)).toBe(at(240));
  });
});
