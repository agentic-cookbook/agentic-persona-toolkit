import XCTest
@testable import AvatarAnimationEngine

final class SceneTests: XCTestCase {

    // The `dot` fixture's authored geometry, emitted by the same builders that
    // run every frame — pinned as literals so a change in `Build` fails HERE,
    // loudly, rather than silently agreeing with itself.
    private enum Expected {
        static let ringPlain = "M50,30C61.046,30 70,38.954 70,50C70,61.046 61.046,70 50,70"
            + "C38.954,70 30,61.046 30,50C30,38.954 38.954,30 50,30Z"
            + "M50,34C41.1632,34 34,41.1632 34,50C34,58.8368 41.1632,66 50,66"
            + "C58.8368,66 66,58.8368 66,50C66,41.1632 58.8368,34 50,34Z"
        static let ringBold = "M50,30C61.046,30 70,38.954 70,50C70,61.046 61.046,70 50,70"
            + "C38.954,70 30,61.046 30,50C30,38.954 38.954,30 50,30Z"
            + "M50,37C42.8201,37 37,42.8201 37,50C37,57.1799 42.8201,63 50,63"
            + "C57.1799,63 63,57.1799 63,50C63,42.8201 57.1799,37 50,37Z"
        static let pupilPlain = "M50,44C53.3138,44 56,46.6862 56,50C56,53.3138 53.3138,56 50,56"
            + "C46.6862,56 44,53.3138 44,50C44,46.6862 46.6862,44 50,44Z"
        static let pupilBold = "M50,42C54.4184,42 58,45.5816 58,50C58,54.4184 54.4184,58 50,58"
            + "C45.5816,58 42,54.4184 42,50C42,45.5816 45.5816,42 50,42Z"
        static let spark = "M50,42C51.1046,42 52,42.8954 52,44C52,45.1046 51.1046,46 50,46"
            + "C48.8954,46 48,45.1046 48,44C48,42.8954 48.8954,42 50,42Z"
        static let line = "M40,70L50,74L60,70"
        static let limbRest = "M50,30C50,20 50,12 50,6"
        static let limbInward = "M50,30C53,20 55.4,12 56,6"
        static let limbRaw10 = "M50,30C55,20 59,12 60,6"
        static let limbOutward = "M50,30C45,20 41,12 40,6"
    }

    private func loadFixtureConfig() throws -> CharacterConfig {
        let d = try Fixture.all()
        return try CharacterConfig.load(RawFiles(
            character: d["character"]!, rig: d["rig"]!, poses: d["poses"]!,
            timelines: d["timelines"]!, behavior: d["behavior"]!, sayings: d["sayings"]!))
    }

    /// A scene over the fixture plus a channel store seeded to rest — the state
    /// every frame starts from.
    private func fresh(variant: String? = nil) throws -> (Scene, Channels) {
        let config = try loadFixtureConfig()
        let channels = Channels()
        config.seed(into: channels)
        return (try Scene(config, variant: variant), channels)
    }

    private func item(_ list: DisplayList, _ id: String) throws -> DisplayItem {
        guard let found = list.first(where: { $0.id == id }) else {
            throw SceneError("no display item with id \"\(id)\"")
        }
        return found
    }

    func testEmitsEveryShapeNodeOnceInDeclarationOrder() throws {
        let (scene, channels) = try fresh()
        let ids = try scene.compose(channels).map(\.id)
        // `body` carries no shape, so it transforms its children and paints
        // nothing itself; `spark` is its last child, so it paints on top.
        XCTAssertEqual(ids, ["eye", "pupil", "limb", "line", "spark"])
        XCTAssertEqual(Set(ids).count, ids.count)
    }

    func testRestsAtIdentityWithTheAuthoredGeometryInLocalSpace() throws {
        let (scene, channels) = try fresh()
        let list = try scene.compose(channels)
        let eye = try item(list, "eye")
        // The ring is authored around its own centre in local space and nothing
        // is driven, so the composed matrix is the identity and the path is the
        // authored path — rule 3, asserted rather than trusted.
        XCTAssertEqual(eye.m, .identity)
        XCTAssertEqual(eye.d, Expected.ringPlain)
        XCTAssertEqual(eye.kind, "MCCCCZMCCCCZ")
        XCTAssertEqual(try item(list, "pupil").d, Expected.pupilPlain)
        XCTAssertEqual(try item(list, "line").d, Expected.line)
        XCTAssertEqual(try item(list, "line").kind, "MLL")
        XCTAssertEqual(try item(list, "spark").d, Expected.spark)
    }

    func testComposesAParentTransformIntoItsChildren() throws {
        let (scene, channels) = try fresh()
        channels.set("body.rotation", 90)
        // `eye` has no transform of its own, so its world matrix IS the body's:
        // a quarter turn about the body pivot (50, 50).
        let m = try item(try scene.compose(channels), "eye").m
        XCTAssertEqual(m.a, 0, accuracy: 1e-12)
        XCTAssertEqual(m.b, 1, accuracy: 1e-12)
        XCTAssertEqual(m.c, -1, accuracy: 1e-12)
        XCTAssertEqual(m.d, 0, accuracy: 1e-12)
        XCTAssertEqual(m.e, 100, accuracy: 1e-12)
        XCTAssertEqual(m.f, 0, accuracy: 1e-12)
    }

