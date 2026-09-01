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

  it("wakes INTO waking.play as a mood, and only then lands on waking.to", () => {
    // The mood matters more than the animation here. Everything keyed on the
    // current mood — blink suppression above all — reads `state().mood`, so a
    // wake window that reported `idle` while the yawn played would blink the
    // character mid-yawn, which the original never does.
    const c = make();
    run(c, 0, asleep + 1);
    expect(c.arbiter.state().mood).toBe(config.behavior.waking.from);
    const before = c.channels.get("mouth.shape");
    c.arbiter.notice(asleep + 1);
    expect(c.arbiter.state().source).toBe("waking");
    expect(c.arbiter.state().mood).toBe(config.behavior.waking.play);
    expect(config.behavior.blink.suppressedIn).toContain(config.behavior.waking.play);
    // The yawn is a timeline, so it is the channels that prove it started.
    let moved = false;
    for (let t = asleep + 1; t <= asleep + 3; t += 1 / 60) {
      c.scheduler.tick(t); c.arbiter.tick(t); c.tweens.tick(t);
      if (c.channels.get("mouth.shape") !== before) moved = true;
    }
    expect(moved).toBe(true);
    // Past the window, the ladder has it back.
    run(c, asleep + 1, asleep + 1 + config.behavior.waking.ms / 1000 + 0.2);
    expect(c.arbiter.state().mood).toBe(config.behavior.waking.to);
  });

  it("plays a choreographed mood's timeline instead of its pose", () => {
    // `yawning` is choreographed, and the yawn snaps `mouth.family` at t=0.35.
    // A pose can never do that — the loader holds every pose of a node to the
    // one family the rig declares — so the family channel is proof that the
    // timeline ran and the pose did not.
    const mood = "yawning";
    const timeline = config.behavior.choreography![mood]!;
    expect(timeline).toBeDefined();
    const c = make();
    c.arbiter.setMood(mood, 0);
    expect(c.channels.get("mouth.family")).toBe(config.families.get("mouth"));
    run(c, 0, 0.5);
    expect(c.channels.get("mouth.family")).toBe("mouthO");
    // And the pose it shares a name with is never applied: the pose parks the
    // mouth on its own polyline, which is not where the yawn has it at 0.5s.
    expect(c.channels.get("mouth.shape"))
      .not.toBe(config.poses.poses[mood]!.channels["mouth.shape"]);
  });

  it("cancels a choreographed timeline when the mood changes out from under it", () => {
    // The original kills the choreography timeline on every mood change; the
    // port must too, or the yawn's later steps land on top of whatever pose
    // replaced it. The closing snap at t=1.85 is the one to watch: if it were
    // still scheduled it would re-write `mouth.family` long after the mood left.
    const c = make();
    c.arbiter.setMood("yawning", 0);
    run(c, 0, 0.5);
    expect(c.channels.get("mouth.family")).toBe("mouthO");
    c.arbiter.setMood("thinking", 0.5);
    // Cancelling hands the mouth back to the pose system, so the family channel
    // goes back to the family a pose is allowed to draw — immediately, not at
    // the timeline's own 1.85.
    expect(c.channels.get("mouth.family")).toBe(config.families.get("mouth"));
    const parked = c.channels.get("mouth.shape");
    run(c, 0.5, 2.5);
    expect(c.channels.get("mouth.family")).toBe(config.families.get("mouth"));
    // The yawn's 1.4s morph would have moved the mouth again had it survived;
    // by 2.5s the thinking pose has long since settled, so nothing more moves.
    const settled = c.channels.get("mouth.shape");
    run(c, 2.5, 3.0);
    expect(c.channels.get("mouth.shape")).toBe(settled);
    expect(settled).not.toBe(parked);
  });

  it("survives a poke that lands while the yawn holds the mouth open", () => {
    // The crash this task's Step 0 exists to prevent, asserted end-to-end rather
    // than at the tween layer. `waking` plays the 2.1s yawn, which snaps
    // `mouth.shape` into family `mouthO` at t=0.35; `laughing` — the `"*"` poke
    // reaction — drives that same channel with an "MLL" polyline, so the pose
    // asks for MCCCCZ -> MLL while the mouth is mid-morph. The poke cancels the
    // rest of the yawn, so its own steps at 1.4 and 1.85 no longer ask for the
    // reverse; the pose's own cross-family tween is what is left, and ticking
    // the window out without throwing IS the assertion.
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
