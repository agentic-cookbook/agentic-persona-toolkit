import Foundation

public enum Schema {
    public static let version = 1
}

public enum Animatable {
    /// Closed. `scale` is a synthesised group that fans out to scaleX/scaleY;
    /// `family` is engine-managed and only ever written by a duration-0 step.
    ///
    /// `pivotX`/`pivotY` are here because the original moves a transform origin
    /// the same way it moves anything else: the sad droop rotates the face about
    /// its bbox bottom and the settle puts the origin back at 60% height. A pivot
    /// that could only be authored in the rig could not express that, and the
    /// whole-glyph offset it produced was the largest geometric difference left
    /// in the web port. They SNAP rather than tween — see `Tweens.swift`.
    public static let all = [
        "x", "y", "rotation", "scale", "scaleX", "scaleY",
        "pivotX", "pivotY",
        "bend", "ink", "alpha", "shape", "family",
    ]
}

/// Every numeric channel's resting value. An array, not a dictionary, because
/// the loader walks it and dictionary order is not stable across launches.
let NUM_REST: [(String, Double)] = [
    ("x", 0), ("y", 0), ("rotation", 0),
    ("scaleX", 1), ("scaleY", 1), ("bend", 0), ("alpha", 1),
]

/// The fields a variant may patch on an ink.
let INK_FIELDS: Set<String> = ["kind", "color", "width"]

/// Predicates the engine answers itself, so a config may name them without
/// declaring them in `params`.
///
/// The web's `load.ts` allowlists only these two at CONFIG time, even though
/// `params.ts`'s runtime `predicate()` also honours `"choreographed"` — a mood
/// gated on choreography is a fact the loader never lets a config *author*
/// against directly. TS is the authority on what a config is allowed to say,
/// so this stays a two-item set rather than the three a naive reading of
/// `predicate()` would suggest.
let BUILTIN_PREDICATES: Set<String> = ["eyesShut", "curious"]

// MARK: - primitives

/// A point. On the wire it is a two-element array, `[50, 30]`.
public struct Pt: Codable, Equatable, Sendable {
    public var x: Double
    public var y: Double
    public init(_ x: Double, _ y: Double) { self.x = x; self.y = y }

    public init(from decoder: Decoder) throws {
        var c = try decoder.unkeyedContainer()
        x = try c.decode(Double.self)
        y = try c.decode(Double.self)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.unkeyedContainer()
        try c.encode(x)
        try c.encode(y)
    }
}

/// Any JSON value. Used only where the config is deliberately open-ended and
/// the loader checks the shape by hand: a variant's ink patch (a partial `Ink`,
/// whose field names must be validated, which a struct of optionals would
/// silently swallow).
public indirect enum JSONValue: Codable, Equatable, Sendable {
    case number(Double)
    case string(String)
    case bool(Bool)
    case array([JSONValue])
    case object([String: JSONValue])
    case null

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null; return }
        // Bool first: JSONDecoder is strict, so `1` will not decode as a Bool
        // and `true` will not decode as a Double — but the order documents the
        // intent rather than relying on that.
        if let v = try? c.decode(Bool.self) { self = .bool(v); return }
        if let v = try? c.decode(Double.self) { self = .number(v); return }
        if let v = try? c.decode(String.self) { self = .string(v); return }
        if let v = try? c.decode([JSONValue].self) { self = .array(v); return }
        if let v = try? c.decode([String: JSONValue].self) { self = .object(v); return }
        throw DecodingError.dataCorruptedError(in: c, debugDescription: "unrecognised JSON value")
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        }
    }
}

// MARK: - character.json

public struct Canvas: Codable, Equatable, Sendable {
    public var w: Double
    public var h: Double
}

public struct StrokeStyle: Codable, Equatable, Sendable {
    public var width: Double
    public var linecap: String
    public var linejoin: String
}

public struct Ink: Codable, Equatable, Sendable {
    public enum Kind: String, Codable, Sendable { case stroke, fill }
    public var kind: Kind
    /// A palette key, a `#rrggbb` literal, or `"@<nodeId>"` — late-bind to that
    /// node's `.ink` channel, so one ink follows a mood colour.
    public var color: String
    public var width: Double?
}

