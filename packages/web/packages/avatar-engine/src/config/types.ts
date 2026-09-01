export const SCHEMA_VERSION = 1;

/* ── character.json ────────────────────────────────────────────────── */

export interface Ink {
  kind: "stroke" | "fill";
  /** A palette key, or "@<nodeId>" for an ink late-bound to that node's `ink` channel. */
  color: string;
  width?: number;
}

export type VariantField = number | [number, number][];

export interface Variant {
  /** ink name -> the fields to override on it — `kind`, `color` or `width`. */
  inks?: Record<string, Partial<Ink>>;
  /** node id -> shape fields to override (`r`, `band`, `rx`, `points`, ...).
   *  Only a node with NO `.shape` channel may be patched — see the loader. */
  shapes?: Record<string, Record<string, VariantField>>;
}

export interface CharacterFile {
  $schema?: string;
  schemaVersion: number;
  id: string;
  canvas: { w: number; h: number };
  strokeStyle: { width: number; linecap: "round" | "butt"; linejoin: "round" | "miter" };
  palette: Record<string, string>;
  inks: Record<string, Ink>;
  /** crop name -> the `feature` names it includes (NOT node ids). */
  crops: Record<string, string[]>;
  /** variant name -> a sparse rig patch applied at scene-build time (Task 12).
   *  A variant is a different rig rendered still, not an animation state — it
   *  has no channels and nothing ever tweens toward it. */
  variants: Record<string, Variant>;
  files: { rig: string; poses: string; timelines: string; behavior: string; sayings: string };
}

/* ── rig.json ──────────────────────────────────────────────────────── */

export interface Transform {
  x?: number; y?: number; rotation?: number;
  scaleX?: number; scaleY?: number;
  /** ABSOLUTE design units — a point on the 400x400 canvas, not an offset. */
  pivot?: [number, number];
}

export interface Bend {
  axis: "x" | "y";
  weights: number[];
  inwardDamp: number;
  inwardSign: 1 | -1;
}

export type Shape =
  | { kind: "ring";     cx: number; cy: number; r: number; band: number }
  | { kind: "disc";     cx: number; cy: number; r: number }
  | { kind: "arc";      cx: number; cy: number; r: number; from: number; to: number }
  | { kind: "polyline"; family: string; points: [number, number][] }
  | { kind: "cubicO";   family: string; cx: number; cy: number; rx: number; ry: number }
  | { kind: "bezier";   family: string; points: [number, number][]; bend?: Bend };

/** The three primitive kinds are never morph targets, so they carry no family.
 *  Everything that can appear on a `.shape` channel does. */
export const shapeFamily = (s: Shape): string | undefined =>
  "family" in s ? s.family : undefined;

export interface RigNode {
  id: string;
  /** Crop membership: names a `character.crops` group this node belongs to. */
  feature?: string;
  /** A pure transform layer, no geometry. */
  layer?: boolean;
  transform?: Transform;
  shape?: Shape;
  /** Key into character.inks. Required whenever `shape` is present.
   *  A LAYER may carry one too: that is where "@body" late-binds from. */
  ink?: string;
  /** Resting value of the node's `.alpha` channel. Defaults to 1. */
  alpha?: number;
  children?: RigNode[];
}

export interface RigFile {
  schemaVersion: number;
  root: RigNode;
  /** group name -> its "<nodeId>.<prop>" members. */
  groups: Record<string, string[]>;
}

/* ── poses.json ────────────────────────────────────────────────────── */

export interface PoseDef {
  duration: number;
  ease: string;
  /** channel or group name -> target. A string is a path or a palette name. */
  channels: Record<string, number | string>;
  /** Values `behavior.json`'s `params` selectors read (e.g. `wiggle`, `bob`). */
  loops?: Record<string, number>;
  /** `carries` names sibling channels that inherit the spin's duration and
   *  ease instead of the pose's own — see `applyPose` for why. */
  spin?: {
    channel: string; turns: number; duration: number; ease: string;
    carries?: string[];
  };
}

export interface PosesFile {
  schemaVersion: number;
  order: string[];
  poses: Record<string, PoseDef>;
}

/* ── timelines.json ────────────────────────────────────────────────── */

