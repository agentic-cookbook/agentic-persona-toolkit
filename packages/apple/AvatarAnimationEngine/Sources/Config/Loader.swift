import Foundation

public struct ConfigError: Error, Equatable, CustomStringConvertible {
    public let message: String
    public init(_ message: String) { self.message = message }
    public var description: String { "avatar config: \(message)" }
}

/// The six files, unparsed.
public struct RawFiles: Sendable {
    public var character: Data
    public var rig: Data
    public var poses: Data
    public var timelines: Data
    public var behavior: Data
    public var sayings: Data

    public init(character: Data, rig: Data, poses: Data,
                timelines: Data, behavior: Data, sayings: Data) {
        self.character = character
        self.rig = rig
        self.poses = poses
        self.timelines = timelines
        self.behavior = behavior
        self.sayings = sayings
    }

    /// Reads `character.json` from `directory`, then the five files IT names —
    /// never five hardcoded filenames. `character.json` is the config's single
    /// entry point on both platforms, and that is what makes it one.
    public static func read(fromDirectory directory: URL) throws -> RawFiles {
        let characterURL = directory.appendingPathComponent("character.json")
        let character = try Data(contentsOf: characterURL)
        let names = try JSONDecoder().decode(CharacterFile.self, from: character).files
        func read(_ name: String) throws -> Data {
            try Data(contentsOf: directory.appendingPathComponent(name))
        }
        return RawFiles(character: character,
                        rig: try read(names.rig),
                        poses: try read(names.poses),
                        timelines: try read(names.timelines),
                        behavior: try read(names.behavior),
                        sayings: try read(names.sayings))
    }
}

public struct CharacterConfig {
    public let character: CharacterFile
    public let rig: RigFile
    public let poses: PosesFile
    public let timelines: TimelinesFile
    public let behavior: BehaviorFile
    public let sayings: SayingsFile

    public let channels: Set<String>
    public let families: [String: String]
    public let rest: [String: ChannelValue]
    public let nodes: [String: RigNode]
    public let bendDriven: Set<String>

    private let expandMap: [String: [String]]
    private let responses: [String: Bend]

    /// A group fans out to its members; anything else maps to itself.
    public func expand(_ channel: String) -> [String] {
        expandMap[channel] ?? [channel]
    }

    /// The value the rig RENDERS for a value written to `channel`.
    ///
    /// Only a bend has one, and the reason is the original's morph.
    /// `inwardDamp` is a kink at zero: apply it while rendering and a sway
    /// crossing zero draws a bent line through rendered space, because the
    /// channel is what moves linearly. The original tweens the two PATHS, so
    /// its rendered deflection is linear in eased time and only the ENDPOINTS
    /// carry the damp — the calm antenna sway runs -10.64 to +7.66 in a
    /// straight line, where damping at render draws -10.64 to +10.64 and folds
    /// the top half over. Mapping the value once, where it is written, puts the
    /// channel in the space the original interpolates: it holds rendered
    /// deflection, endpoints included, and the compositor reads it raw.
    public func respond(_ channel: String, _ value: ChannelValue) -> ChannelValue {
        guard let bend = responses[channel], case let .number(v) = value else { return value }
        let sign: Double = v > 0 ? 1 : (v < 0 ? -1 : 0)
        return sign == bend.inwardSign ? .number(v * bend.inwardDamp) : value
    }

