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