/// A sparse rig patch applied at scene-build time. Deliberately not channels:
/// a variant is who the character *is*, not something that animates.
public struct Variant: Codable, Equatable, Sendable {
    /// Partial `Ink`s. Kept as raw JSON so the loader can reject a field name
    /// the `Ink` type does not have — a struct of optionals would drop it.
    public var inks: [String: [String: JSONValue]]?
    public var shapes: [String: [String: VariantField]]?
}

/// The two kinds of value a variant may write into a shape field.
public enum VariantField: Codable, Equatable, Sendable {
    case number(Double)
    case points([Pt])

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let v = try? c.decode(Double.self) { self = .number(v); return }
        self = .points(try c.decode([Pt].self))
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .number(let v): try c.encode(v)
        case .points(let v): try c.encode(v)
        }
    }
}

public struct CharacterFile: Codable, Equatable, Sendable {
    public struct Files: Codable, Equatable, Sendable {
        public var rig: String
        public var poses: String
        public var timelines: String
        public var behavior: String
        public var sayings: String
    }
    /// `"$schema"` — the editor's pointer at `schema.json`. Nothing in the
    /// engine reads it, and `dot` does not carry one, but a production
    /// `character.json` does and Task 36's round-trip fails on any key the
    /// Swift types drop. `$` is not a legal Swift identifier character, which
    /// is why this one property costs the whole `CodingKeys` block below.
    public var schemaRef: String?
    public var schemaVersion: Int
    public var id: String
    public var canvas: Canvas
    public var strokeStyle: StrokeStyle
    public var palette: [String: String]
    public var inks: [String: Ink]
    public var crops: [String: [String]]
    /// Required, matching TS's `types.ts` (`variants: Record<string, Variant>`,
    /// no `?`) and `schema.json`'s `CharacterFile.required` list, which both
    /// list `variants` as mandatory. A character with none writes `{}`.
    public var variants: [String: Variant]
    public var files: Files

    enum CodingKeys: String, CodingKey {
        case schemaRef = "$schema"
        case schemaVersion, id, canvas, strokeStyle, palette, inks, crops
        case variants, files
    }
}

// MARK: - rig.json

public struct Bend: Codable, Equatable, Sendable {
    public var axis: String          // "x" | "y"
    public var weights: [Double]
    // Both non-optional, matching the web: comparing `Double` to `Double?`
    // makes `sign == bend.inwardSign` always false when `inwardSign` is nil,
    // so a bend missing that field would apply NO damping at all, on either
    // sign, with no error. A bend authored without damping must write
    // `inwardDamp: 1` and a sign explicitly, exactly as the web already
    // requires.
    public var inwardDamp: Double
    public var inwardSign: Double
}

public struct Transform: Codable, Equatable, Sendable {
    public var pivot: Pt?
    public var x: Double?
    public var y: Double?
    public var rotation: Double?
    public var scaleX: Double?
    public var scaleY: Double?
}

/// One shape, as a `kind` plus every field any kind can carry.
///
/// The web declares this as a discriminated union, which makes "a ring has a
/// band" a compile-time fact and "does this shape have a field named `band`?"
/// a plain lookup. Swift's enum-with-payloads gives the first and destroys the
/// second — and the second is the whole of the variant checker. So the fields
/// live flat, `Kind.fields` names what each kind requires, and the loader
/// enforces it (`requireShapeFields`). The invariant is not weakened; it moves
/// from the compiler to a place the plan can point at.
public struct Shape: Codable, Equatable, Sendable {
    public enum Kind: String, Codable, Sendable {
        case ring, disc, arc, polyline, cubicO, bezier

        /// What this kind must declare, in the order the builder reads it.
        /// `bend` is absent because it is optional on a bezier.
        public var fields: [String] {
            switch self {
            case .ring: return ["cx", "cy", "r", "band"]
            case .disc: return ["cx", "cy", "r"]
            case .arc: return ["cx", "cy", "r", "from", "to"]
            case .polyline: return ["family", "points"]
            case .cubicO: return ["family", "cx", "cy", "rx", "ry"]
            case .bezier: return ["family", "points"]
            }
        }
    }

    public var kind: Kind
    public var family: String?
    public var cx: Double?
    public var cy: Double?
    public var r: Double?
    public var band: Double?
    public var from: Double?
    public var to: Double?
    public var rx: Double?
    public var ry: Double?
    public var points: [Pt]?
    public var bend: Bend?