export interface TimelineStep {
  at: number;                  // absolute seconds from timeline start
  channel: string;
  /** Absent only on a `promote` step, which computes its own target. */
  to?: number | string;
  duration: number;            // 0 = snap
  ease: string;
  /** Present only on a duration-0 step that changes the channel's shape family. */
  family?: string;
  /** A duration-0 family snap that re-expresses the channel's CURRENT shape as
   *  this many cubic segments (see `path/promote`), rather than writing a
   *  literal path. It is what lets a timeline cross out of the polyline family
   *  without knowing which pose's mouth it is crossing out of. */
  promote?: number;
}

export interface TimelineDef {
  duration: number;
  steps: TimelineStep[];
}

export interface TimelinesFile {
  schemaVersion: number;
  timelines: Record<string, TimelineDef>;
}

/* ── behavior.json ─────────────────────────────────────────────────── */

/** A `params` entry is one of two tiny expression forms — deliberately not a
 *  general expression language, so the Swift port is a switch, not a parser. */
export type ParamDef =
  | { gt: [string, number] }                                   // boolean: param > n
  | { select: string; then: number; else: number };            // number: pick on a boolean param

/** An amplitude is a literal, or a pose-supplied `loops` value, optionally scaled. */
export type AmplitudeRef = number | { param: string; scale?: number };

export interface LoopDef {
  id: string;
  channel: string;
  /** symmetric = -a..+a; zeroTo = 0..a. */
  mode: "symmetric" | "zeroTo";
  amplitude: AmplitudeRef;
  duration: AmplitudeRef;
  ease: string;
  yoyo?: boolean;
  delay?: number;
  phase?: "negativeFirst" | "positiveFirst";
  enabledWhen?: string;        // a boolean param, or "eyesShut"
  disabledWhen?: string;
  restValue: number;
  restDuration?: number;
  restEase?: string;
}

export interface BlinkDef {
  channel: string; shut: number;
  durationMs: number; minMs: number; maxMs: number;
  tweenDuration: number; ease: string;
  suppressedIn: string[];
}

export interface GazeDef {
  gazeMax: number; tiltMax: number; leanMax: number;
  look: { channels: string[]; duration: number; ease: string };
  tilt: { channel: string; duration: number; ease: string };
  lean: { channels: string[]; duration: number; ease: string };
  wanderAfterMs: number; wanderMinMs: number; wanderMaxMs: number;
  centreChanceCurious: number; centreChanceIdle: number;
  reachCurious: [number, number]; reachIdle: [number, number];
  disabledWhen?: string;
}

export interface IdleFidgetDef {
  activeWhen: string;
  breath: { channel: string; from: number; to: number; duration: number; ease: string; yoyo: boolean };
  sway: { channel: string; amplitude: number };
  brow: { nodes: string[]; rotationAmplitude: number; yAmplitude: number };
  durationRange: [number, number];
  /** Gap until the next fidget: uniform over `gapMs`, then ± `jitterMs`. */
  rearm: { gapMs: [number, number]; jitterMs: number };
  ease: string;
  settle: { duration: number; ease: string };
}

export interface LadderDef {
  boredAfterMs: number; asleepAfterMs: number; alertAfterTypingMs: number;
  pollMs: number;
  /** rung name -> mood name. */
  moods: Record<string, string>;
}

/** A random magnitude: the engine draws uniformly from [-rnd, +rnd]. */
export type EffectValue = number | { rnd: number };

export interface EffectStep {
  channels: Record<string, EffectValue>;
  duration?: number;
  durationRange?: [number, number];
  ease: string;
}

export interface EffectDef {
  id: string;
  target: string;
  firstDelayMs?: [number, number];
  rearmMs?: [number, number];
  branch?: { probability: number; then: string; else: string };
  twitch?: EffectStep[];
  drift?: EffectStep[];
  once?: EffectStep[];
  loop?: Omit<LoopDef, "id" | "restValue"> & { restValue?: number };
  /** How the effect's channels return to rest when the mood ends. Required,
   *  because an effect that walked `body.x` off rest has no pose to reclaim it. */
  settle: { duration: number; ease: string };
}

