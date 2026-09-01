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
import { amplitude, gateOpen } from "./params";
import { createReflexes } from "./reflexes";

const config = loadConfig({ character, rig, poses, timelines, behavior, sayings });
const B = config.behavior;
const ACTIVE = B.ladder.moods.active!;
const LIVELY = Object.keys(config.poses.poses)
  .find((m) => (config.poses.poses[m]!.loops?.wiggle ?? 0) > 0)!;
/** The mood whose effect drives a channel an always-on ambient loop also owns —
 *  the collision Ruling 39 is about, found from the config rather than named, so
 *  that renaming the mood or moving the sag to another channel turns this into a
 *  failure rather than quietly into a test of nothing. */
const COLLIDING = Object.keys(B.moodEffects).find((m) => {
  const l = B.moodEffects[m]!.loop;
  return l !== undefined && B.loops.some((a) => a.channel === l.channel);
})!;
const SAG = B.moodEffects[COLLIDING]!.loop!;
// Through `amplitude` rather than a cast: both fields are `AmplitudeRef`, so a
// `as number` would compile happily against a config that had since moved the
// sag's amplitude behind a param and then measure `NaN`.
const SAG_SCOPE = { mood: COLLIDING };
const SAG_AMP = amplitude(config, SAG_SCOPE, SAG.amplitude);
const SAG_PERIOD = amplitude(config, SAG_SCOPE, SAG.duration);

/** The channel the idle fidget BORROWS, and a mood that takes it back. Found
 *  from the config so that moving the fidget off the brows, or dropping the
 *  brows out of every pose, fails here rather than silently testing nothing. */
const BROW = `${B.idleFidget.brow.nodes[0]!}.rotation`;
const BROW_MOOD = Object.keys(config.poses.poses).find((m) =>
  m !== ACTIVE && m !== B.eyesShutMood
  && (config.poses.poses[m]!.channels[BROW] ?? config.rest.get(BROW)) !== config.rest.get(BROW))!;
const BROW_POSED = config.poses.poses[BROW_MOOD]!.channels[BROW] as number;

interface Harness {
  mood: string;
  reduced: boolean;
  mutters: number[];
}

