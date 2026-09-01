import type { CharacterConfig } from "../config/types";
import type { Channels } from "../runtime/channels";
import type { Scheduler } from "../runtime/scheduler";
import type { Tweens } from "../runtime/tween";
import { parsePath, emitPath } from "../path/parse";
import { promotePolyline } from "../path/promote";
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
  // The nodes this timeline snaps into another shape family. Cancelling hands
  // them straight back to the pose system, which draws only the family the rig
  // declares — so a cancel that lands between a timeline's opening and closing
  // snaps has to put the family channel back itself, or the channel goes on
  // naming a family the shape it sits beside is no longer in.
  const snapped = new Set<string>();

  // Authored order, front to back. Scheduler ids are monotonic and `tick` walks
  // them in that order, so insertion order IS firing order among events that come
  // due in the same tick — which is what puts the yawn's family snap ahead of the
  // morph authored at the same instant. The consequence is shared with Swift and
  // is not a bug: a step authored later in the array but scheduled earlier in
  // time still runs second within the tick that catches both up.
  for (const s of timeline.steps) {
    if (s.family !== undefined) snapped.add(nodeOf(s.channel));
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
        // A promote is still an ordinary snap — it just works out its own target
        // instead of being told one. It has to run here, at fire time, for the
        // same reason the step is expressed this way at all: what the channel
        // holds depends on the mood the timeline interrupted, and the whole
        // point is to cross families out of THAT shape rather than a guess at it.
        let to = s.to;
        if (s.promote !== undefined) {
          const held = channels.get(concrete);
          if (typeof held !== "string") {
            throw new Error(`timeline ${name} promotes ${concrete}, which holds no path`);
          }
          to = emitPath(promotePolyline(parsePath(held), s.promote));
        }
        tweens.add({
          channel: concrete,
          to: to!,
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
      for (const node of snapped) {
        const declared = config.families.get(node);
        if (declared !== undefined) channels.set(`${node}.family`, declared);
      }
    },
  };
}
