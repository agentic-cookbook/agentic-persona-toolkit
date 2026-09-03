import { describe, expect, it } from "vitest";
import character from "@character/character.json";
import rig from "@character/rig.json";
import poses from "@character/poses.json";
import timelines from "@character/timelines.json";
import behavior from "@character/behavior.json";
import sayings from "@character/sayings.json";
import { loadConfig } from "./load";

const files = { character, rig, poses, timelines, behavior, sayings };
const clone = (): typeof files => structuredClone(files);

type BadRig = { root: { children?: unknown[] }; groups: Record<string, string[]> };
type BadVariants = { variants: Record<string, {
  inks?: Record<string, Record<string, unknown>>;
  shapes?: Record<string, Record<string, unknown>>;
}> };
type BadPoses = { poses: Record<string, { channels: Record<string, unknown> }> };
type BadBehavior = {
  loops: { id: string; amplitude: unknown; disabledWhen?: string }[];
  ladder: { moods: Record<string, string> };
  choreography: Record<string, string>;
  waking: { from: string; to: string; play: string; ms: number };
  gaze: { reachCurious: number[]; reachIdle: number[] };
  idleFidget: { durationRange: number[]; rearm: { gapMs: number[] } };
  speech: { bubble: { distance: number[] } };
  moodEffects: Record<string, {
    branch?: { probability: number; then: string; else: string };
    twitch?: { channels: Record<string, unknown>; durationRange?: number[] }[];
    drift?: unknown[];
    once?: { channels: Record<string, unknown>; durationRange?: number[] }[];
    firstDelayMs?: number[];
    rearmMs?: number[];
  }>;
};

/** The id of an effect that branches, and one that plays a `once` list — read
 *  off the shipped behaviour rather than written down, so a rename of either
 *  fails here loudly instead of turning these into tests of nothing. */
const BRANCHING = Object.keys((behavior as unknown as BadBehavior).moodEffects)
  .sort().find((m) => (behavior as unknown as BadBehavior).moodEffects[m]!.branch !== undefined)!;
const WITH_ONCE = Object.keys((behavior as unknown as BadBehavior).moodEffects)
  .sort().find((m) => ((behavior as unknown as BadBehavior).moodEffects[m]!.once ?? []).length > 0)!;
type BadTimelines = {
  timelines: Record<string, {
    duration: number;
    // `to` and `promote` are mutually exclusive in the real schema, so both are
    // optional here — a test that selects a step by which one it carries needs
    // to be able to ask.
    steps: { channel: string; to?: string; at: number; duration: number;
             family?: string; promote?: number }[];
  }>;
};

