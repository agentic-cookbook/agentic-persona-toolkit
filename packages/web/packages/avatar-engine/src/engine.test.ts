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
    const at = (seed: number): string => {
      const e = createEngine({ config, seed });
      for (let t = 0; t <= 20; t += 1 / 60) e.tick(t);
      return JSON.stringify(e.tick(20));
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
    // The yawn does not end at rest — its closing snap writes the `asleep`
    // mouth, while the rig rests on the `idle` V. Asserting a return to `rest`
    // here would fail on the true config.
    const ASLEEP = "M189,235L200,235L211,235";
    expect(rest).not.toBe(ASLEEP);
    e.play("yawn");
    let sawDifference = false;
    for (let t = 0; t <= 2.2; t += 1 / 60) {
      if (e.tick(t).find((i) => i.id === "mouth")!.d !== rest) sawDifference = true;
    }
    expect(sawDifference).toBe(true);
    expect(e.tick(2.5).find((i) => i.id === "mouth")!.d).toBe(ASLEEP);
  });

  it("stamps a command with the frame that just passed, not a clock of its own", () => {
    // The regression guard for Ruling 48, and the shape of the bug it closed:
    // `play` issued two seconds in must still take the yawn its configured time
    // to reach the closing shape. An engine that stamped commands from a second
    // clock — one the golden recorder never advanced — would compute a deadline
    // two seconds in the PAST and snap to the end state on the very next frame.
    const ASLEEP = "M189,235L200,235L211,235";
    const e = engine();
    for (let t = 0; t <= 2; t += 1 / 60) e.tick(t);
    e.play("yawn");
    let firstAsleep = Infinity;
    for (let f = 120; f <= 300; f += 1) {
      const mouth = e.tick(f / 60).find((i) => i.id === "mouth")!.d;
      if (mouth === ASLEEP && firstAsleep === Infinity) firstAsleep = f / 60 - 2;
    }
    // Bounded on BOTH sides. The upper bound is what the timeline is worth; the
    // lower bound is the whole point — under the old two-clock engine this
    // measured a single frame.
    expect(firstAsleep).toBeGreaterThan(1);
    expect(firstAsleep).toBeLessThanOrEqual(2.6);
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
