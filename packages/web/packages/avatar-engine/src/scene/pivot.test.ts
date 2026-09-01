import { describe, expect, it } from "vitest";
import character from "@character/character.json";
import rig from "@character/rig.json";
import poses from "@character/poses.json";
import timelines from "@character/timelines.json";
import behavior from "@character/behavior.json";
import sayings from "@character/sayings.json";
import { loadConfig } from "../config/load";
import { createChannels, type Channels } from "../runtime/channels";
import { createTweens } from "../runtime/tween";
import { createEngine } from "../engine";
import { IDENTITY } from "../math/mat";
import { buildScene, compose, seedChannels } from "./rig";

const config = loadConfig({ character, rig, poses, timelines, behavior, sayings });
const scene = buildScene(config);

const fresh = (): Channels => {
  const channels = createChannels();
  seedChannels(config, channels);
  return channels;
};

const matOf = (channels: Channels, id: string): readonly number[] =>
  compose(scene, channels).find((i) => i.id === id)!.m;

/** The rest origins the original's two `transformOrigin` strings resolve to.
 *  The face's bbox is y in [104.302, 271.022]; "50% 60%" lands at 204.334 and
 *  "50% 100%" — the sad droop's — at its bottom edge. */
const REST_PIVOT_Y = 204.334;
const DROOP_PIVOT_Y = 271.022;

describe("an animatable pivot", () => {
  it("seeds the rig's authored origin as the channel's rest value", () => {
    expect(config.rest.get("face.pivotX")).toBe(200);
    expect(config.rest.get("face.pivotY")).toBe(REST_PIVOT_Y);
    // A node with no authored origin rests at (0, 0) — which is what an absent
    // pivot already meant to `fromTransform`, so seeding changes nothing for it.
    expect(config.rest.get("lean.pivotX")).toBe(0);
    expect(config.rest.get("lean.pivotY")).toBe(0);
  });

  it("composes about the CHANNEL's origin, not the rig's", () => {
    const channels = fresh();
    channels.set("face.rotation", 4);
    const [, , , , ex, ey] = matOf(channels, "mouth");

    channels.set("face.pivotY", DROOP_PIVOT_Y);
    const [, , , , dx, dy] = matOf(channels, "mouth");

    // Two rotations of the same angle about origins d apart differ by the CHORD
    // d * 2sin(angle/2) — not d * sin(angle), which is the tempting answer and is
    // 0.003 too small here. At 4 degrees over the droop's 66.688 units that is the
    // ~4.65-unit whole-glyph swing which was the largest geometric difference
    // left standing against the original.
    const d = DROOP_PIVOT_Y - REST_PIVOT_Y;
    const swing = d * 2 * Math.sin((2 * Math.PI) / 180);
    expect(Math.hypot(dx! - ex!, dy! - ey!)).toBeCloseTo(swing, 6);
    expect(swing).toBeCloseTo(4.6548, 4);
  });
});

describe("a pivot channel snaps", () => {
  it("lands its target at add time however long a duration it is given", () => {
    const channels = fresh();
    const tweens = createTweens(channels);
    tweens.add({ channel: "face.pivotY", to: DROOP_PIVOT_Y, duration: 0.9 }, 0);
    expect(channels.get("face.pivotY")).toBe(DROOP_PIVOT_Y);
    expect(tweens.active()).toBe(0);
  });

  it("still waits out a delay, then jumps — never a value in between", () => {
    const channels = fresh();
    const tweens = createTweens(channels);
    tweens.add({ channel: "face.pivotX", to: 260, duration: 0.9, delay: 0.2 }, 0);
    tweens.tick(0.1);
    expect(channels.get("face.pivotX")).toBe(200);
    tweens.tick(0.2);
    expect(channels.get("face.pivotX")).toBe(260);
  });

  it("gives the sad droop its origin and the settle takes it straight back", () => {
    const engine = createEngine({ config, seed: 1 });
    const seen = new Set<number>();
    const sample = (f: number): void => {
      engine.tick(f / 60);
      seen.add(engine.channels().get("face.pivotY") as number);
    };
    for (let f = 0; f < 30; f += 1) sample(f);
    engine.setMood("sad");
    for (let f = 30; f < 180; f += 1) sample(f);
    engine.setMood(null);
    for (let f = 180; f < 330; f += 1) sample(f);

    // Both origins are reached, and NOTHING between them ever is. A tweened
    // pivot would put ~54 intermediate origins in this set over the droop's 0.9s
    // and another ~27 over the 0.45s settle, and every frame of both would
    // compose a rotation about an origin nobody authored.
    expect([...seen].sort((a, b) => a - b)).toEqual([REST_PIVOT_Y, DROOP_PIVOT_Y]);
  });
});

describe("the pinpricks", () => {
  it("ride the body, so the body's scale carries them", () => {
    const channels = fresh();
    expect(matOf(channels, "pinprickLeft")).toEqual([...IDENTITY]);
    channels.set("body.scaleX", 1.2);
    channels.set("body.scaleY", 1.2);
    // 20% about (200, 200) moves a point at x=152 by 48 * 0.2 outwards.
    const [a, , , , ex] = matOf(channels, "pinprickLeft");
    expect(a).toBeCloseTo(1.2, 9);
    expect(152 * a! + ex!).toBeCloseTo(152 - 48 * 0.2, 9);
  });

  it("sit outside the face, so no tint and no eyelid squish reaches them", () => {
    const channels = fresh();
    const before = matOf(channels, "pinprickLeft");
    channels.set("face.rotation", 12);
    channels.set("face.y", 9);
    channels.set("eyeLeft.scaleY", 0.06);
    expect(matOf(channels, "pinprickLeft")).toEqual(before);
    // The face DID move — otherwise the assertion above proves nothing.
    expect(matOf(channels, "mouth")).not.toEqual(before);
  });
});