    /// Is this field declared? Used by `requireShapeFields`.
    public func declares(_ name: String) -> Bool {
        if name == "family" { return family != nil }
        if name == "points" { return points != nil }
        return numeric(name) != nil
    }

    /// The patchable value of one field, for the variant checker. `family` is
    /// deliberately absent: changing a family is a morph, never a variant.
    public func patchable(_ name: String) -> VariantField? {
        if name == "points" { return points.map(VariantField.points) }
        return numeric(name).map(VariantField.number)
    }

    /// Write one variant field. The mirror of `patchable(_:)`, and deliberately
    /// adjacent to it: the checker and the writer must agree on exactly which
    /// fields exist, and they cannot drift while they read the same list of
    /// cases in the same file.
    ///
    /// An unmatched name or a mismatched case is unreachable — Task 29's variant
    /// block already rejected a field this shape does not declare, and rejected a
    /// value whose kind (number vs. points) differs from the authored one — so
    /// this silently ignores it rather than duplicating that diagnostic here,
    /// where the message would have no config context to quote.
    public mutating func patch(_ name: String, _ value: VariantField) {
        switch (name, value) {
        case ("points", .points(let v)): points = v
        case ("cx", .number(let v)): cx = v
        case ("cy", .number(let v)): cy = v
        case ("r", .number(let v)): r = v
        case ("band", .number(let v)): band = v
        case ("from", .number(let v)): from = v
        case ("to", .number(let v)): to = v
        case ("rx", .number(let v)): rx = v
        case ("ry", .number(let v)): ry = v
        default: break
        }
    }

    private func numeric(_ name: String) -> Double? {
        switch name {
        case "cx": return cx
        case "cy": return cy
        case "r": return r
        case "band": return band
        case "from": return from
        case "to": return to
        case "rx": return rx
        case "ry": return ry
        default: return nil
        }
    }
}

public struct RigNode: Codable, Equatable, Sendable {
    public var id: String
    public var feature: String?
    /// A pure transform layer, no geometry. Never read by the loader — TS's
    /// `load.ts` never inspects `node.layer` either — but modelled because
    /// `types.ts` and `schema.json` both declare it as a real, closed-schema
    /// property, and a production config can carry one. Dropping it would
    /// pass `dot`'s fixtures clean (nothing here uses it) while silently
    /// discarding the field for any config that does — exactly the failure
    /// mode `SchemaParityTests` exists to catch, so it must be modelled even
    /// where the local fixture cannot exercise it.
    public var layer: Bool?
    public var ink: String?
    public var alpha: Double?
    public var transform: Transform?
    public var shape: Shape?
    public var children: [RigNode]?
}

public struct RigFile: Codable, Equatable, Sendable {
    public var schemaVersion: Int
    public var root: RigNode
    // REQUIRED, not Optional, because web's `schema.json` lists `groups` in
    // `RigFile.required` and the two loaders must accept and reject the same set.
    // A rig with no groups writes `"groups": {}`; the explicit empty collection is
    // what keeps the schema total, and both a production character and the
    // `dot` fixture carry it.
    //
    // There is no `overlays` key. A rig is ONE tree: a node that must escape a
    // transform is placed higher up the tree instead, which is where paint order
    // already comes from. A production character's pinpricks are `body`'s
    // last children.
    public var groups: [String: [String]]
}

// MARK: - poses.json

public struct Spin: Codable, Equatable, Sendable {
    public var channel: String
    public var turns: Double
    public var duration: Double
    public var ease: String
    /// Sibling channels that inherit the spin's duration and ease instead of the
    /// pose's own — see `applyPose` for why. Optional: most poses carry nothing.
    public var carries: [String]?
}

public struct PoseDef: Codable, Equatable, Sendable {
    public var duration: Double
    public var ease: String
    public var channels: [String: ChannelValue]
    /// Numbers this mood supplies to the param language. Every param's operand
    /// must appear in EVERY pose — see `requirePoseNumber`.
    public var loops: [String: Double]?
    public var spin: Spin?
}

public struct PosesFile: Codable, Equatable, Sendable {
    public var schemaVersion: Int
    public var order: [String]
    public var poses: [String: PoseDef]
}

// MARK: - timelines.json

