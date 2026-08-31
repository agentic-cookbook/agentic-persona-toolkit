/**
 * Absolute-time event scheduling. The engine never asks "how much time passed" —
 * it asks "what should have happened by now", and the difference is the entire
 * refresh-rate story: at 60 Hz, 120 Hz, or one giant catch-up step after a
 * backgrounded tab, the same events fire the same number of times in the same
 * order.
 */
export interface Scheduler {
  every(interval: number, run: (t: number) => void, opts?: { first?: number }): number;
  once(at: number, run: (t: number) => void): number;
  cancel(id: number): void;
  tick(now: number): void;
}

interface Entry {
  id: number;
  nextAt: number;
  interval: number; // 0 = one-shot
  run: (t: number) => void;
}

export function createScheduler(): Scheduler {
  const entries = new Map<number, Entry>();
  let nextId = 1;

  return {
    every(interval, run, opts) {
      const id = nextId++;
      entries.set(id, { id, interval, nextAt: opts?.first ?? interval, run });
      return id;
    },

    once(at, run) {
      const id = nextId++;
      entries.set(id, { id, interval: 0, nextAt: at, run });
      return id;
    },

    cancel(id) {
      entries.delete(id);
    },

    tick(now) {
      // Snapshot: a handler may schedule or cancel, and iterating the live map
      // while it mutates is exactly the sort of order dependence a golden diff
      // would surface as an unexplainable one-frame difference.
      for (const entry of [...entries.values()]) {
        if (!entries.has(entry.id)) continue;
        if (entry.interval <= 0) {
          if (now >= entry.nextAt) {
            entries.delete(entry.id);
            entry.run(entry.nextAt);
          }
          continue;
        }
        let guard = 0;
        while (now >= entry.nextAt) {
          const at = entry.nextAt;
          entry.nextAt += entry.interval;
          entry.run(at);
          if (!entries.has(entry.id)) break;
          // A pathological interval (or a clock that jumped hours) must not hang
          // the frame. 1000 catch-ups is far beyond any real gap.
          guard += 1;
          if (guard > 1000) {
            entry.nextAt = now + entry.interval;
            break;
          }
        }
      }
    },
  };
}
