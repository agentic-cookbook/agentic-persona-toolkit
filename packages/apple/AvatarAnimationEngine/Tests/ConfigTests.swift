import XCTest
@testable import AvatarAnimationEngine

/// Set (or, with `to: nil`, delete) a value inside a parsed JSON object,
/// addressed by a slash-separated path of dictionary keys and array indices —
/// `"poses/eager/channels/limb.bend"`, `"loops/0/disabledWhen"`. Channel names
/// contain dots, never slashes, so "/" is an unambiguous separator.
///
/// This exists so each of the nineteen negative tests below is one readable line.
/// The TypeScript suite mutates the decoded JSON module object directly; Swift
/// decodes into structs, so the equivalent is to mutate the JSON and re-encode.
enum JSONPath {
    static func set(_ root: inout Any, _ path: [String], to value: Any?) {
        guard let head = path.first else {
            if let value { root = value }
            return
        }
        let rest = Array(path.dropFirst())
        if var dict = root as? [String: Any] {
            if rest.isEmpty {
                if let value { dict[head] = value } else { dict.removeValue(forKey: head) }
            } else {
                // A missing intermediate is created, so a test can add a whole
                // new subtree — `variants/bold/shapes/line/points` — in one line.
                var child = dict[head] ?? [String: Any]()
                set(&child, rest, to: value)
                dict[head] = child
            }
            root = dict
        } else if var array = root as? [Any], let index = Int(head), array.indices.contains(index) {
            if rest.isEmpty {
                if let value { array[index] = value } else { array.remove(at: index) }
            } else {
                var child = array[index]
                set(&child, rest, to: value)
                array[index] = child
            }
            root = array
        }
    }
}

final class ConfigTests: XCTestCase {
    private static let names = ["character", "rig", "poses", "timelines", "behavior", "sayings"]

    /// The unmodified fixture.
    private func fixture() throws -> RawFiles {
        let d = try Fixture.all()
        return RawFiles(character: d["character"]!, rig: d["rig"]!, poses: d["poses"]!,
                        timelines: d["timelines"]!, behavior: d["behavior"]!,
                        sayings: d["sayings"]!)
    }

    /// The fixture with one value changed (or removed) in one file.
    private func fixture(_ file: String, set path: String, to value: Any?) throws -> RawFiles {
        var blobs = try Fixture.all()
        var json: Any = try JSONSerialization.jsonObject(with: blobs[file]!)
        JSONPath.set(&json, path.split(separator: "/").map(String.init), to: value)
        blobs[file] = try JSONSerialization.data(withJSONObject: json)
        return RawFiles(character: blobs["character"]!, rig: blobs["rig"]!, poses: blobs["poses"]!,
                        timelines: blobs["timelines"]!, behavior: blobs["behavior"]!,
                        sayings: blobs["sayings"]!)
    }

    private func expectLoadFailure(_ needle: String,
                                   file: StaticString = #filePath, line: UInt = #line,
                                   _ make: () throws -> RawFiles) {
        do {
            _ = try CharacterConfig.load(try make())
            XCTFail("expected a load failure mentioning \"\(needle)\"", file: file, line: line)
        } catch {
            XCTAssertTrue("\(error)".contains(needle),
                          "wrong failure: \(error)", file: file, line: line)
        }
    }

    // MARK: - what loads

    func testLoadsDot() throws {
        let c = try CharacterConfig.load(fixture())
        XCTAssertEqual(c.character.id, "dot")
        XCTAssertEqual(c.character.canvas.w, 100)
        XCTAssertEqual(c.character.canvas.h, 100)
        XCTAssertEqual(c.poses.poses.count, 4)
        XCTAssertEqual(c.poses.order, ["calm", "eager", "out", "flipping"])
    }

