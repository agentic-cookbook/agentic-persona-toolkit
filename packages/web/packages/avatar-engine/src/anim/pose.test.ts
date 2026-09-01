import { describe, expect, it } from "vitest";
import character from "@character/character.json";
import rig from "@character/rig.json";
import poses from "@character/poses.json";
import timelines from "@character/timelines.json";
import behavior from "@character/behavior.json";
import sayings from "@character/sayings.json";
import { loadConfig } from "../config/load";
import { createChannels } from "../runtime/channels";
import { createTweens } from "../runtime/tween";
import { seedChannels } from "../scene/rig";
import { applyPose, channelDelay, nodeOf } from "./pose";

const config = loadConfig({ character, rig, poses, timelines, behavior, sayings });

const ctx = () => {
  const channels = createChannels();
  seedChannels(config, channels);
  return { config, channels, tweens: createTweens(channels) };
};

describe("applyPose", () => {
  it("reads the delay ladder from behavior.json", () => {
    expect(channelDelay(config, "eyeLeftRing.scaleY")).toBe(0);
    expect(channelDelay(config, "irisLeft.scaleX")).toBe(0);
    expect(channelDelay(config, "antennaLeft.rotation")).toBeCloseTo(0.04, 12);
    expect(channelDelay(config, "browLeft.y")).toBeCloseTo(0.06, 12);
    expect(channelDelay(config, "body.ink")).toBeCloseTo(0.08, 12);
    expect(channelDelay(config, "mouth.shape")).toBeCloseTo(0.08, 12);
    expect(channelDelay(config, "descender.alpha")).toBeCloseTo(0.08, 12);
    // `body.ink` is keyed exactly; the body's other channels do not lag with it.
    expect(channelDelay(config, "body.rotation")).toBe(0);
  });

  it("treats a dotless channel as a whole node name", () => {
    // Swift's `nodeOf` returns the whole string when there is no dot, so this
    // must too: `slice(0, indexOf("."))` would yield `mout` and silently miss
    // the `mouth` row — and at `timeline.ts`'s call site it would write the
    // family to `mout.family`, a channel nothing reads. No olylo channel is
    // dotless today, which is exactly why this needs a test rather than luck.
    expect(nodeOf("mouth")).toBe("mouth");
    expect(nodeOf("mouth.shape")).toBe("mouth");
    expect(channelDelay(config, "mouth")).toBeCloseTo(0.08, 12);
  });

  it("fans a group channel out to every member", () => {
    const c = ctx();
    applyPose(c, "excited", 0);
    c.tweens.tick(1);
    // `eye.scaleY` fans out to the two EYE nodes — `rig.json` defines the group
    // as ["eyeLeft.scaleY", "eyeRight.scaleY"] — not to the rings inside them.
    // The ring, the background disc and the iris are children of `eyeLeft`, so
    // they take the scale through the composed matrix and never carry a channel
    // of their own; asserting on `eyeLeftRing.scaleY` here would read a channel
    // the pose never writes and find its rest value of 1.
    // `body.scale` is the synthesised per-node group, which does fan out to the
    // node's own scaleX/scaleY.
    expect(c.channels.get("eyeLeft.scaleY")).toBeCloseTo(1.12, 12);
    expect(c.channels.get("eyeRight.scaleY")).toBeCloseTo(1.12, 12);
    expect(c.channels.get("body.scaleX")).toBeCloseTo(1.1, 12);
    expect(c.channels.get("body.scaleY")).toBeCloseTo(1.1, 12);
  });

  it("settles on the pose's exact values after the full duration", () => {
    const c = ctx();
    applyPose(c, "sad", 0);
    c.tweens.tick(2.0);            // longest delay + longest pose duration, with room
    for (const [channel, value] of Object.entries(config.poses.poses.sad!.channels)) {
      for (const concrete of config.expand(channel)) {
        expect(c.channels.get(concrete)).toEqual(value);
      }
    }
    expect(c.tweens.active()).toBe(0);
  });

  it("staggers the ladder: the eyes arrive before the mouth", () => {
    const c = ctx();
    applyPose(c, "excited", 0);
    // 0.08 s in, the mouth's tween has not started; the eyes' is well under way.
    c.tweens.tick(0.079);
    expect(c.channels.get("mouth.shape")).toBe(config.rest.get("mouth.shape"));
    expect(c.channels.get("eyeLeft.scaleY")).not.toBe(1);
  });

  it("pins the exact-channel precedence over node-level entries", () => {
    // Exact channel matches in channelDelays win over bare node names, so
    // `body.ink` can lag while `body.rotation` does not. Mutating the precedence
    // order would silently break without goldens catching it, since olylo has no
    // colliding keys in its current behavior.json.
    const clonedBehavior = structuredClone(behavior);
    (clonedBehavior.channelDelays as Record<string, number>)["body"] = 0.02;  // distinct from the exact key
    const testConfig = loadConfig({
      character, rig, poses, timelines,
      behavior: clonedBehavior, sayings,
    });
    expect(channelDelay(testConfig, "body.ink")).toBeCloseTo(0.08, 12);
    expect(channelDelay(testConfig, "body.rotation")).toBeCloseTo(0.02, 12);
  });

  it("spins the body a whole number of turns and reports the normalisation", () => {
    const c = ctx();
    const result = applyPose(c, "silly", 0);
    c.tweens.tick(0.5);
    expect(Math.abs(c.channels.get("body.rotation") as number)).toBeGreaterThan(90);
    c.tweens.tick(0.9);
    // silly poses body.rotation at 180 and spins one turn on top of it.
    expect(c.channels.get("body.rotation")).toBeCloseTo(540, 9);
    expect(result.resetAt).toEqual({ at: 0.9, channel: "body.rotation", value: 180 });
    // The engine (Task 17) hands resetAt to the scheduler; here we apply it by hand.
    c.channels.set(result.resetAt!.channel, result.resetAt!.value);
    expect(c.channels.get("body.rotation")).toBe(180);
  });

  it("normalises spin rotations into (-180, 180] to prevent accumulation", () => {
    // The wrap arithmetic — `((end % 360) + 360) % 360`, then subtract 360 when
    // that lands above 180 — needs both branches driven, or a Swift mirror whose
    // `%` disagrees on negatives passes anyway.
    // Silly poses body.rotation at 180 (already on the boundary) and spins one
    // turn, landing at 540 and normalising to 180. This test drives the other
    // branch: pose at 270, spin one turn, land at 630, normalise to -90.
    const bad = structuredClone({ character, rig, poses, timelines, behavior, sayings });
    (bad.poses as { poses: Record<string, { channels: Record<string, unknown> }> })
      .poses.silly!.channels["body.rotation"] = 270;
    const testConfig = loadConfig(bad);
    const channels = createChannels();
    seedChannels(testConfig, channels);
    const c = {
      config: testConfig,
      channels,
      tweens: createTweens(channels),
    };
    const result = applyPose(c, "silly", 0);
    c.tweens.tick(0.9);
    // Spin is from 270 + (1 * 360) = 630
    expect(c.channels.get("body.rotation")).toBeCloseTo(630, 9);
    // Normalise: ((630 % 360) + 360) % 360 = 270, then > 180 → -90
    expect(result.resetAt).toEqual({ at: 0.9, channel: "body.rotation", value: -90 });
  });

  it("runs a carried channel at the spin's pace, not the pose's", () => {
    const spin = config.poses.poses.silly!.spin!;
    expect(spin.carries).toEqual(["body.scale"]);
    const target = config.poses.poses.silly!.channels["body.scale"] as number;
    // `body.scale` is a group; the rig's own channels are the two axes.
    expect(config.expand("body.scale")).toEqual(["body.scaleX", "body.scaleY"]);
    const c = ctx();
    expect(c.channels.get("body.scaleX")).toBe(1);
    applyPose(c, "silly", 0);

    // At the pose's own duration the pose's channels have landed...
    c.tweens.tick(config.poses.poses.silly!.duration);
    expect(c.channels.get("eyeLeft.x")).toBeCloseTo(-6, 9);
    // ...but the scale rides the 0.9s whirl, so it is barely a third of the way.
    // Written out rather than read back off `resolveEase`, so the expected value
    // pins the spin's ease by name: powerN.inOut is 2^N * t^(N+1) below the
    // midpoint, so power3.inOut at p = 0.4 / 0.9 is 8 * p^4 = 0.312...
    const p = config.poses.poses.silly!.duration / spin.duration;
    expect(p).toBeLessThan(0.5);
    expect(c.channels.get("body.scaleX")).toBeCloseTo(1 + (target - 1) * 8 * p ** 4, 6);
    expect(c.channels.get("body.scaleY") as number).toBeLessThan(target);

    c.tweens.tick(spin.duration);
    expect(c.channels.get("body.scaleX")).toBeCloseTo(target, 9);
    expect(c.channels.get("body.scaleY")).toBeCloseTo(target, 9);
  });

  it("refuses a carried channel the pose does not drive, or the spin's own", () => {
    const clone = () => structuredClone({ character, rig, poses, timelines, behavior, sayings });
    const spinOf = (b: ReturnType<typeof clone>): { channel: string; carries?: string[] } =>
      (b.poses as unknown as { poses: Record<string, { spin: { channel: string; carries?: string[] } }> })
        .poses.silly!.spin;

    const undriven = clone();
    spinOf(undriven).carries = ["face.rotation"];
    expect(() => loadConfig(undriven)).toThrow(/does not drive/);

    const itself = clone();
    spinOf(itself).carries = [spinOf(itself).channel];
    expect(() => loadConfig(itself)).toThrow(/already times it/);

    const nonsense = clone();
    spinOf(nonsense).carries = ["body.notAChannel"];
    expect(() => loadConfig(nonsense)).toThrow();
  });

  it("lets a later pose interrupt an earlier one mid-flight", () => {
    const c = ctx();
    applyPose(c, "excited", 0);
    c.tweens.tick(0.2);
    applyPose(c, "sad", 0.2);
    c.tweens.tick(2.0);
    expect(c.channels.get("body.ink")).toEqual(config.poses.poses.sad!.channels["body.ink"]);
  });
});
