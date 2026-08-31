import type { CharacterConfig } from "../config/types";
import type { Channels } from "../runtime/channels";
import type { Scheduler } from "../runtime/scheduler";
import type { Tweens } from "../runtime/tween";
import { nodeOf } from "./pose";

export interface TimelineContext {
  config: CharacterConfig;
  channels: Channels;
  tweens: Tweens;
  scheduler: Scheduler;
}

export interface TimelineHandle {
  name: string;
  startedAt: number;
  endsAt: number;
  cancel(): void;
}

/**
 * Expand a declarative timeline into scheduled tweens.
 *
 * Each step is scheduled as a one-shot at `startedAt + step.at`, which then adds
 * the tween. Scheduling the tween at its own moment (rather than adding every
 * tween up front with a long delay) is what lets a step read the channel's value
 * as it actually is when the step fires — the yawn's return-to-rest steps depend
 * on that, and it is also what makes cancellation clean: an unfired one-shot is
 * simply removed.
 *
 * Timelines deliberately do NOT apply the pose delay ladder. A timeline author
 * has already placed every step in time; adding 40-80ms of stagger on top would
 * smear the yawn's phases.
 */
export function playTimeline(
  ctx: TimelineContext,
  name: string,
  now: number,
  onDone?: () => void,
): TimelineHandle {
  const { config, channels, tweens, scheduler } = ctx;
  const timeline = config.timelines.timelines[name];
  if (!timeline) throw new Error(`unknown timeline: ${name}`);

  const ids: number[] = [];

  // Authored order, front to back. Scheduler ids are monotonic and `tick` walks
  // them in that order, so insertion order IS firing order among events that come
  // due in the same tick — which is what puts the yawn's family snap ahead of the
  // morph authored at the same instant. The consequence is shared with Swift and
  // is not a bug: a step authored later in the array but scheduled earlier in
  // time still runs second within the tick that catches both up.
  for (const s of timeline.steps) {
    ids.push(scheduler.once(now + s.at, (fired) => {
      // `family` on a step is a SNAP into a different shape family, and the
      // loader has already guaranteed `duration === 0` for it. The channel is
      // engine-managed — this is the ONLY place it is ever written after the
      // rest seed — and it is written before the tween so anything reading the
      // pair within this frame sees the family the new path actually belongs to.
      if (s.family !== undefined) {
        channels.set(`${nodeOf(s.channel)}.family`, s.family);
      }
      for (const concrete of config.expand(s.channel)) {
        tweens.add({
          channel: concrete,
          to: s.to,
          duration: s.duration,
          ease: s.ease,
        }, fired);
      }
    }));
  }

  const endsAt = now + timeline.duration;
  if (onDone) ids.push(scheduler.once(endsAt, () => onDone()));

  return {
    name,
    startedAt: now,
    endsAt,
    cancel: () => {
      for (const id of ids) scheduler.cancel(id);
    },
  };
}
