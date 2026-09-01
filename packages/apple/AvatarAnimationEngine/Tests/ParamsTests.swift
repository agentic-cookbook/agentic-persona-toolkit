import XCTest
@testable import AvatarAnimationEngine

final class ParamsTests: XCTestCase {
    private var config: CharacterConfig!

    override func setUpWithError() throws {
        let d = try Fixture.all()
        config = try CharacterConfig.load(RawFiles(
            character: d["character"]!, rig: d["rig"]!, poses: d["poses"]!,
            timelines: d["timelines"]!, behavior: d["behavior"]!, sayings: d["sayings"]!))
    }

    /// The first mood whose pose supplies a non-zero `wiggle` — derived, not
    /// named, so the test says "a lively mood" rather than "eager".
    private var lively: ParamScope {
        let mood = config.poses.order.first { (config.poses.poses[$0]?.loops?["wiggle"] ?? 0) > 0 }!
        return ParamScope(mood: mood)
    }

    /// The first mood that is neither lively nor the eyes-shut mood.
    private var calm: ParamScope {
        let mood = config.poses.order.first {
            (config.poses.poses[$0]?.loops?["wiggle"] ?? 0) == 0
                && $0 != config.behavior.eyesShutMood
        }!
        return ParamScope(mood: mood)
    }

    private func select(_ name: String) throws -> (then: Double, otherwise: Double) {
        guard case .select(_, let then, let otherwise)? = config.behavior.params[name] else {
            throw XCTSkip("param \"\(name)\" is not a select param")
        }
        return (then, otherwise)
    }

    func testReadsAGtPredicateOffTheCurrentPosesLoopsBlock() {
        XCTAssertEqual(poseNumber(config, calm, "wiggle"), 0, accuracy: 1e-12)
        XCTAssertGreaterThan(poseNumber(config, lively, "wiggle"), 0)
        XCTAssertFalse(predicate(config, calm, "lively"))
        XCTAssertTrue(predicate(config, lively, "lively"))
    }

    func testSelectsBothTheSwayAmplitudeAndItsPeriodByLiveliness() throws {
        let amp = try select("swayAmp")
        XCTAssertEqual(numberParam(config, calm, "swayAmp"), amp.otherwise, accuracy: 1e-9)
        XCTAssertEqual(numberParam(config, lively, "swayAmp"), amp.then, accuracy: 1e-9)
        XCTAssertEqual(amp.otherwise, 4, accuracy: 1e-9)
        XCTAssertEqual(amp.then, 9, accuracy: 1e-9)

        // The period is the second slot, and it is the one a `Double`-typed
        // `LoopDef.duration` would decode happily and then throw on for a
        // param-driven rig.
        let period = try select("swayPeriod")
        XCTAssertEqual(numberParam(config, calm, "swayPeriod"), period.otherwise, accuracy: 1e-9)
        XCTAssertEqual(numberParam(config, lively, "swayPeriod"), period.then, accuracy: 1e-9)
        XCTAssertLessThan(period.then, period.otherwise, "a lively character sways faster")
    }

    func testResolvesTheThreeBuiltInPredicates() {
        let shut = ParamScope(mood: config.behavior.eyesShutMood)
        XCTAssertTrue(predicate(config, shut, "eyesShut"))
        XCTAssertFalse(predicate(config, calm, "eyesShut"))

        // `curious` reads the MOOD, and the scope deliberately cannot see the
        // ladder's rung at all. `calm` is not the ladder's `active` mood,
        // "eager"; a rung-based reading would have called it curious anyway,
        // because a mood forced from outside leaves the rung at 0 while the
        // face is very much occupied — wrongly handing the idle fidget a
        // mood's brows to overwrite. Ruling 105 took the rung out of
        // `ParamScope` so that reading cannot be written.
        XCTAssertEqual(lively.mood, config.behavior.ladder.moods["active"])
        XCTAssertTrue(predicate(config, lively, "curious"))
        XCTAssertFalse(predicate(config, calm, "curious"))
        XCTAssertFalse(predicate(config, shut, "curious"))

        // `choreographed` is a fact about the mood, read off
        // `behavior.choreography` directly — true only for a mood the
        // config maps to a timeline.
        let flipping = ParamScope(mood: "flipping")
        XCTAssertTrue(predicate(config, flipping, "choreographed"))
        XCTAssertFalse(predicate(config, calm, "choreographed"))
    }

    func testAppliesAnAmplitudesScaleAndOpensAGateOnlyWhenBothHalvesAgree() {
        let wiggle = poseNumber(config, lively, "wiggle")
        XCTAssertEqual(amplitude(config, lively, .param(name: "wiggle", scale: 0.5)),
                       wiggle * 0.5, accuracy: 1e-9)
        XCTAssertEqual(amplitude(config, lively, .param(name: "wiggle", scale: nil)),
                       wiggle, accuracy: 1e-9)
        XCTAssertEqual(amplitude(config, lively, .literal(9)), 9, accuracy: 1e-12)

        XCTAssertTrue(gateOpen(config, calm, enabledWhen: nil, disabledWhen: nil))
        XCTAssertFalse(gateOpen(config, calm, enabledWhen: "lively", disabledWhen: nil))
        XCTAssertTrue(gateOpen(config, lively, enabledWhen: "lively", disabledWhen: nil))
        XCTAssertFalse(gateOpen(config, lively, enabledWhen: "lively", disabledWhen: "curious"))
    }
}
