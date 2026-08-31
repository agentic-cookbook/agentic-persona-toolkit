import { describe, expect, it } from "vitest";
import character from "@character/character.json";
import rig from "@character/rig.json";
import poses from "@character/poses.json";
import timelines from "@character/timelines.json";
import behavior from "@character/behavior.json";
import sayings from "@character/sayings.json";
import { loadConfig } from "../config/load";
import { createPrng } from "../math/prng";
import { createChannels } from "../runtime/channels";
import { createScheduler } from "../runtime/scheduler";
import { createTweens } from "../runtime/tween";
import { seedChannels } from "../scene/rig";
import { createReflexes } from "./reflexes";

const config = loadConfig({ character, rig, poses, timelines, behavior, sayings });
const B = config.behavior;
const ACTIVE = B.ladder.moods.active!;
const LIVELY = Object.keys(config.poses.poses)
  .find((m) => (config.poses.poses[m]!.loops?.wiggle ?? 0) > 0)!;

interface Harness {
  mood: string;
  rung: number;
  reduced: boolean;
  mutters: number[];
}

const make = (seed = 7) => {
  const h: Harness = { mood: ACTIVE, rung: 0, reduced: false, mutters: [] };
  const channels = createChannels();
  seedChannels(config, channels);
  const scheduler = createScheduler();
  const tweens = createTweens(channels);
  const reflexes = createReflexes({
    config, channels, tweens, scheduler,
    prng: createPrng(seed),
    mood: () => h.mood,
    idleRung: () => h.rung,
    reducedMotion: () => h.reduced,
    mutter: (now) => h.mutters.push(now),
  });
  return { h, channels, scheduler, tweens, reflexes };
};

const run = (c: ReturnType<typeof make>, from: number, to: number): void => {
  for (let t = from; t <= to + 1e-12; t += 1 / 60) {
    c.scheduler.tick(t); c.tweens.tick(t);
  }
};

/** The extreme a channel reaches over a window — how an ambient loop is measured. */
const swing = (c: ReturnType<typeof make>, channel: string, from: number, to: number): number => {
  let peak = 0;
  for (let t = from; t <= to + 1e-12; t += 1 / 60) {
    c.scheduler.tick(t); c.tweens.tick(t);
    peak = Math.max(peak, Math.abs((c.channels.get(channel) as number) ?? 0));
  }
  return peak;
};

