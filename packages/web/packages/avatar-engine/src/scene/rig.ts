import { IDENTITY, fromTransform, multiply, type Mat } from "../math/mat";
import { arc, bezier, cubicO, disc, polyline, ring } from "../path/build";
import { parsePath } from "../path/parse";
import type { Channels, ChannelValue } from "../runtime/channels";
import type { CharacterConfig, Ink, RigNode } from "../config/types";

export interface DisplayItem {
  id: string;
  m: Mat;
  d: string;
  kind: string;
  paint: { ink: string; alpha: number; fill: boolean; width?: number };
}
export type DisplayList = readonly DisplayItem[];

export interface Scene {
  config: CharacterConfig;
  flat: readonly { node: RigNode; parents: readonly string[] }[];
  /** `config.character.inks` with this scene's variant folded in — identical to
   *  it when there is no variant. Compose reads paint from here and never from
   *  the config, which is what keeps a variant from leaking anywhere else. */
  inks: Readonly<Record<string, Ink>>;
}

/** Depth-first, declaration order — the order the display list will carry.
 *
 *  `variant` names a `character.variants` entry (Task 1) and is applied HERE,
 *  once, so that everything downstream — compose, the tween engine, the golden
 *  recorder — is unaware variants exist. The loader has already guaranteed each
 *  patch names a real ink, or a real node that has no `.shape` channel and whose
 *  named fields exist with the same type and arity. */
export function buildScene(config: CharacterConfig, variant?: string): Scene {
  // `hasOwn`, not a plain index-then-`undefined` check: `variants` is a
  // JSON-derived Record, so a plain index sees `Object.prototype` too, and
  // `variants["constructor"]` comes back truthy without ever naming a real
  // variant — exactly the silent-true-rig outcome this guard exists to forbid.
  if (variant !== undefined && !Object.hasOwn(config.character.variants, variant)) {
    throw new Error(`avatar: unknown variant "${variant}"`);
  }
  const patch = variant === undefined ? undefined : config.character.variants[variant];

  const flat: { node: RigNode; parents: string[] }[] = [];
  const walk = (node: RigNode, parents: string[]): void => {
    const shapePatch = patch?.shapes?.[node.id];
    flat.push({
      node: shapePatch === undefined
        ? node
        : { ...node, shape: { ...node.shape!, ...shapePatch } as RigNode["shape"] },
      parents,
    });
    for (const child of node.children ?? []) walk(child, [...parents, node.id]);
  };
  walk(config.rig.root, []);

  const base = config.character.inks;
  const inks = patch?.inks === undefined
    ? base
    : Object.fromEntries(Object.entries(base).map(([name, ink]) => {
        const over = patch.inks![name];
        return [name, over === undefined ? ink : { ...ink, ...over }];
      }));

  return { config, flat, inks };
}

/** Write every channel's rest value into the store. The loader already derived
 *  the map from the rig tree (Task 11), so there is exactly one definition of
 *  "at rest" and this function cannot drift from it. */
export function seedChannels(config: CharacterConfig, channels: Channels): void {
  for (const [key, value] of config.rest) channels.set(key, value as ChannelValue);
}

const num = (channels: Channels, name: string, fallback: number): number => {
  const v = channels.get(name);
  return typeof v === "number" ? v : fallback;
};

/** Rebuild a node's path. A morphable node's geometry lives on its `.shape`
 *  channel — seeded from the rig, then driven by poses, timelines and morphs —
 *  so the channel is authoritative whenever the node has one. The three
 *  primitives have no `.shape` channel and are rebuilt from the rig each frame,
 *  because `bend` and their own parameters are what animate them. */
