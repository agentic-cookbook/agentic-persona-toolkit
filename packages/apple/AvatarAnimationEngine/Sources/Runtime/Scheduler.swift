import Foundation

/// Absolute-time event scheduling. The engine never asks "how much time passed" —
/// it asks "what should have happened by now", and the difference is the entire
/// refresh-rate story: at 60 Hz, 120 Hz, or one giant catch-up step after the app
/// was backgrounded, the same events fire the same number of times in the same
/// order.
public final class Scheduler {
    /// A reference type on purpose: `tick` snapshots the entries before running
    /// any of them, and then mutates `nextAt` on the entry it is running. With a
    /// value type the snapshot would be a copy and every catch-up would be lost.
    private final class Entry {
        let id: Int
        var nextAt: Double
        let interval: Double            // 0 = one-shot
        let run: (Double) -> Void

        init(id: Int, nextAt: Double, interval: Double, run: @escaping (Double) -> Void) {
            self.id = id
            self.nextAt = nextAt
            self.interval = interval
            self.run = run
        }
    }

    private var entries: [Int: Entry] = [:]
    private var nextId = 1

    /// How late a one-shot may be and still be handed its own deadline.
    ///
    /// A repeater's catch-up is bounded by the guard in `tick`; a chain of
    /// one-shots — every reflex that re-arms itself: the fidget, the blink, the
    /// gaze wander, a mood effect's stir — has no such bound, because the chain
    /// lives in the handler and the scheduler cannot see it. Each link is armed
    /// relative to the time its handler was HANDED, so a deadline hours in the
    /// past re-arms into a deadline hours in the past, and the chain replays its
    /// whole backlog at one link per frame with the tween sampler running in
    /// between. That is not the same thing as having run in real time: a fidget
    /// anchors its jitter on the channel's live value, so a replayed chain walks
    /// the channel one amplitude per frame, for as many frames as there were
    /// missed re-arms.
    ///
    /// So a grossly overdue one-shot is handed `now` less this, which is enough
    /// lateness to be a dropped frame and not enough to be a stopped loop: the
    /// chain re-arms into the future and the backlog is one link, not thousands.
    /// A one-shot inside the window keeps its exact deadline, which is what
    /// keeps the ordinary frame-rate independence intact.
    private static let staleAfter = 1.0

    public init() {}

    @discardableResult
    public func every(_ interval: Double, first: Double? = nil,
                      run: @escaping (Double) -> Void) -> Int {
        let id = nextId
        nextId += 1
        entries[id] = Entry(id: id, nextAt: first ?? interval, interval: interval, run: run)
        return id
    }

    @discardableResult
    public func once(at: Double, run: @escaping (Double) -> Void) -> Int {
        let id = nextId
        nextId += 1
        entries[id] = Entry(id: id, nextAt: at, interval: 0, run: run)
        return id
    }

    public func cancel(_ id: Int) {
        entries.removeValue(forKey: id)
    }

    public func tick(_ now: Double) {
        // Sorted, not `entries.values`. Ids are monotonic, so sorted-by-id is
        // insertion order — the same order the TS `Map` iterates — and it is the
        // snapshot: a handler may schedule or cancel, and iterating the live
        // dictionary while it mutates is exactly the sort of order dependence a
        // golden diff would surface as an unexplainable one-frame difference.
        for id in entries.keys.sorted() {
            guard let entry = entries[id] else { continue }
            if entry.interval <= 0 {
                if now >= entry.nextAt {
                    entries.removeValue(forKey: id)
                    entry.run(max(entry.nextAt, now - Self.staleAfter))
                }
                continue
            }
            var guardCount = 0
            while now >= entry.nextAt {
                let at = entry.nextAt
                entry.nextAt += entry.interval
                entry.run(at)
                if entries[id] == nil { break }
                // A pathological interval (or a clock that jumped hours) must not
                // hang the frame. 1000 catch-ups is far beyond any real gap.
                guardCount += 1
                if guardCount > 1000 {
                    entry.nextAt = now + entry.interval
                    break
                }
            }
        }
    }
}
