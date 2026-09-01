import { resolveEase } from "../math/ease";
import { mixColor } from "../math/color";
import { emitPath, parsePath } from "../path/parse";
import { morphPath } from "../path/morph";
import { snaps, type ChannelValue, type Channels } from "./channels";

export interface TweenSpec {
  channel: string;
  to: ChannelValue;
  duration: number;
  delay?: number;
  ease?: string;
  from?: ChannelValue;
}

export interface Tweens {
  add(spec: TweenSpec, now: number): void;
  tick(now: number): void;
  cancel(channel: string): void;
  active(): number;
}

interface Live {
  channel: string;
  start: number;
  end: number;
  from: ChannelValue | undefined;
  to: ChannelValue;
  easeName: string;
}

const isHex = (v: ChannelValue): v is string =>
  typeof v === "string" && /^#[0-9a-fA-F]{3,6}$/.test(v);
const isPath = (v: ChannelValue): v is string =>
  typeof v === "string" && /^[Mm]/.test(v);

/** Interpolate whatever kind of value this is; unknown strings snap at t >= 1. */
function lerpValue(from: ChannelValue, to: ChannelValue, t: number): ChannelValue {
  if (typeof from === "number" && typeof to === "number") return from + (to - from) * t;
  if (isHex(from) && isHex(to)) return mixColor(from, to, t);
  if (isPath(from) && isPath(to)) {
    const a = parsePath(from);
    const b = parsePath(to);
    // Two paths in different shape families cannot morph — there is no
    // anchor-for-anchor mapping between "MLL" and "MCCCCZ", which is exactly what
    // `morphPath` refuses. So the crossing SNAPS: the same answer rule 4 gives
    // an authored crossing, arrived at from the other direction.
    //
    // This is not a softening of the morph guard. Every crossing an author can
    // write is already caught statically by the loader (Task 11), on both
    // sides: `poseKind` forces every pose driving a channel to share the rig's
    // rest command signature, precisely because the arbiter may morph between
    // any two poses; and a timeline's family change must be a duration-0 step
    // whose paths match the family it declares. A mismatch that reaches HERE is
    // therefore one nobody authored — a pose applied while a timeline holds the
    // mouth open, or a timeline step landing after a pose took the mouth back.
    // Both are legitimate and both are reachable (`behavior.waking` plays the
    // 2.1s yawn while a poke can change the mood under it), so the only answer
    // that is defined, identical on every platform, and not a crash is the snap.
    // `morphPath` keeps its throw — it is that function's contract and its own
    // test still covers it; it simply stops being reachable from here.
    if (a.kind !== b.kind) return to;
    return emitPath(morphPath(a, b, t));
  }
  return t >= 1 ? to : from;
}

/** `respond` maps a value to what the rig renders for it, once, where it is
 *  written -- see `CharacterConfig.respond`. It belongs here because `add` is
 *  the single funnel every animated value passes through, and applying it any
 *  later would interpolate in a space the original never interpolates in. */
export function createTweens(
  channels: Channels,
  respond: (channel: string, value: ChannelValue) => ChannelValue = (_c, v) => v,
): Tweens {
  const live: Live[] = [];

  const cancel = (channel: string): void => {
    for (let i = live.length - 1; i >= 0; i -= 1) {
      if (live[i]!.channel === channel) live.splice(i, 1);
    }
  };

  /** Advance one tween to `now`: write what it shows at that instant, and report
   *  whether it is finished there. `from` resolves on the first call rather than
   *  at `add`, which is what makes a delayed tween pick up the channel as it is
   *  when it actually starts. */
  const write = (t: Live, now: number): boolean => {
    if (t.from === undefined) t.from = channels.get(t.channel) ?? t.to;
    const span = t.end - t.start;
    const p = span <= 0 ? 1 : Math.min(1, (now - t.start) / span);
    channels.set(t.channel, lerpValue(t.from, t.to, p >= 1 ? 1 : resolveEase(t.easeName)(p)));
    return p >= 1;
  };

  /** Rule 5. Before a tween is replaced, the one it replaces writes the value it
   *  would have shown AT `now` — the instant of the handoff, not the instant of
   *  the last tick. Without this the incoming tween resolves its `from` against a
   *  frame-quantised snapshot, so the same animation on the same clock lands
   *  somewhere different at 60 fps than at 240. */
  const settle = (channel: string, now: number): void => {
    for (const t of live) {
      if (t.channel === channel && now >= t.start) write(t, now);
    }
  };

  return {
    cancel,
    active: () => live.length,

    add(spec, now) {
      settle(spec.channel, now);
      cancel(spec.channel);
      const to = respond(spec.channel, spec.to);
      const delay = spec.delay ?? 0;
      // A snapping channel (`snaps`, in ./channels) ignores whatever duration its
      // caller asked for. The rule lives HERE rather than at each of the dozen
      // call sites that build a tween, because a pivot that tweened at even one
      // of them would be a silent whole-subtree drift, not a visible error.
      const duration = snaps(spec.channel) ? 0 : spec.duration;
      // Rule 4. A snap lands HERE, not at the next tick, and it writes `spec.to`
      // verbatim rather than routing through `lerpValue`. Two reasons, and the
      // second is the one that bites: a family snap's two paths are by
      // definition un-morphable, so `lerpValue` would take its snap branch and
      // return `to` — the right VALUE, one tick late, and only after the morph
      // authored at the same instant has already cancelled this tween under
      // rule 1. The authored crossing would vanish and the shape it was making
      // safe would pop instead of animating. Landing at `add` time is what makes
      // the authored pair mean what it reads as.
      if (duration === 0 && delay === 0) {
        channels.set(spec.channel, to);
        return;
      }
      const start = now + delay;
      live.push({
        channel: spec.channel,
        start,
        end: start + duration,
        // `from` is resolved when the tween STARTS, not when it is scheduled, so a
        // delayed tween picks up whatever the channel holds at that moment. That is
        // what makes the per-channel delay ladder read as a wave rather than as a
        // set of tweens that all secretly began at the same value.
        from: spec.from === undefined ? undefined : respond(spec.channel, spec.from),
        to,
        easeName: spec.ease ?? "power3.out",
      });
    },

    tick(now) {
      for (let i = live.length - 1; i >= 0; i -= 1) {
        const t = live[i]!;
        if (now < t.start) continue;
        if (write(t, now)) live.splice(i, 1);
      }
    },
  };
}