public struct TimelineStep: Codable, Equatable, Sendable {
    public var at: Double
    public var channel: String
    /// Absent only on a `promote` step, which computes its own target.
    public var to: ChannelValue?
    public var duration: Double
    public var ease: String
    /// Present only on a `duration: 0` snap that changes which family the
    /// channel's paths belong to.
    public var family: String?
    /// A `duration: 0` family snap that re-expresses the channel's CURRENT
    /// shape as this many cubic segments (see the `path`/promote check in the
    /// loader), rather than writing a literal path. It is what lets a
    /// timeline cross out of the polyline family without knowing which
    /// pose's mouth it is crossing out of.
    public var promote: Int?
    // Deliberately NO `from`. The web's `TimelineStep` (Task 11) does not
    // declare one, so neither does `schema.json`, so an extra optional here
    // would fail the schema-parity round-trip in step 7 — and `playTimeline`
    // never reads one in either implementation: a step's start value is always
    // whatever the channel holds when it fires.
}

public struct TimelineDef: Codable, Equatable, Sendable {
    public var duration: Double
    public var steps: [TimelineStep]
}

public struct TimelinesFile: Codable, Equatable, Sendable {
    public var schemaVersion: Int
    public var timelines: [String: TimelineDef]
}

// MARK: - behavior.json

/// A derived value. Two forms, tagged by which key is present.
public enum ParamDef: Codable, Equatable, Sendable {
    /// `{"gt": ["wiggle", 0]}` — true when pose number `wiggle` exceeds 0.
    case gt(param: String, threshold: Double)
    /// `{"select": "lively", "then": 9, "else": 4}` — a number chosen on a bool.
    case select(param: String, then: Double, otherwise: Double)

    private enum Keys: String, CodingKey { case gt, select, then, `else` }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        if c.contains(.gt) {
            var a = try c.nestedUnkeyedContainer(forKey: .gt)
            self = .gt(param: try a.decode(String.self), threshold: try a.decode(Double.self))
        } else if c.contains(.select) {
            self = .select(param: try c.decode(String.self, forKey: .select),
                           then: try c.decode(Double.self, forKey: .then),
                           otherwise: try c.decode(Double.self, forKey: .else))
        } else {
            throw DecodingError.dataCorruptedError(
                forKey: .gt, in: c, debugDescription: "a param must be a `gt` or a `select`")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Keys.self)
        switch self {
        case .gt(let param, let threshold):
            var a = c.nestedUnkeyedContainer(forKey: .gt)
            try a.encode(param)
            try a.encode(threshold)
        case .select(let param, let then, let otherwise):
            try c.encode(param, forKey: .select)
            try c.encode(then, forKey: .then)
            try c.encode(otherwise, forKey: .else)
        }
    }
}

/// A loop's swing: either a literal, or a number read from a param or a pose.
public enum AmplitudeRef: Codable, Equatable, Sendable {
    case literal(Double)
    case param(name: String, scale: Double?)

    private enum Keys: String, CodingKey { case param, scale }

    public init(from decoder: Decoder) throws {
        if let v = try? decoder.singleValueContainer().decode(Double.self) {
            self = .literal(v)
            return
        }
        let c = try decoder.container(keyedBy: Keys.self)
        self = .param(name: try c.decode(String.self, forKey: .param),
                      scale: try c.decodeIfPresent(Double.self, forKey: .scale))
    }

    public func encode(to encoder: Encoder) throws {
        switch self {
        case .literal(let v):
            var c = encoder.singleValueContainer()
            try c.encode(v)
        case .param(let name, let scale):
            var c = encoder.container(keyedBy: Keys.self)
            try c.encode(name, forKey: .param)
            try c.encodeIfPresent(scale, forKey: .scale)
        }
    }
}

