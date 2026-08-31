import { describe, expect, it } from "vitest";
import character from "@character/character.json";
import rig from "@character/rig.json";
import poses from "@character/poses.json";
import timelines from "@character/timelines.json";
import behavior from "@character/behavior.json";
import sayings from "@character/sayings.json";
import { loadConfig } from "../config/load";
import { disc, ring } from "../path/build";
import { parsePath } from "../path/parse";
import { createChannels } from "../runtime/channels";
import { buildScene, compose, cropList, seedChannels, type DisplayItem } from "./rig";

const config = loadConfig({ character, rig, poses, timelines, behavior, sayings });

const fresh = () => {
  const scene = buildScene(config);
  const channels = createChannels();
  seedChannels(config, channels);
  return { scene, channels };
};

describe("compose", () => {
  it("emits every shape node once, in declaration order", () => {
    const { scene, channels } = fresh();
    const list = compose(scene, channels);
    const ids = list.map((i) => i.id);
    expect(ids).toEqual([
      "browLeft", "browRight",
      "antennaLeft", "antennaRight",
      "mouth", "descender",
      "eyeLeftBg", "eyeLeftRing", "irisLeft",
      "eyeRightBg", "eyeRightRing", "irisRight",
      "pinprickLeft", "pinprickRight",
    ]);
    // Depth-first through `root`, then `overlays` — so each eye's background
    // comes before its ring, and both come before the iris. This list is the
    // one `scrape.ts` (Task 22) emits in, and it is the paint order, so a
    // reordering here is a visual change and the differ treats it as a hard
    // failure rather than a tolerance.
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("places the left eye ring at its rest centre", () => {
    const { scene, channels } = fresh();
    const item = compose(scene, channels).find((i) => i.id === "eyeLeftRing")!;
    // The ring path is authored around the eye centre in local space and the
    // matrix is identity-at-rest, so the composed centre is the authored centre.
    expect(item.m).toEqual([1, 0, 0, 1, 0, 0]);
    expect(item.kind).toBe("MCCCCZMCCCCZ");
  });

  it("composes a parent transform into its children", () => {
    const { scene, channels } = fresh();
    channels.set("body.rotation", 90);
    const item = compose(scene, channels).find((i) => i.id === "irisLeft")!;
    const [a, b, c, d] = item.m;
    expect(Math.abs(a - 0)).toBeLessThan(1e-9);
    expect(Math.abs(b - 1)).toBeLessThan(1e-9);
    expect(Math.abs(c + 1)).toBeLessThan(1e-9);
    expect(Math.abs(d - 0)).toBeLessThan(1e-9);
  });

  it("squashes only the eyes when eye.scaleY is driven", () => {
    const { scene, channels } = fresh();
    channels.set("eyeLeftRing.scaleY", 0.1);
    const list = compose(scene, channels);
    expect(list.find((i) => i.id === "eyeLeftRing")!.m[3]).toBeCloseTo(0.1, 12);
    expect(list.find((i) => i.id === "eyeRightRing")!.m[3]).toBe(1);
  });

  it("resolves @body late-bound ink through body.ink", () => {
    // body.ink names a PALETTE key; every "@body" ink resolves through it, which
    // is how one channel recolours the whole face.
    const { scene, channels } = fresh();
    channels.set("body.ink", "red");
    const list = compose(scene, channels);
    expect(list.find((i) => i.id === "mouth")!.paint.ink).toBe("#ff2d2d");
    expect(list.find((i) => i.id === "browLeft")!.paint.ink).toBe("#ff2d2d");
    // …but a node whose ink names a literal palette entry is untouched by it.
    expect(list.find((i) => i.id === "irisLeft")!.paint.ink).toBe("#33ccff");
  });

  it("takes stroke-vs-fill and width from the ink, not the shape", () => {
    const { scene, channels } = fresh();
    const list = compose(scene, channels);
    const mouth = list.find((i) => i.id === "mouth")!;
    expect(mouth.paint.fill).toBe(false);
    expect(mouth.paint.width).toBe(8);
    const brow = list.find((i) => i.id === "browLeft")!;
    expect(brow.paint.width).toBe(5);
    expect(list.find((i) => i.id === "irisLeft")!.paint.fill).toBe(true);
  });

  it("keeps a fully transparent node in the list", () => {
    const { scene, channels } = fresh();
    channels.set("pinprickLeft.alpha", 0);
    const list = compose(scene, channels);
    const item = list.find((i) => i.id === "pinprickLeft")!;
    expect(item.paint.alpha).toBe(0);
  });

  it("takes a driven mouth path straight off mouth.shape", () => {
    const { scene, channels } = fresh();
    channels.set("mouth.shape", "M189,235L200,235L211,235");
    const item = compose(scene, channels).find((i) => i.id === "mouth")!;
    expect(item.d).toBe("M189,235L200,235L211,235");
    expect(item.kind).toBe("MLL");
  });

  it("rebuilds a bend-driven antenna from its points and .bend", () => {
    // The antennae have NO .shape channel — two authorities over one node's
    // geometry is exactly how a bend stops bending. `bend` moves the control
    // points; `inwardSign`/`inwardDamp` reproduce the original's asymmetry.
    const { scene, channels } = fresh();
    const rest = compose(scene, channels).find((i) => i.id === "antennaLeft")!.d;
    channels.set("antennaLeft.bend", 10);
    const out = compose(scene, channels).find((i) => i.id === "antennaLeft")!;
    expect(out.kind).toBe("MC");
    expect(out.d).not.toBe(rest);
    // weights [0, 0.3, 0.8, 1] on x, damped by 0.72 because +10 is inward here.
    // `points` is flat [x0,y0,x1,y1,…]: index 0 is the M anchor, index 3 the tip.
    const pts = parsePath(out.d).points;
    expect(pts[0]).toBeCloseTo(183, 12);
    expect(pts[6]).toBeCloseTo(179 + 10 * 0.72, 12);
  });
});

describe("variants", () => {
  it("applies the optical cut to shapes and inks, and nothing else", () => {
    const { channels } = fresh();
    const plain = compose(buildScene(config), channels);
    const optical = compose(buildScene(config, "optical"), channels);

    // Same nodes, same order, same transforms — a variant is a size cut of the
    // anatomy, not a different rig shape.
    expect(optical.map((i) => i.id)).toEqual(plain.map((i) => i.id));
    expect(optical.map((i) => i.m)).toEqual(plain.map((i) => i.m));

    const by = (list: readonly DisplayItem[], id: string) => list.find((i) => i.id === id)!;
    expect(by(plain, "mouth").paint.width).toBe(8);
    expect(by(optical, "mouth").paint.width).toBe(13);
    expect(by(plain, "browLeft").paint.width).toBe(5);
    expect(by(optical, "browLeft").paint.width).toBe(9);

    // 35 - 13 = 22: the eye interior shrinks by exactly the extra band, which is
    // the arithmetic `OlyloMark.Weights.innerR` used to do in Swift.
    expect(by(optical, "eyeLeftBg").d).toBe(disc(152, 200, 22));
    expect(by(optical, "irisLeft").d).toBe(disc(152, 200, 10));

    // The ring is FILLED, so its weight is `band` and its ink has no width to
    // patch. Stroking it would paint 23..39 instead of 27..35 — the defect this
    // group of assertions exists to catch.
    expect(by(plain, "eyeLeftRing").paint.fill).toBe(true);
    expect(by(plain, "eyeLeftRing").paint.width).toBeUndefined();
    expect(by(plain, "eyeLeftRing").d).toBe(ring(152, 200, 35, 8));
    expect(by(optical, "eyeLeftRing").d).toBe(ring(152, 200, 35, 13));

    // The alignment invariant, asserted rather than trusted: each antenna's
    // inner edge lands on its eye's inner edge and its outer edge on the outer,
    // at BOTH weights. This is the one thing the four hand-written points in
    // `character.json` have to get right.
    const antennaX = (list: readonly DisplayItem[], id: string) =>
      parsePath(by(list, id).d).points[0]!;
    expect(antennaX(plain, "antennaLeft") + 8 / 2).toBeCloseTo(152 + 35, 9);
    expect(antennaX(optical, "antennaLeft") + 13 / 2).toBeCloseTo(152 + 35, 9);
    expect(antennaX(plain, "antennaRight") - 8 / 2).toBeCloseTo(248 - 35, 9);
    expect(antennaX(optical, "antennaRight") - 13 / 2).toBeCloseTo(248 - 35, 9);

    // The pinpricks carry no variant entry, so they are byte-identical.
    expect(by(optical, "pinprickLeft")).toEqual(by(plain, "pinprickLeft"));
  });

  it("throws on an unknown variant rather than silently rendering the true rig", () => {
    expect(() => buildScene(config, "chunky")).toThrow(/chunky/);
  });
});

describe("crops", () => {
  it("keeps every item when the crop's features cover every feature in the rig", () => {
    const { scene, channels } = fresh();
    const list = compose(scene, channels);
    // `full` is ["brows","antennae","mouth","descender","eyes"], which between
    // them name every feature `rig.json` declares — so this asserts the filter
    // subtracts nothing when nothing should be subtracted, the failure mode a
    // count alone would miss.
    expect(cropList(config, list, "full")).toEqual(list);
    expect(list).toHaveLength(14);
  });

  it("inherits a feature from the nearest ancestor that declares one", () => {
    const { scene, channels } = fresh();
    const list = compose(scene, channels);
    const kept = cropList(config, list, "browsAndEyes");
    // `eyeLeft` and `eyeRight` carry "eyes"; the six discs and rings underneath
    // them carry nothing. The pinpricks are overlays and declare "eyes"
    // themselves, so they survive by name rather than by the structural
    // fallback — which is exactly why `rig.json` names it on them (Task 2).
    expect(kept.map((i) => i.id)).toEqual([
      "browLeft", "browRight",
      "eyeLeftBg", "eyeLeftRing", "irisLeft",
      "eyeRightBg", "eyeRightRing", "irisRight",
      "pinprickLeft", "pinprickRight",
    ]);
    // Same items, same order, same paint — a filter, not a recomposition.
    const dropped = new Set(["antennaLeft", "antennaRight", "mouth", "descender"]);
    expect(kept).toEqual(list.filter((i) => !dropped.has(i.id)));
  });

  it("throws on an unknown crop name rather than returning an empty list", () => {
    const { scene, channels } = fresh();
    expect(() => cropList(config, compose(scene, channels), "nope")).toThrow(/nope/);
  });
});
