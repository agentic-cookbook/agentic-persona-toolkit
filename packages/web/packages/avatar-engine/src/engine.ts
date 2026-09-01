import { createChannels, type Channels } from "./runtime/channels";
import { createScheduler } from "./runtime/scheduler";
import { createTweens } from "./runtime/tween";
import { createPrng } from "./math/prng";
import { buildScene, compose, seedChannels, type DisplayList } from "./scene/rig";
import { createArbiter, type ArbiterState } from "./anim/arbiter";
import { createReflexes } from "./anim/reflexes";
import { playTimeline } from "./anim/timeline";
import { defaultEnvironment, type Environment } from "./env";
import type { CharacterConfig } from "./config/types";

export interface EngineOptions {
  config: CharacterConfig;
  seed?: number;
  env?: Partial<Environment>;
  /** Scene-build-time rig patch, e.g. the optical cut. Defaults to the true rig. */
  variant?: string;
}

export interface Engine {
  tick(now: number): DisplayList;
  setMood(mood: string | null): void;
  notice(): void;
  look(x: number, y: number): void;
  poke(): void;
  say(text: string): void;
  play(name: string): void;
  randomSaying(mood?: string): string;
  state(): Readonly<ArbiterState>;
  channels(): Channels;
}

export function createEngine(options: EngineOptions): Engine {
  const { config } = options;
  const env: Environment = { ...defaultEnvironment, ...options.env };

  const channels = createChannels();
  seedChannels(config, channels);
  const scene = buildScene(config, options.variant);
  const scheduler = createScheduler();
  const tweens = createTweens(channels, config.respond);
  const prng = createPrng(options.seed ?? 1);

  const arbiter = createArbiter({ config, channels, tweens, scheduler });

  /** The engine's own saying picker, hoisted so the mutter callback can use it. */
  const pickSaying = (mood?: string): string => {
    const all = config.sayings.sayings;
    // `sayings.json` has a key for every pose, so this cannot legitimately miss;
    // falling back to the ladder's active mood keeps the type total without
    // inventing a `fallback` key that the schema does not have.
    const lines = all[mood ?? arbiter.state().mood]
      ?? all[config.behavior.ladder.moods.active!]!;
    return prng.pick(lines);
  };

  const reflexes = createReflexes({
    config, channels, tweens, scheduler, prng,
    mood: () => arbiter.state().mood,
    // Reduced motion is its own switch, not a mood trick. Reporting the ladder's
    // active mood would read as *curious*, which is precisely when the idle
    // fidget is most active — the opposite of what the preference asks for.
    reducedMotion: () => env.reducedMotion(),
    // The reflexes own the clock and the PRNG; the arbiter owns what a bubble is.
    mutter: (now) => arbiter.say(pickSaying(), now),
  });

  let started = false;
  /** The host's timestamp at the first frame, and the engine's own clock —
   *  seconds since that frame.
   *
   *  `tick`'s argument is the ONLY time this engine ever reads. There is no
   *  second clock: a command lands at the time of the frame that just passed,
   *  which is at most one frame early and is identically one frame early on
   *  every platform. That is the property a golden can prove. An engine that
   *  asked the host for the time separately would be exact instead, and the
   *  exactness would be worthless — the recorder that generates the goldens has
   *  no host clock to be exact about, so its commands would all land at whatever
   *  the environment's default happened to be while its frames advanced on
   *  scenario time, and every scripted command after the first would arrive
   *  already past its own deadline. That is not hypothetical: it is exactly what
   *  this engine did until Ruling 48.
   *
   *  Normalising to the first frame is the other half. A host is free to drive
   *  `tick` with `performance.now() / 1000` or `CACurrentMediaTime()` — epochs
   *  in the thousands — and a command issued before the loop's first frame still
   *  lands at 0, the start, rather than an epoch-length interval in the past. */
  let origin = 0;
  let clock = 0;

  return {
    tick(now) {
      if (!started) {
        started = true;
        origin = now;
        // Arbiter first, and not for tidiness: registration order is scheduler
        // id order is fire order, so the ladder must settle the opening mood
        // before the reflexes' first poll reads it.
        arbiter.start(0);
        reflexes.start(0);
      }
      clock = now - origin;
      // Fixed order, and the same four on every platform: the scheduler fires
      // this frame's events, the arbiter reads the mood they set, the tweens
      // advance to `now`, and only then is the frame composed. Reorder any pair
      // and the two implementations stop producing the same golden.
      scheduler.tick(clock);
      arbiter.tick(clock);
      tweens.tick(clock);
      return compose(scene, channels);
    },

    setMood: (mood) => arbiter.setMood(mood, clock),
    notice: () => arbiter.notice(clock),
    look: (x, y) => reflexes.look(x, y, clock),
    poke: () => arbiter.poke(clock),
    say: (text) => arbiter.say(text, clock),
    play: (name) => {
      playTimeline({ config, channels, tweens, scheduler }, name, clock);
    },

    randomSaying: pickSaying,

    state: () => arbiter.state(),
    channels: () => channels,
  };
}