    func testDerivesTheChannelSetFromTheRigGroupsIncluded() throws {
        let c = try CharacterConfig.load(fixture())
        XCTAssertTrue(c.channels.contains("line.rotation"))
        XCTAssertTrue(c.channels.contains("eyes.scaleY"))          // an authored group
        XCTAssertEqual(c.expand("eyes.scaleY"), ["eye.scaleY", "pupil.scaleY"])
        XCTAssertEqual(c.expand("line.rotation"), ["line.rotation"])
        XCTAssertEqual(c.expand("body.scale"), ["body.scaleX", "body.scaleY"])
        // A group whose members are themselves groups expands ALL the way to
        // channels the rig holds. A single-level lookup stops at `eye.scale`,
        // which `rest` has no entry for and the compositor never reads — so a
        // pose driving it would animate nothing, silently, on both platforms.
        XCTAssertEqual(
            c.expand("eyes.scale"),
            ["eye.scaleX", "eye.scaleY", "pupil.scaleX", "pupil.scaleY"])
        for channel in c.expand("eyes.scale") {
            XCTAssertNotNil(c.rest[channel], channel)
        }
    }

    func testDerivesEveryChannelsRestValueFromTheRigTree() throws {
        let c = try CharacterConfig.load(fixture())
        XCTAssertEqual(c.rest["line.rotation"], .number(0))
        XCTAssertEqual(c.rest["eye.scaleY"], .number(1))
        XCTAssertEqual(c.rest["spark.alpha"], .number(0))          // authored, not the default 1
        XCTAssertEqual(c.rest["limb.ink"], .text("body"))          // an ink KEY
        XCTAssertEqual(c.rest["line.family"], .text("line"))
        XCTAssertEqual(c.rest["line.shape"], .text("M40,70L50,74L60,70"))
        // `limb` is bend-driven, so it is rebuilt from its points every frame and
        // deliberately has no `.shape` channel to be rebuilt *against*.
        XCTAssertNil(c.rest["limb.shape"])
        XCTAssertTrue(c.bendDriven.contains("limb"))
    }

    func testNormalisesColourChannelsToLiteralsButLeavesInkKeysAlone() throws {
        let c = try CharacterConfig.load(fixture())
        // `body` names a palette colour, so body.ink carries the colour itself —
        // otherwise a mood change would snap instead of fading (`lerpValue`
        // cannot interpolate "ink" -> "warm").
        XCTAssertEqual(c.rest["body.ink"], .text("#112233"))
        XCTAssertEqual(c.poses.poses["eager"]!.channels["body.ink"], .text("#ff8800"))
        // `limb` names an ink KEY — how it is painted, not what colour it is.
        XCTAssertEqual(c.rest["limb.ink"], .text("body"))
    }

    // MARK: - what it refuses

    func testRejectsASchemaVersionMismatch() {
        expectLoadFailure("schemaVersion") {
            try fixture("character", set: "schemaVersion", to: 99)
        }
    }

    func testRejectsAGroupNamingAChannelThatDoesNotExist() {
        expectLoadFailure("nope.scaleY") {
            try fixture("rig", set: "groups/eyes.scaleY", to: ["nope.scaleY"])
        }
    }

    func testRejectsAPoseTargetingAnUnknownChannel() {
        expectLoadFailure("ear.wiggle") {
            try fixture("poses", set: "poses/eager/channels/ear.wiggle", to: 1)
        }
    }

    func testRejectsASpinTargetingAGroupChannel() {
        // Only `spin.channel` moves; the rest of `eager`'s spin stays as authored,
        // so a green test here cannot be the loader catching a missing `duration`
        // or `ease` first. `eyes.scaleY` is the rig's own authored group.
        expectLoadFailure("spin targets group") {
            try fixture("poses", set: "poses/eager/spin/channel", to: "eyes.scaleY")
        }
    }

    func testRejectsASpinCarryingAChannelThePoseDoesNotDrive() {
        // `line.rotation` is a real channel, so this is not the unknown-channel
        // check firing early: the spin would be timing a channel nothing is
        // animating. `carries` RE-TIMES a target; it never invents one.
        expectLoadFailure("does not drive") {
            try fixture("poses", set: "poses/eager/spin/carries", to: ["line.rotation"])
        }
    }

    func testRejectsASpinCarryingItsOwnChannel() {
        expectLoadFailure("already times it") {
            try fixture("poses", set: "poses/eager/spin/carries", to: ["spark.rotation"])
        }
    }

    func testRejectsASpinCarryingAChannelThatDoesNotExist() {
        expectLoadFailure("body.notAChannel") {
            try fixture("poses", set: "poses/eager/spin/carries", to: ["body.notAChannel"])
        }
    }