function resolvePath(node: RigNode, channels: Channels): string {
  const s = node.shape!;
  const driven = channels.get(`${node.id}.shape`);
  if (typeof driven === "string") return driven;
  switch (s.kind) {
    case "ring":
      return ring(s.cx, s.cy, s.r, s.band);
    case "disc":
      return disc(s.cx, s.cy, s.r);
    case "arc":
      return arc(s.cx, s.cy, s.r, s.from, s.to);
    case "polyline":
      return polyline(s.points);
    case "cubicO":
      return cubicO(s.cx, s.cy, s.rx, s.ry);
    case "bezier": {
      if (s.bend === undefined) return bezier(s.points);
      // `bend` offsets each point along one axis by its weight, damped when the
      // bend goes inward — the exact shape of the original's bend(side, a).
      const a = num(channels, `${node.id}.bend`, 0);
      const scaled = Math.sign(a) === s.bend.inwardSign ? a * s.bend.inwardDamp : a;
      const axis = s.bend.axis === "x" ? 0 : 1;
      const moved = s.points.map((p, i): [number, number] => {
        const out: [number, number] = [p[0], p[1]];
        out[axis] += (s.bend!.weights[i] ?? 0) * scaled;
        return out;
      });
      return bezier(moved);
    }
    default:
      throw new Error(`unknown shape kind: ${(s as { kind: string }).kind}`);
  }
}

/** ink key | palette key | "@nodeId" -> a literal colour.
 *
 *  "@body" is late-bound: every mood recolours the whole character by driving one
 *  channel, so the rig never repeats the mood colour on fourteen nodes. The depth
 *  guard is not decoration — a config that made "@x" resolve back to itself would
 *  otherwise hang the render loop rather than fail, and the loader cannot see a
 *  cycle that only closes through a runtime channel value. */
function resolveInk(raw: string, scene: Scene, channels: Channels, depth = 0): string {
  if (depth > 8) throw new Error(`avatar: ink "${raw}" does not resolve to a colour`);
  // A colour channel already holds a literal — the loader normalised it, and a
  // tween mid-flight is producing new literals every frame.
  if (raw.startsWith("#")) return raw;
  if (raw.startsWith("@")) return resolveLateBound(raw, scene, channels, depth);
  const ink = scene.inks[raw];
  if (ink !== undefined) return resolveColourRef(ink.color, scene, channels, depth + 1);
  const colour = scene.config.character.palette[raw];
  if (colour === undefined) throw new Error(`avatar: unknown colour "${raw}"`);
  return colour;
}

/** Resolves an `Ink.color` field. By that field's own contract (see
 *  `config/types.ts`) it is always "#hex", "@nodeId", or a bare PALETTE key —
 *  never another ink key — so, unlike `resolveInk`, this never re-enters the
 *  ink table. That distinction matters for real data: an ink is routinely
 *  named after the very palette entry it points at — `config/load.ts`'s
 *  `paletteColour` comment gives `{ kind: "fill", color: "shell" }` under the
 *  key `shell` as the shape of it — and recursing through the ink table here
 *  would find that same-named ink again and resolve to itself, looping until
 *  the depth guard fires instead of reaching the palette. */
function resolveColourRef(raw: string, scene: Scene, channels: Channels, depth: number): string {
  if (depth > 8) throw new Error(`avatar: ink "${raw}" does not resolve to a colour`);
  if (raw.startsWith("#")) return raw;
  if (raw.startsWith("@")) return resolveLateBound(raw, scene, channels, depth);
  const colour = scene.config.character.palette[raw];
  if (colour === undefined) throw new Error(`avatar: unknown colour "${raw}"`);
  return colour;
}

function resolveLateBound(raw: string, scene: Scene, channels: Channels, depth: number): string {
  const driven = channels.get(`${raw.slice(1)}.ink`);
  if (typeof driven !== "string") {
    throw new Error(`avatar: late-bound ink "${raw}" has no value on ${raw.slice(1)}.ink`);
  }
  return resolveInk(driven, scene, channels, depth + 1);
}

