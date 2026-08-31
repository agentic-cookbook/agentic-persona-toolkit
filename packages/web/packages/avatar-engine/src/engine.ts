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
  const scene = buildScene(config);
  const scheduler = createScheduler();
  const tweens = createTweens(channels);
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
    idleRung: () => arbiter.state().idleRung,
    // Reduced motion is its own switch, not a rung trick. Pinning the rung to 0
    // would read as *curious*, which is precisely when the idle fidget is most
    // active — the opposite of what the preference asks for.
    reducedMotion: () => env.reducedMotion(),
    // The reflexes own the clock and the PRNG; the arbiter owns what a bubble is.
    mutter: (now) => arbiter.say(pickSaying(), now),
  });

  let started = false;

  return {
    tick(now) {
      if (!started) {
        started = true;
        // Arbiter first, and not for tidiness: registration order is scheduler
        // id order is fire order, so the ladder must settle the opening mood
        // before the reflexes' first poll reads it.
        arbiter.start(now);
        reflexes.start(now);
      }
      // Fixed order, and the same four on every platform: the scheduler fires
      // this frame's events, the arbiter reads the mood they set, the tweens
      // advance to `now`, and only then is the frame composed. Reorder any pair
      // and the two implementations stop producing the same golden.
      scheduler.tick(now);
      arbiter.tick(now);
      tweens.tick(now);
      return compose(scene, channels);
    },

    setMood: (mood) => arbiter.setMood(mood, env.now()),
    notice: () => arbiter.notice(env.now()),
    look: (x, y) => reflexes.look(x, y, env.now()),
    poke: () => arbiter.poke(env.now()),
    say: (text) => arbiter.say(text, env.now()),
    play: (name) => {
      playTimeline({ config, channels, tweens, scheduler }, name, env.now());
    },

    randomSaying: pickSaying,

    state: () => arbiter.state(),
    channels: () => channels,
  };
}