    func testRejectsAnUnresolvedInk() {
        expectLoadFailure("@nothing") {
            try fixture("rig", set: "root/ink", to: "@nothing")
        }
    }

    func testRejectsAShapedNodeWithNoInk() {
        // `root/children/0` is `eye`, which carries a shape. Without this the
        // config loads and dies at the first composed frame instead: `compose`
        // reads `node.ink ?? ""` and `resolveInk("")` throws `unknown colour ""`,
        // naming neither the node nor the field. The web loader already rejected
        // it at load time, so this is what makes the two accept the same set.
        expectLoadFailure("has a shape but no ink") {
            try fixture("rig", set: "root/children/0/ink", to: nil)
        }
    }

    func testRejectsAShapedNodePaintedWithABarePaletteColour() {
        // `warm` is a palette key and not an ink key. Nothing downstream throws
        // on this one: the `.ink` channel holds the hex, `inks["#ff8800"]` is
        // nil, and the node paints as a zero-width stroke -- invisible, and
        // invisible identically on both platforms, so a parity test would pass
        // over a wrong picture.
        //
        // The guard is written inks-FIRST, and the `dot` fixture cannot show
        // why: no name here is both an ink and a palette entry. A production config
        // is the collision case -- `eyeBg` and `iris` are each both -- so a
        // palette-first guard would refuse to load the real character. Task 43's
        // golden replay is what catches that, because it loads a real one.
        expectLoadFailure("palette colour \"warm\"") {
            try fixture("rig", set: "root/children/0/ink", to: "warm")
        }
    }

    func testRejectsAPaletteEntryParseHexCannotRead() {
        // The whole batch's failure shape in one line of JSON: legal JSON, waved
        // through by the loader, and fatal at the first colour tween. `isHex` in
        // `Tweens.swift` used to accept anything `Character.isHexDigit` liked,
        // which includes the fullwidth digit block (U+FF10 here) that
        // `Color.parseHex` throws on -- and the `try!` under it TRAPPED the
        // process on the per-frame path. The web dies more politely and just as
        // completely: `bad hex colour` thrown out of an rAF callback with no
        // try/catch. Load is the last moment the offending KEY is nameable.
        for bad in ["#abcd", "#abcde", "112233", "#gggggg", "#ab", "",
                    "#\u{FF10}0ff41"] {
            expectLoadFailure("palette \"warm\"") {
                try fixture("character", set: "palette/warm", to: bad)
            }
        }
    }

    func testAcceptsBothLegalHexShapes() throws {
        for ok in ["#abc", "#AABBCC"] {
            _ = try CharacterConfig.load(fixture("character", set: "palette/warm", to: ok))
        }
    }

    func testRejectsAGroupWithNoMembers() {
        // An empty list is not an empty group: the member loop is vacuous over
        // `[]`, so nothing rejects it, and `concrete.union(expandMap.keys)` then
        // makes the name a legal CHANNEL that expands to nothing. Every consumer
        // reaches for its first member -- `expand(name).first!`, which traps
        // with "Unexpectedly found nil" out of the one function whose entire
        // contract is to throw a `ConfigError`.
        expectLoadFailure("group \"eyelids\" has no members") {
            try fixture("rig", set: "groups/eyelids", to: [String]())
        }
    }

    func testRejectsARigWithNoGroupsKey() {
        // Same rule, same reason: required by `schema.json`, iterated unguarded
        // by `load.ts`. An empty rig writes `"groups": {}` on both platforms.
        expectLoadFailure("groups") {
            try fixture("rig", set: "groups", to: nil)
        }
    }

    func testRejectsATweenedFamilyChangeInATimeline() {
        // The snap into "arcLine" is what makes the next step's MC -> MC morph
        // legal; tweening the snap itself is exactly the bug the rule prevents.
        expectLoadFailure("family") {
            try fixture("timelines", set: "timelines/flip/steps/0/duration", to: 0.3)
        }
    }

    func testRejectsADuplicateNodeId() {
        // `nodes` is keyed by id, so without the guard the second node silently
        // replaces the first: the loser keeps its channels in `rest` but is
        // unreachable by id, and nothing downstream notices. Plan A rejects this
        // too — the message differs, the verdict must not.
        expectLoadFailure("share the id") {
            try fixture("rig", set: "root/children/0/id", to: "body")
        }
    }

