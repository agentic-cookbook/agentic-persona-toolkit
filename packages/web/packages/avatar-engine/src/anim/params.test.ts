import { describe, expect, it } from "vitest";
import character from "@character/character.json";
import rig from "@character/rig.json";
import poses from "@character/poses.json";
import timelines from "@character/timelines.json";
import behavior from "@character/behavior.json";
import sayings from "@character/sayings.json";
import { loadConfig } from "../config/load";
import { amplitude, gateOpen, numberParam, poseNumber, predicate } from "./params";

const config = loadConfig({ character, rig, poses, timelines, behavior, sayings });
const P = config.behavior.params;
const calm = { mood: config.behavior.ladder.moods.active! };
const livelyMood = Object.keys(config.poses.poses)
  .find((m) => (config.poses.poses[m]!.loops?.wiggle ?? 0) > 0)!;
const lively = { mood: livelyMood };

describe("params", () => {
  it("reads a gt predicate off the current pose's loops block", () => {
    expect(poseNumber(config, calm, "wiggle")).toBe(0);
    expect(predicate(config, calm, "lively")).toBe(false);
    expect(predicate(config, lively, "lively")).toBe(true);
  });

  it("selects the sway amplitude by liveliness, at full precision", () => {
    const sel = P.swayAmp as { then: number; else: number };
    // 8 * 1.33 and 18 * 1.33 — the goldens compare at 1e-6, so nothing rounds.
    expect(numberParam(config, calm, "swayAmp")).toBeCloseTo(sel.else, 9);
    expect(numberParam(config, lively, "swayAmp")).toBeCloseTo(sel.then, 9);
    expect(sel.else).toBeCloseTo(10.64, 9);
    expect(sel.then).toBeCloseTo(23.94, 9);
  });

  it("resolves the two built-in predicates", () => {
    const shut = { mood: config.behavior.eyesShutMood };
    expect(predicate(config, shut, "eyesShut")).toBe(true);
    expect(predicate(config, calm, "eyesShut")).toBe(false);
    expect(predicate(config, calm, "curious")).toBe(true);
    expect(predicate(config, shut, "curious")).toBe(false);
  });

  it("applies an amplitude's scale, and opens a gate only when both halves agree", () => {
    const bob = config.poses.poses[livelyMood]!.loops!.bob!;
    expect(amplitude(config, lively, { param: "bob", scale: -1 })).toBeCloseTo(-bob, 9);
    expect(amplitude(config, lively, 9)).toBe(9);
    expect(gateOpen(config, calm, {})).toBe(true);
    expect(gateOpen(config, calm, { enabledWhen: "lively" })).toBe(false);
    expect(gateOpen(config, lively, { enabledWhen: "lively" })).toBe(true);
    // `disabledWhen` is consulted even after `enabledWhen` has passed. The two
    // halves name the SAME predicate on purpose: `curious` is now "the mood is
    // the ladder's active one", and that mood has `wiggle: 0`, so no mood in the
    // shipped config satisfies `lively` and `curious` at once. Naming two
    // predicates that cannot co-hold would let the gate close for the wrong
    // half and still pass.
    expect(gateOpen(config, lively, { enabledWhen: "lively", disabledWhen: "lively" })).toBe(false);
    expect(gateOpen(config, lively, { enabledWhen: "lively", disabledWhen: "curious" })).toBe(true);
  });
});
