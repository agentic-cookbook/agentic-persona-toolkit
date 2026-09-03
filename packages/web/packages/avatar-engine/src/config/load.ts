import { resolveEase } from "../math/ease";
import { bezier, cubicO, polyline } from "../path/build";
import { emitPath, parsePath } from "../path/parse";
import { ANIMATABLE, SCHEMA_VERSION, shapeFamily } from "./types";
import type {
  AmplitudeRef, BehaviorFile, CharacterConfig, CharacterFile, ChannelValue,
  PosesFile, RawFiles, RigFile, RigNode, SayingsFile, TimelinesFile, Variant,
} from "./types";

const fail = (msg: string): never => {
  throw new Error(`avatar config: ${msg}`);
};

/** `#rgb` or `#rrggbb` — exactly what `parseHex` accepts and `lerpValue`'s
 *  `isHex` admits, and the same predicate Swift's loader applies. The loader is
 *  the last place a bad colour is still attributable to a KEY: past here it is a
 *  string on a per-frame path, where `mixColor`'s throw names only the string. */
const isLoadableHex = (s: string): boolean => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s);

/** The shape fields a variant may patch. The mirror of Swift's
 *  `Shape.patchable`, and an ALLOWLIST rather than a lookup on the shape object:
 *  `kind`, `bend` and `family` are all "defined" on a shape that has them, so a
 *  dynamic read waves them through. `family` is excluded deliberately — changing
 *  a family is a morph, never a variant — and `kind`/`bend` because `applyVariant`
 *  merges the patch with an object spread, so a bad one is not quietly dropped by
 *  a `switch`: it reaches `compose` and throws inside the rAF loop. */
const PATCHABLE_SHAPE_FIELDS = new Set([
  "points", "cx", "cy", "r", "band", "from", "to", "rx", "ry",
]);

/** The resting `shape` of a morphable node — the same string `resolvePath`
 *  (Task 12) will build for it on frame 0. Primitives have no shape channel. */
function restShape(node: RigNode): string | undefined {
  const s = node.shape;
  if (s === undefined) return undefined;
  switch (s.kind) {
    case "polyline": return polyline(s.points);
    case "bezier":   return bezier(s.points);
    case "cubicO":   return cubicO(s.cx, s.cy, s.rx, s.ry);
    default:         return undefined;   // ring | disc | arc are rebuilt, never driven
  }
}