    func testRejectsTwoPosesDrivingOneChannelWithDifferentPathKinds() {
        // The ALL-PAIRS rule, and why it is stronger than the timelines'
        // consecutive-step check: the arbiter can morph between ANY two moods,
        // so it is not enough for each pose to agree with the one authored next
        // to it. `line` rests at MLL and all three poses drive it at MLL; an ML
        // here is a morph that would throw only when the arbiter happened to
        // pick that pair at run time.
        expectLoadFailure("command signature") {
            try fixture("poses", set: "poses/eager/channels/line.shape",
                        to: "M40,68L60,68")
        }
    }

    func testRejectsATimelineWhoseStepsOutrunItsDeclaredDuration() {
        // `duration` is what the host waits on before firing `onDone`. Declaring
        // it short fires `onDone` mid-tween — every individual frame still
        // correct, so no golden catches it. This is the check that found a real
        // character's `yawn` declaring 2.05 s against a 2.1 s
        // `body.scale` settle.
        expectLoadFailure("steps run to") {
            try fixture("timelines", set: "timelines/flip/duration", to: 0.1)
        }
    }

    func testRejectsAnUnknownEaseName() {
        expectLoadFailure("elastic.out") {
            try fixture("poses", set: "poses/calm/ease", to: "elastic.out")
        }
    }

    func testRejectsAPathOutsideTheSupportedSubset() {
        expectLoadFailure("unsupported") {
            try fixture("timelines", set: "timelines/flip/steps/1/to",
                        to: "M0,0 A45,45 0 0 1 10,10")
        }
    }

    func testRejectsAPoseDrivingShapeOnABendDrivenNode() {
        // `limb` is rebuilt from its points and `.bend` every frame, so a
        // `.shape` channel on it would win and the bend would silently stop.
        expectLoadFailure("bend-driven") {
            try fixture("poses", set: "poses/calm/channels/limb.shape", to: "M0,0L1,1")
        }
    }

    func testRejectsAShapeMissingAFieldItsKindRequires() {
        // Swift's own check: the web's discriminated union makes this a type
        // error, so there is nothing to test there and everything to test here.
        expectLoadFailure("band") {
            try fixture("rig", set: "root/children/0/shape/band", to: nil)
        }
    }

    func testRejectsACropNamingAFeatureNoNodeCarries() {
        expectLoadFailure("knees") {
            try fixture("character", set: "crops/coreOnly", to: ["knees"])
        }
    }

    func testRejectsAVariantPatchingAnInkThatDoesNotExist() {
        expectLoadFailure("outline") {
            try fixture("character", set: "variants/bold/inks/outline", to: ["width": 9])
        }
    }

    func testRejectsAVariantInkPatchWithAnUnknownField() {
        expectLoadFailure("dash") {
            try fixture("character", set: "variants/bold/inks/body/dash", to: 3)
        }
    }

    func testRejectsAVariantPatchingAShapeFieldTheNodesKindDoesNotHave() {
        // `pupil` is a disc: it has cx, cy and r, and no band.
        expectLoadFailure("no shape field \"band\"") {
            try fixture("character", set: "variants/bold/shapes/pupil/band", to: 3)
        }
    }

    func testRejectsAVariantPatchingAMorphableNode() {
        // `line` is a polyline with a family and no bend, so its geometry lives
        // on `line.shape` and is re-seeded from the unpatched rig every build. A
        // patch here would be silently overwritten, which is worse than an error.
        expectLoadFailure("morphable") {
            try fixture("character", set: "variants/bold/shapes/line/points",
                        to: [[0, 0], [1, 1], [2, 2]])
        }
    }

    func testRejectsAVariantThatChangesAShapeFieldsPointCount() {
        // `limb` is bend-driven, so it IS patchable — but a point-count change is
        // a different shape, not a size cut of the same one.
        expectLoadFailure("point count") {
            try fixture("character", set: "variants/bold/shapes/limb/points",
                        to: [[0, 0], [1, 1]])
        }
    }

    func testRejectsASayingForAMoodWithNoPose() {
        expectLoadFailure("smitten") {
            try fixture("sayings", set: "sayings/smitten", to: ["hello"])
        }
    }

