import { describe, expect, it } from "vitest";
import character from "@character/character.json";
import rig from "@character/rig.json";
import poses from "@character/poses.json";
import timelines from "@character/timelines.json";
import behavior from "@character/behavior.json";
import sayings from "@character/sayings.json";
import { loadConfig } from "../config/load";
import { SCENARIOS } from "./scenarios";
import { recordScenario } from "./record";

const config = loadConfig({ character, rig, poses, timelines, behavior, sayings });
const yawn = SCENARIOS.find((s) => s.name === "yawn")!;

describe("recordScenario", () => {
  it("emits one line per frame, ending with a single newline", () => {
    const out = recordScenario(config, yawn);
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
    expect(out.trimEnd().split("\n")).toHaveLength(Math.floor(yawn.duration * yawn.fps) + 1);
  });

  it("writes the documented line shape", () => {
    const first = JSON.parse(recordScenario(config, yawn).split("\n")[0]!);
    expect(first.f).toBe(0);
    expect(first.t).toBe(0);
    expect(first.items).toHaveLength(14);
    const item = first.items[0];
    expect(Object.keys(item).sort()).toEqual(["id", "k", "m", "p", "pts"]);
    expect(item.m).toHaveLength(6);
    expect(typeof item.k).toBe("string");
  });

  it("is byte-identical across runs", () => {
    expect(recordScenario(config, yawn)).toBe(recordScenario(config, yawn));
  });

  it("runs every scenario without throwing", () => {
    for (const s of SCENARIOS) {
      expect(recordScenario(config, s).length).toBeGreaterThan(0);
    }
  });

  it("covers every mood in poses.json", () => {
    const moods = SCENARIOS.find((s) => s.name === "moods")!;
    const scripted = new Set<string>();
    const probe = { setMood: (m: string | null) => { if (m) scripted.add(m); } };
    for (const step of moods.script) step.do(probe as never);
    expect([...scripted].sort()).toEqual(Object.keys(config.poses.poses).sort());
  });
});
