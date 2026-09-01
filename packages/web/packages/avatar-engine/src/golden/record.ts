import { createEngine } from "../engine";
import { parsePath } from "../path/parse";
import type { CharacterConfig } from "../config/types";
import type { Scenario } from "./scenarios";

/** Round to 1e-9 so the file is byte-stable; the diff tolerance is 1e-6. */
const q = (v: number): number => {
  const r = Math.round(v * 1e9) / 1e9;
  return Object.is(r, -0) ? 0 : r;
};

/**
 * Record one scenario to JSONL.
 *
 * The recorded object IS the display list — no rendering, no rasterisation, no
 * screenshots. That is the whole point: a golden that compares pixels would fail
 * on font hinting and antialiasing differences between platforms, while a golden
 * that compares the display list fails only when the animation actually differs.
 */
export function recordScenario(config: CharacterConfig, scenario: Scenario): string {
  const engine = createEngine({
    config,
    seed: scenario.seed,
    env: scenario.reducedMotion ? { reducedMotion: () => true } : undefined,
    variant: scenario.variant,
  });

  const frames = Math.floor(scenario.duration * scenario.fps);
  const script = [...scenario.script].sort((a, b) => a.at - b.at);
  let next = 0;
  const lines: string[] = [];

  for (let f = 0; f <= frames; f += 1) {
    const t = f / scenario.fps;
    // Commands fire BEFORE the tick they belong to, so a command at t=1 is
    // visible in the frame stamped t=1 rather than the one after it.
    while (next < script.length && script[next]!.at <= t + 1e-12) {
      script[next]!.do(engine);
      next += 1;
    }
    const list = engine.tick(t);
    lines.push(JSON.stringify({
      f,
      t: q(t),
      items: list.map((item) => {
        const parsed = parsePath(item.d);
        return {
          id: item.id,
          m: item.m.map(q),
          pts: parsed.points.map(q),
          k: parsed.kind,
          p: {
            ink: item.paint.ink,
            alpha: q(item.paint.alpha),
            fill: item.paint.fill,
            ...(item.paint.width === undefined ? {} : { width: q(item.paint.width) }),
          },
        };
      }),
    }));
  }
  return `${lines.join("\n")}\n`;
}