describe("reflexes", () => {
  it("drives the antennae with the calm sway amplitude at rest", () => {
    const sel = B.params.swayAmp as { then: number; else: number };
    const c = make();
    c.reflexes.start(0);
    const peak = swing(c, "antennaLeft.bend", 0, 4);
    expect(peak).toBeGreaterThan(sel.else * 0.9);
    expect(peak).toBeLessThanOrEqual(sel.else + 1e-6);
  });

  it("switches to the lively amplitude when the pose supplies a wiggle", () => {
    const sel = B.params.swayAmp as { then: number; else: number };
    const c = make();
    c.h.mood = LIVELY;
    c.reflexes.start(0);
    const peak = swing(c, "antennaLeft.bend", 0, 4);
    expect(peak).toBeGreaterThan(sel.else + 1);
    expect(peak).toBeLessThanOrEqual(sel.then + 1e-6);
  });

  it("rests the antennae when the eyes are shut, and re-arms them on waking", () => {
    const c = make();
    c.reflexes.start(0);
    run(c, 0, 2);
    c.h.mood = B.eyesShutMood;
    c.h.rung = 2;
    run(c, 2, 6);
    expect(Math.abs(c.channels.get("antennaLeft.bend") as number)).toBeLessThan(1e-6);
    c.h.mood = ACTIVE;
    c.h.rung = 0;
    expect(swing(c, "antennaLeft.bend", 6, 11)).toBeGreaterThan(1);
  });

  it("blinks — shut and back open — and not at all in a suppressed mood", () => {
    const chan = config.expand(B.blink.channel)[0]!;
    const c = make();
    c.reflexes.start(0);
    let low = Infinity;
    let lastDip = 0;
    for (let t = 0; t <= B.blink.maxMs / 1000 + 1; t += 1 / 60) {
      c.scheduler.tick(t); c.tweens.tick(t);
      const v = c.channels.get(chan) as number;
      low = Math.min(low, v);
      if (v < 0.5) lastDip = t;
    }
    expect(low).toBeLessThan(B.blink.shut + 0.05);
    // Let THAT blink finish, rather than asserting at a fixed time: the gap is
    // drawn from [minMs, maxMs], so a fixed end lands mid-close whenever a blink
    // happens to fire just before it. The next blink cannot start for another
    // minMs, so a window anchored on the last dip is guaranteed to be open.
    run(c, B.blink.maxMs / 1000 + 1,
        lastDip + B.blink.durationMs / 1000 + 2 * B.blink.tweenDuration + 0.05);
    expect(c.channels.get(chan)).toBeCloseTo(1, 6);

    const quiet = make();
    quiet.h.mood = B.blink.suppressedIn[0]!;
    quiet.reflexes.start(0);
    let dip = Infinity;
    for (let t = 0; t <= B.blink.maxMs / 1000 * 3; t += 1 / 60) {
      quiet.scheduler.tick(t); quiet.tweens.tick(t);
      dip = Math.min(dip, quiet.channels.get(chan) as number);
    }
    expect(dip).toBeCloseTo(1, 6);
  });

  it("follows a look, and wanders within gazeMax once the pointer goes quiet", () => {
    const c = make();
    c.reflexes.start(0);
    c.reflexes.look(1, -1, 0);
    run(c, 0, 1);
    expect(c.channels.get("irisLeft.x")).toBeCloseTo(B.gaze.gazeMax, 4);
    expect(c.channels.get("irisLeft.y")).toBeCloseTo(-B.gaze.gazeMax, 4);
    expect(c.channels.get("tilt.rotation")).toBeCloseTo(B.gaze.tiltMax, 4);

    // No further look: after wanderAfterMs the gaze picks its own targets, and
    // every one of them stays inside the configured reach.
    let peak = 0;
    for (let t = 1; t <= 12; t += 1 / 60) {
      c.scheduler.tick(t); c.tweens.tick(t);
      peak = Math.max(peak, Math.abs(c.channels.get("irisLeft.x") as number));
    }
    expect(peak).toBeLessThanOrEqual(B.gaze.gazeMax + 1e-6);
  });

  it("suppresses the ambient loops and the fidget under reduced motion", () => {
    const c = make();
    c.h.mood = LIVELY;
    c.h.reduced = true;
    c.reflexes.start(0);
    expect(swing(c, "antennaLeft.bend", 0, 5)).toBeLessThan(1e-6);
    expect(swing(c, "idle.rotation", 0, 5)).toBeLessThan(1e-6);
    // And it is a switch, not a one-way door.
    c.h.reduced = false;
    expect(swing(c, "antennaLeft.bend", 5, 10)).toBeGreaterThan(1);
  });

  it("fades the pinpricks in when the eyes shut and back out when they open", () => {
    const node = B.pinpricks.nodes[0]!;
    const c = make();
    c.reflexes.start(0);
    run(c, 0, 1);
    const hidden = config.rest.get(`${node}.alpha`) as number;
    expect(c.channels.get(`${node}.alpha`)).toBeCloseTo(hidden, 6);
    c.h.mood = B.eyesShutMood;
    run(c, 1, 3);
    expect(c.channels.get(`${node}.alpha`)).toBeCloseTo(B.pinpricks.alpha, 6);
    c.h.mood = ACTIVE;
    run(c, 3, 5);
    expect(c.channels.get(`${node}.alpha`)).toBeCloseTo(hidden, 6);
  });

  it("stirs the body while asleep and returns it to rest on waking", () => {
    const c = make();
    c.h.mood = B.eyesShutMood;
    c.h.rung = 2;
    c.reflexes.start(0);
    let moved = 0;
    for (let t = 0; t <= 20; t += 1 / 60) {
      c.scheduler.tick(t); c.tweens.tick(t);
      moved = Math.max(moved, Math.abs(c.channels.get("body.x") as number));
    }
    expect(moved).toBeGreaterThan(0.2);
    c.h.mood = ACTIVE;
    c.h.rung = 0;
    run(c, 20, 23);
    expect(c.channels.get("body.x")).toBeCloseTo(config.rest.get("body.x") as number, 5);
  });

  it("mutters only while asleep, on the mutterMs cadence", () => {
    const period = B.speech.mutterMs / 1000;
    const c = make();
    c.reflexes.start(0);
    run(c, 0, period * 2 + 1);
    expect(c.h.mutters).toHaveLength(0);
    c.h.mood = B.speech.loopingIn[0]!;
    run(c, period * 2 + 1, period * 4 + 2);
    expect(c.h.mutters.length).toBeGreaterThanOrEqual(1);
  });

  it("is deterministic: same seed and same clock, identical channels", () => {
    const a = make(1234);
    const b = make(1234);
    a.reflexes.start(0);
    b.reflexes.start(0);
    run(a, 0, 12);
    run(b, 0, 12);
    for (const name of a.channels.names()) {
      expect(b.channels.get(name)).toStrictEqual(a.channels.get(name));
    }
  });

  it("cancels every pending one-shot on stop", () => {
    const c = make();
    c.reflexes.start(0);
    run(c, 0, 3);
    c.reflexes.stop();
    // `stop` cancels SCHEDULED work, not tweens already in flight — at t = 3 the
    // breath is 0.4 s into a 2.6 s cycle and both sways are mid-stroke. Drain
    // them first: the claim under test is that nothing NEW gets scheduled, and
    // snapshotting mid-tween would fail against a perfectly correct `stop`.
    run(c, 3, 9);
    const frozen = c.channels.names().map((n) => c.channels.get(n));
    run(c, 9, 20);
    expect(c.channels.names().map((n) => c.channels.get(n))).toStrictEqual(frozen);
  });
});