    func testRejectsALoopGatedOnAPredicateThatIsNeitherAParamNorABuiltIn() {
        // The failure mode this guards is silent: an unknown predicate reads as
        // false forever, so the loop simply never runs and nothing complains.
        expectLoadFailure("eyesClosed") {
            try fixture("behavior", set: "loops/0/disabledWhen", to: "eyesClosed")
        }
    }

    func testRejectsALoopAmplitudeNoPoseSupplies() {
        expectLoadFailure("shimmy") {
            try fixture("behavior", set: "loops/1/amplitude", to: ["param": "shimmy"])
        }
    }

    func testRejectsALadderMissingOneOfItsThreeRungs() {
        // Rung 0 is the mood the arbiter paints at startup and returns to on
        // every `notice()`. Nothing else in the config points at it, so an
        // omitted `active` loads clean and then crashes the first time the
        // arbiter indexes its rung table.
        expectLoadFailure("\"active\" rung") {
            try fixture("behavior", set: "ladder/moods/active", to: nil)
        }
    }

    func testRejectsChoreographyKeyedOnAMoodNoPoseDefines() {
        // A choreographed mood never has its pose applied, which is exactly why
        // the pose still has to exist: the name is reachable from the ladder,
        // the poke rules and `waking`, and every one of those is checked
        // against the poses.
        expectLoadFailure("choreography names unknown mood \"stretching\"") {
            try fixture("behavior", set: "choreography/stretching", to: "flip")
        }
    }

    func testRejectsChoreographyPointingAtATimelineThatDoesNotExist() {
        expectLoadFailure("choreography for \"flipping\" names unknown timeline \"stretch\"") {
            try fixture("behavior", set: "choreography/flipping", to: "stretch")
        }
    }

    func testRejectsWakingPlayNamingATimelineRatherThanAMood() {
        // The trap this catches is the port's own first spelling: `play` used
        // to name the flip TIMELINE, so the wake window reported `idle` as the
        // mood and every mood-keyed reflex missed the flip entirely.
        expectLoadFailure("waking.play names unknown mood \"flip\"") {
            try fixture("behavior", set: "waking/play", to: "flip")
        }
    }

    func testRejectsAPromoteStepThatAlsoNamesItsOwnTarget() {
        // `to` and `promote` are mutually exclusive: a promote computes its
        // target out of whatever shape the channel already holds, and a value
        // written by hand alongside it is a target the loader cannot trust the
        // step to reach.
        expectLoadFailure("both promotes line.shape and gives it a value") {
            try fixture("timelines", set: "timelines/flip/steps/0/promote", to: 3)
        }
    }

    func testRejectsAPromoteStepWithoutAFamily() {
        // A whole-step replacement, not a field-by-field patch: `fixture`
        // takes one mutation per call, so a step that must lose `to` AND
        // `family` while gaining `promote` is authored as one new step object
        // at the step's own index.
        expectLoadFailure("promotes line.shape without naming a family") {
            try fixture("timelines", set: "timelines/flip/steps/0", to: [
                "at": 0, "channel": "line.shape", "promote": 3,
                "duration": 0, "ease": "none",
            ])
        }
    }

    func testRejectsAPromoteWhoseSourceIsNotAnOpenPolyline() {
        // Step 1 already morphs within `arcLine`, "MC" — a cubic, not the
        // open polyline `/^ML+$/` a promote needs a source shape to be — so
        // promoting it (into `arcLine` again, changing nothing about the
        // family in force) still has to fail on the source check alone.
        expectLoadFailure(
            "out of family \"arcLine\", whose shape is \"MC\"; only an open polyline can be promoted"
        ) {
            try fixture("timelines", set: "timelines/flip/steps/1", to: [
                "at": 0, "channel": "line.shape", "promote": 6, "family": "arcLine",
                "duration": 0, "ease": "sine.inOut",
            ])
        }
    }
    // MARK: - pair arity (finding 16, the load-time half)
    //
    // `schema.json` already says `minItems: 2, maxItems: 2` on all eight of
    // these fields (`#/$defs/Point`), and says it to nobody: nothing validates a
    // config against the schema at load. `requirePair` is what turns it into a
    // rule. The runtime's `pairRange` still degrades a short pair to a
    // degenerate range rather than trapping — that is the second line of
    // defence, for a config that reaches the engine from anywhere but a loader.

