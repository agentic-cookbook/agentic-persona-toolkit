import { describe, expect, it } from "vitest";
import character from "@character/character.json";
import rig from "@character/rig.json";
import poses from "@character/poses.json";
import timelines from "@character/timelines.json";
import behavior from "@character/behavior.json";
import sayings from "@character/sayings.json";
import { loadConfig } from "./config/load";
import { createEngine } from "./engine";

const config = loadConfig({ character, rig, poses, timelines, behavior, sayings });
const engine = () => createEngine({ config, seed: 1 });

describe("engine", () => {
  it("returns a display list of the expected shape on the first tick", () => {
    const e = engine();
    const list = e.tick(0);
    expect(list).toHaveLength(14);
    for (const item of list) {
      expect(item.m).toHaveLength(6);
      expect(typeof item.d).toBe("string");
      expect(item.paint.ink).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("never reads a clock of its own", () => {
    // Two engines given identical tick sequences must agree exactly, which cannot
    // hold if anything inside consulted a real clock or Math.random.
    const a = engine();
    const b = engine();
    let last: unknown;
    for (let t = 0; t <= 20; t += 1 / 60) {
      last = JSON.stringify(a.tick(t));
      expect(JSON.stringify(b.tick(t))).toBe(last);
    }
  });

  it("produces the same 20-second state at 60 and 240 Hz", () => {
    const at = (fps: number): string => {
      const e = engine();
      for (let t = 0; t <= 20; t += 1 / fps) e.tick(t);
      return JSON.stringify(e.tick(20));
    };
    expect(at(60)).toBe(at(240));
  });

  it("differs between seeds", () => {
    // Sampled once per second across the run, not just at the final instant:
    // with two independent blink chains (Task 44) each engine can land on an
    // idle, tween-free frame -- no blink, no gaze wander -- at any ONE given
    // tick purely by chance, coinciding across seeds despite the seed
    // otherwise mattering throughout the run. Concatenating several samples
    // keeps that single-instant coincidence from failing a test about
    // determinism, while still failing if the seed genuinely stopped
    // affecting anything.
    const at = (seed: number): string => {
      const e = createEngine({ config, seed });
      const samples: string[] = [];
      for (let f = 0; f <= 20 * 60; f++) {
        const list = e.tick(f / 60);
        if (f % 60 === 0) samples.push(JSON.stringify(list));
      }
      return samples.join("|");
    };
    expect(at(1)).not.toBe(at(2));
  });

  it("applies a mood on the very next tick", () => {
    const e = engine();
    e.tick(0);
    e.setMood("sad");
    e.tick(1 / 60);
    e.tick(1.0);
    expect(e.state().mood).toBe("sad");
  });

  it("plays a named timeline and settles on the shape it ends on", () => {
    const e = engine();
    const rest = e.tick(0).find((i) => i.id === "mouth")!.d;
    // The yawn does not end at rest — its closing snap writes a flat slit,
    // while the rig rests on the `idle` V. Asserting a return to `rest` here
    // would fail on the true config.
    const CLOSED = "M187,235L200,235L213,235";
    expect(rest).not.toBe(CLOSED);
    e.play("yawn");
    let sawDifference = false;
    for (let t = 0; t <= 2.2; t += 1 / 60) {
      if (e.tick(t).find((i) => i.id === "mouth")!.d !== rest) sawDifference = true;
    }
    expect(sawDifference).toBe(true);
    expect(e.tick(2.5).find((i) => i.id === "mouth")!.d).toBe(CLOSED);
  });

  it("cancels the running timeline before starting another, whichever door starts it", () => {
    // `play` used to throw the handle away, so a second timeline landed on top
    // of the first: its `at: 0` promote read a `mouth.shape` the first had
    // already promoted and `promotePolyline` refused it —
    // `can only promote an open polyline, not "MCCCC"` — thrown from inside
    // `scheduler.tick`, i.e. out of `engine.tick`, which on the web is the frame
    // that never schedules the next `requestAnimationFrame`. The avatar is dead
    // until unmount, so "does not throw" is the whole assertion, and it is only
    // worth anything because both of these DID.
    for (const second of [
      (e: ReturnType<typeof engine>) => e.play("yawn"),
      (e: ReturnType<typeof engine>) => e.setMood("yawning"),
    ]) {
      const e = engine();
      for (let t = 0; t <= 1; t += 1 / 60) e.tick(t);
      e.play("yawn");
      for (let t = 1 + 1 / 60; t <= 1.5; t += 1 / 60) e.tick(t);
      second(e);
      expect(() => { for (let t = 1.5; t <= 5; t += 1 / 60) e.tick(t); }).not.toThrow();
      // Alive, and the mouth is back in a family the rig declares.
      expect(e.tick(5).length).toBe(14);
      expect(e.channels().get("mouth.family")).toBe("mouth");
    }
  });

  it("refuses an unknown mood without committing it", () => {
    // `setMood` is the one string reaching this engine that the loader never
    // saw. The arbiter used to commit `current` first and let `applyPose` throw:
    // the state then said the mood applied, so every later `evaluate`
    // short-circuited on `next.mood !== current` and painted nothing at all —
    // and the first one that did not short-circuit threw out of a `tick` the
    // host's frame loop does not survive.
    const e = engine();
    for (let t = 0; t <= 1; t += 1 / 60) e.tick(t);
    expect(() => e.setMood("exicted")).toThrow("unknown mood: exicted");
    expect(e.state().mood).toBe("idle");

    // Still painting, and still able to take a real mood afterwards.
    const before = JSON.stringify(e.tick(1.5));
    e.setMood("excited");
    for (let t = 1.5; t <= 3; t += 1 / 60) e.tick(t);
    expect(e.state().mood).toBe("excited");
    expect(JSON.stringify(e.tick(3))).not.toBe(before);

    // And a poke, whose window lapsing is what re-ran `evaluate` from inside
    // `arbiter.tick` and threw there under the old order.
    e.setMood(null);
    e.poke();
    expect(() => { for (let t = 3; t <= 12; t += 1 / 60) e.tick(t); }).not.toThrow();
  });

  it("stamps a command with the frame that just passed, not a clock of its own", () => {
    // The regression guard for Ruling 48, and the shape of the bug it closed:
    // `play` issued two seconds in must still take the yawn its configured time
    // to reach the closing shape. An engine that stamped commands from a second
    // clock — one the golden recorder never advanced — would compute a deadline
    // two seconds in the PAST and snap to the end state on the very next frame.
    const CLOSED = "M187,235L200,235L213,235";
    const e = engine();
    for (let t = 0; t <= 2; t += 1 / 60) e.tick(t);
    e.play("yawn");
    let firstClosed = Infinity;
    for (let f = 120; f <= 300; f += 1) {
      const mouth = e.tick(f / 60).find((i) => i.id === "mouth")!.d;
      if (mouth === CLOSED && firstClosed === Infinity) firstClosed = f / 60 - 2;
    }
    // Bounded on BOTH sides. The upper bound is what the timeline is worth; the
    // lower bound is the whole point — under the old two-clock engine this
    // measured a single frame.
    expect(firstClosed).toBeGreaterThan(1);
    expect(firstClosed).toBeLessThanOrEqual(2.6);
  });

  it("normalises the host's epoch away", () => {
    // A browser drives `tick` from `performance.now() / 1000`, a Mac from
    // `CACurrentMediaTime()` — both seconds since some arbitrary boot-ish epoch,
    // and neither anywhere near zero. The engine anchors on its own first frame,
    // so the same frame SEQUENCE composes the same list whatever the epoch, and
    // a command issued before that first frame lands at the start rather than an
    // epoch-length interval in the past.
    const run = (epoch: number): number[][] => {
      const e = engine();
      e.setMood("sad");
      let last = e.tick(epoch);
      for (let f = 1; f <= 120; f += 1) last = e.tick(epoch + f / 60);
      return last.map((i) => [...i.m]);
    };
    const here = run(0);
    const faraway = run(1e6);
    expect(faraway).toHaveLength(here.length);
    // Compared numerically, and honestly so. `epoch + f / 60` is a double, so a
    // six-digit epoch costs the fraction a few of its low bits and the
    // normalised clock lands within ~1e-9 of the frame time rather than exactly
    // on it. The claim is that the epoch does not MATTER, at the same 1e-6 the
    // golden differ tolerates — not that IEEE-754 addition is associative.
    for (let i = 0; i < here.length; i += 1) {
      for (let k = 0; k < 6; k += 1) {
        expect(Math.abs(faraway[i]![k]! - here[i]![k]!)).toBeLessThan(1e-6);
      }
    }
  });

  it("picks sayings deterministically from the seed", () => {
    const a = createEngine({ config, seed: 42 });
    const b = createEngine({ config, seed: 42 });
    expect(a.randomSaying("excited")).toBe(b.randomSaying("excited"));
    expect(config.sayings.sayings.excited).toContain(a.randomSaying("excited"));
  });

  it("suppresses ambient motion under reduced motion", () => {
    // A WIRING test, and only that (Ruling 42): what the preference *means* —
    // the ambient loops settle and never re-arm, the idle fidget stops — is
    // proved against the reflexes directly in `anim/reflexes.test.ts`. The only
    // question left here is whether `env.reducedMotion` actually reaches
    // `createReflexes`, so this measures the same two channels that test does,
    // through the engine's own public surface.
    //
    // Each channel is measured against its own REST value, not against a second
    // engine. Reduced motion deliberately leaves the gaze running, and the gaze
    // is what dominates the composed geometry — so comparing the spread of a
    // rendered item between a reduced-motion engine and a normal one asks which
    // of the two happened to wander further, not whether anything is breathing.
    // Worse, the two PRNG streams diverge the moment one of them stops drawing
    // for the fidget, so the answer is a coin flip: on this config it inverts
    // for 6 of the first 15 seeds.
    const loop = "antennaLeft.bend"; // the sway loop's channel, and nothing else's
    const fidget = "idle.rotation"; // the idle fidget's channel, and nothing else's
    const swing = (reduced: boolean): Record<string, number> => {
      const e = createEngine({ config, seed: 1, env: { reducedMotion: () => reduced } });
      const out: Record<string, number> = { [loop]: 0, [fidget]: 0 };
      for (let t = 0; t <= 8; t += 1 / 60) {
        e.tick(t);
        for (const ch of [loop, fidget]) {
          const rest = (config.rest.get(ch) as number) ?? 0;
          const v = (e.channels().get(ch) as number) ?? rest;
          out[ch] = Math.max(out[ch]!, Math.abs(v - rest));
        }
      }
      return out;
    };

    const still = swing(true);
    expect(still[loop]).toBe(0);
    expect(still[fidget]).toBe(0);

    // The other half of the claim, and what stops the zeros above from passing
    // on a dead channel: both channels DO move with the preference off. The
    // loop is not PRNG-driven — it reaches its configured `swayAmp` of 10.64
    // exactly — while the fidget's magnitude is a draw inside ±3.5, so it is
    // only asserted to be non-zero.
    const moving = swing(false);
    expect(moving[loop]).toBeGreaterThan(5);
    expect(moving[fidget]).toBeGreaterThan(0);
  });
});
