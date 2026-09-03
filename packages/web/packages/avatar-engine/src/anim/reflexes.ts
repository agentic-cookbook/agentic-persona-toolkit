import type { CharacterConfig, EffectDef, EffectStep, LoopDef } from "../config/types";
import type { Prng } from "../math/prng";
import type { Channels } from "../runtime/channels";
import type { Scheduler } from "../runtime/scheduler";
import type { Tweens } from "../runtime/tween";
import { amplitude, gateOpen, predicate, type ParamScope } from "./params";

export interface ReflexDeps {
  config: CharacterConfig;
  channels: Channels;
  tweens: Tweens;
  scheduler: Scheduler;
  prng: Prng;
  mood: () => string;
  reducedMotion: () => boolean;
  mutter: (now: number) => void;
}

export interface Reflexes {
  start(now: number): void;
  look(x: number, y: number, now: number): void;
  stop(): void;
}

const clamp1 = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v);

/** One PRNG draw from a `[lo, hi]` config pair, whatever arity the pair has.
 *
 *  Six sites in this file read a config array as a pair — `reachIdle`,
 *  `durationRange` twice, `rearm.gapMs`, `rearmMs`, `firstDelayMs` — and every
 *  one of them used to index `[0]` and `[1]` directly. The TYPE says
 *  `[number, number]`; nothing between the JSON and here enforces it, because
 *  `load.ts` arity-checks no pair field and `schema.json` puts no
 *  `minItems`/`maxItems` on any of them. So `"rearmMs": [4000]` loads clean,
 *  passes every config test, and then computes `range(4000, undefined)` — `NaN`
 *  — which is scheduled as a deadline that can never come due: the behaviour is
 *  silently deleted, at a distance, on whichever branch happens to be taken
 *  first. The Swift twin does not degrade, it TRAPS: `Index out of range`,
 *  minutes into a session, arbitrarily far from the config that caused it. Two
 *  different wrong answers to one bad pair.
 *
 *  This is the second line of defence, not the first — the loader is where a
 *  bad pair should be named and refused, and this file cannot reach the loader.
 *  What it can do is make the two engines fail the SAME way: a pair short of an
 *  element degrades to the degenerate range built from what is actually there
 *  (`[4000]` reads as 4000..4000, `[]` as 0..0), and the draw still happens, so
 *  the PRNG stream stays in step across the two platforms and across the good
 *  and bad configs alike. Anything the pair does not say is missing behaviour,
 *  never `NaN` and never a trap. */
export function pairRange(prng: Prng, pair: readonly number[]): number {
  const lo = pair.length > 0 ? pair[0]! : 0;
  const hi = pair.length > 1 ? pair[1]! : lo;
  return prng.range(lo, hi);
}