    // MARK: - the pivot channels (Ruling 76)

    func testSeedsTheRigsAuthoredOriginAsThePivotChannelsRestValue() throws {
        let config = try loadFixtureConfig()
        // `body` is the only node in the fixture with an authored transform ...
        XCTAssertEqual(config.rest["body.pivotX"]?.number, 50)
        XCTAssertEqual(config.rest["body.pivotY"]?.number, 50)
        // ... and every other node still gets the pair, resting at the origin.
        // A pivot the rig never mentions is still a pivot something can drive,
        // and a node whose pivot channels did not exist could not be given one
        // without editing the rig.
        XCTAssertEqual(config.rest["line.pivotX"]?.number, 0)
        XCTAssertEqual(config.rest["line.pivotY"]?.number, 0)
    }

    func testComposesAboutTheChannelsOriginNotTheRigs() throws {
        let (scene, channels) = try fresh()
        channels.set("body.rotation", 4)
        let before = try item(try scene.compose(channels), "line").m
        channels.set("body.pivotY", 74)
        let after = try item(try scene.compose(channels), "line").m

        // Two rotations of the SAME angle about origins `d` apart differ by the
        // CHORD `d · 2·sin(θ/2)`, not by `d · sin(θ)`. At four degrees those two
        // are within 0.1% of each other, which no eye catches and every golden
        // does — so the identity is asserted here rather than left implied by
        // the matrix arithmetic.
        let d = 74.0 - 50.0
        let chord = d * 2 * sin(2 * Double.pi / 180)
        XCTAssertEqual(hypot(after.e - before.e, after.f - before.f), chord,
                       accuracy: 1e-9)
        XCTAssertEqual(chord, 1.6752, accuracy: 1e-4)
    }

    func testSquashesOnlyTheNodeWhoseScaleIsDriven() throws {
        let (scene, channels) = try fresh()
        channels.set("eye.scaleY", 0.1)
        let list = try scene.compose(channels)
        XCTAssertEqual(try item(list, "eye").m.d, 0.1, accuracy: 1e-12)
        XCTAssertEqual(try item(list, "pupil").m.d, 1)
    }

    func testResolvesLateBoundInkThroughTheBodysInkChannel() throws {
        // Every "@body" ink reads `body.ink`, which is how one channel recolours
        // the whole character without the rig repeating the colour on each node.
        let (scene, channels) = try fresh()
        var list = try scene.compose(channels)
        XCTAssertEqual(try item(list, "eye").paint.ink, "#112233")
        XCTAssertEqual(try item(list, "line").paint.ink, "#112233")
        XCTAssertEqual(try item(list, "pupil").paint.ink, "#000000")

        channels.set("body.ink", "warm")
        list = try scene.compose(channels)
        XCTAssertEqual(try item(list, "eye").paint.ink, "#ff8800")
        XCTAssertEqual(try item(list, "line").paint.ink, "#ff8800")
        // …but a node whose ink names its own colour is untouched by it.
        XCTAssertEqual(try item(list, "pupil").paint.ink, "#000000")

        // Mid-tween the channel holds a literal, not a palette key. Both resolve.
        channels.set("body.ink", "#ff2d2d")
        XCTAssertEqual(try item(try scene.compose(channels), "eye").paint.ink, "#ff2d2d")
    }

    func testTakesStrokeVsFillAndWidthFromTheInkNotTheShape() throws {
        let (scene, channels) = try fresh()
        let list = try scene.compose(channels)
        let eye = try item(list, "eye")
        XCTAssertFalse(eye.paint.fill)
        XCTAssertEqual(eye.paint.width, 4)
        XCTAssertEqual(try item(list, "line").paint.width, 4)
        let pupil = try item(list, "pupil")
        XCTAssertTrue(pupil.paint.fill)
        XCTAssertNil(pupil.paint.width)
    }

    func testKeepsAFullyTransparentNodeInTheList() throws {
        let (scene, channels) = try fresh()
        // `spark` rests at alpha 0 and is emitted anyway — rule 2. The golden
        // diff checks list LENGTH structurally, so a skipped node is a mismatch
        // on every later item, not a missing one.
        var list = try scene.compose(channels)
        XCTAssertEqual(try item(list, "spark").paint.alpha, 0)
        XCTAssertEqual(list.count, 5)

        channels.set("line.alpha", 0)
        list = try scene.compose(channels)
        XCTAssertEqual(try item(list, "line").paint.alpha, 0)
        XCTAssertEqual(list.count, 5)
    }