    public static func load(_ files: RawFiles) throws -> CharacterConfig {
        func decode<T: Decodable>(_ type: T.Type, _ data: Data, _ name: String) throws -> T {
            do {
                return try JSONDecoder().decode(type, from: data)
            } catch {
                throw ConfigError("\(name) could not be read: \(error)")
            }
        }

        let character = try decode(CharacterFile.self, files.character, "character.json")
        let rig = try decode(RigFile.self, files.rig, "rig.json")
        var poses = try decode(PosesFile.self, files.poses, "poses.json")
        var timelines = try decode(TimelinesFile.self, files.timelines, "timelines.json")
        let behavior = try decode(BehaviorFile.self, files.behavior, "behavior.json")
        let sayings = try decode(SayingsFile.self, files.sayings, "sayings.json")

        // 1. schema versions ------------------------------------------------
        for (name, declared) in [("character.json", character.schemaVersion),
                                 ("rig.json", rig.schemaVersion),
                                 ("poses.json", poses.schemaVersion),
                                 ("timelines.json", timelines.schemaVersion),
                                 ("behavior.json", behavior.schemaVersion),
                                 ("sayings.json", sayings.schemaVersion)] {
            guard declared == Schema.version else {
                throw ConfigError(
                    "\(name) declares schemaVersion \(declared), but this engine reads "
                    + "schemaVersion \(Schema.version)")
            }
        }

        // 2. walk the rig ---------------------------------------------------
        var nodes: [String: RigNode] = [:]
        var order: [String] = []            // insertion order, for stable errors
        var concrete: Set<String> = []
        var features: Set<String> = []
        var families: [String: String] = [:]
        var bendDriven: Set<String> = []
        var rest: [String: ChannelValue] = [:]
        /// Nodes whose `.ink` channel carries a COLOUR rather than an ink key.
        var paletteDriven: Set<String> = []

        /// A name resolves to a COLOUR only if it is not also an ink key.
        ///
        /// `character.inks` and `character.palette` share one namespace, and a
        /// collision is not exotic — it is what happens whenever a character
        /// names an ink after the palette entry that ink points at, which is the
        /// obvious thing to call it (`{ kind: "fill", color: "shell" }` under the
        /// key `shell`). Checking the palette first would classify every node
        /// painted with such an ink as colour-driven, seeding `rest` with the
        /// resolved hex instead of the ink name. Inks-first is not a preference:
        /// it is the precedence `resolveInk` (Task 30) already applies at paint
        /// time, and the two have to agree.
        func paletteColour(_ name: String) -> String? {
            character.inks[name] != nil ? nil : character.palette[name]
        }

        /// `Build` takes flat number pairs, because the Path module knows
        /// nothing about config types — `Pt` lives here, not there.
        func flat(_ points: [Pt]) -> [[Double]] { points.map { [$0.x, $0.y] } }

        func requireShapeFields(_ id: String, _ shape: Shape) throws {
            for field in shape.kind.fields where !shape.declares(field) {
                throw ConfigError(
                    "node \"\(id)\" is a \(shape.kind.rawValue) but declares no \"\(field)\"")
            }
        }

        /// The path a familied node rests at, built from the rig by the same
        /// builders that run every frame — so the resting frame is not a second
        /// authoring of the same geometry.
        func restShape(_ id: String, _ shape: Shape) throws -> String {
            switch shape.kind {
            case .polyline: return try Build.polyline(flat(shape.points!))
            case .cubicO:   return Build.cubicO(cx: shape.cx!, cy: shape.cy!,
                                                rx: shape.rx!, ry: shape.ry!)
            case .bezier:   return try Build.bezier(flat(shape.points!))
            default:
                throw ConfigError("node \"\(id)\" has a family but is a \(shape.kind.rawValue)")
            }
        }

        func walk(_ node: RigNode) throws {
            // TS's own message is `duplicate node id "${id}"` (`load.ts`); this
            // is the one pinned test where the brief's own suite intentionally
            // diverges from it (see its comment: "the message differs, the
            // verdict must not"), so the wording here matches the PINNED test
            // rather than the TypeScript.
            guard nodes[node.id] == nil else {
                throw ConfigError("two nodes share the id \"\(node.id)\"")
            }
            nodes[node.id] = node
            order.append(node.id)
            if let feature = node.feature { features.insert(feature) }

            for prop in Animatable.all { concrete.insert("\(node.id).\(prop)") }
            for (prop, value) in NUM_REST { rest["\(node.id).\(prop)"] = .number(value) }

            if let t = node.transform {
                if let v = t.x { rest["\(node.id).x"] = .number(v) }
                if let v = t.y { rest["\(node.id).y"] = .number(v) }
                if let v = t.rotation { rest["\(node.id).rotation"] = .number(v) }
                if let v = t.scaleX { rest["\(node.id).scaleX"] = .number(v) }
                if let v = t.scaleY { rest["\(node.id).scaleY"] = .number(v) }
            }
            // The authored `pivot` is only this node's REST origin; `compose`
            // reads the channels, so a pose or a mood effect can move the origin
            // the way the original moves `transformOrigin`. A node with no
            // authored pivot rests at (0, 0), which is what `Mat.from` already
            // means by an absent pivot.
            let pivot = node.transform?.pivot
            rest["\(node.id).pivotX"] = .number(pivot?.x ?? 0)
            rest["\(node.id).pivotY"] = .number(pivot?.y ?? 0)

            if let alpha = node.alpha { rest["\(node.id).alpha"] = .number(alpha) }

            // The node's own ink is checked HERE, before any ink definition is
            // resolved. An unresolvable node ink and a dangling "@target" can be
            // the same typo, and this order is what makes the reported fault the
            // one the author wrote rather than the one it knocked over.
            if let ink = node.ink {
                guard character.inks[ink] != nil || character.palette[ink] != nil else {
                    throw ConfigError("node \"\(node.id)\" uses unresolved ink \"\(ink)\"")
                }
                if let colour = paletteColour(ink) {
                    // The node names a palette colour, so its `.ink` channel IS
                    // the colour — stored as a literal from the first frame,
                    // exactly as a pose will later write it.
                    paletteDriven.insert(node.id)
                    rest["\(node.id).ink"] = .text(colour)
                } else {
                    rest["\(node.id).ink"] = .text(ink)
                }
            }

            if let shape = node.shape {
                // A shaped node must name an ink, and that ink must be an INK,
                // not a bare palette colour -- `character.inks` is what carries
                // fill-vs-stroke and the stroke width, `character.palette` is
                // only a colour.
                guard let inkName = node.ink else {
                    throw ConfigError("node \"\(node.id)\" has a shape but no ink")
                }
                guard paletteColour(inkName) == nil else {
                    throw ConfigError(
                        "node \"\(node.id)\" has a shape but is painted with the palette "
                        + "colour \"\(inkName)\"; a shape needs an ink, which is what "
                        + "carries fill-vs-stroke and the stroke width")
                }
                // Swift's own check: the web's discriminated union makes a shape
                // missing a field its kind requires a compile-time impossibility,
                // so there is nothing to port here and everything to enforce.
                try requireShapeFields(node.id, shape)
                if let family = shape.family {
                    families[node.id] = family
                    rest["\(node.id).family"] = .text(family)
                    if shape.bend != nil {
                        // Rebuilt from its points and `.bend` every frame, so it
                        // gets no resting path to be rebuilt against.
                        bendDriven.insert(node.id)
                    } else {
                        rest["\(node.id).shape"] = .text(try restShape(node.id, shape))
                    }
                }
            }

            for child in node.children ?? [] { try walk(child) }
        }

        try walk(rig.root)

        // 3. ink definitions, and their late binding -------------------------
        for name in character.inks.keys.sorted() {
            let ink = character.inks[name]!
            if ink.color.hasPrefix("@") {
                let target = String(ink.color.dropFirst())
                guard nodes[target] != nil else {
                    throw ConfigError("ink \"\(name)\" uses unresolved ink \"\(ink.color)\"")
                }
                // `resolveInk` keeps resolving once it reaches the target's own
                // ink, so a chain that dead-ends on an ink KEY rather than a
                // palette colour would recurse further or dead-end at paint time
                // instead of load time. Load is where a config error belongs.
                guard paletteDriven.contains(target) else {
                    throw ConfigError(
                        "ink \"\(name)\" late-binds to \"\(ink.color)\", but node \"\(target)\" "
                        + "does not carry a palette colour to bind to")
                }
            } else if character.palette[ink.color] == nil {
                throw ConfigError("ink \"\(name)\" names unknown palette colour \"\(ink.color)\"")
            }
        }

        // 4. groups, and the derived `.scale` --------------------------------
        var expandMap: [String: [String]] = [:]
        for id in order {
            expandMap["\(id).scale"] = ["\(id).scaleX", "\(id).scaleY"]
        }
        for name in rig.groups.keys.sorted() {
            let members = rig.groups[name]!
            guard !concrete.contains(name) else {
                throw ConfigError(
                    "group \"\(name)\" shadows a node's own channel; rename the group")
            }
            guard expandMap[name] == nil else {
                throw ConfigError("group \"\(name)\" shadows the derived scale group")
            }
            for member in members where !concrete.contains(member) {
                throw ConfigError("group \"\(name)\" names unknown channel \"\(member)\"")
            }
            // Flattened through the derived map, not stored as authored. One
            // pass is enough: a group name can never itself be a member,
            // because members must be `concrete` and an authored group name is
            // rejected when it is.
            expandMap[name] = members.flatMap { expandMap[$0] ?? [$0] }
        }
        let channels = concrete.union(expandMap.keys)

        /// A group fans out to its members; anything else maps to itself. A
        /// local mirror of the public `expand(_:)` — `self` does not exist
        /// yet, since this method is what builds it.
        func expand(_ channel: String) -> [String] {
            expandMap[channel] ?? [channel]
        }

        // 4b. channel responses ----------------------------------------------
        var responses: [String: Bend] = [:]
        for id in order {
            guard let shape = nodes[id]?.shape, shape.kind == .bezier,
                  let bend = shape.bend else { continue }
            responses["\(id).bend"] = bend
        }

        // 5. the shared per-channel checks ------------------------------------
        func requireChannel(_ name: String, _ context: String) throws {
            guard channels.contains(name) else {
                throw ConfigError("\(context) targets unknown channel \"\(name)\"")
            }
        }

        func requireEase(_ name: String, _ context: String) throws {
            guard (try? Ease.resolve(name)) != nil else {
                throw ConfigError("\(context) uses unknown ease \"\(name)\"")
            }
        }

        func requireNode(_ id: String, _ context: String) throws {
            guard nodes[id] != nil else {
                throw ConfigError("\(context) names unknown node \"\(id)\"")
            }
        }

        func requireMood(_ name: String, _ context: String) throws {
            guard poses.poses[name] != nil else {
                throw ConfigError("\(context) names unknown mood \"\(name)\"")
            }
        }

        /// An `.ink` channel carries either a colour (the `body` layer, the one
        /// every "@body" resolves through) or an INK key naming how a node is
        /// painted. Colours are normalised to "#rrggbb" HERE, once, so
        /// `lerpValue` can interpolate them in OKLab without knowing what a
        /// palette is. An ink key is left exactly as written.
        func colourise(_ channel: String, _ to: ChannelValue, _ context: String) throws -> ChannelValue {
            guard case .text(let s) = to, channel.hasSuffix(".ink") else { return to }
            if character.inks[s] != nil { return to }
            guard let hex = character.palette[s] else {
                throw ConfigError("\(context) sets \(channel) to unknown colour \"\(s)\"")
            }
            return .text(hex)
        }

        /// Every authored `d` is re-emitted through the engine's own printer, so
        /// a config author's spacing and precision can never reach a channel or
        /// a golden log. A timeline's closing snap and the pose that timeline
        /// lands on routinely author the SAME geometry with different
        /// whitespace, and those must become ONE string.
        func canonicalise(_ channel: String, _ to: ChannelValue, _ context: String) throws -> ChannelValue {
            guard case .text(let d) = to, channel.hasSuffix(".shape") else { return to }
            do {
                return .text(emitPath(try parsePath(d)))
            } catch {
                throw ConfigError("\(context): unsupported path — \(error)")
            }
        }

        /// Pure validation — no normalisation, and (matching the web exactly)
        /// no type check at all for a channel that is neither `.shape` nor
        /// `.ink`: only those two suffixes get special handling, so e.g. a
        /// `.family` channel written a number, or an `.x` channel written a
        /// string, passes through unexamined. `colourise` has already turned a
        /// palette name on an ink channel into a literal, so a "#" here is
        /// normalised, not unchecked.
        func requireValue(_ channel: String, _ to: ChannelValue, _ context: String) throws {
            if channel.hasSuffix(".shape"),
               bendDriven.contains(String(channel.dropLast(".shape".count))) {
                throw ConfigError(
                    "\(context) sets \(channel), but that node is bend-driven — animate its "
                    + ".bend instead")
            }
            guard case .text(let s) = to else { return }
            if channel.hasSuffix(".shape") {
                do {
                    _ = try parsePath(s)
                } catch {
                    throw ConfigError("\(context): unsupported path — \(error)")
                }
            } else if channel.hasSuffix(".ink") {
                guard s.hasPrefix("#") || character.palette[s] != nil
                        || character.inks[s] != nil else {
                    throw ConfigError("\(context) sets \(channel) to unknown colour \"\(s)\"")
                }
            }
        }

        /// `parsePath` reports its own reason; wrap it so the config's own
        /// prefix and location survive.
        func parse(path: String, context: String) throws -> ParsedPath {
            do {
                return try parsePath(path)
            } catch {
                throw ConfigError("\(context): unsupported path — \(error)")
            }
        }

        // 6. poses -------------------------------------------------------------
        // channel -> the command signature every pose driving it must share,
        // and who established it. Poses form an ARBITRARY transition graph: the
        // arbiter can move between any two moods, so a mood change morphs the
        // live geometry into whichever pose is next. Every pose driving one
        // `.shape` channel must therefore agree with every other — an all-pairs
        // requirement, strictly STRONGER than the timelines' consecutive-step
        // check below. Seeded from the node's rest shape, because rest is where
        // frame 0 starts and is itself a reachable end of a transition.
        var poseKind: [String: (kind: String, source: String)] = [:]
        for poseName in poses.poses.keys.sorted() {
            var pose = poses.poses[poseName]!
            let context = "pose \"\(poseName)\""
            try requireEase(pose.ease, context)
            for name in pose.channels.keys.sorted() {
                try requireChannel(name, context)
                let first = expand(name).first!
                var to = try colourise(first, pose.channels[name]!, context)
                to = try canonicalise(first, to, context)
                pose.channels[name] = to
                for member in expand(name) { try requireValue(member, to, context) }
                guard case .text(let d) = to else { continue }
                for channel in expand(name) where channel.hasSuffix(".shape") {
                    if poseKind[channel] == nil, case .text(let restD)? = rest[channel] {
                        let restKind = try parse(path: restD, context: "the rig's rest shape").kind
                        let restSource = "the rig's rest shape"
                        poseKind[channel] = (kind: restKind, source: restSource)
                    }
                    let kind = try parse(path: d, context: "\(context) drives \(channel)").kind
                    if let known = poseKind[channel] {
                        guard known.kind == kind else {
                            let knownKind = known.kind
                            let knownSource = known.source
                            throw ConfigError(
                                "\(context) drives \(channel) with path "
                                + "\"\(kind)\", but \(knownSource) drives it with "
                                + "\"\(knownKind)\"; the arbiter can morph between any two "
                                + "poses, so every pose driving one channel must share its "
                                + "command signature")
                        }
                    } else {
                        poseKind[channel] = (kind: kind, source: context)
                    }
                }
            }
            if let spin = pose.spin {
                try requireChannel(spin.channel, "\(context) spin")
                // Spin needs a single concrete channel, not a group that
                // expands to many.
                if expandMap[spin.channel] != nil {
                    throw ConfigError(
                        "\(context) spin targets group \"\(spin.channel)\"; " +
                        "spin needs a single concrete channel")
                }
                try requireEase(spin.ease, "\(context) spin")
                // A carried channel has to be one the pose actually states a
                // target for: `carries` RE-TIMES a target, it does not invent
                // one. Checking against the EXPANDED set lets a pose drive a
                // group and carry one member of it.
                var driven: Set<String> = []
                for channel in pose.channels.keys.sorted() {
                    for c in expandMap[channel] ?? [channel] { driven.insert(c) }
                }
                for carried in spin.carries ?? [] {
                    try requireChannel(carried, "\(context) spin carries")
                    if carried == spin.channel {
                        throw ConfigError(
                            "\(context) spin carries its own channel " +
                            "\"\(carried)\"; the spin already times it")
                    }
                    for c in expandMap[carried] ?? [carried] where !driven.contains(c) {
                        throw ConfigError(
                            "\(context) spin carries \"\(c)\", which the pose " +
                            "does not drive")
                    }
                }
            }
            poses.poses[poseName] = pose
        }
        // `poses.order` names every mood the character actually visits;
        // `poses.poses` may legitimately carry more (an authored-but-unreached
        // mood), so this checks only that `order` never dangles.
        for name in poses.order where poses.poses[name] == nil {
            throw ConfigError("poses.order names unknown pose \"\(name)\"")
        }

        // 7. timelines -----------------------------------------------------
        for name in timelines.timelines.keys.sorted() {
            var timeline = timelines.timelines[name]!
            let context = "timeline \"\(name)\""

            // `sorted(by:)` is NOT stable in Swift, and `flip` has two steps at
            // `at: 0`. Decorating with the authored index makes the order the
            // same one JavaScript's stable sort produces — which is the order
            // the family walk depends on.
            let ordered = timeline.steps.enumerated().sorted {
                $0.element.at == $1.element.at ? $0.offset < $1.offset : $0.element.at < $1.element.at
            }

            var familyOf: [String: String] = [:]   // channel -> family in force
            var kindOf: [String: String] = [:]     // family -> its command signature
            // A promote computes its target out of whatever shape the channel
            // holds when it fires, so there is no path here to check its kind
            // against. What CAN be checked is the pair of families it bridges,
            // collected during the walk and settled once `kindOf` is complete.
            var promotions: [(source: String, target: String, segments: Int, channel: String)] = []

            for (index, step) in ordered {
                try requireChannel(step.channel, context)
                try requireEase(step.ease, context)

                if step.promote != nil {
                    guard step.to == nil else {
                        throw ConfigError(
                            "\(context) both promotes \(step.channel) and gives it a value")
                    }
                    guard step.family != nil else {
                        throw ConfigError(
                            "\(context) promotes \(step.channel) without naming a family")
                    }
                    guard step.duration == 0 else {
                        throw ConfigError(
                            "\(context) promotes \(step.channel) over \(step.duration)s; a "
                            + "promote is a snap")
                    }
                    guard step.channel.hasSuffix(".shape") else {
                        throw ConfigError(
                            "\(context) promotes \(step.channel), which is not a shape channel")
                    }
                } else {
                    guard let to = step.to else {
                        throw ConfigError("\(context) drives \(step.channel) with no value")
                    }
                    let first = expand(step.channel).first!
                    var value = try colourise(first, to, context)
                    value = try canonicalise(first, value, context)
                    timeline.steps[index].to = value
                    for member in expand(step.channel) { try requireValue(member, value, context) }
                }

                guard step.channel.hasSuffix(".shape") else { continue }

                for c in expand(step.channel) {
                    let node = String(c.dropLast(".shape".count))
                    var current = familyOf[c]
                    if current == nil {
                        current = families[node]
                        // Seed the kind in force from the node's resting shape,
                        // so the FIRST authored step that morphs this channel is
                        // checked against what the node actually rests at.
                        if let cur = current, kindOf[cur] == nil,
                           case .text(let restD)? = rest["\(node).shape"] {
                            kindOf[cur] = try parse(path: restD, context: context).kind
                        }
                    }
                    guard var effectiveCurrent = current else {
                        throw ConfigError("\(context) drives \(c), whose node declares no family")
                    }
                    if let family = step.family {
                        // A step that CROSSES families must snap. A step that
                        // restates the family it is already in crosses nothing
                        // — that is an ordinary morph within one family.
                        if family != effectiveCurrent, step.duration != 0 {
                            throw ConfigError(
                                "\(context) tweens \(c) from family \"\(effectiveCurrent)\" to "
                                + "\"\(family)\"; a family change must have duration 0")
                        }
                        if let promote = step.promote {
                            promotions.append(
                                (source: effectiveCurrent, target: family, segments: promote, channel: c))
                        }
                        effectiveCurrent = family
                        familyOf[c] = family
                    }
                    // A promote step names no value of its own, and a numeric
                    // channel has nothing to morph: nothing left to check here.
                    guard case .text(let d)? = timeline.steps[index].to else { continue }
                    let kind = try parse(path: d, context: context).kind
                    if let known = kindOf[effectiveCurrent] {
                        guard known == kind else {
                            throw ConfigError(
                                "\(context) morphs within family \"\(effectiveCurrent)\" but "
                                + "its path is \"\(kind)\" where the family is \"\(known)\"")
                        }
                    } else {
                        kindOf[effectiveCurrent] = kind
                    }
                }
            }

            // The `promotions` collected above, checked now that every step has
            // run and `kindOf` is complete.
            for pr in promotions {
                let source = kindOf[pr.source]
                guard let source, source.hasPrefix("M"), source.count > 1,
                      source.dropFirst().allSatisfy({ $0 == "L" }) else {
                    throw ConfigError(
                        "\(context) promotes \(pr.channel) out of family \"\(pr.source)\", "
                        + "whose shape is \"\(source ?? "unknown")\"; only an open polyline can "
                        + "be promoted")
                }
                let target = kindOf[pr.target]
                guard target == "M" + String(repeating: "C", count: pr.segments) else {
                    throw ConfigError(
                        "\(context) promotes \(pr.channel) into family \"\(pr.target)\" as "
                        + "\(pr.segments) cubic(s), but that family's shape is "
                        + "\"\(target ?? "unknown")\"")
                }
                let lines = source.count - 1
                guard lines != 0, pr.segments % lines == 0 else {
                    throw ConfigError(
                        "\(context) promotes \(pr.channel)'s \(lines) line(s) into "
                        + "\(pr.segments) segment(s); the target count must be a whole multiple "
                        + "of the source's")
                }
            }
            // The declared `duration` is what the host waits on before firing
            // `onDone`; the steps are what actually move. A step still running
            // at `duration` means `onDone` fires mid-tween and the character is
            // caught in motion — a defect no golden frame catches, because
            // every individual frame is right. So the declaration is a FLOOR,
            // not a hint.
            let span = timeline.steps.reduce(0.0) { max($0, $1.at + $1.duration) }
            guard timeline.duration >= span else {
                throw ConfigError(
                    "\(context) declares duration \(timeline.duration) but its "
                    + "steps run to \(span)")
            }
            timelines.timelines[name] = timeline
        }

        // 8. behaviour -------------------------------------------------------
        // A delay key is a node id (the whole node lags) or one full channel.
        for key in behavior.channelDelays.keys.sorted() {
            guard nodes[key] == nil else { continue }
            try requireChannel(key, "behavior.channelDelays")
        }

        // Predicates are a closed set of three forms; anything else is a typo,
        // and a typo that loads would be a permanently-false condition — a loop
        // that simply never runs, which no test would notice and no golden
        // would catch. `BUILTIN_PREDICATES` (Types.swift) allowlists only
        // "eyesShut"/"curious" at CONFIG time — see its doc comment for why
        // "choreographed" is deliberately excluded even though the runtime
        // `predicate()` honours it.
        func requirePredicate(_ name: String?, _ context: String) throws {
            guard let name else { return }
            if BUILTIN_PREDICATES.contains(name) { return }
            guard let def = behavior.params[name] else {
                throw ConfigError("\(context) names unknown predicate \"\(name)\"")
            }
            guard case .gt = def else {
                throw ConfigError("\(context) names \"\(name)\", which is a number, not a boolean")
            }
        }
        // The left operand of a `gt` is POSE-supplied and nothing else. Letting
        // it name another `params` entry would allow two params to reference
        // each other, and the evaluator would recurse forever on data that
        // loaded cleanly.
        func requirePoseNumber(_ name: String, _ context: String) throws {
            for mood in poses.poses.keys.sorted() where poses.poses[mood]?.loops?[name] == nil {
                throw ConfigError(
                    "\(context) reads \"\(name)\", which pose \"\(mood)\" does not supply")
            }
        }
        // An amplitude is wider: it may also name a `select` param, because
        // that is how `swayAmp` picks between the calm and lively numbers.
        func requireAmplitude(_ amplitude: AmplitudeRef, _ context: String) throws {
            guard case .param(let name, _) = amplitude else { return }
            guard let def = behavior.params[name] else {
                try requirePoseNumber(name, context)
                return
            }
            guard case .select = def else {
                throw ConfigError("\(context) reads \"\(name)\", which is a boolean, not a number")
            }
        }

        for name in behavior.params.keys.sorted() {
            switch behavior.params[name]! {
            case .gt(let param, _):
                try requirePoseNumber(param, "param \"\(name)\"")
            case .select(let param, _, _):
                try requirePredicate(param, "param \"\(name)\"")
            }
        }
        for loop in behavior.loops {
            let context = "loop \"\(loop.id)\""
            try requireChannel(loop.channel, context)
            try requireEase(loop.ease, context)
            if let ease = loop.restEase { try requireEase(ease, "\(context) rest") }
            try requireAmplitude(loop.amplitude, "\(context) amplitude")
            // A duration is an amplitude reference too, and it is checked with
            // the same function for that reason — a period that named a
            // boolean param would otherwise load clean and run at zero seconds
            // a cycle.
            try requireAmplitude(loop.duration, "\(context) duration")
            try requirePredicate(loop.enabledWhen, context)
            try requirePredicate(loop.disabledWhen, context)
        }
        try requirePredicate(behavior.gaze.disabledWhen, "behavior.gaze")
        try requirePredicate(behavior.idleFidget.activeWhen, "behavior.idleFidget")
        try requirePredicate(behavior.pinpricks.shownWhen, "behavior.pinpricks")

        try requireChannel(behavior.blink.channel, "behavior.blink")
        try requireEase(behavior.blink.ease, "behavior.blink")
        // A typo'd mood here reads as false forever, silently disabling blink
        // suppression for that mood — the same silent-predicate failure mode
        // the loop and param checks above already guard against.
        for mood in behavior.blink.suppressedIn where poses.poses[mood] == nil {
            throw ConfigError("behavior.blink.suppressedIn names unknown mood \"\(mood)\"")
        }

        for channel in behavior.gaze.look.allChannels + behavior.gaze.tilt.allChannels
            + behavior.gaze.lean.allChannels {
            try requireChannel(channel, "behavior.gaze")
        }
        for move in [behavior.gaze.look, behavior.gaze.tilt, behavior.gaze.lean] {
            try requireEase(move.ease, "behavior.gaze")
        }

        try requireChannel(behavior.idleFidget.breath.channel, "behavior.idleFidget.breath")
        try requireEase(behavior.idleFidget.breath.ease, "behavior.idleFidget.breath")
        try requireChannel(behavior.idleFidget.sway.channel, "behavior.idleFidget.sway")
        for id in behavior.idleFidget.brow.nodes {
            try requireNode(id, "behavior.idleFidget.brow")
        }
        try requireEase(behavior.idleFidget.ease, "behavior.idleFidget")
        try requireEase(behavior.idleFidget.settle.ease, "behavior.idleFidget.settle")

        for id in behavior.pinpricks.nodes {
            try requireNode(id, "behavior.pinpricks")
        }
        try requireEase(behavior.pinpricks.ease, "behavior.pinpricks")

        // An effect's loop is a `LoopDef` in everything but its `id`, so it
        // gets the same six checks the top-level loops get — amplitude,
        // duration and both gates included.
        for mood in behavior.moodEffects.keys.sorted() {
            let effect = behavior.moodEffects[mood]!
            let context = "moodEffect \"\(effect.id)\""
            try requireMood(mood, "moodEffects")
            try requireNode(effect.target, context)
            for steps in [effect.twitch, effect.drift, effect.once] {
                for step in steps ?? [] {
                    try requireEase(step.ease, context)
                    for channel in step.channels.keys.sorted() {
                        try requireChannel(channel, context)
                    }
                }
            }
            // "twitch" or "drift" — and NOT "once", however plausible a third
            // step list looks here. `stir` plays `key == "drift" ? drift :
            // twitch`, so anything else silently plays the twitch list.
            if let branch = effect.branch {
                for key in [branch.then, branch.else] where !["twitch", "drift"].contains(key) {
                    throw ConfigError("\(context) branches to \"\(key)\", not \"twitch\" or \"drift\"")
                }
            }
            try requireEase(effect.settle.ease, "\(context) settle")
            if let loop = effect.loop {
                try requireChannel(loop.channel, "\(context) loop")
                try requireEase(loop.ease, "\(context) loop")
                try requireAmplitude(loop.amplitude, "\(context) loop amplitude")
                try requireAmplitude(loop.duration, "\(context) loop duration")
                try requirePredicate(loop.enabledWhen, "\(context) loop")
                try requirePredicate(loop.disabledWhen, "\(context) loop")
            }
        }

        for rule in behavior.poke {
            if rule.from != "*" && poses.poses[rule.from] == nil {
                throw ConfigError("poke names unknown mood \"\(rule.from)\"")
            }
            guard poses.poses[rule.expression] != nil else {
                throw ConfigError("poke names unknown pose \"\(rule.expression)\"")
            }
        }

        // A choreographed mood is still a mood — the ladder, the poke rules and
        // `waking` all name moods, and every one of those names is checked
        // against `poses.poses`. The pose is demanded even though the engine
        // never applies it.
        for mood in (behavior.choreography ?? [:]).keys.sorted() {
            let timeline = behavior.choreography![mood]!
            try requireMood(mood, "choreography")
            guard timelines.timelines[timeline] != nil else {
                throw ConfigError(
                    "choreography for \"\(mood)\" names unknown timeline \"\(timeline)\"")
            }
        }

        try requireMood(behavior.waking.from, "waking.from")
        try requireMood(behavior.waking.to, "waking.to")
        // A MOOD, not a timeline — see `WakingDef.play`. It does not have to be
        // choreographed: a character whose waking transition is a plain pose is
        // a legitimate character, and this validates the name, not the staging.
        try requireMood(behavior.waking.play, "waking.play")
        try requireMood(behavior.eyesShutMood, "eyesShutMood")

        // The ladder has exactly three rungs and the arbiter indexes them, so a
        // missing key is a crash at run time rather than a mood that never
        // appears. Demand all three by name before checking what they point at.
        for rung in ["active", "bored", "asleep"] where behavior.ladder.moods[rung] == nil {
            throw ConfigError("ladder is missing the \"\(rung)\" rung")
        }
        for mood in behavior.ladder.moods.keys.sorted() {
            try requireMood(behavior.ladder.moods[mood]!, "ladder")
        }

        try requireEase(behavior.speech.bubble.in.ease, "behavior.speech.bubble.in")
        try requireEase(behavior.speech.bubble.out.ease, "behavior.speech.bubble.out")

        // 9. crops -------------------------------------------------------------
        for name in character.crops.keys.sorted() {
            for feature in character.crops[name]! where !features.contains(feature) {
                throw ConfigError("crop \"\(name)\" names unknown feature \"\(feature)\"")
            }
        }

        // 10. variants -----------------------------------------------------
        // A node WITHOUT a `.shape` channel is rebuilt from its rig shape every
        // frame, so a patch on it takes effect. A node WITH one reads its
        // geometry off the channel, which is re-seeded from the unpatched rig —
        // so a patch there is dead config that renders identically and says
        // nothing. `rest` already knows which is which.
        for variantName in character.variants.keys.sorted() {
            let variant = character.variants[variantName]!
            let context = "variant \"\(variantName)\""

            for inkName in (variant.inks ?? [:]).keys.sorted() {
                guard character.inks[inkName] != nil else {
                    throw ConfigError("\(context) patches unknown ink \"\(inkName)\"")
                }
                for field in variant.inks![inkName]!.keys.sorted() where !INK_FIELDS.contains(field) {
                    throw ConfigError("\(context) ink \"\(inkName)\" has unknown field \"\(field)\"")
                }
            }

            for nodeId in (variant.shapes ?? [:]).keys.sorted() {
                guard let node = nodes[nodeId] else {
                    throw ConfigError("\(context) patches unknown node \"\(nodeId)\"")
                }
                guard let shape = node.shape else {
                    throw ConfigError("\(context) patches shapeless node \"\(nodeId)\"")
                }
                // `rest`, NOT `channels`: `concrete` gives EVERY node all
                // animatable props, so `channels.contains("x.shape")` is true
                // for every node in the rig and would refuse every variant
                // patch ever written. `rest` holds a `.shape` entry only where
                // `walk` actually seeded one.
                guard rest["\(nodeId).shape"] == nil else {
                    throw ConfigError(
                        "\(context) patches morphable node \"\(nodeId)\"; its .shape channel "
                        + "would overwrite the patch")
                }
                for field in variant.shapes![nodeId]!.keys.sorted() {
                    guard let current = shape.patchable(field) else {
                        throw ConfigError(
                            "\(context) node \"\(nodeId)\" has no shape field \"\(field)\"")
                    }
                    let patch = variant.shapes![nodeId]![field]!
                    switch (current, patch) {
                    case (.points(let before), .points(let after)):
                        // A point-count change is a different shape, not a size
                        // cut of the same one, and would break the morph
                        // guard's anchor-count promise.
                        guard before.count == after.count else {
                            throw ConfigError(
                                "\(context) node \"\(nodeId)\" field \"\(field)\" changes "
                                + "point count")
                        }
                    case (.number, .number):
                        break
                    default:
                        throw ConfigError(
                            "\(context) node \"\(nodeId)\" field \"\(field)\" changes type")
                    }
                }
            }
        }

        // 11. sayings --------------------------------------------------------
        // Three checks, and the last two exist because the engine's
        // `pickSaying` has no honest failure mode of its own: it falls back to
        // the active mood's list and indexes into it. The load is the last
        // moment the whole set of reachable moods is knowable.
        for mood in sayings.sayings.keys.sorted() {
            try requireMood(mood, "sayings")
            if sayings.sayings[mood]!.isEmpty {
                throw ConfigError("sayings for \"\(mood)\" is empty")
            }
        }
        let fallbackMood = behavior.ladder.moods["active"]!
        if sayings.sayings[fallbackMood] == nil {
            throw ConfigError(
                "sayings has no list for \"\(fallbackMood)\", the mood every other "
                + "mood falls back to")
        }

        return CharacterConfig(
            character: character, rig: rig, poses: poses, timelines: timelines,
            behavior: behavior, sayings: sayings,
            channels: channels, families: families, rest: rest, nodes: nodes,
            bendDriven: bendDriven, expandMap: expandMap, responses: responses)
    }
}