export interface BubbleDef {
  x: number; y: number;
  angleDeg: { base: number; jitter: number };
  distance: [number, number];
  spin: number;
  in: { from: Record<string, number>; to: Record<string, number>; duration: number; ease: string };
  out: { duration: number; delay: number; ease: string; to: Record<string, number> };
}

export interface BehaviorFile {
  schemaVersion: number;
  /** Node id OR full channel -> the seconds its pose tween waits. Looked up
   *  exact-channel first, node second; absent = 0. */
  channelDelays: Record<string, number>;
  params: Record<string, ParamDef>;
  loops: LoopDef[];
  blink: BlinkDef;
  gaze: GazeDef;
  idleFidget: IdleFidgetDef;
  ladder: LadderDef;
  poke: { from: string; expression: string; ms: number }[];
  /** Mood -> the timeline that IS that mood. A choreographed mood skips its
   *  pose entirely: entering it plays the named timeline, and leaving it
   *  cancels whatever of that timeline has not fired yet. The pose of the same
   *  name still has to exist — it is what the loader validates against, and
   *  what a still frame of the mood would draw — but the engine never applies
   *  it. Absent for a character with nothing choreographed. */
  choreography?: Record<string, string>;
  /** `play` names a MOOD, not a timeline: the wake window resolves to it, so
   *  everything keyed on the current mood — blink suppression above all — sees
   *  the yawn the way it sees any other mood. Choreography is what turns that
   *  mood into a timeline. */
  waking: { from: string; to: string; play: string; ms: number };
  moodEffects: Record<string, EffectDef>;
  /** The mood in which the eyes count as shut, gating blink, gaze and pinpricks. */
  eyesShutMood: string;
  pinpricks: { nodes: string[]; shownWhen: string; alpha: number;
               showDuration: number; hideDuration: number; ease: string };
  speech: { mutterMs: number; loopingIn: string[]; bubble: BubbleDef };
}

/* ── sayings.json ──────────────────────────────────────────────────── */

export interface SayingsFile {
  schemaVersion: number;
  sayings: Record<string, string[]>;
}

/* ── what the loader returns ───────────────────────────────────────── */

export type ChannelValue = number | string;

export interface RawFiles {
  character: unknown; rig: unknown; poses: unknown;
  timelines: unknown; behavior: unknown; sayings: unknown;
}

export interface CharacterConfig {
  character: CharacterFile; rig: RigFile; poses: PosesFile;
  timelines: TimelinesFile; behavior: BehaviorFile; sayings: SayingsFile;
  /** Every legal channel name: "<nodeId>.<prop>" plus every group name. */
  channels: ReadonlySet<string>;
  /** group name -> the concrete channels it fans out to (a concrete channel maps to itself). */
  expand: (channel: string) => readonly string[];
  /** The value the rig RENDERS for a value written to `channel`.
   *
   *  Applied once, where the value is written, so the channel holds rendered
   *  quantity and everything downstream interpolates in the space the original
   *  interpolates. Identity for every channel but a damped bend. */
  respond: (channel: string, value: ChannelValue) => ChannelValue;
  /** node id -> declared shape family, for the morph guard. */
  families: ReadonlyMap<string, string>;
  /** Every concrete channel's resting value, DERIVED from the rig tree — the
   *  seed `seedChannels` writes (Task 12) and the value a loop or effect returns
   *  to when it is disabled (Tasks 15, 16). It is computed, never authored, so
   *  there is no second table to drift from the rig. */
  rest: ReadonlyMap<string, ChannelValue>;
  /** node id -> the node, for crop and effect targeting. */
  nodes: ReadonlyMap<string, RigNode>;
}

/** The animatable property set is fixed and closed.
 *
 *  `pivotX`/`pivotY` are here because the original moves a transform origin the
 *  same way it moves anything else: the sad droop rotates the face about its
 *  bbox bottom and the settle puts the origin back at 60% height. A pivot that
 *  could only be authored in the rig could not express that, and the whole-glyph
 *  offset it produced was the largest geometric difference left in the port. */
export const ANIMATABLE = [
  "x", "y", "rotation", "scale", "scaleX", "scaleY",
  "pivotX", "pivotY",
  "bend", "ink", "alpha", "shape", "family",
] as const;