    func testTakesADrivenPathStraightOffTheShapeChannel() throws {
        let (scene, channels) = try fresh()
        channels.set("line.shape", "M40,60L50,60L60,60")
        let line = try item(try scene.compose(channels), "line")
        XCTAssertEqual(line.d, "M40,60L50,60L60,60")
        XCTAssertEqual(line.kind, "MLL")
    }

    func testRebuildsABendDrivenNodeFromItsPointsAndBend() throws {
        // `limb` has NO `.shape` channel: two authorities over one node's
        // geometry is exactly how a bend stops bending. `bend` moves the control
        // points, weighted along the axis, and the path is rebuilt each frame.
        // It moves them by exactly what the channel holds — the inward damp is
        // applied where the value is WRITTEN (`CharacterConfig.respond`), never
        // here, so a channel set by hand is already a rendered deflection.
        let (scene, channels) = try fresh()
        let rest = try item(try scene.compose(channels), "limb")
        XCTAssertEqual(rest.d, Expected.limbRest)
        XCTAssertEqual(rest.kind, "MC")

        channels.set("limb.bend", 10)
        XCTAssertEqual(try item(try scene.compose(channels), "limb").d, Expected.limbRaw10)
    }

    func testRendersABendUndampedInBothDirections() throws {
        // weights [0, 0.5, 0.9, 1] on x, and no asymmetry at render: +10 and
        // -10 travel the same distance in opposite directions. `respond` is
        // what makes the two ends of a sway unequal, and its own test is in
        // ConfigTests; a value that reaches the compositor has been through it.
        let (scene, channels) = try fresh()
        channels.set("limb.bend", 6)
        XCTAssertEqual(try item(try scene.compose(channels), "limb").d, Expected.limbInward)
        channels.set("limb.bend", -10)
        XCTAssertEqual(try item(try scene.compose(channels), "limb").d, Expected.limbOutward)
    }

    func testDampsOnlyABendsInwardSideAndLeavesEveryOtherChannelAlone() throws {
        // `limb` bends inward on the positive side, damped to 0.6. The damp is
        // one-sided, which is why it cannot be folded into the weights, and it
        // is applied HERE rather than at render, so a tween crossing zero draws
        // the straight line the original's path morph draws.
        let config = try loadFixtureConfig()
        XCTAssertEqual(config.respond("limb.bend", .number(10)), .number(6))
        XCTAssertEqual(config.respond("limb.bend", .number(-10)), .number(-10))
        XCTAssertEqual(config.respond("limb.bend", .number(0)), .number(0))
        // Not a bend, not a number: identity.
        XCTAssertEqual(config.respond("body.rotation", .number(10)), .number(10))
        XCTAssertEqual(config.respond("limb.bend", .text("#ff0000")), .text("#ff0000"))
    }

    func testTheVariantPatchesShapesAndInksAndNothingElse() throws {
        let config = try loadFixtureConfig()
        let channels = Channels()
        config.seed(into: channels)
        // Bold first, plain second: a variant that leaked into the config would
        // show up as the SECOND scene being wrong, which building plain first
        // would hide.
        let bold = try Scene(config, variant: "bold").compose(channels)
        let plain = try Scene(config).compose(channels)

        // Same nodes, same order, same transforms — a variant is a size cut of
        // the anatomy, not a different rig.
        XCTAssertEqual(bold.map(\.id), plain.map(\.id))
        XCTAssertEqual(bold.map(\.m), plain.map(\.m))

        XCTAssertEqual(try item(plain, "eye").d, Expected.ringPlain)
        XCTAssertEqual(try item(bold, "eye").d, Expected.ringBold)
        XCTAssertEqual(try item(plain, "pupil").d, Expected.pupilPlain)
        XCTAssertEqual(try item(bold, "pupil").d, Expected.pupilBold)

        XCTAssertEqual(try item(plain, "eye").paint.width, 4)
        XCTAssertEqual(try item(bold, "eye").paint.width, 7)
        XCTAssertEqual(try item(plain, "line").paint.width, 4)
        XCTAssertEqual(try item(bold, "line").paint.width, 7)

        // `spark` carries no variant entry, so it is identical in both — every
        // field, including the resolved colour.
        XCTAssertEqual(try item(bold, "spark"), try item(plain, "spark"))
    }

    func testThrowsOnAnUnknownVariantRatherThanSilentlyRenderingTheTrueRig() throws {
        let config = try loadFixtureConfig()
        XCTAssertThrowsError(try Scene(config, variant: "chunky")) { error in
            XCTAssertTrue("\(error)".contains("chunky"), "\(error)")
        }
    }

    func testRefusesAnInkThatResolvesBackToItself() throws {
        // The loader cannot see this cycle: it closes through a runtime channel
        // value, which does not exist at load time. Without the depth guard the
        // render loop would hang instead of failing.
        let (scene, channels) = try fresh()
        channels.set("body.ink", "@body")
        XCTAssertThrowsError(try scene.compose(channels)) { error in
            XCTAssertTrue("\(error)".contains("does not resolve to a colour"), "\(error)")
        }
    }
}