public struct LoopDef: Codable, Equatable, Sendable {
    public var id: String
    public var channel: String
    public var mode: String                // "symmetric" | "zeroTo"
    public var amplitude: AmplitudeRef
    /// An `AmplitudeRef`, not a `Double`, and the type is load-bearing: a
    /// production character's sway period IS a param (`{"param":"swayPeriodLeft"}`) — 0.85 s calm,
    /// 0.3 s lively — so the cycle length changes with the mood exactly as its
    /// swing does. This is also why a loop is a self-rescheduling one-shot
    /// chain rather than `scheduler.every`: an `every` fixes its interval when
    /// it is armed and would keep the calm period through a lively mood.
    public var duration: AmplitudeRef
    public var ease: String
    /// Optional, matching the web's `yoyo?`. Absent means "replay the same
    /// stroke each cycle", and such a loop starts every cycle from `restValue`
    /// rather than from wherever the last one ended.
    public var yoyo: Bool?
    public var delay: Double?
    public var phase: String?              // "negativeFirst" | "positiveFirst"
    public var restValue: Double
    public var restDuration: Double?
    public var restEase: String?
    public var enabledWhen: String?
    public var disabledWhen: String?
}

/// A `LoopDef` without an `id`, since an effect's loop is named by the effect,
/// and with `restValue` optional because an effect's channels rest at the rig's
/// value. Every other field matches `LoopDef` exactly — the reflexes promote one
/// to the other and a field that differed would be dropped in the promotion.
public struct EffectLoop: Codable, Equatable, Sendable {
    public var channel: String
    public var mode: String
    public var amplitude: AmplitudeRef
    public var duration: AmplitudeRef
    public var ease: String
    public var yoyo: Bool?
    public var delay: Double?
    public var phase: String?
    public var restValue: Double?
    public var restDuration: Double?
    public var restEase: String?
    public var enabledWhen: String?
    public var disabledWhen: String?
}

public struct Settle: Codable, Equatable, Sendable {
    public var duration: Double
    public var ease: String
}

public struct BlinkDef: Codable, Equatable, Sendable {
    public var channel: String
    public var shut: Double
    public var durationMs: Double
    public var minMs: Double
    public var maxMs: Double
    public var tweenDuration: Double
    public var ease: String
    public var suppressedIn: [String]
}

public struct GazeDef: Codable, Equatable, Sendable {
    /// One gaze movement. `channel` and `channels` are both optional because a
    /// tilt drives one channel and a look drives a pair.
    public struct Move: Codable, Equatable, Sendable {
        public var channel: String?
        public var channels: [String]?
        public var duration: Double
        public var ease: String
        /// Every channel this move writes, however it was spelled.
        public var allChannels: [String] { channels ?? channel.map { [$0] } ?? [] }
    }
    public var gazeMax: Double
    public var tiltMax: Double
    public var leanMax: Double
    public var look: Move
    public var tilt: Move
    public var lean: Move
    public var wanderAfterMs: Double
    public var wanderMinMs: Double
    public var wanderMaxMs: Double
    public var centreChanceCurious: Double
    public var centreChanceIdle: Double
    public var reachCurious: [Double]
    public var reachIdle: [Double]
    public var disabledWhen: String?
}

public struct IdleFidgetDef: Codable, Equatable, Sendable {
    public struct Breath: Codable, Equatable, Sendable {
        public var channel: String
        public var from: Double
        public var to: Double
        public var duration: Double
        public var ease: String
        public var yoyo: Bool
    }
    public struct Sway: Codable, Equatable, Sendable {
        public var channel: String
        public var amplitude: Double
    }
    public struct Brow: Codable, Equatable, Sendable {
        public var nodes: [String]
        public var rotationAmplitude: Double
        public var yAmplitude: Double
    }
    public struct Rearm: Codable, Equatable, Sendable {
        public var gapMs: [Double]
        public var jitterMs: Double
    }
    /// Required, matching the web. A fidget with no gate is a fidget that
    /// runs through a yawn.
    public var activeWhen: String
    public var breath: Breath
    public var sway: Sway
    public var brow: Brow
    public var durationRange: [Double]
    public var rearm: Rearm
    public var ease: String
    public var settle: Settle
}

public struct LadderDef: Codable, Equatable, Sendable {
    public var boredAfterMs: Double
    public var asleepAfterMs: Double
    public var alertAfterTypingMs: Double
    public var pollMs: Double
    public var moods: [String: String]
}

public struct PokeRule: Codable, Equatable, Sendable {
    /// A mood name, or `"*"` for any.
    public var from: String
    public var expression: String
    public var ms: Double
}

public struct WakingDef: Codable, Equatable, Sendable {
    public var from: String
    public var to: String
    public var play: String
    public var ms: Double
}