    func testRejectsAGazeReachThatIsNotExactlyTwoNumbers() {
        expectLoadFailure("behavior.gaze.reachCurious needs exactly two numbers, not 1") {
            try fixture("behavior", set: "gaze/reachCurious", to: [0.6])
        }
    }

    func testRejectsAnIdleFidgetDurationRangeOfThreeNumbers() {
        expectLoadFailure("behavior.idleFidget.durationRange needs exactly two numbers, not 3") {
            try fixture("behavior", set: "idleFidget/durationRange", to: [0.5, 1.1, 2.0])
        }
    }

    func testRejectsAOneElementRearmGapThePairThatUsedToTrapMinutesIn() {
        // `"gapMs": [4000]` is the finding's own example. It loaded clean, and
        // then this engine trapped on `pair[1]` — `Index out of range`, minutes
        // into a session, arbitrarily far from the config that caused it —
        // while the web engine produced a NaN deadline that could never come
        // due. One bad config, two different wrong answers.
        expectLoadFailure("behavior.idleFidget.rearm.gapMs needs exactly two numbers, not 1") {
            try fixture("behavior", set: "idleFidget/rearm/gapMs", to: [4000])
        }
    }

    func testRejectsASpeechBubbleDistanceThatIsNotAPair() {
        expectLoadFailure("behavior.speech.bubble.distance needs exactly two numbers, not 0") {
            try fixture("behavior", set: "speech/bubble/distance", to: [Double]())
        }
    }

    func testRejectsAMoodEffectsRearmMsAndItsStepsDurationRangeAlike() {
        expectLoadFailure("rearmMs needs exactly two numbers, not 1") {
            try fixture("behavior", set: "moodEffects/eager/rearmMs", to: [1200])
        }
        expectLoadFailure("step durationRange needs exactly two numbers, not 3") {
            try fixture("behavior", set: "moodEffects/eager/drift/0/durationRange", to: [1, 2, 3])
        }
    }

    // MARK: - channel type (finding 17, the loader half)

    func testRejectsAnEffectStepWritingANumberToAChannelThatHoldsAPath() {
        // The finding's second half: `requireChannel` said the channel exists
        // and nothing said it can hold what the step writes. An effect step's
        // value is always numeric, so a `.shape` channel is a type error — one
        // that used to surface only as `Timelines.swift`'s promote quietly
        // refusing, mid-session, with the write dropped.
        expectLoadFailure("writes a number to line.shape, which holds a path") {
            try fixture("behavior", set: "moodEffects/calm/once/0/channels",
                        to: ["line.shape": 1])
        }
    }

    func testRejectsAnEffectStepWritingANumberToAChannelThatHoldsAColour() {
        expectLoadFailure("writes a number to body.ink, which holds a colour") {
            try fixture("behavior", set: "moodEffects/calm/once/0/channels",
                        to: ["body.ink": 0.5])
        }
    }

    // MARK: - branch target exists (finding 36, the loader half)

    func testRejectsAnEffectThatBranchesToAListItDoesNotDefine() {
        // Spelling the key right was the whole of the old check. An effect that
        // branches to "drift" and defines none used to load clean, then go
        // silent on the share of stirs the branch sent that way — while still
        // drawing the branch value and the re-arm gap, so the chain lived
        // forever and the shared PRNG stream walked out of step with every
        // golden. `stir`'s `stepList` guard ends the chain visibly now; this
        // makes the state unreachable from an authored config at all.
        expectLoadFailure("branches to \"drift\", which it does not define") {
            try fixture("behavior", set: "moodEffects/eager/drift", to: nil)
        }
    }

    func testStillAcceptsAnEffectWhoseBranchListIsAuthoredEmpty() throws {
        // Absent and empty are different statements — "no such list" against
        // "nothing to play this round" — and the runtime's old `?? []` was
        // collapsing them. The runtime keeps the distinction now; so must the
        // loader, or the distinction is only half real.
        _ = try CharacterConfig.load(
            try fixture("behavior", set: "moodEffects/eager/drift", to: [Any]()))
    }
}
