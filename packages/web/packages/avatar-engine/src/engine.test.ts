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

  it("picks sayings deterministically from the seed", () => {
    const a = createEngine({ config, seed: 42 });
    const b = createEngine({ config, seed: 42 });
    expect(a.randomSaying("excited")).toBe(b.randomSaying("excited"));
    expect(config.sayings.sayings.excited).toContain(a.randomSaying("excited"));
  });

  it("suppresses ambient motion under reduced motion", () => {
    // The ambient loops and the idle fidget are what move the face layer, and
    // `mouth` rides it — so the mouth's x translation is the cheapest honest
    // measure of "is anything breathing".

    const still = createEngine({ config, seed: 1, env: { reducedMotion: () => true } });
    const moving = createEngine({ config, seed: 1, env: { reducedMotion: () => false } });
    const spread = (e: ReturnType<typeof engine>): number => {
      let lo = Infinity; let hi = -Infinity;
      for (let t = 0; t <= 8; t += 1 / 60) {
        const v = e.tick(t).find((i) => i.id === "mouth")!.m[4];
        lo = Math.min(lo, v); hi = Math.max(hi, v);
      }
      return hi - lo;
    };
    expect(spread(still)).toBeLessThan(spread(moving));
  });
});