/// A number, or `{"rnd": 2}` — uniform in [-2, 2], drawn at the scheduled event.
public enum EffectValue: Codable, Equatable, Sendable {
    case number(Double)
    case rnd(Double)

    private enum Keys: String, CodingKey { case rnd }

    public init(from decoder: Decoder) throws {
        if let v = try? decoder.singleValueContainer().decode(Double.self) {
            self = .number(v)
            return
        }
        let c = try decoder.container(keyedBy: Keys.self)
        self = .rnd(try c.decode(Double.self, forKey: .rnd))
    }

    public func encode(to encoder: Encoder) throws {
        switch self {
        case .number(let v):
            var c = encoder.singleValueContainer()
            try c.encode(v)
        case .rnd(let v):
            var c = encoder.container(keyedBy: Keys.self)
            try c.encode(v, forKey: .rnd)
        }
    }
}

public struct EffectStep: Codable, Equatable, Sendable {
    public var channels: [String: EffectValue]
    /// Exactly one of these two is present. A fixed length, or a range the
    /// engine draws from at the scheduled event — a production sleeping `drift`
    /// wanders for 2.6–4.2 s, which is what stops it looking metronomic.
    public var duration: Double?
    public var durationRange: [Double]?
    public var ease: String
}

public struct EffectDef: Codable, Equatable, Sendable {
    /// Which step list a stir plays. Absent means always `twitch`.
    public struct Branch: Codable, Equatable, Sendable {
        public var probability: Double
        public var then: String
        public var `else`: String
    }
    public var id: String
    public var target: String
    /// Every list below is optional because the three effect shapes use
    /// disjoint subsets: a branching stirrer has `firstDelayMs`/`rearmMs` and
    /// two step lists, a loop-only effect has none of them, and a once-only
    /// effect has just `once`. Making any of them mandatory rejects two of
    /// the three mood effects a production character declares.
    public var firstDelayMs: [Double]?
    public var rearmMs: [Double]?
    public var branch: Branch?
    public var twitch: [EffectStep]?
    public var drift: [EffectStep]?
    public var once: [EffectStep]?
    public var loop: EffectLoop?
    /// Required, because an effect that walked `body.x` off rest has no pose to
    /// reclaim it.
    public var settle: Settle
}

public struct PinpricksDef: Codable, Equatable, Sendable {
    public var nodes: [String]
    public var shownWhen: String
    public var alpha: Double
    public var showDuration: Double
    public var hideDuration: Double
    public var ease: String
}

public struct BubbleDef: Codable, Equatable, Sendable {
    public struct Angle: Codable, Equatable, Sendable {
        public var base: Double
        public var jitter: Double
    }
    public struct Phase: Codable, Equatable, Sendable {
        public var from: [String: Double]?
        public var to: [String: Double]
        public var duration: Double
        public var delay: Double?
        public var ease: String
    }
    public var x: Double
    public var y: Double
    public var angleDeg: Angle
    public var distance: [Double]
    public var spin: Double
    public var `in`: Phase
    public var out: Phase
}

public struct SpeechDef: Codable, Equatable, Sendable {
    public var mutterMs: Double
    public var loopingIn: [String]
    public var bubble: BubbleDef
}

public struct BehaviorFile: Codable, Equatable, Sendable {
    public var schemaVersion: Int
    public var channelDelays: [String: Double]
    public var params: [String: ParamDef]
    public var loops: [LoopDef]
    public var blink: BlinkDef
    public var gaze: GazeDef
    public var idleFidget: IdleFidgetDef
    public var ladder: LadderDef
    public var poke: [PokeRule]
    /// Mood -> the timeline that IS that mood. A choreographed mood skips its
    /// pose entirely: entering it plays the named timeline, and leaving it
    /// cancels whatever of that timeline has not fired yet. The pose of the
    /// same name still has to exist — it is what the loader validates
    /// against, and what a still frame of the mood would draw — but the
    /// engine never applies it. Absent for a character with nothing
    /// choreographed.
    public var choreography: [String: String]?
    public var waking: WakingDef
    public var moodEffects: [String: EffectDef]
    public var eyesShutMood: String
    public var pinpricks: PinpricksDef
    public var speech: SpeechDef
}

// MARK: - sayings.json

public struct SayingsFile: Codable, Equatable, Sendable {
    public var schemaVersion: Int
    public var sayings: [String: [String]]
}
