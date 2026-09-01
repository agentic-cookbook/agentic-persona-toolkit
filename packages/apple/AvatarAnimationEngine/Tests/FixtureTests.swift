import XCTest

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
