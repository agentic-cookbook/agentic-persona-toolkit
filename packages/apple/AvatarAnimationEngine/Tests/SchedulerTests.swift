import XCTest
@testable import AvatarAnimationEngine

final class SchedulerTests: XCTestCase {
    func testFiresARepeatingEventOncePerInterval() {
        let s = Scheduler()
        var fires: [Double] = []
        s.every(0.1, first: 0.1) { fires.append($0) }
        var i = 0
        while Double(i) / 60 <= 0.55 + 1e-12 {
            s.tick(Double(i) / 60)
            i += 1
        }
        XCTAssertEqual(fires.count, 5)
    }

    func testCatchesUpAcrossALongFrameInsteadOfDroppingEvents() {
        let s = Scheduler()
        var n = 0
        s.every(0.1, first: 0.1) { _ in n += 1 }
        s.tick(0)
        s.tick(0.55)                  // one 550 ms step
        XCTAssertEqual(n, 5)          // not 1
    }

    func testIsFrameRateIndependent() {
        func count(_ step: Double) -> Int {
            let s = Scheduler()
            var n = 0
            s.every(0.1, first: 0.1) { _ in n += 1 }
            var i = 0
            while Double(i) * step <= 2 + 1e-12 {
                s.tick(Double(i) * step)
                i += 1
            }
            s.tick(2)
            return n
        }
        XCTAssertEqual(count(1.0 / 60), count(1.0 / 240))
    }

    func testRunsAOneShotExactlyOnceAndForgetsIt() {
        let s = Scheduler()
        var n = 0
        let id = s.once(at: 0.5) { _ in n += 1 }
        s.tick(1)
        s.tick(2)
        XCTAssertEqual(n, 1)
        s.cancel(id)                  // cancelling a spent one-shot is a no-op, not a trap
    }

    func testHandsASlightlyLateOneShotItsOwnDeadline() {
        let s = Scheduler()
        var fired: Double?
        s.once(at: 0.5) { fired = $0 }
        s.tick(1)                     // half a second late: a dropped frame
        XCTAssertEqual(fired, 0.5)    // still its own deadline, not `now`
    }

    /// A repeater's catch-up is bounded by the guard in `tick`. A chain of
    /// one-shots — every reflex that re-arms itself — has no such bound: each
    /// link is armed relative to the time its handler was handed, so a deadline
    /// an hour in the past re-arms an hour in the past, and the chain replays
    /// its whole backlog at one link per frame. The frame loop stops for real
    /// reasons (display sleep, occlusion, backgrounding), and a chain that
    /// anchors on a live channel walks that channel once per replayed link.
    func testResumesAOneShotChainAfterAStoppedLoopInsteadOfReplayingItsBacklog() {
        let s = Scheduler()
        var fires: [Double] = []
        func arm(_ at: Double) {
            s.once(at: at) { t in
                fires.append(t)
                arm(t + 5)
            }
        }
        arm(5)
        s.tick(5)
        XCTAssertEqual(fires, [5])

        s.tick(3600)                  // an hour with no frames at all
        XCTAssertEqual(fires.count, 2, "the backlog is one link, not 719")
        // Late enough to be a stopped loop, so the link is pulled up to `now`
        // rather than left at its dead deadline...
        XCTAssertGreaterThanOrEqual(fires[1], 3599)
        XCTAssertLessThanOrEqual(fires[1], 3600)
        // ...which is what puts the next link in the FUTURE. Without that, the
        // next frame fires again, and the frame after that, for 719 frames.
        s.tick(3600 + 1.0 / 60)
        XCTAssertEqual(fires.count, 2)
    }

    func testCancelsARepeater() {
        let s = Scheduler()
        var n = 0
        let id = s.every(0.1, first: 0.1) { _ in n += 1 }
        s.tick(0.25)
        s.cancel(id)
        s.tick(5)
        XCTAssertEqual(n, 2)
    }
}
