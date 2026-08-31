import { describe, expect, it } from "vitest";
import { createScheduler } from "./scheduler";

describe("scheduler", () => {
  it("fires a repeating event once per interval", () => {
    const s = createScheduler();
    const fires: number[] = [];
    s.every(0.1, (t) => fires.push(t), { first: 0.1 });
    for (let t = 0; t <= 0.55; t += 1 / 60) s.tick(t);
    expect(fires).toHaveLength(5);
  });

  it("catches up across a long frame instead of dropping events", () => {
    const s = createScheduler();
    let n = 0;
    s.every(0.1, () => { n += 1; }, { first: 0.1 });
    s.tick(0);
    s.tick(0.55);                 // one 550ms step
    expect(n).toBe(5);            // not 1
  });

  it("is frame-rate independent", () => {
    const count = (step: number): number => {
      const s = createScheduler();
      let n = 0;
      s.every(0.1, () => { n += 1; }, { first: 0.1 });
      for (let t = 0; t <= 2 + 1e-12; t += step) s.tick(t);
      s.tick(2);
      return n;
    };
    expect(count(1 / 60)).toBe(count(1 / 240));
  });

  it("runs a one-shot exactly once and forgets it", () => {
    const s = createScheduler();
    let n = 0;
    const id = s.once(0.5, () => { n += 1; });
    s.tick(1);
    s.tick(2);
    expect(n).toBe(1);
    expect(() => s.cancel(id)).not.toThrow();
  });

  it("cancels a repeater", () => {
    const s = createScheduler();
    let n = 0;
    const id = s.every(0.1, () => { n += 1; }, { first: 0.1 });
    s.tick(0.25);
    s.cancel(id);
    s.tick(5);
    expect(n).toBe(2);
  });
});
