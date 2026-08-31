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
import { createArbiter } from "./arbiter";

const config = loadConfig({ character, rig, poses, timelines, behavior, sayings });
const L = config.behavior.ladder;
const bored = L.boredAfterMs / 1000;
const asleep = L.asleepAfterMs / 1000;

const make = () => {
  const channels = createChannels();
  seedChannels(config, channels);
  const scheduler = createScheduler();
  const tweens = createTweens(channels);
  const arbiter = createArbiter({ config, channels, tweens, scheduler });
  // The engine calls this once before the first tick; every test needs it, both
  // for the opening pose and because it is what arms the ladder poll.
  arbiter.start(0);
  return { arbiter, scheduler, tweens, channels };
};

const run = (c: ReturnType<typeof make>, from: number, to: number): void => {
  for (let t = from; t <= to + 1e-12; t += 1 / 60) {
    c.scheduler.tick(t); c.arbiter.tick(t); c.tweens.tick(t);
  }
  c.scheduler.tick(to); c.arbiter.tick(to); c.tweens.tick(to);
};

describe("arbiter", () => {
  it("starts on rung 0 and actually applies the active pose", () => {
    // Rest comes from the rig, not from a pose, so `idle`'s -7 brow rotation is
    // only there if the very first evaluation applied a pose rather than
    // short-circuiting on "the mood already equals the mood I would pick".
    const c = make();
    run(c, 0, 1);
    expect(c.arbiter.state().idleRung).toBe(0);
    expect(c.arbiter.state().source).toBe("idle");
    expect(c.arbiter.state().mood).toBe(L.moods.active);
    expect(c.channels.get("browLeft.rotation")).toBeCloseTo(-7, 9);
  });

  it("climbs to bored and then asleep as time passes with no interaction", () => {
    const c = make();
    run(c, 0, bored - 1);
    expect(c.arbiter.state().idleRung).toBe(0);
    run(c, bored - 1, bored + 1);
    expect(c.arbiter.state().idleRung).toBe(1);
    expect(c.arbiter.state().mood).toBe(L.moods.bored);
    run(c, bored + 1, asleep + 1);
    expect(c.arbiter.state().idleRung).toBe(2);
    expect(c.arbiter.state().mood).toBe(L.moods.asleep);
  });

  it("resets the ladder on notice", () => {
    const c = make();
    run(c, 0, bored + 1);
    c.arbiter.notice(bored + 1);
    run(c, bored + 1, bored + 2);
    expect(c.arbiter.state().idleRung).toBe(0);
  });

  it("lets an app mood outrank the ladder, and releases it on null", () => {
    const c = make();
    c.arbiter.setMood("thinking", 0);
    run(c, 0, asleep + 1);
    expect(c.arbiter.state().source).toBe("app");
    expect(c.arbiter.state().mood).toBe("thinking");
    // The ladder kept climbing underneath — releasing the app mood drops
    // straight to the rung the clock says we are on, with no catch-up.
    expect(c.arbiter.state().idleRung).toBe(2);
    c.arbiter.setMood(null, asleep + 1);
    expect(c.arbiter.state().mood).toBe(L.moods.asleep);
    expect(c.arbiter.state().source).toBe("idle");
  });

  it("picks the poke reaction from the mood it interrupts", () => {
    const asleepRule = config.behavior.poke.find((r) => r.from === L.moods.asleep)!;
    const anyRule = config.behavior.poke.find((r) => r.from === "*")!;

    const sleeping = make();
    run(sleeping, 0, asleep + 1);
    sleeping.arbiter.poke(asleep + 1);
    expect(sleeping.arbiter.state().mood).toBe(asleepRule.expression);
    expect(sleeping.arbiter.state().source).toBe("poke");

    const awake = make();
    run(awake, 0, 1);
    awake.arbiter.poke(1);
    expect(awake.arbiter.state().mood).toBe(anyRule.expression);
  });

  it("holds the poke for its rule's window, then falls back", () => {
    const rule = config.behavior.poke.find((r) => r.from === "*")!;
    const c = make();
    c.arbiter.setMood("thinking", 0);
    c.arbiter.poke(1);
    run(c, 1, 1 + rule.ms / 1000 - 0.2);
    expect(c.arbiter.state().source).toBe("poke");
    run(c, 1 + rule.ms / 1000 - 0.2, 1 + rule.ms / 1000 + 0.2);
    // The app mood is still set, so the poke falls back to it, not to the ladder.
    expect(c.arbiter.state().source).toBe("app");
    expect(c.arbiter.state().mood).toBe("thinking");
  });

  it("wakes through waking.to and plays the yawn when noticed asleep", () => {
    const c = make();
    run(c, 0, asleep + 1);
    expect(c.arbiter.state().mood).toBe(config.behavior.waking.from);
    const before = c.channels.get("mouth.shape");
    c.arbiter.notice(asleep + 1);
    expect(c.arbiter.state().source).toBe("waking");
    expect(c.arbiter.state().mood).toBe(config.behavior.waking.to);
    // The yawn is a timeline, so it is the channels that prove it started.
    let moved = false;
    for (let t = asleep + 1; t <= asleep + 3; t += 1 / 60) {
      c.scheduler.tick(t); c.arbiter.tick(t); c.tweens.tick(t);
      if (c.channels.get("mouth.shape") !== before) moved = true;
    }
    expect(moved).toBe(true);
  });

  it("survives a poke that lands while the yawn holds the mouth open", () => {
    // The crash this task's Step 0 exists to prevent, asserted end-to-end rather
    // than at the tween layer. `waking` plays the 2.1s yawn, which snaps
    // `mouth.shape` into family `mouthO` at t=0 and does not snap back until
    // t=1.85; `laughing` — the `"*"` poke reaction — drives that same channel
    // with an "MLL" polyline. So the pose asks for MCCCCZ -> MLL, and the yawn's
    // own steps at 1.4 and 1.85 then ask for the reverse. Ticking the whole yawn
    // out without throwing IS the assertion; there is nothing to catch.
    const c = make();
    run(c, 0, asleep + 1);
    c.arbiter.notice(asleep + 1);
    const t0 = asleep + 1;
    run(c, t0, t0 + 0.5);
    expect(() => c.arbiter.poke(t0 + 0.5)).not.toThrow();
    expect(c.arbiter.state().mood).toBe(
      config.behavior.poke.find((r) => r.from === "*")!.expression,
    );
    // Past 1.85 — the yawn's closing family snap — and past the poke window.
    expect(() => run(c, t0 + 0.5, t0 + 3)).not.toThrow();
  });

  it("holds speech for the bubble's own life without touching the mood", () => {
    const b = config.behavior.speech.bubble;
    const life = b.in.duration + b.out.delay + b.out.duration;
    const c = make();
    c.arbiter.setMood("thinking", 0);
    c.arbiter.say("hi", 0);
    c.arbiter.tick(0);
    expect(c.arbiter.state().speech?.text).toBe("hi");
    expect(c.arbiter.state().speech!.until).toBeCloseTo(life, 9);
    // A much longer line lives exactly as long — the bubble is not length-scaled.
    c.arbiter.say("a considerably longer line than the previous one", 0);
    c.arbiter.tick(0);
    expect(c.arbiter.state().speech!.until).toBeCloseTo(life, 9);
    expect(c.arbiter.state().mood).toBe("thinking");
    run(c, 0, life + 0.5);
    expect(c.arbiter.state().speech).toBeNull();
  });

  it("pins the ladder to rung 0 for alertAfterTypingMs after a say", () => {
    const alert = L.alertAfterTypingMs / 1000;
    const c = make();
    c.arbiter.say("still here", 0);
    run(c, 0, asleep + 1);
    expect(c.arbiter.state().idleRung).toBe(0);
    // The pin does not touch lastInteraction, so when it lapses the ladder
    // resumes from the real last interaction rather than restarting from zero.
    run(c, asleep + 1, alert + 1);
    expect(c.arbiter.state().idleRung).toBe(2);
  });

  it("normalises the spin instead of leaving the body wound up", () => {
    // applyPose deliberately does NOT schedule its own reset — a second tween on
    // the channel would cancel the spin — so the arbiter owns it, and owns it as
    // a zero-duration tween rather than a channels.set. The distinction is not
    // stylistic: the reset fires inside scheduler.tick, which runs BEFORE
    // tweens.tick on the same frame, so a raw write is overwritten by the spin
    // tween's own final 540 and the normalisation never happens at all.
    const c = make();
    const spin = config.poses.poses.silly!.spin!;
    c.arbiter.setMood("silly", 0);
    run(c, 0, spin.duration + 0.5);
    expect(c.channels.get("body.rotation")).toBe(180);
  });

  it("evaluates the ladder on scheduler instants, identical at every rate", () => {
    // Not "roughly agrees" — the instants are the scheduler's own accumulation,
    // so the whole sequence is byte-identical. The offsets straddle the boredom
    // boundary in both directions, so a test that passed by never climbing would
    // fail on the two negative probes.
    const offsets = [-0.3, -0.1, 0.05, 0.1, 0.15, 0.2, 0.3];
    const sweep = (fps: number): number[] =>
      offsets.map((offset) => {
        const c = make();
        const target = bored + offset;
        for (let t = 0; t <= target; t += 1 / fps) {
          c.scheduler.tick(t); c.arbiter.tick(t); c.tweens.tick(t);
        }
        return c.arbiter.state().idleRung;
      });
    const expected = [0, 0, 1, 1, 1, 1, 1];
    for (const fps of [30, 60, 90, 120, 144, 240]) {
      expect(sweep(fps)).toEqual(expected);
    }
  });
});
