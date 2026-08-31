import { resolveEase } from "../math/ease";
import { mixColor } from "../math/color";
import { emitPath, parsePath } from "../path/parse";
import { morphPath } from "../path/morph";
import type { ChannelValue, Channels } from "./channels";

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
  started: boolean;
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
    return emitPath(morphPath(parsePath(from), parsePath(to), t));
  }
  return t >= 1 ? to : from;
}

export function createTweens(channels: Channels): Tweens {
  const live: Live[] = [];

  const cancel = (channel: string): void => {
    for (let i = live.length - 1; i >= 0; i -= 1) {
      if (live[i]!.channel === channel) live.splice(i, 1);
    }
  };

  return {
    cancel,
    active: () => live.length,

    add(spec, now) {
      cancel(spec.channel);
      const delay = spec.delay ?? 0;
      // Rule 4. A snap lands HERE, not at the next tick, and it writes `spec.to`
      // verbatim rather than routing through `lerpValue` — a family snap's two
      // paths are by definition un-morphable, so `lerpValue(from, to, 1)` would
      // throw on exactly the step whose job is to make that crossing safe.
      if (spec.duration === 0 && delay === 0) {
        channels.set(spec.channel, spec.to);
        return;
      }
      const start = now + delay;
      live.push({
        channel: spec.channel,
        start,
        end: start + spec.duration,
        // `from` is resolved when the tween STARTS, not when it is scheduled, so a
        // delayed tween picks up whatever the channel holds at that moment. That is
        // what makes the per-channel delay ladder read as a wave rather than as a
        // set of tweens that all secretly began at the same value.
        from: spec.from,
        to: spec.to,
        easeName: spec.ease ?? "power3.out",
        started: false,
      });
    },

    tick(now) {
      for (let i = live.length - 1; i >= 0; i -= 1) {
        const t = live[i]!;
        if (now < t.start) continue;
        if (!t.started) {
          t.started = true;
          if (t.from === undefined) t.from = channels.get(t.channel) ?? t.to;
        }
        const span = t.end - t.start;
        const p = span <= 0 ? 1 : Math.min(1, (now - t.start) / span);
        const eased = p >= 1 ? 1 : resolveEase(t.easeName)(p);
        channels.set(t.channel, lerpValue(t.from!, t.to, eased));
        if (p >= 1) live.splice(i, 1);
      }
    },
  };
}
