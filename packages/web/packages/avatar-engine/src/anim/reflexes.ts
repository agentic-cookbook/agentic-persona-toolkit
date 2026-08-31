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
  idleRung: () => number;
  reducedMotion: () => boolean;
  mutter: (now: number) => void;
}

export interface Reflexes {
  start(now: number): void;
  look(x: number, y: number, now: number): void;
  stop(): void;
}

const clamp1 = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v);

export function createReflexes(deps: ReflexDeps): Reflexes {
  const { config, channels, tweens, scheduler, prng } = deps;
  const { mood, idleRung, reducedMotion, mutter } = deps;
  const b = config.behavior;
  const poll = b.ladder.pollMs / 1000;

  const scope = (): ParamScope => ({ mood: mood(), idleRung: idleRung() });
  const rest = (channel: string): number => (config.rest.get(channel) as number) ?? 0;
  const now0 = (channel: string): number => (channels.get(channel) as number) ?? rest(channel);

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
   *  Reachable whenever a loop's period exceeds `pollMs`: the sways are 0.97s
   *  with their delay against a 400ms poll, and 0.97 and 0.4 share no useful
   *  factor, so the two cadences drift into that window on their own.
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

  function armLoop(loop: LoopDef, when: number): void {
    const s = scope();
    if (!loopLive(loop, s)) {
      stopLoop(loop, when);
      return; // the poll re-arms it; nothing idles in a chain it cannot use
    }
    running.set(loop.id, true);
    const sign = signs.get(loop.id) ?? (loop.phase === "negativeFirst" ? -1 : 1);
    const amp = amplitude(config, s, loop.amplitude);
    const dur = amplitude(config, s, loop.duration);
    const to = loop.mode === "symmetric"
      ? sign * amp
      : (sign > 0 ? amp : loop.restValue);
    const delay = loop.delay ?? 0;
    for (const ch of config.expand(loop.channel)) {
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

  function armBlink(when: number): void {
    at(when + prng.range(b.blink.minMs, b.blink.maxMs) / 1000, blink);
  }

  function blink(when: number): void {
    if (!b.blink.suppressedIn.includes(mood())) {
      for (const ch of config.expand(b.blink.channel)) {
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
    }
    armBlink(when);
  }

  /* ── gaze ────────────────────────────────────────────────────────── */

  let target: readonly [number, number] = [0, 0];
  let pointerAt = -Infinity;

  const applyGaze = (when: number): void => {
    const g = b.gaze;
    if (g.disabledWhen !== undefined && predicate(config, scope(), g.disabledWhen)) return;
    const [tx, ty] = target;
    // Dispatched on the channel's suffix, never on its index: the four `look`
    // channels are two eyes × two axes, and an index would silently swap them
    // the day a third eye or a different order appears in the rig.
    for (const ch of g.look.channels) {
      tweens.add({
        channel: ch, to: (ch.endsWith(".y") ? ty : tx) * g.gazeMax,
        duration: g.look.duration, ease: g.look.ease,
      }, when);
    }
    tweens.add({
      channel: g.tilt.channel, to: tx * g.tiltMax,
      duration: g.tilt.duration, ease: g.tilt.ease,
    }, when);
    for (const ch of g.lean.channels) {
      tweens.add({
        channel: ch, to: (ch.endsWith(".y") ? ty : tx) * g.leanMax,
        duration: g.lean.duration, ease: g.lean.ease,
      }, when);
    }
  };

  function wander(when: number): void {
    const g = b.gaze;
    if (when - pointerAt >= g.wanderAfterMs / 1000) {
      const curious = predicate(config, scope(), "curious");
      if (prng.chance(curious ? g.centreChanceCurious : g.centreChanceIdle)) {
        target = [0, 0];
      } else {
        const reach = curious ? g.reachCurious : g.reachIdle;
        const angle = prng.range(0, Math.PI * 2);
        const r = prng.range(reach[0], reach[1]);
        target = [Math.cos(angle) * r, Math.sin(angle) * r];
      }
      applyGaze(when);
    }
    at(when + prng.range(g.wanderMinMs, g.wanderMaxMs) / 1000, wander);
  }

  /* ── idle fidget and breath ──────────────────────────────────────── */

  const fidgetActive = (): boolean =>
    !reducedMotion() && predicate(config, scope(), b.idleFidget.activeWhen);

  /** channel -> the ± magnitude it jitters by. */
  const fidgetTargets = (): [string, number][] => {
    const f = b.idleFidget;
    const out: [string, number][] = config.expand(f.sway.channel)
      .map((ch) => [ch, f.sway.amplitude] as [string, number]);
    for (const node of f.brow.nodes) {
      out.push([`${node}.rotation`, f.brow.rotationAmplitude]);
      out.push([`${node}.y`, f.brow.yAmplitude]);
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
    const dur = prng.range(f.durationRange[0], f.durationRange[1]);
    for (const [ch, amp] of fidgetTargets()) {
      const base = now0(ch);
      tweens.add({ channel: ch, to: base + prng.signed(amp), duration: dur, ease: f.ease }, when);
      at(when + dur, (t) => {
        tweens.add({
          channel: ch, to: base,
          duration: f.settle.duration, ease: f.settle.ease,
        }, t);
      });
    }
    const gap = prng.range(f.rearm.gapMs[0], f.rearm.gapMs[1]) + prng.signed(f.rearm.jitterMs);
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

  function playSteps(
    steps: readonly EffectStep[], i: number, when: number, done: (t: number) => void,
  ): void {
    const step = steps[i];
    if (step === undefined) {
      done(when);
      return;
    }
    const dur = step.duration
      ?? (step.durationRange === undefined
        ? 0
        : prng.range(step.durationRange[0], step.durationRange[1]));
    // SORTED, and it is the PRNG that makes it matter: a `{"rnd": n}` channel
    // draws one value per channel, in walk order, so the order of this loop is
    // part of the determinism contract. JS would walk it in the JSON's own key
    // order; Swift's `Dictionary` walks it in a per-process random order. Sorting
    // is the only order both platforms can agree on, and channel names are ASCII,
    // so JS's code-unit sort and Swift's `sorted()` produce the same sequence.
    for (const ch of Object.keys(step.channels).sort()) {
      const value = step.channels[ch]!;
      const to = typeof value === "number" ? value : prng.range(-value.rnd, value.rnd);
      touched.add(ch);
      tweens.add({ channel: ch, to, duration: dur, ease: step.ease }, when);
    }
    // Sequential, not delayed: one tween per channel and newest wins, so two
    // steps touching the same channel must be separated by the scheduler.
    at(when + dur, (t) => playSteps(steps, i + 1, t, done));
  }

  function stir(when: number): void {
    if (activeEffect === null) return;
    const def = b.moodEffects[activeEffect];
    if (def === undefined) return;
    const key = def.branch === undefined
      ? "twitch"
      : (prng.chance(def.branch.probability) ? def.branch.then : def.branch.else);
    const steps = key === "drift" ? def.drift : def.twitch;
    playSteps(steps ?? [], 0, when, (t) => {
      const r = def.rearmMs;
      if (r !== undefined) at(t + prng.range(r[0], r[1]) / 1000, stir);
    });
  }

  const startEffect = (m: string, when: number): void => {
    const def = b.moodEffects[m];
    if (def === undefined) return;
    activeEffect = m;
    touched.clear();
    if (def.once !== undefined) playSteps(def.once, 0, when, () => {});
    if (def.loop !== undefined) armLoop(effectLoop(def), when);
    if (def.firstDelayMs !== undefined) {
      at(when + prng.range(def.firstDelayMs[0], def.firstDelayMs[1]) / 1000, stir);
    }
  };

  const stopEffect = (when: number): void => {
    if (activeEffect === null) return;
    const def = b.moodEffects[activeEffect];
    activeEffect = null;
    if (def === undefined) return;
    // Through `stopLoop`, not by hand: an effect's loop is a chain like any
    // other, so its pending event needs orphaning too (see `gen`).
    if (def.loop !== undefined) stopLoop(effectLoop(def), when);
    // Sorted too, though nothing here depends on it: no PRNG is drawn, and every
    // channel gets exactly one tween at the same instant, so the order is
    // unobservable. It is sorted so that the Swift port — where an unsorted walk
    // IS a bug waiting for the day someone adds a draw — can be a transcription
    // rather than a judgement call.
    for (const ch of [...touched].sort()) {
      tweens.add({
        channel: ch, to: rest(ch),
        duration: def.settle.duration, ease: def.settle.ease,
      }, when);
    }
    touched.clear();
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
      if (loopLive(loop, s)) {
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
      // `first` is absolute, so an omitted one means "0.4", not "0.4 from now".
      // Under a host clock in the hundreds of thousands of seconds that is a
      // million catch-up iterations on the first tick, capped by the scheduler's
      // 1000-iteration guard into ~1000 spurious polls and a visible hitch.
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
    },
  };
}
