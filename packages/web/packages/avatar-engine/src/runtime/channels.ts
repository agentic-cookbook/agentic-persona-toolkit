/**
 * A flat string-keyed store of animatable values. Everything the engine animates
 * — a node property, an ink, a mouth path, a shape family — is a channel, so the
 * scene tree never has to know what an animation is and animation never has to
 * know what the scene tree looks like.
 */
export type ChannelValue = number | string;

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