describe("loadConfig", () => {
  it("damps only a bend's inward side, and leaves every other channel alone", () => {
    const c = loadConfig(clone());
    // antennaLeft bends inward on the positive side, antennaRight on the
    // negative one, and the damp is 0.72 on whichever side that is.
    expect(c.respond("antennaLeft.bend", 10)).toBeCloseTo(7.2, 10);
    expect(c.respond("antennaLeft.bend", -10)).toBe(-10);
    expect(c.respond("antennaRight.bend", -10)).toBeCloseTo(-7.2, 10);
    expect(c.respond("antennaRight.bend", 10)).toBe(10);
    expect(c.respond("antennaLeft.bend", 0)).toBe(0);
    // Not a bend, not a number: identity.
    expect(c.respond("face.rotation", 10)).toBe(10);
    expect(c.respond("body.ink", "#ff0000")).toBe("#ff0000");
  });

  it("loads olylo", () => {
    const c = loadConfig(clone());
    expect(c.character.id).toBe("olylo");
    expect(c.character.canvas).toEqual({ w: 400, h: 400 });
    expect(Object.keys(c.poses.poses)).toHaveLength(14);
    expect(c.poses.order).toHaveLength(14);
  });

  it("derives the channel set from the rig, groups included", () => {
    const c = loadConfig(clone());
    expect(c.channels.has("browLeft.rotation")).toBe(true);
    expect(c.channels.has("eye.scaleY")).toBe(true);          // a group
    expect(c.expand("eye.scaleY")).toEqual(["eyeLeft.scaleY", "eyeRight.scaleY"]);
    expect(c.expand("browLeft.rotation")).toEqual(["browLeft.rotation"]);
    expect(c.expand("body.scale")).toEqual(["body.scaleX", "body.scaleY"]);
  });

  it("derives every channel's rest value from the rig tree", () => {
    const c = loadConfig(clone());
    expect(c.rest.get("browLeft.rotation")).toBe(0);
    expect(c.rest.get("eyeLeft.scaleY")).toBe(1);
    expect(c.rest.get("mouth.ink")).toBe("body");
    expect(c.rest.get("mouth.family")).toBe("mouth");
    expect(c.rest.get("mouth.shape")).toBe("M187,233L200,246L213,233");   // `polyline` emits no spaces
  });

  it("normalises colour channels to literals, but leaves ink keys alone", () => {
    const c = loadConfig(clone());
    // `body` names a palette colour, so body.ink carries the colour itself —
    // otherwise a mood change would snap instead of fading (`lerpValue` cannot
    // interpolate "green" -> "orange").
    expect(c.rest.get("body.ink")).toBe("#00ff41");
    expect(c.poses.poses.excited!.channels["body.ink"]).toBe("#ff9500");
    expect(c.timelines.timelines.yawn!.steps.find((s) => s.channel === "body.ink")!.to)
      .toBe("#00ff41");
    // `mouth` names an ink KEY — how it is painted, not what colour it is.
    expect(c.rest.get("mouth.ink")).toBe("body");
  });

  it("rejects a schemaVersion mismatch", () => {
    const bad = clone();
    (bad.character as { schemaVersion: number }).schemaVersion = 99;
    expect(() => loadConfig(bad)).toThrow(/schemaVersion/);
  });

  it("expands a group all the way to channels the rig actually reads", () => {
    const c = loadConfig(clone());
    // `iris.scale` names `irisLeft.scale` / `irisRight.scale`, and each of THOSE
    // is the derived uniform-scale group — so a single-level expand stops on a
    // name that is in `concrete` (because `scale` is in ANIMATABLE) but has no
    // `rest` entry and is read by nothing. `iris.scale` is in all fourteen
    // poses, so stopping there would mean the iris never scales, with no error
    // anywhere to say so. The `rest` assertion is the one that generalises:
    // every name `expand` yields must be a channel the rig actually holds.
    expect(c.expand("iris.scale")).toEqual([
      "irisLeft.scaleX", "irisLeft.scaleY", "irisRight.scaleX", "irisRight.scaleY",
    ]);
    for (const channel of c.expand("iris.scale")) {
      expect(c.rest.has(channel)).toBe(true);
    }
  });

  it("rejects a group naming a channel that does not exist", () => {
    const bad = clone();
    (bad.rig as BadRig).groups["eye.scaleY"] = ["nope.scaleY"];
    expect(() => loadConfig(bad)).toThrow(/nope\.scaleY/);
  });

  it("rejects a pose targeting an unknown channel", () => {
    const bad = clone();
    (bad.poses as BadPoses).poses.excited!.channels["ear.wiggle"] = 1;
    expect(() => loadConfig(bad)).toThrow(/ear\.wiggle/);
  });

  it("rejects a spin targeting a group channel", () => {
    const bad = clone();
    // Only `spin.channel` moves; the rest of the pose stays as authored. A
    // wholesale replacement would drop the pose's own `duration` and `ease`, and
    // then a green test would only prove the group guard runs before whichever
    // check catches those — not that it fires at all.
    const spun = (bad.poses as unknown as {
      poses: Record<string, { spin: { channel: string } }>;
    }).poses.silly!;
    spun.spin.channel = "eye.scaleY";
    expect(() => loadConfig(bad)).toThrow(/spin targets group "eye\.scaleY"/);
  });

  it("rejects an unresolved ink", () => {
    const bad = clone();
    // Walk to the first inked node rather than assuming a depth — the rig is a tree.
    type Walkable = { ink?: string; children?: Walkable[] };
    const stack: Walkable[] = [(bad.rig as unknown as { root: Walkable }).root];
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (n.ink !== undefined) { n.ink = "@nothing"; break; }
      for (const c of n.children ?? []) stack.push(c);
    }
    expect(() => loadConfig(bad)).toThrow(/@nothing/);
  });

  it("rejects a shaped node with no ink at all", () => {
    // The guard has always been here; the test has not, and Swift had neither
    // (parity ruling 12). Without it the config loads and dies at the first
    // composed frame, with a message naming neither the node nor the field.
    const bad = clone();
    type Walkable = { ink?: string; shape?: unknown; children?: Walkable[] };
    const stack: Walkable[] = [(bad.rig as unknown as { root: Walkable }).root];
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (n.shape !== undefined && n.ink !== undefined) { delete n.ink; break; }
      for (const c of n.children ?? []) stack.push(c);
    }
    expect(() => loadConfig(bad)).toThrow(/has a shape but no ink/);
  });

  it("rejects a shaped node painted with a bare palette colour", () => {
    // The one config fault that renders as nothing instead of failing: the
    // `.ink` channel is seeded with the hex, `compose` finds no `inks["#…"]`,
    // and the node paints as a zero-width stroke. Swift does the same, so the
    // platforms agree on an invisible node. `green` is a palette key that is
    // NOT an ink key — which is the whole distinction, since `eyeBg` and `iris`
    // are both and must stay legal.
    const bad = clone();
    type Walkable = { ink?: string; shape?: unknown; children?: Walkable[] };
    const stack: Walkable[] = [(bad.rig as unknown as { root: Walkable }).root];
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (n.shape !== undefined && n.ink !== undefined) { n.ink = "green"; break; }
      for (const c of n.children ?? []) stack.push(c);
    }
    expect(() => loadConfig(bad)).toThrow(/palette colour "green"/);
    // An ink name that is ALSO a palette key stays legal — inks win.
    const ok = clone();
    expect(() => loadConfig(ok)).not.toThrow();
  });

  it("rejects a palette entry `parseHex` cannot read", () => {
    // The whole batch's failure shape in one line of JSON: legal JSON, waved
    // through by the loader, and fatal at the first colour tween. `#abcd` is a
    // 4-digit body — accepted by the old `isHex`, thrown on by `parseHex` — so
    // it threw `bad hex colour: #abcd` from inside `useAvatarEngine`'s rAF
    // callback, which has no try/catch, and the avatar stopped for good. Swift
    // fared worse: a fullwidth digit is `Character.isHexDigit` there, and the
    // `try!` beneath it TRAPPED the process. Load is the last moment the
    // offending KEY is nameable.
    for (const bad of ["#abcd", "#abcde", "abcdef", "#gggggg", "#ab", ""]) {
      const c = clone();
      (c.character as { palette: Record<string, string> }).palette.green = bad;
      expect(() => loadConfig(c), bad).toThrow(/palette "green"/);
    }
    // The two legal shapes stay legal.
    for (const ok of ["#abc", "#AABBCC"]) {
      const c = clone();
      (c.character as { palette: Record<string, string> }).palette.green = ok;
      expect(() => loadConfig(c), ok).not.toThrow();
    }
  });

  it("rejects a group with no members", () => {
    // An empty list is not an empty group: the member loop is vacuous over
    // `[]`, so nothing rejects it, and `concrete.union(expandMap.keys)` then
    // makes the name a legal CHANNEL that expands to nothing. Every consumer
    // reaches for its first member — `expand(name)[0]!` here, `.first!` on
    // Swift, which traps out of the one function whose contract is to throw.
    const bad = clone();
    (bad.rig as unknown as BadRig).groups.eyelids = [];
    expect(() => loadConfig(bad)).toThrow(/group "eyelids" has no members/);
  });

  it("rejects a primitive that also declares a family", () => {
    // A ring/disc/arc is REBUILT every frame and never morphed, so `restShape`
    // returns undefined for it — and the `!` on that call wrote `undefined`
    // into `Channels` under a key `names()` lists, breaking the `ChannelValue`
    // union every consumer assumes. It also reclassified the node as morphable,
    // which refuses olylo's real `optical` variant. Swift threw on this input
    // all along.
    const bad = clone();
    type Walkable = { id: string; shape?: { family?: string }; children?: Walkable[] };
    const stack: Walkable[] = [(bad.rig as unknown as { root: Walkable }).root];
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (n.id === "eyeLeftRing") { n.shape!.family = "eye"; break; }
      for (const c of n.children ?? []) stack.push(c);
    }
    expect(() => loadConfig(bad)).toThrow(/"eyeLeftRing" has a family but is a ring/);
  });

  it("rejects a tweened family change in a timeline", () => {
    const bad = clone();
    // The yawn carries two family steps: the promote at 0 and the closing snap
    // at 1.85. A promote is refused for being a promote over time, by its own
    // message, so it would pass this test without exercising the rule under it.
    const snap = (bad.timelines as BadTimelines).timelines.yawn!.steps
      .find((s) => s.family !== undefined && s.promote === undefined)!;
    snap.duration = 0.3;  // a *tweened* family change is exactly the bug
    expect(() => loadConfig(bad)).toThrow(/family/);
  });

  it("rejects a duplicate node id", () => {
    // `walk` keys every node by id, so a duplicate silently overwrote the first
    // — the losing node kept its channels in `rest` but was unreachable by id,
    // and nothing downstream noticed.
    const bad = clone();
    const root = (bad.rig as unknown as { root: { id: string; children: { id: string }[] } }).root;
    root.children[0]!.id = root.id;
    expect(() => loadConfig(bad)).toThrow(/duplicate node id/);
  });

  it("rejects two poses that drive one channel with different path kinds", () => {
    // The ALL-PAIRS rule, and the reason it is stronger than the timelines'
    // consecutive-step check: the arbiter can morph between ANY two moods, so
    // it is not enough for each pose to agree with the one authored next to it.
    // Every pose driving `mouth.shape` rests at MLL; an ML here is a morph that
    // would throw only when the arbiter happened to pick that pair at run time.
    const bad = clone();
    (bad.poses as unknown as { poses: Record<string, { channels: Record<string, string> }> })
      .poses.bored!.channels["mouth.shape"] = "M188,241 L212,241";
    expect(() => loadConfig(bad)).toThrow(/must share its command signature/);
  });

  it("rejects a timeline whose steps outrun its declared duration", () => {
    // `duration` is what the host waits on before firing `onDone`. Declaring it
    // short fires `onDone` mid-tween — every individual frame still correct, so
    // no golden catches it.
    const bad = clone();
    (bad.timelines as BadTimelines).timelines.yawn!.duration = 1.0;
    expect(() => loadConfig(bad)).toThrow(/declares duration 1 but its steps run to 2\.1/);
  });

  it("rejects an unknown ease name", () => {
    const bad = clone();
    (bad.poses as { poses: Record<string, { ease: string }> }).poses.idle!.ease = "elastic.out";
    expect(() => loadConfig(bad)).toThrow(/elastic\.out/);
  });

  it("rejects a path outside the supported subset", () => {
    const bad = clone();
    // A step that already drives a value: the first `mouth.shape` step is the
    // promote, which computes its own target and refuses one written by hand.
    (bad.timelines as BadTimelines).timelines.yawn!.steps
      .find((s) => s.channel === "mouth.shape" && s.to !== undefined)!.to = "M0,0 A45,45 0 0 1 10,10";
    expect(() => loadConfig(bad)).toThrow(/unsupported/);
  });

  it("rejects a pose driving .shape on a bend-driven node", () => {
    // The antennae are rebuilt from their points and `.bend` every frame, so a
    // `.shape` channel on them would win and the bend would silently stop.
    const bad = clone();
    (bad.poses as BadPoses).poses.idle!.channels["antennaLeft.shape"] = "M0,0L1,1";
    expect(() => loadConfig(bad)).toThrow(/bend-driven/);
  });

  it("rejects a crop naming a feature no node carries", () => {
    const bad = clone();
    (bad.character as { crops: Record<string, string[]> }).crops.browsAndEyes = ["knees"];
    expect(() => loadConfig(bad)).toThrow(/knees/);
  });

  it("rejects a variant patching an ink that does not exist", () => {
    const bad = clone();
    (bad.character as BadVariants).variants.optical!.inks!.eyebrow = { width: 9 };
    expect(() => loadConfig(bad)).toThrow(/eyebrow/);
  });

  it("rejects a variant patching a shape field the node's kind does not have", () => {
    const bad = clone();
    (bad.character as BadVariants).variants.optical!.shapes!.irisLeft = { band: 3 };
    expect(() => loadConfig(bad)).toThrow(/no shape field "band"/);
  });

  it("rejects a variant patching a shape field that is not resizable", () => {
    // The key was validated by READING it off the shape object, so `kind`,
    // `bend` and `family` all looked "defined" and passed — where Swift checks
    // an allowlist and throws. The patch is applied by object spread, not by a
    // `switch`, so it was not quietly dropped: `{kind: 5}` reached `compose`
    // as `unknown shape kind: 5` and `{bend: 2}` as a TypeError reading
    // `(2).weights[0]`, both inside the rAF loop, every frame.
    for (const [nodeId, patch] of [
      ["eyeLeftRing", { kind: 5 }],
      ["antennaLeft", { bend: 2 }],
      ["eyeLeftRing", { family: 3 }],
    ] as [string, Record<string, unknown>][]) {
      const bad = clone();
      (bad.character as BadVariants).variants.optical!.shapes![nodeId] = patch;
      expect(() => loadConfig(bad), `${nodeId} ${JSON.stringify(patch)}`)
        .toThrow(/has no shape field/);
    }
  });

  it("rejects a variant patching a morphable node", () => {
    // `mouth` is a polyline with a `family` and no bend, so its geometry lives
    // on `mouth.shape` and is re-seeded from the unpatched rig every build. A
    // patch here would be silently overwritten, which is worse than a load error.
    const bad = clone();
    (bad.character as BadVariants).variants.optical!.shapes!.mouth = {
      points: [[0, 0], [1, 1], [2, 2]],
    };
    expect(() => loadConfig(bad)).toThrow(/morphable/);
  });

  it("rejects a variant that changes a shape field's point count", () => {
    const bad = clone();
    (bad.character as BadVariants).variants.optical!.shapes!.antennaLeft = {
      points: [[0, 0], [1, 1]],
    };
    expect(() => loadConfig(bad)).toThrow(/point count/);
  });

  it("rejects a saying for a mood with no pose", () => {
    const bad = clone();
    (bad.sayings as { sayings: Record<string, string[]> }).sayings.smitten = ["hello"];
    expect(() => loadConfig(bad)).toThrow(/smitten/);
  });

  it("rejects a loop gated on a predicate that is neither a param nor a built-in", () => {
    // The failure mode this guards is silent: an unknown predicate reads as
    // false forever, so the loop simply never runs and nothing else complains.
    const bad = clone();
    (bad.behavior as BadBehavior).loops[0]!.disabledWhen = "eyesClosed";
    expect(() => loadConfig(bad)).toThrow(/eyesClosed/);
  });

  it("rejects a loop amplitude no pose supplies", () => {
    const bad = clone();
    (bad.behavior as BadBehavior).loops.find((l) => l.id === "faceWiggle")!
      .amplitude = { param: "shimmy" };
    expect(() => loadConfig(bad)).toThrow(/shimmy/);
  });

  it("rejects a ladder missing one of its three rungs", () => {
    // Rung 0 is the mood the arbiter paints at startup and returns to on every
    // notice(). Nothing else in the config points at it, so an omitted `active`
    // loads clean and then crashes the first time the arbiter indexes its rungs.
    const bad = clone();
    delete (bad.behavior as BadBehavior).ladder.moods.active;
    expect(() => loadConfig(bad)).toThrow(/"active" rung/);
  });

  it("rejects choreography keyed on a mood no pose defines", () => {
    // A choreographed mood never has its pose applied, which is exactly why the
    // pose still has to exist: the name is reachable from the ladder, the poke
    // rules and `waking`, and every one of those is checked against the poses.
    const bad = clone();
    (bad.behavior as BadBehavior).choreography.stretching = "yawn";
    expect(() => loadConfig(bad)).toThrow(/unknown mood "stretching"/);
  });

  it("rejects choreography pointing at a timeline that does not exist", () => {
    const bad = clone();
    (bad.behavior as BadBehavior).choreography.yawning = "stretch";
    expect(() => loadConfig(bad)).toThrow(/unknown timeline "stretch"/);
  });

  it("rejects waking.play naming a timeline rather than a mood", () => {
    // The trap this catches is the port's own first spelling: `play` used to
    // name the yawn TIMELINE, so the wake window reported `idle` as the mood
    // and every mood-keyed reflex missed the yawn entirely.
    const bad = clone();
    (bad.behavior as BadBehavior).waking.play = "yawn";
    expect(() => loadConfig(bad)).toThrow(/waking.play names unknown mood "yawn"/);
  });
  // --- pair arity (finding 16, the load-time half) -------------------------
  //
  // `schema.json` already says `minItems: 2, maxItems: 2` on all eight of these
  // (`#/$defs/Point`), and says it to nobody: no validator runs the schema at
  // load. `requirePair` is what makes it a rule. The runtime's `pairRange`
  // still degrades a short pair rather than trapping — that is the second line
  // of defence, for a config reaching the engine from somewhere other than here.

  it("rejects a gaze reach that is not exactly two numbers", () => {
    const bad = clone();
    (bad.behavior as BadBehavior).gaze.reachCurious = [0.4];
    expect(() => loadConfig(bad))
      .toThrow(/behavior\.gaze\.reachCurious needs exactly two numbers, not 1/);
  });

  it("rejects an idle-fidget duration range of three numbers", () => {
    const bad = clone();
    (bad.behavior as BadBehavior).idleFidget.durationRange = [200, 400, 600];
    expect(() => loadConfig(bad))
      .toThrow(/behavior\.idleFidget\.durationRange needs exactly two numbers, not 3/);
  });

  it("rejects a one-element rearm gap, the pair that used to trap minutes in", () => {
    // `"gapMs": [4000]` is the finding's own example: it loaded clean, then the
    // Swift engine trapped on `pair[1]` and the web engine produced a NaN
    // deadline that could never come due — one bad config, two wrong answers,
    // both arbitrarily far from the line that caused them.
    const bad = clone();
    (bad.behavior as BadBehavior).idleFidget.rearm.gapMs = [4000];
    expect(() => loadConfig(bad))
      .toThrow(/behavior\.idleFidget\.rearm\.gapMs needs exactly two numbers, not 1/);
  });

  it("rejects a speech bubble distance that is not a pair", () => {
    const bad = clone();
    (bad.behavior as BadBehavior).speech.bubble.distance = [];
    expect(() => loadConfig(bad))
      .toThrow(/behavior\.speech\.bubble\.distance needs exactly two numbers, not 0/);
  });

  it("rejects a mood effect's rearmMs and its step's durationRange alike", () => {
    const bad = clone();
    (bad.behavior as BadBehavior).moodEffects[BRANCHING]!.rearmMs = [1000];
    expect(() => loadConfig(bad)).toThrow(/rearmMs needs exactly two numbers, not 1/);

    const bad2 = clone();
    (bad2.behavior as BadBehavior).moodEffects[WITH_ONCE]!.once![0]!.durationRange = [1, 2, 3];
    expect(() => loadConfig(bad2))
      .toThrow(/step durationRange needs exactly two numbers, not 3/);
  });

  // --- channel type (finding 17, the loader half) --------------------------

  it("rejects an effect step writing a number to a channel that holds a path", () => {
    // The finding's second half: `requireChannel` said the channel exists and
    // nothing said it can hold what the step writes. An effect step's value is
    // always numeric, so a `.shape` channel is a type error — one that used to
    // surface only as a promote silently refusing, mid-session.
    const bad = clone();
    const shape = Object.keys(
      (bad.poses as unknown as BadPoses).poses[
        Object.keys((bad.poses as unknown as BadPoses).poses)[0]!]!.channels)
      .find((c) => c.endsWith(".shape"))!;
    (bad.behavior as BadBehavior).moodEffects[WITH_ONCE]!.once![0]!.channels[shape] = 1;
    expect(() => loadConfig(bad))
      .toThrow(new RegExp(`writes a number to ${shape.replace(".", "\\.")}, which holds a path`));
  });

  it("rejects an effect step writing a number to a channel that holds a colour", () => {
    const bad = clone();
    (bad.behavior as BadBehavior).moodEffects[WITH_ONCE]!.once![0]!.channels["body.ink"] = 0.5;
    expect(() => loadConfig(bad)).toThrow(/writes a number to body\.ink, which holds a colour/);
  });

  // --- branch target exists (finding 36, the loader half) ------------------

  it("rejects an effect that branches to a list it does not define", () => {
    // Spelling the key right was the whole of the old check. An effect that
    // branches to "drift" and defines none used to load clean, then go silent
    // on the share of stirs the branch sent that way — while still drawing the
    // branch value and the re-arm gap, so the chain lived forever and the PRNG
    // stream walked out of step with every golden.
    const bad = clone();
    delete (bad.behavior as BadBehavior).moodEffects[BRANCHING]!.drift;
    expect(() => loadConfig(bad)).toThrow(/branches to "drift", which it does not define/);
  });

  it("still accepts an effect whose branch list is authored empty", () => {
    // Absent and empty are different statements — "no such list" against
    // "nothing to play this time" — and `?? []` was collapsing them. The
    // runtime keeps the distinction; so must the loader.
    const ok = clone();
    (ok.behavior as BadBehavior).moodEffects[BRANCHING]!.drift = [];
    expect(() => loadConfig(ok)).not.toThrow();
  });
});
