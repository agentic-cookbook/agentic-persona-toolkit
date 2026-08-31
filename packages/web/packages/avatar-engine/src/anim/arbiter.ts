import type { CharacterConfig } from "../config/types";
import type { Channels } from "../runtime/channels";
import type { Scheduler } from "../runtime/scheduler";
import type { Tweens } from "../runtime/tween";
import { applyPose } from "./pose";
import { playTimeline } from "./timeline";

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
    if (now < wakeUntil) return { mood: b.waking.to, source: "waking", rung: r };
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
      appMood = mood;
      evaluate(now);
    },

    notice(now) {
      if (current === b.waking.from) {
        wakeUntil = now + b.waking.ms / 1000;
        playTimeline({ config, channels, tweens, scheduler }, b.waking.play, now);
      }
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
