/**
 * A flat string-keyed store of animatable values. Everything the engine animates
 * — a node property, an ink, a mouth path, a shape family — is a channel, so the
 * scene tree never has to know what an animation is and animation never has to
 * know what the scene tree looks like.
 */
export type ChannelValue = number | string;

/** Properties that jump to their target instead of interpolating towards it.
 *
 *  A pivot is not a quantity that moves — it is WHERE the moving happens. Slide
 *  one across a tween and every frame in between composes a rotation about an
 *  origin nobody authored, dragging the whole subtree sideways for the length of
 *  the tween. GSAP says the same thing by construction: `transformOrigin` is
 *  applied when a tween starts and is never part of the interpolation.
 *
 *  A delay still applies — the jump lands when the tween would have STARTED,
 *  which is exactly where GSAP puts it. */
const SNAP_PROPS: ReadonlySet<string> = new Set(["pivotX", "pivotY"]);

/** Does this concrete "<nodeId>.<prop>" channel snap rather than tween? */
export function snaps(channel: string): boolean {
  const dot = channel.lastIndexOf(".");
  return dot >= 0 && SNAP_PROPS.has(channel.slice(dot + 1));
}

export interface Channels {
  get(name: string): ChannelValue | undefined;
  set(name: string, value: ChannelValue): void;
  names(): string[];
}

export function createChannels(initial: Record<string, ChannelValue> = {}): Channels {
  const values = new Map<string, ChannelValue>(Object.entries(initial));
  return {
    get: (name) => values.get(name),
    set: (name, value) => {
      values.set(name, value);
    },
    names: () => [...values.keys()].sort(),
  };
}