export function compose(scene: Scene, channels: Channels): DisplayList {
  const world = new Map<string, Mat>();
  const out: DisplayItem[] = [];

  for (const { node, parents } of scene.flat) {
    const parentMat = parents.length === 0
      ? IDENTITY
      : world.get(parents[parents.length - 1]!)!;

    const local = fromTransform({
      x: num(channels, `${node.id}.x`, 0),
      y: num(channels, `${node.id}.y`, 0),
      rotation: num(channels, `${node.id}.rotation`, 0),
      scaleX: num(channels, `${node.id}.scaleX`, 1),
      scaleY: num(channels, `${node.id}.scaleY`, 1),
      // Channels, not `node.transform.pivot`: the rig only seeds the rest value.
      // The original moves a transform origin as freely as it moves a rotation —
      // the sad droop turns the face about its bbox bottom, the settle turns it
      // about 60% height — so the origin has to be animatable too.
      pivot: [
        num(channels, `${node.id}.pivotX`, 0),
        num(channels, `${node.id}.pivotY`, 0),
      ],
    });
    const m = multiply(parentMat, local);
    world.set(node.id, m);

    if (!node.shape) continue;

    const d = resolvePath(node, channels);
    const inkChannel = channels.get(`${node.id}.ink`);
    const inkName = typeof inkChannel === "string" ? inkChannel : node.ink!;
    // Stroke-vs-fill and the stroke width are properties of the INK, not of the
    // shape — that is what lets `body` restyle six nodes from one place, and it
    // is the single fact CoreGraphics has to agree with SVG about.
    const ink = scene.inks[inkName];
    out.push({
      id: node.id,
      m,
      d,
      kind: parsePath(d).kind,
      paint: {
        ink: resolveInk(inkName, scene, channels),
        alpha: num(channels, `${node.id}.alpha`, 1),
        fill: ink?.kind === "fill",
        width: ink?.width,
      },
    });
  }
  return out;
}

/** The display list, keeping only what the named crop asks for.
 *
 *  A crop names FEATURES (`character.crops`), and a feature is declared on a
 *  node — but not necessarily on the node that carries the shape. A grouping
 *  node (an eye, say) can declare a feature while the primitives underneath it
 *  — its background, its ring, its interior — declare nothing, because the
 *  feature is a property of the group rather than of each shape it is built
 *  from. So a feature is INHERITED from the nearest ancestor that declares one.
 *
 *  An item whose chain declares none at all is kept by every crop: a node nobody
 *  assigned to a feature is structural, and a crop that silently subtracted
 *  things its author never named would be impossible to reason about.
 *
 *  It has no opinion about visibility either — `compose` emits an `alpha <= 0`
 *  item deliberately, and dropping one here would change what a golden log
 *  records. Deciding an invisible item is not worth painting belongs to the
 *  renderer, and the still-mark renderer (Plan B, Task 39) is where that
 *  decision is made. */
export function cropList(
  config: CharacterConfig,
  list: DisplayList,
  crop: string,
): DisplayList {
  // `hasOwn`, not a plain index-then-`undefined` check: `crops` is a
  // JSON-derived Record, so a plain index sees `Object.prototype` too, and
  // `crops["constructor"]` comes back truthy and not iterable, throwing a
  // `TypeError` instead of this function's own message.
  if (!Object.hasOwn(config.character.crops, crop)) {
    throw new Error(`avatar: unknown crop "${crop}"`);
  }
  const wanted = config.character.crops[crop];
  const features = new Set(wanted);
  const featureOf = new Map<string, string>();

  const walk = (node: RigNode, inherited: string | undefined): void => {
    const feature = node.feature ?? inherited;
    if (feature !== undefined) featureOf.set(node.id, feature);
    for (const child of node.children ?? []) walk(child, feature);
  };
  walk(config.rig.root, undefined);

  return list.filter((item) => {
    const feature = featureOf.get(item.id);
    return feature === undefined || features.has(feature);
  });
}
