import type { Engine } from "../engine";

export interface Scenario {
  name: string;
  seed: number;
  fps: number;
  duration: number;
  reducedMotion?: boolean;
  script: { at: number; do: (e: Engine) => void }[];
}

const MOODS = [
  "idle", "thinking", "excited", "surprised", "startled", "mad", "laughing",
  "inquisitive", "sad", "bored", "silly", "smug", "yawning", "asleep",
];

export const SCENARIOS: readonly Scenario[] = [
  { name: "rest", seed: 1, fps: 60, duration: 20, script: [] },
  {
    name: "moods", seed: 1, fps: 60, duration: 45,
    script: MOODS.map((mood, i) => ({ at: i * 3 + 0.5, do: (e: Engine) => e.setMood(mood) })),
  },
  { name: "yawn", seed: 1, fps: 60, duration: 6, script: [{ at: 1, do: (e) => e.play("yawn") }] },
  { name: "idle-ladder", seed: 1, fps: 60, duration: 180, script: [{ at: 0, do: (e) => e.notice() }] },
  {
    name: "waking", seed: 1, fps: 60, duration: 30,
    script: [{ at: 0, do: (e) => e.notice() }, { at: 20, do: (e) => e.notice() }],
  },
  {
    name: "poke", seed: 1, fps: 60, duration: 12,
    script: [{ at: 2, do: (e) => e.poke() }, { at: 4, do: (e) => e.poke() }, { at: 4.1, do: (e) => e.poke() }],
  },
  {
    name: "speech", seed: 1, fps: 60, duration: 15,
    script: [
      { at: 1, do: (e) => e.say("hi") },
      { at: 6, do: (e) => e.say("a considerably longer thing to say out loud") },
    ],
  },
  { name: "reduced-motion", seed: 1, fps: 60, duration: 20, reducedMotion: true, script: [] },
  { name: "high-rate", seed: 1, fps: 240, duration: 20, script: [] },
];
