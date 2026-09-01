import XCTest
@testable import AvatarAnimationEngine

final class SchemaParityTests: XCTestCase {
    /// Decode -> re-encode -> compare as generic JSON. `NSDictionary`'s equality
    /// is a deep compare, and `NSNumber` compares numerically across
    /// representations — so `100` vs `100.0` is equal and only a genuine
    /// difference in KEYS or VALUES fails.
    private func assertRoundTrips<T: Codable>(
        _ type: T.Type, _ name: String,
        file: StaticString = #filePath, line: UInt = #line
    ) throws {
        let original = try Fixture.data(name)
        let decoded = try JSONDecoder().decode(type, from: original)
        let reencoded = try JSONEncoder().encode(decoded)
        let before = try JSONSerialization.jsonObject(with: original) as? NSDictionary
        let after = try JSONSerialization.jsonObject(with: reencoded) as? NSDictionary
        XCTAssertEqual(before, after,
                       "\(name).json does not survive decode -> encode; the Swift types are "
                       + "missing a field the JSON carries, or spell one differently",
                       file: file, line: line)
    }

    func testEveryConfigFileSurvivesADecodeEncodeRoundTrip() throws {
        try assertRoundTrips(CharacterFile.self, "character")
        try assertRoundTrips(RigFile.self, "rig")
        try assertRoundTrips(PosesFile.self, "poses")
        try assertRoundTrips(TimelinesFile.self, "timelines")
        try assertRoundTrips(BehaviorFile.self, "behavior")
        try assertRoundTrips(SayingsFile.self, "sayings")
    }
}
