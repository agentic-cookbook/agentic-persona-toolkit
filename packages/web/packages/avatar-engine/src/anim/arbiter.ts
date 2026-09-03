import type { CharacterConfig } from "../config/types";
import type { Channels } from "../runtime/channels";
import type { Scheduler } from "../runtime/scheduler";
import type { Tweens } from "../runtime/tween";
import { applyPose } from "./pose";
import { playTimeline, type TimelineHandle } from "./timeline";

export type MoodSource = "app" | "idle" | "poke" | "waking";

export interface ArbiterState {
  mood: string;
  source: MoodSource;
  speech: { text: string; until: number } | null;
  idleRung: number;
  lastInteraction: number;
}

export interface ArbiterDeps {
  config: CharacterConfig;
  channels: Channels;
  tweens: Tweens;
  scheduler: Scheduler;
}

export interface Arbiter {
  state(): Readonly<ArbiterState>;
  start(now: number): void;
  setMood(mood: string | null, now: number): void;
  notice(now: number): void;
  poke(now: number): void;
  say(text: string, now: number): void;
  play(name: string, now: number): void;
  tick(now: number): void;
}

export function createArbiter(deps: ArbiterDeps): Arbiter {
  const { config, channels, tweens, scheduler } = deps;
  const b = config.behavior;
  const ladder = b.ladder;
  const poll = ladder.pollMs / 1000;

  // `ladder.moods` is a record because the JSON reads better that way; every
  // other line of code wants an ordered array, because a rung IS an index.
  const RUNGS: readonly { after: number; mood: string }[] = [
    { after: 0, mood: ladder.moods.active! },
    { after: ladder.boredAfterMs / 1000, mood: ladder.moods.bored! },
    { after: ladder.asleepAfterMs / 1000, mood: ladder.moods.asleep! },
  ];

  const bubble = b.speech.bubble;
  const speechLife = bubble.in.duration + bubble.out.delay + bubble.out.duration;

  let appMood: string | null = null;
  let pokeMood = RUNGS[0]!.mood;
  let pokeUntil = -Infinity;
  let wakeUntil = -Infinity;
  let alertUntil = -Infinity;
  let lastInteraction = 0;
  let speech: ArbiterState["speech"] = null;

  let current = RUNGS[0]!.mood;
  let source: MoodSource = "idle";
  let rung = 0;
  let applied = false;
  let pollId: number | null = null;
  let choreo: TimelineHandle | null = null;

  const rungFor = (now: number): number => {
    // The typing pin holds the rung down WITHOUT touching lastInteraction, so
    // when it lapses the ladder resumes from the real last interaction.
    if (now < alertUntil) return 0;
    const idle = now - lastInteraction;
    let found = 0;
    for (let i = 0; i < RUNGS.length; i += 1) if (idle >= RUNGS[i]!.after) found = i;
    return found;
  };

  const resolve = (now: number): { mood: string; source: MoodSource; rung: number } => {
    const r = rungFor(now);
    if (now < pokeUntil) return { mood: pokeMood, source: "poke", rung: r };
    if (appMood !== null) return { mood: appMood, source: "app", rung: r };
    // `waking.play`, NOT `waking.to`. The wake transition IS a mood for its
    // whole window — that is what lets blink suppression, the pinpricks and
    // every other mood-keyed reflex see the yawn. `waking.to` is where the
    // ladder lands once the window lapses, and it gets there on its own.
    if (now < wakeUntil) return { mood: b.waking.play, source: "waking", rung: r };
    return { mood: RUNGS[r]!.mood, source: "idle", rung: r };
  };

  const evaluate = (now: number): void => {
    const next = resolve(now);
    rung = next.rung;
    source = next.source;
    // `!applied` is the startup case and it matters: rest comes from the rig,
    // not from a pose, so without it the opening mood would never be painted.
    if (!applied || next.mood !== current) {
      applied = true;
      current = next.mood;
      // Leaving a choreographed mood cancels whatever of its timeline has not
      // fired yet, so a poke mid-yawn does not get the yawn's remaining steps
      // dropped on top of the pose it just asked for. Unfired one-shots are the
      // only state a timeline holds; the tweens it already started are cancelled
      // the ordinary way, by the next tween on the same channel.
      if (choreo !== null) { choreo.cancel(); choreo = null; }
      const timeline = b.choreography?.[current];
      if (timeline !== undefined) {
        // A choreographed mood skips its pose entirely. The timeline is the
        // whole performance — it opens the mouth, holds it, and walks every
        // channel it touched back to rest — so applying the pose as well would
        // fight it for the same channels from the first frame.
        choreo = playTimeline({ config, channels, tweens, scheduler }, timeline, now);
      } else {
        const result = applyPose({ config, channels, tweens }, current, now);
        if (result.resetAt) {
          const { at, channel, value } = result.resetAt;
          // A zero-duration tween, NOT channels.set. The one-shot fires inside
          // scheduler.tick, which runs before tweens.tick on the same frame, so a
          // raw write would be overwritten by the spin tween's own final value.
          // Going through `add` cancels that tween (newest wins) and writes the
          // normalised value verbatim, both by rules the tween engine already has.
          scheduler.once(at, (fired) => {
            tweens.add({ channel, to: value, duration: 0 }, fired);
          });
        }
      }
    }
    if (speech && now >= speech.until) speech = null;
  };

  return {
    state: () => ({ mood: current, source, speech, idleRung: rung, lastInteraction }),

    start(now) {
      // Evaluate once so the opening mood is painted on frame 1, then hand the
      // cadence to the scheduler — that, and not the poll interval itself, is
      // what makes the evaluation instants frame-rate independent.
      //
      // `first` is absolute and MUST be anchored on `now`. Omitting it sets the
      // first instant to the INTERVAL (0.4) on the engine's own clock, which is
      // the same instant only when `start` runs at zero. It does today — Ruling
      // 48 normalises the clock to the first frame — but `start` is public and
      // re-callable, and the identical spelling in the reflexes re-arms in the
      // middle of a run, where an unanchored deadline is one already in the past
      // and the catch-up loop runs instead of the poll. One rule, both places.
      evaluate(now);
      if (pollId !== null) scheduler.cancel(pollId);
      pollId = scheduler.every(poll, (at) => evaluate(at), { first: now + poll });
    },

    setMood(mood, now) {
      // The only unvalidated string that reaches this arbiter — every other
      // mood it can resolve to (the three rungs, every poke expression, the
      // waking mood) was checked against `poses.json` by the loader. Refusing
      // it HERE, before a single field is committed, is what keeps `evaluate`
      // honest: `evaluate` runs from inside `scheduler.tick` as well as from
      // this call, and a throw from there escapes `engine.tick` and takes the
      // host's frame loop with it. Committing `appMood` first and letting
      // `applyPose` throw is worse still — the state says the mood applied, so
      // every later `evaluate` short-circuits on `next.mood !== current` and
      // paints nothing at all, until the first one that does not short-circuit
      // throws out of a tick nobody called.
      //
      // Byte-identical message to `applyPose`'s, so the two doors fail the same
      // way, and identical to Swift's `Arbiter.setMood`.
      if (mood !== null && config.poses.poses[mood] === undefined) {
        throw new Error(`unknown mood: ${mood}`);
      }
      appMood = mood;
      evaluate(now);
    },

    notice(now) {
      // Opening the window is all this does: `evaluate` below resolves to
      // `waking.play` and choreography plays its timeline, the same way it
      // would for a mood reached any other route.
      if (current === b.waking.from) wakeUntil = now + b.waking.ms / 1000;
      lastInteraction = now;
      evaluate(now);
    },

    poke(now) {
      // First matching rule wins; "*" is a rule like any other and sits last in
      // the JSON, so the specific `from` cases are reached first. No branch here.
      const rule = b.poke.find((r) => r.from === current)
        ?? b.poke.find((r) => r.from === "*");
      if (rule !== undefined) {
        pokeMood = rule.expression;
        pokeUntil = now + rule.ms / 1000;
      }
      lastInteraction = now;
      evaluate(now);
    },

    say(text, now) {
      speech = { text, until: now + speechLife };
      alertUntil = now + ladder.alertAfterTypingMs / 1000;
    },

    /**
     * Play a timeline by name, on the engine's ONE timeline slot.
     *
     * The slot is the same field a choreographed mood uses, and sharing it is
     * the point rather than a saving. A timeline is not a private animation: it
     * snaps engine-managed `.family` channels and rewrites the shapes beside
     * them, and only its own handle knows how to hand either back. Two of them
     * standing at once means the second reads channels the first has already
     * moved — `play("yawn")` twice half a second apart, or `play("yawn")`
     * followed by `setMood("yawning")`, both landed a second promote on an
     * already-promoted mouth and threw out of `engine.tick`.
     *
     * Cancelling first is therefore the whole fix, and putting the handle where
     * `evaluate` already looks is what extends it across the two doors: a mood
     * change cancels a hand-played timeline exactly as it cancels a
     * choreographed one, which is also the behaviour a caller wants — leaving
     * the mood a timeline was performing should not leave the timeline running.
     */
    play(name, now) {
      if (choreo !== null) { choreo.cancel(); choreo = null; }
      choreo = playTimeline({ config, channels, tweens, scheduler }, name, now);
    },

    tick(now) {
      // The ladder is not evaluated here — `start` gave that to the scheduler.
      // What is left are the three hard deadlines, checked every frame because
      // letting a poke outlive its window by up to 400 ms reads as a stuck
      // expression. They are releases, so a frame of jitter is the cheap side of
      // that trade; see the prose above.
      if (
        (source === "poke" && now >= pokeUntil) ||
        (source === "waking" && now >= wakeUntil) ||
        (speech !== null && now >= speech.until)
      ) {
        evaluate(now);
      }
    },
  };
}
