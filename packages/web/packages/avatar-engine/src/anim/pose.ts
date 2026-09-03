import type { CharacterConfig } from "../config/types";
import type { Channels, ChannelValue } from "../runtime/channels";
import type { Tweens } from "../runtime/tween";

export interface PoseContext {
  config: CharacterConfig;
  channels: Channels;
  tweens: Tweens;
}

export interface PoseResult {
  resetAt?: { at: number; channel: string; value: number };
}

/**
 * The node half of a `node.prop` channel name.
 *
 * Exported rather than local: `timeline.ts` needs it too, to find the `.family`
 * channel a timeline step's node owns, and a second copy there is a second place
 * for the two files to disagree about what a node name is. Swift's `nodeOf` in
 * `Poses.swift` is the same function for the same reason, and the two must agree.
 *
 * A name with no dot is returned whole. `slice(0, indexOf("."))` would instead
 * silently drop the last character — turning `mouth` into `mout`, a node name
 * that resolves to nothing but could collide with a real one.
 */
export function nodeOf(channel: string): string {
  const dot = channel.indexOf(".");
  return dot === -1 ? channel : channel.slice(0, dot);
}

/**
 * The per-channel delay ladder. The face does not snap into a mood all at once:
 * some parts lead and others lag, creating an animation that reads as alive and
 * intentional rather than mechanical. The whole ladder lives in data
 * (`behavior.json.channelDelays`) rather than hard-coded here, and exact
 * channel matches take precedence over node-level entries so individual channels
 * can be singled out for special timing.
 */
export function channelDelay(config: CharacterConfig, channel: string): number {
  const table = config.behavior.channelDelays;
  // Exact channel wins over the node, so `body.ink` can lag while `body.rotation`
  // does not. Anything unlisted is 0 — the eyes lead, and they lead by default.
  const exact = table[channel];
  if (exact !== undefined) return exact;
  return table[nodeOf(channel)] ?? 0;
}

export function applyPose(ctx: PoseContext, mood: string, now: number): PoseResult {
  const { config, channels, tweens } = ctx;
  const pose = config.poses.poses[mood];
  if (!pose) throw new Error(`unknown mood: ${mood}`);

  // Duration and ease are per-pose and REQUIRED (Task 3) — a snappy `startled`
  // and a slow `sad` are the character, so there is no global to fall back to.
  const { duration, ease } = pose;

  /** Channels the spin re-times, and the timing each inherits.
   *
   *  A node has ONE transform matrix, so a scale stated alongside a whirl is not
   *  a second animation running beside it — it is the same animation, and it
   *  moves at the whirl's pace. Without this, a spinning pose reaches its scale
   *  in the pose's own duration while the spin is still a third of the way
   *  round, and the body is visibly too big for most of the transition.
   *
   *  Naming the channels in data rather than inferring them keeps the rule
   *  anatomy-agnostic: nothing here has to know that a scale and a rotation
   *  happen to share a matrix in SVG. */
  const carried = new Map<string, { duration: number; ease: string }>();
  if (pose.spin?.carries) {
    const timing = { duration: pose.spin.duration, ease: pose.spin.ease };
    for (const name of pose.spin.carries) {
      for (const concrete of config.expand(name)) carried.set(concrete, timing);
    }
  }

  // `Object.keys(...).sort()`, never a bare `Object.entries(...)`: this walks in
  // JSON insertion order, where Swift's `pose.channels.keys.sorted()` walks
  // sorted (Task 28, rule 5). The two agree only until one pose writes both a
  // group and one of its members — `eyes.y` and `eyeLeft.y` — at which point
  // newest-wins resolves differently on each platform and the byte-identical
  // golden contract is gone. 14 of olylo's 15 poses already have JSON order !=
  // sorted order, so the divergence is one authored line away.
  for (const channel of Object.keys(pose.channels).sort()) {
    const target = pose.channels[channel]!;
    for (const concrete of config.expand(channel)) {
      const rides = carried.get(concrete);
      tweens.add({
        channel: concrete,
        to: target as ChannelValue,
        duration: rides?.duration ?? duration,
        delay: channelDelay(config, concrete),
        ease: rides?.ease ?? ease,
      }, now);
    }
  }

  if (!pose.spin) return {};

  // A whole number of turns, then normalised back, so repeated spins never
  // accumulate into an ever-growing rotation the goldens would drift on.
  //
  // `applyPose` does NOT schedule the normalisation itself. A second tween on the
  // same channel would immediately cancel the spin (newest wins), so the reset is
  // reported to the caller and Task 17's engine hands it to the scheduler as a
  // one-shot. Keeping the one-tween-per-channel rule absolute is worth more than
  // saving a return value.
  // The spin runs from the pose's OWN target for that channel, not from wherever
  // the channel is right now. This ensures that a pose which also rotates lands
  // on its rotation plus the turns, and a second spin during the first one cannot
  // land somewhere the goldens could not predict. Starting from `current` would
  // violate this guarantee.
  // Notably, there is deliberately no call to `config.expand()` here: the loader
  // (load.ts) rejects grouped channels for spin, guaranteeing the channel is
  // concrete. Expanding it would force `resetAt` to become a list, rippling into
  // Task 17's engine and the Swift mirror for a case no character has.
  const channel = pose.spin.channel;
  const posed = pose.channels[channel];
  const from = typeof posed === "number"
    ? posed
    : ((channels.get(channel) as number | undefined) ?? 0);
  const end = from + pose.spin.turns * 360;
  tweens.add({
    channel,
    to: end,
    duration: pose.spin.duration,
    ease: pose.spin.ease,
  }, now);

  const wrapped = ((end % 360) + 360) % 360;
  return {
    resetAt: {
      at: now + pose.spin.duration,
      channel,
      value: wrapped > 180 ? wrapped - 360 : wrapped,
    },
  };
}
