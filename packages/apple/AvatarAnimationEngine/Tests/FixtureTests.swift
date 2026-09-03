import XCTest
@testable import AvatarAnimationEngine

/// The fixture is a resource of the test bundle, and every later test reaches
/// it through this one enum. If bundling ever breaks, exactly one test fails
/// with a message that says so, instead of forty failing on a `nil`.
enum Fixture {
    static func url(_ name: String) -> URL {
        let bundle = Bundle(for: FixtureTests.self)
        guard let url = bundle.url(forResource: name, withExtension: "json",
                                   subdirectory: "Fixtures/dot")
            ?? bundle.url(forResource: name, withExtension: "json") else {
            fatalError("fixture dot/\(name).json is not in the test bundle")
        }
        return url
    }

    static func data(_ name: String) throws -> Data { try Data(contentsOf: url(name)) }

    /// The six raw files, in the order the loader takes them.
    static func all() throws -> [String: Data] {
        var out: [String: Data] = [:]
        for name in ["character", "rig", "poses", "timelines", "behavior", "sayings"] {
            out[name] = try data(name)
        }
        return out
    }

    /// The dot fixture plus one timeline the checked-in files do not have: `bow`,
    /// which PROMOTES `line.shape` out of the open-polyline family the rig
    /// declares into a two-cubic family, and the mood + choreography entry that
    /// reach it through the arbiter.
    ///
    /// Assembled in memory rather than added to `Fixtures/dot/*.json` because
    /// those files are pinned — the golden recordings and the schema-parity
    /// suite both read them — and a promote step is only wanted by the handful
    /// of tests that cover what `cancel` owes a promoted channel.
    ///
    /// The closing snap deliberately lands on a DIFFERENT polyline from the rig's
    /// rest (`M40,68L50,68L60,68`, not `M40,70L50,74L60,70`), the same way the
    /// olylo yawn ends on a shut mouth rather than its idle V. That is what makes
    /// "a cancel after the closing snap touches nothing" an assertion with
    /// something to catch.
    static func promoting() throws -> CharacterConfig {
        var d = try all()

        var timelines = try object(d["timelines"]!)
        var byName = timelines["timelines"] as! [String: Any]
        byName["bow"] = [
            "duration": 0.5,
            "steps": [
                ["at": 0, "channel": "line.shape", "promote": 2,
                 "duration": 0, "ease": "none", "family": "bowLine"],
                ["at": 0, "channel": "line.shape",
                 "to": "M40,76C44,62,56,62,50,74C54,70,58,68,60,76",
                 "duration": 0.2, "ease": "sine.inOut"],
                ["at": 0.3, "channel": "line.shape", "to": "M40,68L50,68L60,68",
                 "duration": 0, "ease": "none", "family": "line"],
            ],
        ]
        timelines["timelines"] = byName
        d["timelines"] = try blob(timelines)

        var poses = try object(d["poses"]!)
        var byMood = poses["poses"] as! [String: Any]
        byMood["bowing"] = ["duration": 0.5, "ease": "power2.inOut",
                            "channels": [String: Any](),
                            "loops": ["wiggle": 0, "sway": 1]]
        poses["poses"] = byMood
        poses["order"] = (poses["order"] as! [String]) + ["bowing"]
        d["poses"] = try blob(poses)

        var behavior = try object(d["behavior"]!)
        var choreography = behavior["choreography"] as! [String: Any]
        choreography["bowing"] = "bow"
        behavior["choreography"] = choreography
        d["behavior"] = try blob(behavior)

        return try CharacterConfig.load(RawFiles(
            character: d["character"]!, rig: d["rig"]!, poses: d["poses"]!,
            timelines: d["timelines"]!, behavior: d["behavior"]!, sayings: d["sayings"]!))
    }

    private static func object(_ raw: Data) throws -> [String: Any] {
        try JSONSerialization.jsonObject(with: raw) as! [String: Any]
    }

    private static func blob(_ o: [String: Any]) throws -> Data {
        try JSONSerialization.data(withJSONObject: o)
    }
}

final class FixtureTests: XCTestCase {
    func testAllSixFixtureFilesAreBundledAndDeclareSchemaVersionOne() throws {
        for (name, blob) in try Fixture.all() {
            let object = try JSONSerialization.jsonObject(with: blob)
            let dict = try XCTUnwrap(object as? [String: Any], name)
            XCTAssertEqual(dict["schemaVersion"] as? Int, 1, name)
        }
    }
}
