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

  it("turns the whole glyph about the character's centre, not the canvas origin", () => {
    // The idle fidget's sway and breath drive the ROOT layer, and the original
    // states both with `svgOrigin` at the rig's pivot. A root with no pivot of
    // its own turns the glyph about (0, 0) instead, which reads as the whole
    // character sliding rather than breathing — 18 design units of it on the
    // mouth, at nothing more than a 3.5 degree sway and a 1.035 swell.
    const { scene, channels } = fresh();
    const centre = config.rig.root.transform?.pivot;
    expect(centre).toEqual([200, 200]);
    const [px, py] = centre!;

    const sway = config.behavior.idleFidget.sway;
    const breath = config.behavior.idleFidget.breath;
    expect(config.expand(sway.channel)).toEqual(["idle.rotation"]);
    for (const ch of config.expand(sway.channel)) channels.set(ch, sway.amplitude);
    for (const ch of config.expand(breath.channel)) channels.set(ch, breath.to);

    // The centre is the fixed point of a turn taken about it, at every depth.
    for (const id of ["mouth", "browLeft", "irisRight"]) {
      const [a, b, c, d, e, f] = compose(scene, channels).find((i) => i.id === id)!.m;
      expect(a * px + c * py + e).toBeCloseTo(px, 9);
      expect(b * px + d * py + f).toBeCloseTo(py, 9);
    }
  });

  it("pins the multiply argument order — parent-then-local, not local-then-parent", () => {
    // multiply(parent, local) and multiply(local, parent) agree whenever either
    // operand is identity, which every node but the root is at rest — a single
    // rotated ancestor isn't enough to tell them apart either, because a lone
    // rotation still leaves the translation `e`/`f` matching both orders. Two
    // ancestors are needed: a ROTATED one (body) and, further down the chain, a
    // TRANSLATED one (face) whose own pivot is off-centre. `a,b,c,d` (the linear
    // part) come out identical under either argument order — `e` and `f` are
    // the ONLY pair that discriminates, which is exactly why the existing
    // parent-transform test above, which never checks them, missed this. Do not
    // "simplify" this back down to a,b,c,d.
    const { scene, channels } = fresh();
    channels.set("body.rotation", 90);
    channels.set("face.y", 10);
    const [a, b, c, d, e, f] = compose(scene, channels).find((i) => i.id === "irisLeft")!.m;
    expect(a).toBeCloseTo(0, 9);
    expect(b).toBeCloseTo(1, 9);
    expect(c).toBeCloseTo(-1, 9);
    expect(d).toBeCloseTo(0, 9);
    expect(e).toBeCloseTo(390, 9);
    expect(f).toBeCloseTo(0, 9);
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

  it("throws on a variant named after an Object.prototype member instead of rendering the true rig", () => {
    // `character.variants` is a JSON-derived Record, so a plain index sees
    // Object.prototype too — "constructor" resolves to a function, which is
    // truthy, so a guard that only checks `=== undefined` never fires and this
    // silently renders the true rig, exactly what the test above forbids.
    expect(() => buildScene(config, "constructor")).toThrow(/constructor/);
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

  it("drops an inherited feature the crop excludes — neither shipped crop can show this", () => {
    // Both `full` and `browsAndEyes` include "eyes", so real inheritance and the
    // no-feature-declared fallback produce the SAME output for every crop
    // `character.json` ships — a crop that discriminates has to exclude "eyes"
    // while a node still inherits it. Inventing that crop in the shipped config
    // would put fiction nothing in the product wants into real data, so it is
    // built here instead: a clone of the imported config with one extra crop,
    // loaded through the real loader like any other config would be.
    const patched = structuredClone(character) as typeof character;
    (patched.crops as Record<string, string[]>).browsOnly = ["brows"];
    const localConfig = loadConfig({ character: patched, rig, poses, timelines, behavior, sayings });
    const { channels } = fresh();
    const list = compose(buildScene(localConfig), channels);
    const kept = cropList(localConfig, list, "browsOnly");
    // Under inheritance, eyeLeft/eyeRight's six undeclared children inherit
    // "eyes" and are dropped along with the pinpricks, which declare "eyes"
    // directly. The no-feature fallback would have kept the six children
    // regardless, since they declare nothing of their own.
    expect(kept.map((i) => i.id)).toEqual(["browLeft", "browRight"]);
  });

  it("throws on an unknown crop name rather than returning an empty list", () => {
    const { scene, channels } = fresh();
    expect(() => cropList(config, compose(scene, channels), "nope")).toThrow(/nope/);
  });

  it("throws on a crop named after an Object.prototype member instead of returning it", () => {
    // `character.crops` is a JSON-derived Record, so a plain index sees
    // Object.prototype too — "constructor" resolves to a function, which is
    // truthy, so a guard that only checks `=== undefined` never fires and this
    // silently returns garbage instead of throwing.
    const { scene, channels } = fresh();
    expect(() => cropList(config, compose(scene, channels), "constructor")).toThrow(/constructor/);
  });
});