export function createReflexes(deps: ReflexDeps): Reflexes {
  const { config, channels, tweens, scheduler, prng } = deps;
  const { mood, reducedMotion, mutter } = deps;
  const b = config.behavior;
  const poll = b.ladder.pollMs / 1000;

  const scope = (): ParamScope => ({ mood: mood() });
  /** The rig's resting value for a channel, as a NUMBER.
   *
   *  A check, not a cast, and the difference is arithmetic. `ChannelValue` is
   *  `number | string`, and a `.ink` or `.shape` channel's rest is a string:
   *  `"#3a3a3a"`, `"M40,70L50,74L60,70"`. `as number` told the compiler
   *  otherwise and let that string straight into `fidget`'s
   *  `base + prng.signed(amp)`, where `+` is concatenation — `"#3a3a3a1.4"`,
   *  written to a channel as if it were a number, and from there into a tween
   *  that interpolates toward it. Swift reaches these lines through
   *  `?.number ?? 0`, which yields 0 for exactly the same config, so the cast
   *  was also a silent divergence between the twins. Zero is the answer both
   *  now give: a reflex aimed at a non-numeric channel does nothing, rather
   *  than doing something no one can name. */
  const rest = (channel: string): number => {
    const v = config.rest.get(channel);
    return typeof v === "number" ? v : 0;
  };
  /** The channel's live value, or its rest if nothing has written it yet.
   *
   *  Checked for the same reason `rest` is, and it has to be checked HERE too:
   *  `seedChannels` seeds every channel from `config.rest`, so a string rest is
   *  also a string sitting live on the channel, and a guard on `rest` alone
   *  would be walked straight past by the `channels.get` branch. Swift's
   *  `ctx.channels.get(channel)?.number ?? rest(channel)` falls through to the
   *  rest for a non-numeric value; this is that fall-through. */
  const now0 = (channel: string): number => {
    const v = channels.get(channel);
    return typeof v === "number" ? v : rest(channel);
  };

  // Every one-shot this file schedules is tracked so `stop` can cancel it. A
  // fired entry removes itself, so the set is bounded by what is actually pending.
  const pending = new Set<number>();
  const at = (t: number, run: (fired: number) => void): void => {
    const id: number = scheduler.once(t, (fired) => {
      pending.delete(id);
      run(fired);
    });
    pending.add(id);
  };

  /* ── ambient loops ───────────────────────────────────────────────── */

  const running = new Map<string, boolean>();
  const signs = new Map<string, number>();
  /** Which arming of a loop is the current one.
   *
   *  A loop's chain schedules its own next cycle, and `stopLoop` cannot cancel
   *  that pending event — `at` does not hand back an id. Before Ruling 39 it
   *  never had to: a loop only ever stopped from INSIDE its chain, so the stop
   *  and the chain's death were the same instant. The poll can now stop a loop
   *  between two of its own ticks, and if the amplitude comes back before that
   *  orphaned event fires, the poll has already armed a fresh chain — the
   *  orphan then arms a SECOND one, and the loop oscillates on two chains at
   *  once, forever, each re-arming the other's channel at a fractional offset.
   *  Reachable whenever a loop's period exceeds `pollMs`: the calm sways are
   *  0.85s and 1.05s against a 400ms poll, and neither shares a useful factor
   *  with 0.4, so the two cadences drift into that window on their own.
   *
   *  The generation is what lets a pending event ask whether the chain that
   *  scheduled it is still the current one. Every arm mints one; every stop
   *  invalidates whatever is outstanding. */
  const gen = new Map<string, number>();
  const nextGen = (loop: LoopDef): number => {
    const g = (gen.get(loop.id) ?? 0) + 1;
    gen.set(loop.id, g);
    return g;
  };

  const settleLoop = (loop: LoopDef, when: number): void => {
    for (const ch of config.expand(loop.channel)) {
      tweens.add({
        channel: ch, to: loop.restValue,
        duration: loop.restDuration ?? 0, ease: loop.restEase,
      }, when);
    }
  };

  /** Whether a loop should be oscillating at this instant.
   *
   *  A ZERO AMPLITUDE IS NOT A LOOP THAT SWINGS BY NOTHING — it is a loop that
   *  must not run at all, and the difference is visible. `faceBob`'s amplitude
   *  is the active pose's `bob`, zero for eleven of the fourteen moods, and
   *  `faceWiggle`'s is `wiggle`, zero for nine. A zero-amplitude loop that keeps
   *  re-arming rewrites its channel to `restValue` every cycle, and by tween
   *  rule 1 — newest wins — that write cancels whatever else is driving the
   *  channel. What else drives it is the mood effect on the same channel:
   *  `boredSag` yoyos `face.y` out to 2.5 over 3.5s while `faceBob` writes it
   *  back to 0 every 0.5s, so the sag peaks around 0.12 and never completes one
   *  cycle. The original had no such conflict because it never started the loop
   *  — `if (bob > 0)` started it, and `else` ran ONE settle tween and then left
   *  `face.y` alone for the sag to own. This predicate is that `if`.
   *
   *  `-0 !== 0` is false in JS and `-0.0 != 0.0` is false in Swift, so the
   *  `{ "param": "bob", "scale": -1 }` amplitude reads as zero on both.
   */
  const loopLive = (loop: LoopDef, s: ParamScope): boolean =>
    !reducedMotion()
    && amplitude(config, s, loop.amplitude) !== 0
    && gateOpen(config, s, loop);

  /** Settle a running loop and take it out of the chain. Idempotent — a loop
   *  already stopped writes nothing, so the poll can call it every tick without
   *  re-settling a channel something else has since taken over. */
  const stopLoop = (loop: LoopDef, when: number): void => {
    nextGen(loop); // orphan any pending chain event, running or not
    if (running.get(loop.id) !== true) return;
    running.set(loop.id, false);
    settleLoop(loop, when);
  };

  /** Take a loop out of the chain WITHOUT writing its channel.
   *
   *  `stopLoop` settles, because it is the eyes-shutting case: the original
   *  tweens each antenna back to bend 0 over half a second when the character
   *  falls asleep, and `restValue`/`restDuration`/`restEase` are that tween,
   *  copied. Entering a choreographed mood is a different case with a different
   *  answer. There the original kills the loop tweens outright, and a killed
   *  GSAP tween writes nothing more: the antenna stays at whatever bend the
   *  half cycle had reached and the timeline owns the channel unchallenged.
   *  Settling here would put a half-second sway-to-centre underneath the yawn
   *  that the original never draws.
   *
   *  Cancelling the channel's tweens is what makes the freeze a freeze rather
   *  than a pause: an in-flight sway tween left running would keep writing.
   */
  const freezeLoop = (loop: LoopDef): void => {
    nextGen(loop); // orphan any pending chain event, running or not
    if (running.get(loop.id) !== true) return;
    running.set(loop.id, false);
    for (const ch of config.expand(loop.channel)) tweens.cancel(ch);
  };

  /** Whether a choreographed mood suppresses this loop outright.
   *
   *  A CHOREOGRAPHED MOOD RUNS NO AMBIENT LOOP AT ALL. In the original every
   *  ambient loop is created inside `applyPose`, and the pose effect returns
   *  before `applyPose` when the mood has a timeline — so the suppression is
   *  structural and covers every ambient loop uniformly, which is why it is
   *  expressed here and not as a `disabledWhen` each loop opts into one at a
   *  time. Measured on a forced 10s `yawning` take: the original never writes
   *  `antennaLeft.bend` (tip x is 179.000 on all 601 frames) while the port
   *  swung the full calm amplitude, 10.64 units, throughout.
   *
   *  It is the AMBIENT loops and only those. A mood effect's loop reaches its
   *  channels through its own hook in the original, not through the pose, so a
   *  timeline never suppressed it and neither does this.
   */
  const ambient = new Set(b.loops.map((l) => l.id));
  const suppressed = (loop: LoopDef, s: ParamScope): boolean =>
    ambient.has(loop.id) && predicate(config, s, "choreographed");

  function armLoop(loop: LoopDef, when: number): void {
    const s = scope();
    if (suppressed(loop, s)) {
      freezeLoop(loop);
      return; // the poll re-arms it when the timeline's mood ends
    }
    if (!loopLive(loop, s)) {
      stopLoop(loop, when);
      return; // the poll re-arms it; nothing idles in a chain it cannot use
    }
    /** Whether this arm OPENS a chain rather than continuing one.
     *
     *  The original states an ambient loop as ONE tween, created the instant the
     *  pose lands and left to repeat itself. So everything about that loop which
     *  happens once happens here and nowhere else: the phase it begins at, the
     *  jump onto that phase, and the loop's start delay. A re-arm is one repeat
     *  of that same tween — no delay, no jump, and it picks up the phase the
     *  previous half cycle left. */
    const opening = running.get(loop.id) !== true;
    running.set(loop.id, true);
    // A REOPENED chain begins at the phase the config names, never at whichever
    // extreme the last one happened to stop on. Reopening is a pose landing, and
    // the original's pose apply always re-states the same starting side.
    const sign = (opening ? undefined : signs.get(loop.id))
      ?? (loop.phase === "negativeFirst" ? -1 : 1);
    const amp = amplitude(config, s, loop.amplitude);
    const dur = amplitude(config, s, loop.duration);
    /** A symmetric yoyo swings BETWEEN two extremes, so it has to be standing on
     *  one of them before the swing starts. The original puts it there with an
     *  instantaneous set and only then runs the tween across to the far side, so
     *  `phase` names the side it stands on and the stroke this arm plays runs to
     *  the other one. Easing out of rest instead leaves the port half a cycle
     *  behind for as long as the pose lasts, and on the pose's very first frame
     *  it sits at zero where the original sits at full amplitude — around five
     *  degrees of whole-face rotation on `silly`, and the antennae start bent
     *  the wrong way in every mood.
     *
     *  `zeroTo` has no such jump and must not be given one: its rest value IS
     *  one of its two ends, so the original starts it exactly where the channel
     *  already is — `faceBob` runs to `-bob` with no set of any kind first. */
    const swings = loop.mode === "symmetric" && loop.yoyo === true;
    const to = loop.mode === "symmetric"
      ? (swings ? -sign : sign) * amp
      : (sign > 0 ? amp : loop.restValue);
    // The delay positions the loop's START. It is not a gap between repeats —
    // charging it every half cycle stretches the antenna sway's period by its
    // own 0.12s and puts the two implementations permanently out of step.
    const delay = opening ? (loop.delay ?? 0) : 0;
    for (const ch of config.expand(loop.channel)) {
      if (swings && opening) {
        tweens.add({ channel: ch, to: sign * amp, duration: 0 }, when);
      }
      tweens.add({
        channel: ch, to, duration: dur, delay, ease: loop.ease,
        // A non-yoyo loop replays the same stroke each cycle, so it starts from
        // rest rather than from wherever the last cycle happened to end.
        from: loop.yoyo === true ? undefined : loop.restValue,
      }, when);
    }
    signs.set(loop.id, loop.yoyo === true ? -sign : sign);
    const g = nextGen(loop);
    at(when + delay + dur, (t) => { if (gen.get(loop.id) === g) armLoop(loop, t); });
  }

  /* ── blink ───────────────────────────────────────────────────────── */

  /** Arms every lid. The original runs a separate `useBlink` hook per eye
   *  ($GSAP/src/engine.ts:106-107), so the lids are never in step; expanding
   *  inside `blink` instead -- as this did -- shuts them on the same frame with
   *  the same tween, which reads as a graphic rather than a face. `expand`
   *  returns `[channel]` for a name it does not know, so a one-eyed
   *  character gets exactly one chain from the same code. */
  function armBlink(when: number): void {
    for (const ch of config.expand(b.blink.channel)) armLid(when, ch);
  }

  /** One lid's self-perpetuating chain. The gap is drawn off the engine's one
   *  shared prng in `expand`'s declared order, which is what keeps the recorded
   *  goldens reproducible. */
  function armLid(when: number, ch: string): void {
    at(when + prng.range(b.blink.minMs, b.blink.maxMs) / 1000, (t) => blink(t, ch));
  }

  function blink(when: number, ch: string): void {
    if (!b.blink.suppressedIn.includes(mood())) {
      // Captured before the close, so the eye reopens to whatever the pose
      // asked for rather than to the rig's rest.
      const open = now0(ch);
      tweens.add({
        channel: ch, to: b.blink.shut,
        duration: b.blink.tweenDuration, ease: b.blink.ease,
      }, when);
      at(when + b.blink.durationMs / 1000, (t) => {
        tweens.add({
          channel: ch, to: open,
          duration: b.blink.tweenDuration, ease: b.blink.ease,
        }, t);
      });
    }
    armLid(when, ch);
  }

  /* ── gaze ────────────────────────────────────────────────────────── */

  let target: readonly [number, number] = [0, 0];
  let pointerAt = -Infinity;

  /** Asleep is dead still: no tracking, no tilt, no lean, and no saccade. The
   *  original expresses this by returning from `useGaze` before it registers
   *  either the pointer listener or the wander timer. */
  const gazeShut = (): boolean =>
    b.gaze.disabledWhen !== undefined && predicate(config, scope(), b.gaze.disabledWhen);

  /** Where the irises point. Dispatched on the channel's suffix, never on its
   *  index: the four `look` channels are two eyes x two axes, and an index would
   *  silently swap them the day a third eye or a different order appears. */
  const lookAt = (when: number, tx: number, ty: number): void => {
    const g = b.gaze;
    for (const ch of g.look.channels) {
      tweens.add({
        channel: ch, to: (ch.endsWith(".y") ? ty : tx) * g.gazeMax,
        duration: g.look.duration, ease: g.look.ease,
      }, when);
    }
  };

  /** The head's own layer, in degrees — already signed by the caller. */
  const tiltTo = (when: number, deg: number): void => {
    const g = b.gaze;
    tweens.add({
      channel: g.tilt.channel, to: deg,
      duration: g.tilt.duration, ease: g.tilt.ease,
    }, when);
  };

  /** The whole glyph's drift, in normalised units the caller has clamped. */
  const leanTo = (when: number, nx: number, ny: number): void => {
    const g = b.gaze;
    for (const ch of g.lean.channels) {
      tweens.add({
        channel: ch, to: (ch.endsWith(".y") ? ny : nx) * g.leanMax,
        duration: g.lean.duration, ease: g.lean.ease,
      }, when);
    }
  };

  /** Eyes, head and glyph all aimed at the current target — what a POINTER
   *  (or a deliberate gaze) does. A wander is deliberately not this. */
  const applyGaze = (when: number): void => {
    if (gazeShut()) return;
    const [tx, ty] = target;
    lookAt(when, tx, ty);
    // NEGATED, and the sign is the whole point: the head leans INTO whatever it
    // is watching, not away from it. The original spells it `-x * tiltMax` at
    // both of its call sites (`gaze.ts`), and `tiltMax` stays positive here so
    // the config keeps reading as a magnitude rather than smuggling a direction
    // into a field named "max". Flip this and the character mirrors — which is
    // exactly the class of difference this port exists to not have.
    tiltTo(when, -tx * b.gaze.tiltMax);
    leanTo(when, tx, ty);
  };

  function wander(when: number): void {
    const g = b.gaze;
    if (!gazeShut() && when - pointerAt >= g.wanderAfterMs / 1000) {
      // The head LEVELS and the glyph re-centres before the eyes pick their own
      // target. A wander is the irises drifting so the face never stares blankly
      // — it is not the head turning to watch something, because by definition
      // there is nothing to watch: the pointer has been still for wanderAfterMs.
      // The original opens its wander tick with `tilt(0); lean(0, 0)` for this
      // reason. Aiming the head at a wander target instead rotates the ENTIRE
      // rig by up to tiltMax degrees, on nothing, for as long as the mood lasts
      // — every node in the recorded frame shifted by one common angle, with no
      // matching motion anywhere in the original.
      tiltTo(when, 0);
      leanTo(when, 0, 0);
      const curious = predicate(config, scope(), "curious");
      if (prng.chance(curious ? g.centreChanceCurious : g.centreChanceIdle)) {
        target = [0, 0];
      } else {
        const reach = curious ? g.reachCurious : g.reachIdle;
        const angle = prng.range(0, Math.PI * 2);
        const r = pairRange(prng, reach);
        target = [Math.cos(angle) * r, Math.sin(angle) * r];
      }
      lookAt(when, target[0], target[1]);
    }
    at(when + prng.range(g.wanderMinMs, g.wanderMaxMs) / 1000, wander);
  }

  /* ── idle fidget and breath ──────────────────────────────────────── */

  const fidgetActive = (): boolean =>
    !reducedMotion() && predicate(config, scope(), b.idleFidget.activeWhen);

  /** channel -> the ± magnitude it jitters by, and whether a pose owns it too.
   *
   *  The sway lives on a layer no pose writes, so the fidget is the only thing
   *  that can put it back. The brows are ordinary pose channels the fidget only
   *  BORROWS while curious, and that is how the original hands them over when a
   *  mood arrives: it settles its own layer to neutral and lets the pose reset
   *  the brows. A settle that fired after the mood landed would drag that mood's
   *  brows back to the idle ones half a second in. */
  const fidgetTargets = (): [string, number, boolean][] => {
    const f = b.idleFidget;
    const out: [string, number, boolean][] = config.expand(f.sway.channel)
      .map((ch) => [ch, f.sway.amplitude, false] as [string, number, boolean]);
    for (const node of f.brow.nodes) {
      out.push([`${node}.rotation`, f.brow.rotationAmplitude, true]);
      out.push([`${node}.y`, f.brow.yAmplitude, true]);
    }
    return out;
  };

  let fidgetRunning = false;

  function fidget(when: number): void {
    const f = b.idleFidget;
    if (!fidgetActive()) {
      fidgetRunning = false;
      return; // every fidget settles itself, so there is nothing to unwind
    }
    fidgetRunning = true;
    const dur = pairRange(prng, f.durationRange);
    for (const [ch, amp, poseOwned] of fidgetTargets()) {
      const base = now0(ch);
      tweens.add({ channel: ch, to: base + prng.signed(amp), duration: dur, ease: f.ease }, when);
      at(when + dur, (t) => {
        // The mood can change while a fidget is in flight. `base` is the idle
        // value this jitter started from, so once the fidget is no longer
        // active a pose-owned channel must be left where the new pose put it.
        if (poseOwned && !fidgetActive()) return;
        tweens.add({
          channel: ch, to: base,
          duration: f.settle.duration, ease: f.settle.ease,
        }, t);
      });
    }
    const gap = pairRange(prng, f.rearm.gapMs) + prng.signed(f.rearm.jitterMs);
    at(when + dur + gap / 1000, fidget);
  }

  let breathRunning = false;
  let breathUp = false;

  function breathe(when: number): void {
    const br = b.idleFidget.breath;
    if (!fidgetActive()) {
      breathRunning = false;
      for (const ch of config.expand(br.channel)) {
        tweens.add({
          channel: ch, to: br.from,
          duration: b.idleFidget.settle.duration, ease: b.idleFidget.settle.ease,
        }, when);
      }
      return;
    }
    breathRunning = true;
    breathUp = br.yoyo ? !breathUp : true;
    for (const ch of config.expand(br.channel)) {
      tweens.add({
        channel: ch, to: breathUp ? br.to : br.from,
        duration: br.duration, ease: br.ease,
      }, when);
    }
    at(when + br.duration, breathe);
  }

  /* ── mood effects ────────────────────────────────────────────────── */

  const effectLoop = (def: EffectDef): LoopDef => ({
    ...def.loop!, id: def.id, restValue: def.loop?.restValue ?? 0,
  });

  let activeEffect: string | null = null;
  const touched = new Set<string>();
  /** Which arming of the stir chain is the current one.
   *
   *  The same problem `gen` solves for an ambient loop, and the same answer.
   *  A stir chain re-arms itself through `at`, which hands back no id, so
   *  `stopEffect` cannot cancel the pending event — and `stir`'s only gate was
   *  `activeEffect !== null`, which an orphan passes whenever ANY effect is
   *  active by the time it lands, not just the one that armed it. Every mood
   *  change through an effect-bearing mood, and every reduced-motion toggle
   *  (`pollTick` runs `stopEffect` then `startEffect`), left the old chain
   *  pending and armed a new one: N transitions, N+1 chains, all of them
   *  writing the same `body.x`/`body.rotation` at fractional offsets and each
   *  cancelling the last by the newest-wins tween rule. The extra PRNG draws
   *  alone diverge the stream from every golden.
   *
   *  `asleep` reaches it on the shipped config with nothing but time:
   *  `firstDelayMs` is [4000, 7000] and `rearmMs` [4000, 8000], so
   *  `setMood("asleep")`, `setMood("idle")`, `setMood("asleep")` inside four
   *  seconds is enough.
   *
   *  A single counter rather than one per effect id: there is exactly one stir
   *  chain, because there is exactly one `activeEffect`. Every start mints a
   *  generation; every stop invalidates whatever is outstanding. */
  let effectGen = 0;

  function playSteps(
    steps: readonly EffectStep[], i: number, when: number, done: (t: number) => void,
  ): void {
    const step = steps[i];
    if (step === undefined) {
      done(when);
      return;
    }
    const dur = step.duration
      ?? (step.durationRange === undefined ? 0 : pairRange(prng, step.durationRange));
    // SORTED, and it is the PRNG that makes it matter: a `{"rnd": n}` channel
    // draws one value per channel, in walk order, so the order of this loop is
    // part of the determinism contract. JS would walk it in the JSON's own key
    // order; Swift's `Dictionary` walks it in a per-process random order. Sorting
    // is the only order both platforms can agree on, and channel names are ASCII,
    // so JS's code-unit sort and Swift's `sorted()` produce the same sequence.
    for (const ch of Object.keys(step.channels).sort()) {
      const value = step.channels[ch]!;
      const to = typeof value === "number" ? value : prng.range(-value.rnd, value.rnd);
      // EXPANDED, exactly as `settleLoop` and `armLoop` expand theirs. The
      // loader's `requireChannel` accepts a group name here — it is the same
      // check a loop's channel goes through, and a loop's channel is routinely
      // a group — so `"channel": "eye.y"` on an effect step validates cleanly.
      // Writing the raw name instead put the tween on a channel nothing
      // renders: the step was silently dead in both directions, and
      // `stopEffect` then settled that phantom to rest while the two eyes it
      // was supposed to move never learned of it.
      //
      // The draw happens ONCE, above, and every member of the group shares its
      // value — the same shape as `armLoop`, which computes one amplitude and
      // one duration and hands them to every expanded channel. Drawing per
      // member instead would make the number of PRNG values consumed depend on
      // how many members the rig's group happens to have, which is not
      // something the determinism contract can say.
      for (const concrete of config.expand(ch)) {
        touched.add(concrete);
        tweens.add({ channel: concrete, to, duration: dur, ease: step.ease }, when);
      }
    }
    // Sequential, not delayed: one tween per channel and newest wins, so two
    // steps touching the same channel must be separated by the scheduler.
    at(when + dur, (t) => playSteps(steps, i + 1, t, done));
  }

  /** The step list a branch key names, or `undefined` when this effect defines
   *  none under that name.
   *
   *  Total, and that is the whole point. The expression this replaces —
   *  `key === "drift" ? def.drift : def.twitch` — answered two different
   *  questions with one ternary and got both wrong. It mapped EVERY key that
   *  was not `"drift"` onto `twitch`, so `"branch": { "then": "twich" }` played
   *  the drift list's opposite rather than saying anything; and paired with
   *  `?? []` at the call site it made an ABSENT list indistinguishable from an
   *  authored empty one. `load.ts` validates only that a branch key spells
   *  `"twitch"` or `"drift"`, never that the list it names exists, so deleting
   *  olylo's `drift` block loads clean and then produces silence on roughly 40%
   *  of stirs — half the authored behaviour gone, with nothing anywhere saying
   *  so. */
  const stepList = (def: EffectDef, key: string): readonly EffectStep[] | undefined => {
    if (key === "twitch") return def.twitch;
    if (key === "drift") return def.drift;
    return undefined;
  };

  /** `g` is the arming this call belongs to; an orphan from an earlier one
   *  returns without drawing, scheduling or writing anything. */
  function stir(when: number, g: number): void {
    if (g !== effectGen || activeEffect === null) return;
    const def = b.moodEffects[activeEffect];
    if (def === undefined) return;
    const key = def.branch === undefined
      ? "twitch"
      : (prng.chance(def.branch.probability) ? def.branch.then : def.branch.else);
    // A branch naming a list this effect does not define ENDS the chain, and
    // the difference from `?? []` is the re-arm. `?? []` played nothing and then
    // armed the next stir anyway, so the chain went on drawing a branch value
    // and a re-arm gap forever for a behaviour that could never happen: an
    // intermittent silence that also walks the shared PRNG stream out of step
    // with every golden, which is the worst of the available failures because it
    // is invisible in both directions. Stopping is visible — the effect goes
    // quiet outright, at once, the first time the bad branch is drawn — and it
    // consumes nothing further.
    //
    // An authored EMPTY list is a different thing and keeps its old behaviour:
    // `stepList` hands back `[]`, `playSteps` completes immediately, and the
    // chain re-arms. Absent and empty were the two cases `?? []` collapsed
    // together.
    const steps = stepList(def, key);
    if (steps === undefined) return;
    playSteps(steps, 0, when, (t) => {
      // Checked again here, not only at the top: `playSteps` walks the steps
      // through the scheduler, so seconds can pass between the two and the
      // effect can be stopped in between.
      if (g !== effectGen) return;
      const r = def.rearmMs;
      if (r !== undefined) at(t + pairRange(prng, r) / 1000, (t2) => stir(t2, g));
    });
  }

  /** Every channel the running effect moved, tweened back to the rig's rest.
   *
   *  One function rather than a loop inside `stopEffect`, because `touched` is a
   *  record of channels that are OFF REST, and every place that record is
   *  dropped owes the same settle first. `startEffect` used to drop it with a
   *  bare `touched.clear()`: a `stop()` that left a twitch standing on
   *  `spark.x` at 0.7, followed by a `start()`, erased the only note of where
   *  that channel had been taken, and nothing put it back for the life of the
   *  session.
   *
   *  Sorted too, though nothing here depends on it: no PRNG is drawn, and every
   *  channel gets exactly one tween at the same instant, so the order is
   *  unobservable. It is sorted so that the Swift port — where an unsorted walk
   *  IS a bug waiting for the day someone adds a draw — can be a transcription
   *  rather than a judgement call. */
  const settleTouched = (when: number, settle: { duration: number; ease: string }): void => {
    for (const ch of [...touched].sort()) {
      tweens.add({
        channel: ch, to: rest(ch),
        duration: settle.duration, ease: settle.ease,
      }, when);
    }
    touched.clear();
  };

  const startEffect = (m: string, when: number): void => {
    const def = b.moodEffects[m];
    if (def === undefined) return;
    // SETTLED, not merely forgotten. On the ordinary path `pollTick` has just
    // run `stopEffect`, so `touched` is already empty and this writes nothing —
    // which is why no golden moves. The path that is not ordinary is `stop()`
    // then `start()`: `stop` used to leave `touched` populated and
    // `activeEffect` null, so `stopEffect` could never claim those channels
    // again, and the `touched.clear()` that stood here was the moment the engine
    // forgot a channel it had walked off rest. `stop` now puts them back itself,
    // and this is the second door onto the same record — a `start` called twice
    // without a `stop` between.
    //
    // The NEW effect's settle timing, because it is the only one still in reach:
    // whichever effect took those channels off rest is gone, and the alternative
    // is the raw write `stop` uses, which would pop mid-session.
    settleTouched(when, def.settle);
    activeEffect = m;
    effectGen += 1;
    const g = effectGen;
    if (def.once !== undefined) playSteps(def.once, 0, when, () => {});
    if (def.loop !== undefined) armLoop(effectLoop(def), when);
    if (def.firstDelayMs !== undefined) {
      at(when + pairRange(prng, def.firstDelayMs) / 1000, (t) => stir(t, g));
    }
  };

  const stopEffect = (when: number): void => {
    if (activeEffect === null) return;
    const def = b.moodEffects[activeEffect];
    activeEffect = null;
    effectGen += 1; // orphan any pending stir event, mid-chain or re-arming
    if (def === undefined) return;
    // Through `stopLoop`, not by hand: an effect's loop is a chain like any
    // other, so its pending event needs orphaning too (see `gen`).
    if (def.loop !== undefined) stopLoop(effectLoop(def), when);
    settleTouched(when, def.settle);
  };

  /* ── pinpricks ───────────────────────────────────────────────────── */

  let pinpricksShown: boolean | null = null;

  const pinprickTick = (when: number): void => {
    const p = b.pinpricks;
    const show = predicate(config, scope(), p.shownWhen);
    if (show === pinpricksShown) return;
    pinpricksShown = show;
    for (const node of p.nodes) {
      const ch = `${node}.alpha`;
      tweens.add({
        channel: ch, to: show ? p.alpha : rest(ch),
        duration: show ? p.showDuration : p.hideDuration, ease: p.ease,
      }, when);
    }
  };

  /* ── muttering ───────────────────────────────────────────────────── */

  function mutterTick(when: number): void {
    if (b.speech.loopingIn.includes(mood())) mutter(when);
    at(when + b.speech.mutterMs / 1000, mutterTick);
  }

  /* ── the one poll ────────────────────────────────────────────────── */

  let lastMood: string | null = null;
  let lastReduced = false;
  let pollId: number | null = null;

  const pollTick = (when: number): void => {
    const m = mood();
    const reduced = reducedMotion();
    const s = scope();
    // The ambient loops are settled BEFORE the mood block claims their channels,
    // and that order is the original's: `applyPose` settled `face.y` first and
    // only then did the expression register its sag, so the sag's tween is the
    // newer one and wins. Run the mood block first and the settle, being newer,
    // would cancel a sag armed microseconds earlier — leaving `face.y` flat for
    // a whole 3.5s cycle until the sag's own chain re-armed.
    for (const loop of b.loops) {
      // Symmetric, and it has to be: `armLoop` can only stop a loop from inside
      // its own chain, one whole cycle after the amplitude went to zero — up to
      // 1.05s for the sway. The original stopped it the instant the pose applied,
      // by killing the loops `applyPose` had returned. The poll is 400ms, so
      // testing both directions here is what keeps the settle inside a delay the
      // original would recognise.
      if (suppressed(loop, s)) {
        freezeLoop(loop);
      } else if (loopLive(loop, s)) {
        if (running.get(loop.id) !== true) armLoop(loop, when);
      } else {
        stopLoop(loop, when);
      }
    }
    // Reduced motion is treated exactly like a mood change, and that is the
    // whole of the mood-effect gate. `armLoop` gates a loop-shaped effect, but a
    // once-shaped one (`sadDroop`) and a stir chain (`asleepStir`) reach their
    // channels through `playSteps`, which has no gate of its own — so under
    // reduced motion the sleeping body went on twitching. Stopping the effect
    // rather than gating each shape settles every channel it touched through the
    // path that already exists, and restarting it from the top when the setting
    // clears replays the once-steps too, which a per-shape flag would not.
    if (m !== lastMood || reduced !== lastReduced) {
      // The instant a mood shuts the eyes, the gaze goes dead still: irises
      // centred, head level, glyph re-centred. Nothing else would do it — a
      // pose draws nodes, and tilt and lean are layers no pose owns — so a head
      // the pointer had turned would stay turned for the whole sleep. The
      // original reaches the same state by re-running `useGaze`, whose
      // `eyesShut` branch zeroes all three before it returns.
      const shutDef = b.gaze.disabledWhen;
      // `start` always sets `lastMood` before the first poll can run, so the
      // null here is a type, not a state — but naming it is cheaper than a cast.
      const was = lastMood;
      if (shutDef !== undefined && was !== null
        && predicate(config, { mood: m }, shutDef)
        && !predicate(config, { mood: was }, shutDef)) {
        lookAt(when, 0, 0);
        tiltTo(when, 0);
        leanTo(when, 0, 0);
      }
      stopEffect(when);
      lastMood = m;
      lastReduced = reduced;
      if (!reduced) startEffect(m, when);
    }
    if (activeEffect !== null) {
      const def = b.moodEffects[activeEffect];
      if (def?.loop !== undefined) {
        const loop = effectLoop(def);
        if (running.get(loop.id) !== true) armLoop(loop, when);
      }
    }
    if (!fidgetRunning && fidgetActive()) fidget(when);
    if (!breathRunning && fidgetActive()) breathe(when);
    pinprickTick(when);
  };

  return {
    start(when) {
      lastMood = mood();
      lastReduced = reducedMotion();
      for (const loop of b.loops) armLoop(loop, when);
      breathe(when);
      fidget(when);
      armBlink(when);
      at(when + b.gaze.wanderAfterMs / 1000, wander);
      at(when + b.speech.mutterMs / 1000, mutterTick);
      if (!lastReduced) startEffect(lastMood, when);
      pinprickTick(when);
      // `first` is absolute, so an omitted one means "0.4", not "0.4 later".
      // This arms in the MIDDLE of a run — `when` is whatever moment the mood
      // changed at — so an unanchored deadline is one that went by long ago, and
      // the scheduler's catch-up loop runs to its 1000-iteration guard instead
      // of the poll: ~1000 spurious polls and a visible hitch.
      //
      // Cancelled first, because a second `start` without a `stop` between — a
      // remount, a re-`play` of the whole engine — would otherwise overwrite
      // `pollId` and leave the first repeater running with nothing holding its
      // id. Two polls means every mood change is serviced twice, and the count
      // climbs with each restart.
      if (pollId !== null) scheduler.cancel(pollId);
      pollId = scheduler.every(poll, pollTick, { first: when + poll });
    },

    look(x, y, when) {
      target = [clamp1(x), clamp1(y)];
      pointerAt = when;
      applyGaze(when);
    },

    stop() {
      for (const id of pending) scheduler.cancel(id);
      pending.clear();
      if (pollId !== null) scheduler.cancel(pollId);
      pollId = null;
      running.clear();
      fidgetRunning = false;
      breathRunning = false;
      activeEffect = null;
      effectGen += 1; // orphan any pending stir event, as `stopEffect` does
      // Every channel the effect walked off rest, put back THIS instant.
      //
      // `stop` has no clock — it is teardown, not a moment on the timeline — so
      // the restore is `cancel` then a raw write rather than a settle tween,
      // exactly the way `TimelineHandle.cancel` hands a promoted shape back, and
      // for the same reason: the tween still driving the channel would otherwise
      // overwrite the value before anything saw it.
      //
      // Leaving `touched` populated here was the leak. `activeEffect` is null
      // from this line on, so `stopEffect` returns at its guard and can never
      // reclaim these channels; the next `startEffect` cleared the record
      // outright. A twitch caught mid-stroke therefore stranded `spark.x` at 0.7
      // for the life of the process, with nothing left that knew it was there.
      for (const ch of [...touched].sort()) {
        tweens.cancel(ch);
        channels.set(ch, rest(ch));
      }
      touched.clear();
    },
  };
}