export function loadConfig(input: RawFiles): CharacterConfig {
  // The loader NORMALISES what it is handed (palette names become colour
  // literals below), so it works on its own copy. A bundler hands the same JSON
  // module object to every call; rewriting it underneath the host would make a
  // second `loadConfig` see already-normalised data and fail.
  const raw = structuredClone(input) as RawFiles;
  const character = raw.character as CharacterFile;
  const rig = raw.rig as RigFile;
  const poses = raw.poses as PosesFile;
  const timelines = raw.timelines as TimelinesFile;
  const behavior = raw.behavior as BehaviorFile;
  const sayings = raw.sayings as SayingsFile;

  for (const [name, file] of Object.entries({ character, rig, poses, timelines, behavior, sayings })) {
    const v = (file as { schemaVersion?: number }).schemaVersion;
    if (v !== SCHEMA_VERSION) {
      fail(`${name}.json has schemaVersion ${v}, expected ${SCHEMA_VERSION}`);
    }
  }

  // --- the values neither runtime survives ---------------------------------
  // ONE block, not a guard scattered across the eight places these values are
  // read. Everything checked here shares a shape: it is legal JSON, the loader
  // used to wave it through, and the first thing downstream that touches it
  // either writes `undefined`/`NaN` into a channel and kills the rAF loop (web)
  // or TRAPS the process (Apple). Load is the last moment the offending KEY is
  // still nameable — "bad hex colour: #abcd" arriving forty frames later names
  // nothing an author can act on. `Loader.swift` runs the identical block, and
  // `schema.json` states both constraints, so no single loader is the only
  // defence.
  for (const [name, hex] of Object.entries(character.palette)) {
    if (!isLoadableHex(hex)) {
      fail(`palette "${name}" is "${hex}", which is not a #rgb or #rrggbb colour`);
    }
  }
  // An empty member list makes the group a legal CHANNEL — the member check
  // below is vacuous over `[]`, so nothing rejects it — that expands to
  // nothing. Every consumer then reaches for its first member.
  for (const [name, members] of Object.entries(rig.groups)) {
    if (members.length === 0) fail(`group "${name}" has no members`);
  }

  // An `.ink` channel holds an ink KEY (a shaped node names how it is painted) or
  // a PALETTE key (the `body` layer names the colour every "@body" ink resolves
  // to). Both are legal, and `resolveInk` (Task 12) resolves both. A node's own
  // `.ink` does NOT get the "@" late-binding character.inks[].color gets below:
  // late binding exists to let an ink follow a node's mood colour, and every
  // ink a node's own `.ink` could name is already in character.inks, so the
  // indirection has no target. Swift never accepted it either.
  const requireInk = (ink: string, where: string): void => {
    if (!(ink in character.inks) && !(ink in character.palette)) {
      fail(`${where} uses unresolved ink "${ink}"`);
    }
  };

  // --- concrete channels and rest values, from the rig tree ----------------
  const nodes = new Map<string, RigNode>();
  const families = new Map<string, string>();
  const concrete = new Set<string>();
  const features = new Set<string>();
  const rest = new Map<string, ChannelValue>();
  const bendDriven = new Set<string>();
  /** Nodes whose `.ink` channel carries a COLOUR rather than an ink key. */
  const paletteDriven = new Set<string>();
  /** A name resolves to a COLOUR only if it is not also an ink key.
   *
   *  `character.inks` and `character.palette` share one namespace here, and a
   *  collision is not exotic — it is what happens whenever a character names an
   *  ink after the palette entry that ink points at, which is the obvious thing
   *  to call it (`{ kind: "fill", color: "shell" }` under the key `shell`).
   *  Checking the palette first would classify every node painted with such an
   *  ink as colour-driven, seeding `rest` with the resolved hex instead of the
   *  ink name. The colour would still come out right; `compose` would then look
   *  up that hex in `scene.inks`, find nothing, and paint a FILL as a stroke.
   *  Inks-first is not a preference: it is the precedence `resolveInk`
   *  (Task 12) already applies at paint time, and the two have to agree. */
  const paletteColour = (name: string): string | undefined =>
    character.inks[name] !== undefined ? undefined : character.palette[name];

  const NUM_REST: Record<string, number> = {
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, bend: 0, alpha: 1,
  };

  const walk = (node: RigNode): void => {
    if (nodes.has(node.id)) fail(`duplicate node id "${node.id}"`);
    nodes.set(node.id, node);
    if (node.feature !== undefined) features.add(node.feature);
    for (const prop of ANIMATABLE) concrete.add(`${node.id}.${prop}`);

    const t = node.transform ?? {};
    for (const [prop, fallback] of Object.entries(NUM_REST)) {
      rest.set(`${node.id}.${prop}`, (t as Record<string, number | undefined>)[prop] ?? fallback);
    }
    // The authored `pivot` is only this node's REST origin; `compose` reads the
    // channels, so a pose or a mood effect can move the origin the way the
    // original moves `transformOrigin`. A node with no authored pivot rests at
    // (0, 0), which is what `fromTransform` already means by an absent pivot.
    const [pivotX, pivotY] = t.pivot ?? [0, 0];
    rest.set(`${node.id}.pivotX`, pivotX);
    rest.set(`${node.id}.pivotY`, pivotY);
    if (node.alpha !== undefined) rest.set(`${node.id}.alpha`, node.alpha);

    // A LAYER may carry an ink too: that is how `body` holds the mood colour every
    // "@body" resolves to, without owning any geometry of its own.
    if (node.ink !== undefined) {
      requireInk(node.ink, `node "${node.id}"`);
      const colour = paletteColour(node.ink);
      if (colour !== undefined) {
        // The node names a palette colour, so its `.ink` channel IS the colour —
        // stored as a literal from the first frame, exactly as a pose will
        // later write it, so rest and posed values are the same kind of thing.
        paletteDriven.add(node.id);
        rest.set(`${node.id}.ink`, colour);
      } else {
        rest.set(`${node.id}.ink`, node.ink);
      }
    }

    if (node.shape) {
      // `fail` is a `const` arrow typed `: never`, and TS's never-returning-call
      // narrowing (unlike a real `throw`/`return`) does not follow through a
      // const-arrow call — only `throw`, `return`, or a `function` declaration
      // does. Prefixing the call with `throw` gets the narrowing for free
      // without changing `fail`'s own declaration or its runtime behavior:
      // `fail` never returns, so this `throw` never actually executes.
      const ink = node.ink;
      if (ink === undefined) throw fail(`node "${node.id}" has a shape but no ink`);
      // A shape needs an INK, not a bare colour. `character.inks` is what
      // carries fill-vs-stroke and the stroke width; `character.palette` is only
      // a colour. Paint a shaped node with a palette name and everything
      // downstream succeeds quietly: the `.ink` channel is seeded with the hex,
      // which is correct and is what a bare transform layer relies on; `compose`
      // then looks that hex up in `scene.inks`, finds nothing, and emits
      // `fill: false` with no width — a stroke of zero width, in the right
      // colour, drawing nothing. Swift's compositor does the identical thing, so
      // the two platforms agree on an invisible node and every parity test
      // passes. A character whose only palette-driven node happens to be a
      // shapeless layer cannot catch the regression either, which is why this is
      // a guard rather than a test.
      if (paletteColour(ink) !== undefined) {
        fail(`node "${node.id}" has a shape but is painted with the palette colour ` +
             `"${ink}"; a shape needs an ink, which is what carries ` +
             `fill-vs-stroke and the stroke width`);
      }

      const family = shapeFamily(node.shape);
      if (family !== undefined) {
        families.set(node.id, family);
        rest.set(`${node.id}.family`, family);
        // A bend-driven node is REBUILT from its points every frame (Task 12), so
        // it deliberately gets no `.shape` channel: two authorities over one
        // node's geometry is exactly how a bend-driven node would stop bending.
        if ("bend" in node.shape && node.shape.bend !== undefined) {
          bendDriven.add(node.id);
        } else {
          // NOT `restShape(node)!`. A ring/disc/arc that also declares a family
          // is a primitive — rebuilt every frame, never morphed — so `restShape`
          // returns undefined for it, and the assertion wrote that `undefined`
          // into `Channels` under a key `names()` lists, breaking the
          // `ChannelValue` union every consumer assumes. It also reclassified
          // the node as morphable, which refuses olylo's real `optical` variant.
          // Swift's `restShape` throws on the same input; this is that throw.
          const d = restShape(node);
          if (d === undefined) {
            fail(`node "${node.id}" has a family but is a ${node.shape.kind}`);
          }
          rest.set(`${node.id}.shape`, d!);
        }
      }
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(rig.root);

  for (const [name, ink] of Object.entries(character.inks)) {
    if (ink.color.startsWith("@")) {
      const target = ink.color.slice(1);
      if (!nodes.has(target)) fail(`ink "${name}" uses unresolved ink "${ink.color}"`);
      // `resolveInk` keeps resolving once it reaches the target's own ink, so a
      // chain that dead-ends on an ink KEY rather than a palette colour would
      // recurse further or dead-end at paint time instead of load time. Load is
      // where a config error belongs.
      if (!paletteDriven.has(target)) {
        fail(`ink "${name}" late-binds to "${ink.color}", but node "${target}" does not carry ` +
             `a palette colour to bind to`);
      }
    } else if (!(ink.color in character.palette)) {
      fail(`ink "${name}" names unknown palette colour "${ink.color}"`);
    }
  }

  // --- groups: the derived `.scale` groups first, the authored ones second -
  // `Map.set` silently overwrites, so an authored group named e.g. "body.x"
  // would swallow the node's own channel — or a derived `.scale` group — and
  // redirect every write meant for it into the group's member list, with no
  // load-time failure to say so. Seeding the derived groups first and
  // checking each authored name against both `concrete` and `expandMap` is
  // what makes that collision a load error instead of a silent one.
  const expandMap = new Map<string, readonly string[]>();
  for (const id of nodes.keys()) {
    // `scale` is uniform scale — the one derived group, so poses.json can write
    // `body.scale` without the rig repeating the pair on every node.
    expandMap.set(`${id}.scale`, [`${id}.scaleX`, `${id}.scaleY`]);
  }
  for (const [group, members] of Object.entries(rig.groups)) {
    if (concrete.has(group)) fail(`group "${group}" shadows a node's own channel; rename the group`);
    if (expandMap.has(group)) fail(`group "${group}" shadows the derived scale group`);
    for (const member of members) {
      if (!concrete.has(member)) fail(`group "${group}" names unknown channel "${member}"`);
    }
    // Flattened through the derived map, not stored as authored. An authored
    // group routinely names `<id>.scale` for each of the nodes it covers, and
    // `<id>.scale` is itself a group. `expand` is a single lookup at every call
    // site, so an unflattened member would come back as the answer: `applyPose`
    // would tween `<id>.scale`, a name `rest` has no entry for and `compose`
    // never reads, and every node in the group would simply never scale on any
    // pose. Nothing would fail — not the loader,
    // whose member check passes because `scale` is in ANIMATABLE and so
    // `<id>.scale` is in `concrete`; not the tween engine, which animates any
    // name it is handed; and not Swift, which would reproduce the same dead
    // write. Flattening here fixes every consumer at once and keeps `expand`
    // one map lookup on both platforms. One pass is enough: a group name can
    // never itself be a member, because members must be `concrete` and an
    // authored group name is rejected when it is.
    expandMap.set(group, members.flatMap((m) => expandMap.get(m) ?? [m]));
  }
  const channels = new Set<string>([...concrete, ...expandMap.keys()]);
  const expand = (channel: string): readonly string[] => expandMap.get(channel) ?? [channel];

  // --- channel responses ---------------------------------------------------
  /** A channel whose RENDERED value is not the value written to it.
   *
   *  Only a bend has one, and the reason is the original's morph. `inwardDamp`
   *  is a kink at zero: apply it while rendering and a sway crossing zero draws
   *  a bent line through rendered space, because the channel is what moves
   *  linearly. The original tweens the two PATHS, so its rendered deflection is
   *  linear in eased time and only the ENDPOINTS carry the damp -- the calm
   *  antenna sway runs -10.64 to +7.66 in a straight line, where damping at
   *  render draws -10.64 to +10.64 and folds the top half over. Mapping the
   *  value once, at the moment it is written, puts the channel in the same
   *  space the original interpolates: it holds rendered deflection, endpoints
   *  included, and every consumer downstream reads it raw.
   *
   *  Written as a map rather than read off the node at each use so the rule is
   *  one lookup on both platforms and the renderer needs no rig knowledge. */
  const responses = new Map<string, (v: number) => number>();
  for (const [id, node] of nodes) {
    const shape = node.shape;
    if (shape === undefined || shape.kind !== "bezier" || shape.bend === undefined) continue;
    const { inwardDamp, inwardSign } = shape.bend;
    responses.set(`${id}.bend`, (v) => (Math.sign(v) === inwardSign ? v * inwardDamp : v));
  }
  const respond = (channel: string, value: ChannelValue): ChannelValue => {
    const f = responses.get(channel);
    return f !== undefined && typeof value === "number" ? f(value) : value;
  };

  const requireChannel = (name: string, where: string): void => {
    if (!channels.has(name)) fail(`${where} targets unknown channel "${name}"`);
  };
  const requireEase = (name: string | undefined, where: string): void => {
    if (name === undefined) return;
    try { resolveEase(name); } catch { fail(`${where} uses unknown ease "${name}"`); }
  };
  // An `.ink` channel carries either a colour (that is the `body` layer, the one
  // every "@body" resolves through) or an INK key naming how a node is painted.
  // Colours are normalised to "#rrggbb" HERE, once, so `lerpValue` can
  // interpolate them in OKLab without knowing what a palette is — a palette
  // *name* would silently snap at t >= 1 instead of fading, which is the whole
  // mood transition lost. An ink key is left exactly as written: it says how the
  // node is painted, not what colour it is, and `compose` needs it verbatim to
  // find the ink's `kind` and `width`.
  const colourise = (channel: string, to: number | string, where: string): number | string => {
    if (typeof to !== "string" || !channel.endsWith(".ink")) return to;
    if (character.inks[to] !== undefined) return to;
    const hex = character.palette[to];
    if (hex === undefined) fail(`${where} sets ${channel} to unknown colour "${to}"`);
    return hex!;
  };

  // Every authored `d` is re-emitted through the engine's own printer, so a
  // config author's spacing and precision can never reach a channel or a golden
  // log. A timeline's closing snap and the pose that timeline lands on author
  // the SAME geometry, and they routinely author it with different whitespace —
  // `timelines.json` spacing its polyline out, `poses.json` writing it tight.
  // Those must become ONE string, because the snap writes `to` verbatim
  // (Task 10, rule 4) and a later mood change to that pose must be a no-op
  // rather than a one-frame flicker. Note the claim is about the pose a timeline
  // ENDS on, which is routinely not the rig's rest pose; comparing against rest
  // would be the wrong test.
  const canonicalise = (channel: string, to: number | string, where: string): number | string => {
    if (typeof to !== "string" || !channel.endsWith(".shape")) return to;
    try {
      return emitPath(parsePath(to));
    } catch (e) {
      return fail(`${where}: unsupported path — ${(e as Error).message}`);
    }
  };

  /**
   * A pair field is two numbers and only two. Nothing between the JSON and the
   * seven sites that index one enforces that — the `[number, number]` in
   * `types.ts` is erased before `JSON.parse` ever runs — so `"rearmMs": [4000]`
   * loads clean and reaches the runtime, where `pairRange` now reads it as the
   * degenerate 4000..4000 rather than yielding `NaN`. That degrade is the
   * SECOND line of defence, the one that makes the two engines agree about a
   * config arriving from somewhere other than a loader; this is the first, and
   * it names the field while the author is still looking at it.
   *
   * `schema.json` already says `minItems: 2, maxItems: 2` on every one of these
   * (they all `$ref` `#/$defs/Point`) and it is not enough: nothing validates a
   * config against that schema at load — it is a document, not a gate — so the
   * check has to exist in code here, and in `Loader.swift`'s `requirePair`, to
   * be a check at all.
   */
  const requirePair = (pair: readonly number[] | undefined, where: string): void => {
    if (pair !== undefined && pair.length !== 2) {
      fail(`${where} needs exactly two numbers, not ${pair.length}`);
    }
  };

  const requireValue = (channel: string, to: number | string, where: string): void => {
    if (channel.endsWith(".shape") && bendDriven.has(channel.slice(0, -".shape".length))) {
      fail(`${where} sets ${channel}, but that node is bend-driven — animate its .bend instead`);
    }
    // A `.shape` channel holds a path and an `.ink` channel holds a colour;
    // both are text. A NUMBER written to one is not a value the channel can
    // hold, and until this check nothing said so: `timeline.ts`'s promote step
    // would meet a number where it demanded a string, refuse, and `continue` —
    // the write silently dropped, arbitrarily far from the config that asked
    // for it. This is the check the comment at that promote site assumes has
    // already run. Every other suffix stays deliberately unexamined, exactly as
    // the string branch below leaves it.
    if (typeof to === "number" && (channel.endsWith(".shape") || channel.endsWith(".ink"))) {
      fail(`${where} writes a number to ${channel}, which holds `
        + `${channel.endsWith(".shape") ? "a path" : "a colour"}`);
    }
    if (typeof to !== "string") return;
    if (channel.endsWith(".shape")) {
      try { parsePath(to); } catch (e) { fail(`${where}: unsupported path — ${(e as Error).message}`); }
    } else if (channel.endsWith(".ink")) {
      // No shape check on the "#" branch, and the reason is worth stating:
      // `colourise` runs immediately before every call to this function and
      // rejects any `.ink` string that is neither an ink key nor a palette KEY
      // — an authored `"#abcd"` included, because a literal is never a palette
      // key. The only "#" that reaches here is therefore a palette VALUE, whose
      // shape the block at the top of `loadConfig` has already checked. What is
      // left is the ink-key case, which `colourise` passes through.
      if (!to.startsWith("#") && !(to in character.palette) && !(to in character.inks)) {
        fail(`${where} sets ${channel} to unknown colour "${to}"`);
      }
    }
  };

  // --- poses --------------------------------------------------------------
  // channel -> the command signature every pose driving it must share, and who
  // established it. Poses form an ARBITRARY transition graph: the arbiter can
  // move between any two moods, so a mood change morphs the live geometry into
  // whichever pose is next. Every pose driving one `.shape` channel must
  // therefore agree with every other — an all-pairs requirement, strictly
  // STRONGER than the timelines' consecutive-step check below, which only has
  // to hold along one authored order. Seeded from the node's rest shape,
  // because rest is where frame 0 starts and is itself a reachable end of a
  // transition.
  const poseKind = new Map<string, { kind: string; where: string }>();
  for (const [poseName, pose] of Object.entries(poses.poses)) {
    const where = `pose "${poseName}"`;
    requireEase(pose.ease, where);
    for (const [channel, authored] of Object.entries(pose.channels)) {
      requireChannel(channel, where);
      // The block at the top rejects the only config that can make this empty;
      // the guard stays because `[0]!` writes `undefined` through a signature
      // that promises a string, and every check downstream then reads the wrong
      // channel's rules. Swift throws the same `ConfigError` here.
      const first = expand(channel)[0];
      if (first === undefined) throw fail(`${where} targets empty group "${channel}"`);
      const to = canonicalise(first, colourise(first, authored, where), where);
      pose.channels[channel] = to;
      for (const c of expand(channel)) requireValue(c, to, where);
      if (typeof to !== "string") continue;
      for (const c of expand(channel)) {
        if (!c.endsWith(".shape")) continue;
        let known = poseKind.get(c);
        if (known === undefined) {
          const restD = rest.get(c);
          if (typeof restD === "string") {
            known = { kind: parsePath(restD).kind, where: "the rig's rest shape" };
            poseKind.set(c, known);
          }
        }
        const kind = parsePath(to).kind;
        if (known === undefined) {
          poseKind.set(c, { kind, where });
        } else if (known.kind !== kind) {
          fail(`${where} drives ${c} with path "${kind}", but ${known.where} ` +
               `drives it with "${known.kind}"; the arbiter can morph between ` +
               `any two poses, so every pose driving one channel must share ` +
               `its command signature`);
        }
      }
    }
    if (pose.spin) {
      requireChannel(pose.spin.channel, `${where} spin`);
      // Spin needs a single concrete channel, not a group that expands to many.
      // The resetAt normalisation cannot be a list, and fanning out spin would
      // ripple into Task 17's engine and the Swift mirror without serving any
      // character's need. Reject it at load time rather than silently writing a
      // tween to a group-name string that nothing reads.
      const expanded = expand(pose.spin.channel);
      if (expanded.length !== 1 || expanded[0] !== pose.spin.channel) {
        fail(`${where} spin targets group "${pose.spin.channel}"; spin needs a single concrete channel`);
      }
      requireEase(pose.spin.ease, `${where} spin`);
      // A carried channel has to be one the pose actually states a target for:
      // `carries` re-times a target, it does not invent one. Checking against
      // the EXPANDED set lets a pose drive a group and carry one member of it.
      const driven = new Set<string>();
      for (const ch of Object.keys(pose.channels)) for (const c of expand(ch)) driven.add(c);
      for (const carried of pose.spin.carries ?? []) {
        requireChannel(carried, `${where} spin carries`);
        if (carried === pose.spin.channel) {
          fail(`${where} spin carries its own channel "${carried}"; the spin already times it`);
        }
        for (const c of expand(carried)) {
          if (!driven.has(c)) {
            fail(`${where} spin carries "${c}", which the pose does not drive`);
          }
        }
      }
    }
  }
  for (const name of poses.order) {
    if (!(name in poses.poses)) fail(`poses.order names unknown pose "${name}"`);
  }

  // --- timelines ----------------------------------------------------------
  for (const [tlName, tl] of Object.entries(timelines.timelines)) {
    const where = `timeline "${tlName}"`;
    // A family change may only ever SNAP. Tweening one means asking the morph to
    // interpolate between two different anchor structures, which is the exact bug
    // the family rule exists to prevent — so walk the steps in time order and
    // track what family each channel is in.
    const familyOf = new Map<string, string>();
    // family -> the command signature ("MLL", "MCCCCZ", ...) every path
    // driving that family must share. Two paths may only morph into one
    // another when they carry the same signature (Task 9's morph guard);
    // without this, web discovered a mismatch only when `morphPath` threw
    // mid-playback — or never, if that step never played. Swift already
    // checked this at load; this ports that check.
    const kindOf = new Map<string, string>();
    // A promote computes its target out of whatever shape the channel holds when
    // it fires, so there is no path here to check its kind against. What CAN be
    // checked is the pair of families it bridges — and must be, because the
    // whole point of the step is to land in a kind the family already uses.
    // Collected during the walk, with the family in force at that instant, and
    // settled once `kindOf` is complete.
    const promotions: { source: string; target: string; segments: number; channel: string }[] = [];
    for (const step of [...tl.steps].sort((a, b) => a.at - b.at)) {
      requireChannel(step.channel, where);
      requireEase(step.ease, where);
      if (step.promote !== undefined) {
        if (step.to !== undefined) fail(`${where} both promotes ${step.channel} and gives it a value`);
        if (step.family === undefined) fail(`${where} promotes ${step.channel} without naming a family`);
        if (step.duration !== 0) fail(`${where} promotes ${step.channel} over ${step.duration}s; a promote is a snap`);
        if (!step.channel.endsWith(".shape")) fail(`${where} promotes ${step.channel}, which is not a shape channel`);
      } else {
        // The schema's `oneOf` has already ruled this out; the throw is what
        // narrows it for the compiler (see the `ink` guard above).
        if (step.to === undefined) throw fail(`${where} drives ${step.channel} with no value`);
        // As in the pose walk: an error, never an `undefined` channel name.
        const first = expand(step.channel)[0];
        if (first === undefined) throw fail(`${where} targets empty group "${step.channel}"`);
        step.to = canonicalise(first, colourise(first, step.to, where), where);
        for (const c of expand(step.channel)) requireValue(c, step.to, where);
      }
      if (!step.channel.endsWith(".shape")) continue;

      for (const c of expand(step.channel)) {
        const node = c.slice(0, -".shape".length);
        let current = familyOf.get(c);
        if (current === undefined) {
          current = families.get(node);
          // Seed the kind in force from the node's resting shape, so the
          // FIRST authored step that morphs this channel is checked against
          // what the node actually rests at, not just against later steps.
          if (current !== undefined && !kindOf.has(current)) {
            const restShapeD = rest.get(`${node}.shape`);
            if (typeof restShapeD === "string") kindOf.set(current, parsePath(restShapeD).kind);
          }
        }
        // See the `ink` guard above: `throw` (not a bare call) is what makes
        // TS's never-returning-call narrowing apply to a `const` arrow like `fail`.
        if (current === undefined) throw fail(`${where} drives ${c}, whose node declares no family`);
        if (step.family !== undefined) {
          if (step.family !== current && step.duration !== 0) {
            fail(`${where} tweens ${c} from family "${current}" to "${step.family}"; ` +
                 `a family change must have duration 0`);
          }
          if (step.promote !== undefined) {
            promotions.push({ source: current, target: step.family, segments: step.promote, channel: c });
          }
          current = step.family;
          familyOf.set(c, step.family);
        }
        if (typeof step.to !== "string") continue;   // a numeric channel: nothing to morph
        const kind = parsePath(step.to).kind;
        const known = kindOf.get(current);
        if (known === undefined) {
          kindOf.set(current, kind);
        } else if (known !== kind) {
          fail(`${where} morphs within family "${current}" but its path is "${kind}" ` +
               `where the family is "${known}"`);
        }
      }
    }

    for (const pr of promotions) {
      const source = kindOf.get(pr.source);
      const target = kindOf.get(pr.target);
      if (source === undefined || !/^ML+$/.test(source)) {
        fail(`${where} promotes ${pr.channel} out of family "${pr.source}", whose shape is ` +
             `"${source ?? "unknown"}"; only an open polyline can be promoted`);
      } else if (target !== `M${"C".repeat(pr.segments)}`) {
        fail(`${where} promotes ${pr.channel} into family "${pr.target}" as ${pr.segments} ` +
             `cubic(s), but that family's shape is "${target ?? "unknown"}"`);
      } else if ((source.length - 1) === 0 || pr.segments % (source.length - 1) !== 0) {
        fail(`${where} promotes ${pr.channel}'s ${source.length - 1} line(s) into ${pr.segments} ` +
             `segment(s); the target count must be a whole multiple of the source's`);
      }
    }

    // The declared `duration` is what the host waits on before firing `onDone`;
    // the steps are what actually move. A step still running at `duration` means
    // `onDone` fires mid-tween and the character is caught in motion — a defect
    // no golden frame catches, because every individual frame is right. So the
    // declaration is a FLOOR, not a hint, and the loader holds it to that.
    let span = 0;
    for (const step of tl.steps) span = Math.max(span, step.at + step.duration);
    if (tl.duration < span) {
      fail(`${where} declares duration ${tl.duration} but its steps run to ${span}`);
    }
  }

  // --- behavior -----------------------------------------------------------
  // A delay key is a node id (the whole node lags) or one full channel.
  for (const key of Object.keys(behavior.channelDelays)) {
    if (nodes.has(key)) continue;
    requireChannel(key, "behavior.channelDelays");
  }

  // Predicates are a closed set of three forms; anything else is a typo, and a
  // typo that loads would be a permanently-false condition — a loop that simply
  // never runs, which no test would notice and no golden would catch.
  const BUILTIN_PREDICATES = ["eyesShut", "curious"];
  const requirePredicate = (name: string | undefined, where: string): void => {
    if (name === undefined) return;
    if (BUILTIN_PREDICATES.includes(name)) return;
    const def = behavior.params[name];
    if (def === undefined) fail(`${where} names unknown predicate "${name}"`);
    if (!("gt" in def!)) fail(`${where} names "${name}", which is a number, not a boolean`);
  };
  // The left operand of a `gt` is POSE-supplied and nothing else. Letting it name
  // another `params` entry would allow two params to reference each other, and
  // the evaluator would recurse forever on data that loaded cleanly.
  const requirePoseNumber = (name: string, where: string): void => {
    for (const [mood, pose] of Object.entries(poses.poses)) {
      if (pose.loops === undefined || !(name in pose.loops)) {
        fail(`${where} reads "${name}", which pose "${mood}" does not supply`);
      }
    }
  };
  // An amplitude is wider: it may also name a `select` param, because that is
  // how `swayAmp` picks between the calm and lively numbers.
  const requireAmplitude = (a: AmplitudeRef, where: string): void => {
    if (typeof a === "number") return;
    const def = behavior.params[a.param];
    if (def === undefined) return requirePoseNumber(a.param, where);
    if (!("select" in def)) fail(`${where} reads "${a.param}", which is a boolean, not a number`);
  };
  for (const [name, def] of Object.entries(behavior.params)) {
    if ("gt" in def) requirePoseNumber(def.gt[0], `param "${name}"`);
    else requirePredicate(def.select, `param "${name}"`);
  }
  for (const loop of behavior.loops) {
    requireChannel(loop.channel, `loop "${loop.id}"`);
    requireEase(loop.ease, `loop "${loop.id}"`);
    requireEase(loop.restEase, `loop "${loop.id}" rest`);
    requireAmplitude(loop.amplitude, `loop "${loop.id}" amplitude`);
    requireAmplitude(loop.duration, `loop "${loop.id}" duration`);
    requirePredicate(loop.enabledWhen, `loop "${loop.id}"`);
    requirePredicate(loop.disabledWhen, `loop "${loop.id}"`);
  }
  requirePredicate(behavior.gaze.disabledWhen, "behavior.gaze");
  requirePredicate(behavior.idleFidget.activeWhen, "behavior.idleFidget");
  requirePredicate(behavior.pinpricks.shownWhen, "behavior.pinpricks");
  requireChannel(behavior.blink.channel, "behavior.blink");
  requireEase(behavior.blink.ease, "behavior.blink");
  // A typo'd mood here reads as false forever, silently disabling blink
  // suppression for that mood — the same silent-predicate failure mode the
  // loop and param checks above already guard against.
  for (const mood of behavior.blink.suppressedIn) {
    if (!(mood in poses.poses)) fail(`behavior.blink.suppressedIn names unknown mood "${mood}"`);
  }
  for (const c of [...behavior.gaze.look.channels, behavior.gaze.tilt.channel,
                   ...behavior.gaze.lean.channels]) {
    requireChannel(c, "behavior.gaze");
  }
  for (const part of [behavior.gaze.look, behavior.gaze.tilt, behavior.gaze.lean]) {
    requireEase(part.ease, "behavior.gaze");
  }
  requirePair(behavior.gaze.reachCurious, "behavior.gaze.reachCurious");
  requirePair(behavior.gaze.reachIdle, "behavior.gaze.reachIdle");
  requireChannel(behavior.idleFidget.breath.channel, "behavior.idleFidget.breath");
  requireEase(behavior.idleFidget.breath.ease, "behavior.idleFidget.breath");
  requireChannel(behavior.idleFidget.sway.channel, "behavior.idleFidget.sway");
  for (const id of behavior.idleFidget.brow.nodes) {
    if (!nodes.has(id)) fail(`behavior.idleFidget.brow names unknown node "${id}"`);
  }
  requireEase(behavior.idleFidget.ease, "behavior.idleFidget");
  requireEase(behavior.idleFidget.settle.ease, "behavior.idleFidget.settle");
  requirePair(behavior.idleFidget.durationRange, "behavior.idleFidget.durationRange");
  requirePair(behavior.idleFidget.rearm.gapMs, "behavior.idleFidget.rearm.gapMs");
  for (const id of behavior.pinpricks.nodes) {
    if (!nodes.has(id)) fail(`behavior.pinpricks names unknown node "${id}"`);
  }
  requireEase(behavior.pinpricks.ease, "behavior.pinpricks");
  // An effect's loop is a `LoopDef` in everything but its `id`, so it gets the
  // same six checks the top-level loops get — amplitude, duration and both
  // gates included. Checking only its channel and ease was the asymmetry that
  // let `enabledWhen: "livly"` load clean and simply never run.
  for (const [mood, effect] of Object.entries(behavior.moodEffects)) {
    if (!(mood in poses.poses)) fail(`moodEffects names unknown mood "${mood}"`);
    if (!nodes.has(effect.target)) fail(`moodEffect "${effect.id}" names unknown node "${effect.target}"`);
    requirePair(effect.firstDelayMs, `moodEffect "${effect.id}" firstDelayMs`);
    requirePair(effect.rearmMs, `moodEffect "${effect.id}" rearmMs`);
    for (const steps of [effect.twitch, effect.drift, effect.once]) {
      for (const step of steps ?? []) {
        requireEase(step.ease, `moodEffect "${effect.id}"`);
        requirePair(step.durationRange, `moodEffect "${effect.id}" step durationRange`);
        for (const c of Object.keys(step.channels)) {
          requireChannel(c, `moodEffect "${effect.id}"`);
          // An effect step's value is always numeric — a literal or a
          // `{"rnd": n}` draw — so every channel it names has to be one that
          // holds a number. Pose channels and timeline steps have gone through
          // `requireValue` all along; effect steps got `requireChannel` and
          // nothing else, which is why an effect writing a number to
          // `mouth.shape` loaded clean. Expanded first, because a group is a
          // legitimate thing for a step to name and it is the MEMBERS written.
          for (const member of expand(c)) requireValue(member, 0, `moodEffect "${effect.id}"`);
        }
      }
    }
    if (effect.branch) {
      // "twitch" or "drift" — and NOT "once", however plausible a third step
      // list looks here: `stir` plays the list `branch.then`/`.else` names, and
      // `once` is `startEffect`'s, played on a different clock.
      //
      // Naming one of the two is necessary and not sufficient. The list also
      // has to EXIST: an effect that branches to "drift" without defining one
      // used to load clean and then go silent on roughly the fraction of stirs
      // the branch sent that way — while still drawing the branch value and the
      // re-arm gap, so the chain lived forever and the shared PRNG stream
      // walked out of step with every golden. `stir`'s `stepList` is total now
      // and ends the chain instead, which is at least visible; this makes it
      // unreachable from an authored config.
      for (const key of [effect.branch.then, effect.branch.else]) {
        if (!["twitch", "drift"].includes(key)) {
          fail(`moodEffect "${effect.id}" branches to "${key}", not "twitch" or "drift"`);
        }
        if ((key === "twitch" ? effect.twitch : effect.drift) === undefined) {
          fail(`moodEffect "${effect.id}" branches to "${key}", which it does not define`);
        }
      }
    }
    requireEase(effect.settle.ease, `moodEffect "${effect.id}" settle`);
    if (effect.loop) {
      requireChannel(effect.loop.channel, `moodEffect "${effect.id}" loop`);
      requireEase(effect.loop.ease, `moodEffect "${effect.id}" loop`);
      requireAmplitude(effect.loop.amplitude, `moodEffect "${effect.id}" loop amplitude`);
      requireAmplitude(effect.loop.duration, `moodEffect "${effect.id}" loop duration`);
      requirePredicate(effect.loop.enabledWhen, `moodEffect "${effect.id}" loop`);
      requirePredicate(effect.loop.disabledWhen, `moodEffect "${effect.id}" loop`);
    }
  }
  for (const rule of behavior.poke) {
    if (rule.from !== "*" && !(rule.from in poses.poses)) fail(`poke names unknown mood "${rule.from}"`);
    if (!(rule.expression in poses.poses)) fail(`poke names unknown pose "${rule.expression}"`);
  }
  for (const [mood, timeline] of Object.entries(behavior.choreography ?? {})) {
    // The pose is demanded even though the engine never applies it. A
    // choreographed mood is still a mood — the ladder, the poke rules and
    // `waking` all name moods, and every one of those names is checked against
    // `poses.poses`. Letting choreography be the one exception would make a
    // typo in it the only mood name that fails at run time instead of here.
    if (!(mood in poses.poses)) fail(`choreography names unknown mood "${mood}"`);
    if (!(timeline in timelines.timelines)) {
      fail(`choreography for "${mood}" names unknown timeline "${timeline}"`);
    }
  }
  if (!(behavior.waking.from in poses.poses)) fail(`waking.from names unknown mood "${behavior.waking.from}"`);
  if (!(behavior.waking.to in poses.poses)) fail(`waking.to names unknown mood "${behavior.waking.to}"`);
  // A MOOD, not a timeline — see `BehaviorFile.waking`. It does not have to be
  // choreographed: a character whose waking transition is a plain pose is a
  // legitimate character, and this validates the name, not the staging.
  if (!(behavior.waking.play in poses.poses)) {
    fail(`waking.play names unknown mood "${behavior.waking.play}"`);
  }
  if (!(behavior.eyesShutMood in poses.poses)) {
    fail(`eyesShutMood names unknown mood "${behavior.eyesShutMood}"`);
  }
  // The ladder has exactly three rungs and the arbiter indexes them, so a
  // missing key is a crash at run time rather than a mood that never appears.
  // Demand all three by name before checking what they point at.
  for (const rung of ["active", "bored", "asleep"] as const) {
    if (!(rung in behavior.ladder.moods)) fail(`ladder is missing the "${rung}" rung`);
  }
  for (const mood of Object.values(behavior.ladder.moods)) {
    if (!(mood in poses.poses)) fail(`ladder names unknown mood "${mood}"`);
  }
  requirePair(behavior.speech.bubble.distance, "behavior.speech.bubble.distance");
  requireEase(behavior.speech.bubble.in.ease, "behavior.speech.bubble.in");
  requireEase(behavior.speech.bubble.out.ease, "behavior.speech.bubble.out");

  // --- crops --------------------------------------------------------------
  for (const [cropName, featureNames] of Object.entries(character.crops)) {
    for (const feature of featureNames) {
      if (!features.has(feature)) fail(`crop "${cropName}" names unknown feature "${feature}"`);
    }
  }

  // --- variants -----------------------------------------------------------
  // A node WITHOUT a `.shape` channel is rebuilt from its rig shape every
  // frame, so a patch on it takes effect. A node WITH one reads its geometry
  // off the channel, which `seedChannels` re-seeds from the unpatched rig — so
  // a patch there is dead config that renders identically and says nothing.
  // `rest` already knows which is which; this block is why it is checked
  // here rather than by listing shape kinds, which would get the bend-driven
  // nodes (bezier, but channel-less) exactly backwards.
  const INK_FIELDS = new Set(["kind", "color", "width"]);
  for (const [vName, patch] of Object.entries(character.variants)) {
    for (const [inkName, fields] of Object.entries(patch.inks ?? {})) {
      if (!(inkName in character.inks)) {
        fail(`variant "${vName}" patches unknown ink "${inkName}"`);
      }
      for (const key of Object.keys(fields)) {
        if (!INK_FIELDS.has(key)) {
          fail(`variant "${vName}" ink "${inkName}" has unknown field "${key}"`);
        }
      }
    }
    for (const [nodeId, fields] of Object.entries(patch.shapes ?? {})) {
      const target = nodes.get(nodeId);
      if (target === undefined) fail(`variant "${vName}" patches unknown node "${nodeId}"`);
      const shape = target!.shape;
      if (shape === undefined) fail(`variant "${vName}" patches shapeless node "${nodeId}"`);
      // `rest`, NOT `channels`: `concrete` gives EVERY node all eleven animatable
      // props, so `channels.has("x.shape")` is true for every node in the rig and
      // would refuse every variant patch ever written. `rest` holds a `.shape`
      // entry only where `walk` actually seeded one — a shape with a `family`
      // and no `bend` — which is exactly "its geometry is driven by a channel".
      if (rest.has(`${nodeId}.shape`)) {
        fail(`variant "${vName}" patches morphable node "${nodeId}"; its .shape channel would overwrite the patch`);
      }
      for (const [key, value] of Object.entries(fields)) {
        // The allowlist FIRST, then the shape's own declaration — the mirror of
        // Swift's `patchable(_:)`, which returns nil for both. Reading the key
        // straight off the shape made `kind`, `bend` and `family` all look
        // "defined", so `{kind: 5}` and `{bend: 2}` loaded clean and threw in
        // `compose` on the next frame.
        const current = PATCHABLE_SHAPE_FIELDS.has(key)
          ? (shape as unknown as Record<string, unknown>)[key]
          : undefined;
        if (current === undefined) {
          fail(`variant "${vName}" node "${nodeId}" has no shape field "${key}"`);
        }
        if (Array.isArray(current) !== Array.isArray(value)) {
          fail(`variant "${vName}" node "${nodeId}" field "${key}" changes type`);
        }
        if (Array.isArray(value)) {
          // A point-count change is a different shape, not a size cut of the
          // same one, and would break the morph guard's anchor-count promise.
          if (value.length !== (current as unknown[]).length) {
            fail(`variant "${vName}" node "${nodeId}" field "${key}" changes point count`);
          }
        } else if (typeof value !== "number") {
          fail(`variant "${vName}" node "${nodeId}" field "${key}" is not a number`);
        }
      }
    }
  }

  // --- sayings ------------------------------------------------------------
  // Three checks, and the last two exist because the engine's `pickSaying` has
  // no honest failure mode of its own: it falls back to the active mood's list
  // and indexes into it, and `pick([])` quietly returns `undefined` through a
  // signature that says `string`. The load is the last moment the whole set of
  // reachable moods is knowable, so the guarantee has to be made here.
  for (const mood of Object.keys(sayings.sayings)) {
    if (!(mood in poses.poses)) fail(`sayings names unknown mood "${mood}"`);
    if (sayings.sayings[mood]!.length === 0) fail(`sayings for "${mood}" is empty`);
  }
  const fallbackMood = behavior.ladder.moods.active!;
  if (!(fallbackMood in sayings.sayings)) {
    fail(`sayings has no list for "${fallbackMood}", the mood every other mood falls back to`);
  }

  return {
    character, rig, poses, timelines, behavior, sayings,
    channels, expand, respond, families, rest, nodes,
  };
}
