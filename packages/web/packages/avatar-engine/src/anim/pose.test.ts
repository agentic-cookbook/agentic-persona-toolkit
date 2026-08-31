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

  it("lets a later pose interrupt an earlier one mid-flight", () => {
    const c = ctx();
    applyPose(c, "excited", 0);
    c.tweens.tick(0.2);
    applyPose(c, "sad", 0.2);
    c.tweens.tick(2.0);
    expect(c.channels.get("body.ink")).toEqual(config.poses.poses.sad!.channels["body.ink"]);
  });
});
