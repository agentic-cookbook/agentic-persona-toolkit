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
 * The promoted form of `held`, or `undefined` if it has none.
 *
 * Split out so that the ONE place a promote can fail on live channel content is
 * named, and so the Swift twin — whose `promotePolyline` and `parsePath` both
 * throw, inside a scheduler callback that cannot — has the same shape to
 * transcribe rather than a `try?` chain buried in the middle of a loop.
 */
function tryPromote(held: string, segments: number): string | undefined {
  try {
    return emitPath(promotePolyline(parsePath(held), segments));
  } catch {
    return undefined;
  }
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
  // What each concrete `.shape` channel held immediately BEFORE a promote step
  // rewrote it, keyed by the node whose family that step snapped.
  //
  // Restoring the family alone is half a restore. A promote does not merely
  // rename the family a shape belongs to — it REWRITES the shape, from the
  // polyline the rig declares into the all-cubic path of the family the
  // timeline is crossing into. Hand the family back without handing the shape
  // back and the node holds an "MCCCC" path while its family channel says
  // "mouth", which is a pair no pose, no rig and no other timeline ever
  // produces. The next promote out of that node then reads the cubic it left
  // behind and `promotePolyline` refuses it — on the web a throw out of
  // `engine.tick`, in Swift a trap.
  //
  // The loader guarantees a promote step names a family and targets a `.shape`
  // channel (`load.ts`'s promote checks), so every promote's node is in
  // `snapped` and the family channel IS the flag for whether the rewrite is
  // still standing — see `cancel`.
  const promoted = new Map<string, Map<string, string>>();

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
          // A promote that cannot be performed leaves the channel EXACTLY where
          // it is — no tween, no write, nothing thrown. The same answer, and for
          // the same reason, as the family crossing `tween.ts` snaps rather than
          // morphs: every promote an author can write is checked statically by
          // the loader, so a refusal reaching here is one nobody authored — a
          // channel already sitting in the promoted family because a previous
          // play of this timeline is still standing. Throwing would be a worse
          // answer than doing nothing, because `scheduler.tick` runs inside
          // `engine.tick` and the host's frame loop does not survive it; and it
          // is not an answer Swift can give at all, where the scheduler's
          // callback cannot throw and the alternative is trapping the process.
          if (typeof held !== "string") continue;
          const target = tryPromote(held, s.promote);
          if (target === undefined) continue;
          let held0 = promoted.get(nodeOf(s.channel));
          if (held0 === undefined) {
            held0 = new Map<string, string>();
            promoted.set(nodeOf(s.channel), held0);
          }
          // Never overwritten: the FIRST promote of a run is the one that took
          // the channel out of its declared family, so it is the one to undo.
          if (!held0.has(concrete)) held0.set(concrete, held);
          to = target;
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
    // Sorted, and the sort is the contract: a `Set`'s insertion order is the
    // authored order here but Swift's `Set` has no order at all, so both sides
    // sort to write the same channels in the same sequence.
    cancel: () => {
      for (const id of ids) scheduler.cancel(id);
      for (const node of [...snapped].sort()) {
        const declared = config.families.get(node);
        if (declared === undefined) continue;
        // The family channel is the flag. While it still names a family this
        // timeline snapped it into, the crossing is standing and this handle
        // owes both halves of the restore. Once the timeline's own closing snap
        // has put it back — the yawn does that at `at: 1.85`, a quarter second
        // before it ends — the crossing is already undone and a cancel arriving
        // afterwards must touch nothing: the arbiter cancels every choreo handle
        // on the next mood change whether it ran to completion or not, and a
        // restore there would drag the mouth back to a shape the timeline
        // deliberately animated away from.
        if (channels.get(`${node}.family`) === declared) continue;
        channels.set(`${node}.family`, declared);
        const held = promoted.get(node);
        if (held === undefined) continue;
        for (const concrete of [...held.keys()].sort()) {
          // `tweens.cancel` first, then a raw write. The tween the promote step
          // added — or whichever later step of this timeline superseded it — is
          // still live and `tweens.tick` runs after `scheduler.tick` on this
          // very frame, so a write with the tween left standing is overwritten
          // before anything sees it. `freezeLoop` in `reflexes.ts` takes a
          // channel off an animation the same way and for the same reason.
          tweens.cancel(concrete);
          channels.set(concrete, held.get(concrete)!);
        }
      }
    },
  };
}
