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
 * The per-channel delay ladder. The face does not snap into a mood all at once:
 * eyes lead, antennae follow at 40 ms, brows at 60 ms, and colour/mouth at 80 ms.
 * That stagger is most of why the original reads as alive, so it lives in data
 * (`behavior.json.channelDelays`) and is matched here rather than re-invented.
 */
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

  for (const [channel, target] of Object.entries(pose.channels)) {
    for (const concrete of config.expand(channel)) {
      tweens.add({
        channel: concrete,
        to: target as ChannelValue,
        duration,
        delay: channelDelay(config, concrete),
        ease,
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
  // the channel is right now: `silly` sets body.rotation to 180 and spins one
  // turn on top, so the tween runs to 540 and normalises back to 180 — the pose
  // still lands upside down. Starting from `current` would make a second spin
  // during the first one land somewhere the goldens could not predict.
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