const make = (seed = 7) => {
  const h: Harness = { mood: ACTIVE, reduced: false, mutters: [] };
  const channels = createChannels();
  seedChannels(config, channels);
  const scheduler = createScheduler();
  const tweens = createTweens(channels);
  const reflexes = createReflexes({
    config, channels, tweens, scheduler,
    prng: createPrng(seed),
    mood: () => h.mood,
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
    run(c, 2, 6);
    expect(Math.abs(c.channels.get("antennaLeft.bend") as number)).toBeLessThan(1e-6);
    c.h.mood = ACTIVE;
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
    // Negated against the look: the head turns toward the pointer, not away.
    expect(c.channels.get("tilt.rotation")).toBeCloseTo(-B.gaze.tiltMax, 4);

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

  it("hands a borrowed brow to the mood's pose and never takes it back", () => {
    // The regression this pins. The fidget's gate used to read the idle ladder's
    // RUNG, and a mood forced from outside leaves that rung at 0 — so the idle
    // fidget went on jittering brows a mood had just set, and the settle it had
    // already scheduled dragged them back to the idle value half a second later.
    // The measured cost was the whole face: brow rotation pinned near 0 instead
    // of the pose's, and a swaying idle layer displacing every child node under
    // it. The gate reads the MOOD now, and the settle skips a pose-owned channel
    // once the fidget is no longer active.
    const c = make();
    c.reflexes.start(0);
    // The mood must land while a fidget is IN FLIGHT — that is the only moment
    // whose settle is already on the scheduler with the old idle value in its
    // closure. Waiting for a fixed instant would land in a gap between fidgets
    // on a different seed and quietly stop testing the race.
    let at = 0;
    for (let t = 0; t <= 8; t += 1 / 60) {
      c.scheduler.tick(t); c.tweens.tick(t);
      if (t > 1 && Math.abs(c.channels.get(BROW) as number) > 0.5) { at = t; break; }
    }
    expect(at).toBeGreaterThan(0);
    // The mood arrives, and its pose takes the brow — written the way `applyPose`
    // writes it, since the reflexes know nothing about poses.
    c.h.mood = BROW_MOOD;
    const pose = config.poses.poses[BROW_MOOD]!;
    c.tweens.add({ channel: BROW, to: BROW_POSED, duration: pose.duration, ease: pose.ease }, at);
    // Once that tween has landed the brow belongs to the mood, and NOTHING may
    // move it again — not a fidget the gate should have shut off, and not a
    // settle scheduled before the mood existed. Sampling the whole window is the
    // assertion: an end-state check passes even on the broken engine, because a
    // fidget that ran and settled leaves the channel back where it found it.
    let worst = 0;
    for (let t = at; t <= at + 6; t += 1 / 60) {
      c.scheduler.tick(t); c.tweens.tick(t);
      if (t < at + pose.duration) continue;
      worst = Math.max(worst, Math.abs((c.channels.get(BROW) as number) - BROW_POSED));
    }
    expect(worst).toBeLessThan(1e-9);
    // And the idle LAYER — which no pose writes, so only the fidget can put it
    // back — must still have settled to neutral rather than been left mid-sway.
    expect(c.channels.get("idle.rotation")).toBeCloseTo(0, 6);
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
    c.reflexes.start(0);
    let moved = 0;
    for (let t = 0; t <= 20; t += 1 / 60) {
      c.scheduler.tick(t); c.tweens.tick(t);
      moved = Math.max(moved, Math.abs(c.channels.get("body.x") as number));
    }
    expect(moved).toBeGreaterThan(0.2);
    c.h.mood = ACTIVE;
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

  it("lets a mood effect own a channel whose ambient loop has zero amplitude", () => {
    // `faceBob` is armed for every mood and its amplitude is the active pose's
    // `bob`, which this one sets to 0. Before Ruling 39 that zero-amplitude loop
    // kept re-arming and rewriting `face.y` to 0 every 0.5s; by tween rule 1 each
    // write cancelled the sag, which peaked at 0.124 — 5% of its amplitude — and
    // then sat flat. The lower bound is what fails if that loop comes back.
    const c = make();
    c.h.mood = COLLIDING;
    c.reflexes.start(0);
    // `start` arms the effect directly, so no poll is needed to begin; the window
    // is one out-and-back of the sag.
    const peak = swing(c, SAG.channel, 0, SAG_PERIOD * 2 + 1);
    expect(peak).toBeGreaterThan(SAG_AMP * 0.9);
    expect(peak).toBeLessThanOrEqual(SAG_AMP + 1e-6);
  });

  it("hands the channel over on a mood change, not only when it starts there", () => {
    // The stop side of the same ruling, and the one that needs the poll: nothing
    // tells the reflexes a pose was applied, so the loop whose amplitude just
    // went to zero is noticed by `pollTick` and by nothing else.
    const bob = B.loops.find((l) => l.channel === SAG.channel)!;
    const c = make();
    c.h.mood = LIVELY;
    c.reflexes.start(0);
    expect(swing(c, bob.channel, 0, 2)).toBeGreaterThan(0.5);
    c.h.mood = COLLIDING;
    // Deliberately NOT asserting a return to rest in between: the sag arms in the
    // same poll that stops the bob and is the newer tween, so it takes the channel
    // over from wherever the bob left it — which is what the original did too,
    // both of its writes carrying `overwrite: "auto"`.
    const peak = swing(c, SAG.channel, 2, 2 + SAG_PERIOD * 2 + 1);
    expect(peak).toBeGreaterThan(SAG_AMP * 0.9);
  });

  it("suppresses a mood effect under reduced motion, and restores it when it clears", () => {
    const c = make();
    c.h.mood = COLLIDING;
    c.h.reduced = true;
    c.reflexes.start(0);
    expect(swing(c, SAG.channel, 0, SAG_PERIOD * 2)).toBeLessThan(1e-6);
    c.h.reduced = false;
    // The poll treats the setting exactly like a mood change, so the effect
    // restarts from the top and runs a whole cycle rather than resuming
    // mid-stroke — which is also why a once-shaped effect gets replayed.
    expect(swing(c, SAG.channel, SAG_PERIOD * 2, SAG_PERIOD * 4 + 1))
      .toBeGreaterThan(SAG_AMP * 0.9);
  });

  it("re-arms a stopped loop on exactly one chain", () => {
    // Ruling 41. `stopLoop` cannot cancel the event its own chain already
    // scheduled — `at` hands back no id — so the generation is what stops that
    // orphan from arming a SECOND chain beside the one the poll armed. Two
    // chains are not a bigger swing; they are two writers on one channel at a
    // fractional offset, each cancelling the other mid-stroke. So this counts
    // DIRECTION REVERSALS, which one chain makes once per cycle and two make
    // twice as often.
    //
    // The window is constructed rather than stumbled into: the loop has to arm
    // at 0, be stopped by the poll at `poll`, be re-armed by the poll at
    // `2*poll`, and only THEN have its orphan fire — which needs
    // `period > 2*poll`, the same inequality that makes the bug reachable in
    // the shipped config at all.
    const poll = B.ladder.pollMs / 1000;
    const cycle = (l: (typeof B.loops)[number], m: string): number =>
      amplitude(config, { mood: m }, l.duration) + (l.delay ?? 0);
    const live = (l: (typeof B.loops)[number], m: string): boolean => {
      const s = { mood: m };
      return amplitude(config, s, l.amplitude) !== 0 && gateOpen(config, s, l);
    };
    const gated = B.loops.find((l) =>
      live(l, ACTIVE) && !live(l, B.eyesShutMood) && cycle(l, ACTIVE) > 2 * poll)!;
    const p = cycle(gated, ACTIVE);
    const ch = config.expand(gated.channel)[0]!;

    const c = make();
    c.reflexes.start(0);
    run(c, 0, poll / 2);
    c.h.mood = B.eyesShutMood; // the poll at `poll` stops it
    run(c, poll / 2, poll + poll / 2);
    c.h.mood = ACTIVE; // the poll at `2*poll` arms a fresh chain
    run(c, poll + poll / 2, 3 * poll); // ... and the orphan fires at `p`

    let prev = (c.channels.get(ch) as number) ?? 0;
    let dir = 0;
    let turns = 0;
    for (let t = 3 * poll; t <= 3 * poll + 4 * p + 1e-12; t += 1 / 60) {
      c.scheduler.tick(t); c.tweens.tick(t);
      const v = (c.channels.get(ch) as number) ?? 0;
      // The epsilon is not decoration: a `sine.inOut` stroke moves by less than
      // a float's noise either side of its extreme, and counting that as a turn
      // would find reversals in a perfectly single chain.
      const d = Math.abs(v - prev) < 1e-9 ? 0 : Math.sign(v - prev);
      if (d !== 0 && dir !== 0 && d !== dir) turns += 1;
      if (d !== 0) dir = d;
      prev = v;
    }
    // One chain turns once per cycle — four cycles, four turns, and a fifth
    // only if the window's edge splits one. Two chains turn twice as often.
    expect(turns).toBeGreaterThanOrEqual(3);
    expect(turns).toBeLessThanOrEqual(5);
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
