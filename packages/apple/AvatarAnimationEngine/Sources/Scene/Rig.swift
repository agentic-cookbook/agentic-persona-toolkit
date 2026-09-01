import Foundation

/// One paintable thing, fully resolved: where it is, what it looks like, and how
/// it is painted. The engine produces an array of these per frame and hands it
/// to a renderer that knows nothing about rigs, channels or config.
public struct DisplayItem: Equatable, Sendable {
    public struct Paint: Equatable, Sendable {
        /// Always a `#rrggbb` literal — palette keys and `"@node"` late bindings
        /// have already been resolved away, so no renderer needs the palette.
        public var ink: String
        public var alpha: Double
        public var fill: Bool
        public var width: Double?

        public init(ink: String, alpha: Double, fill: Bool, width: Double?) {
            self.ink = ink; self.alpha = alpha; self.fill = fill; self.width = width
        }
    }

    public var id: String
    /// World transform, in design units.
    public var m: Mat
    /// The resolved path, in the node's LOCAL space. The matrix carries the
    /// placement; the points are never baked.
    public var d: String
    /// The parsed path's command string, e.g. `"MCCCCZ"`.
    public var kind: String
    public var paint: Paint

    public init(id: String, m: Mat, d: String, kind: String, paint: Paint) {
        self.id = id; self.m = m; self.d = d; self.kind = kind; self.paint = paint
    }
}

public typealias DisplayList = [DisplayItem]

public struct SceneError: Error, Equatable, CustomStringConvertible {
    public let message: String
    public init(_ message: String) { self.message = message }
    public var description: String { "avatar scene: \(message)" }
}

/// A flattened, variant-folded rig, ready to compose. Building one is the only
/// place a variant is ever mentioned: everything downstream — compose, the tween
/// engine, the golden recorder, the renderer — is unaware variants exist.
public struct Scene {
    /// A node plus the id of the node whose world transform it inherits.
    ///
    /// The web keeps the whole ancestor chain and reads only its last element.
    /// One parent id is the same information, and it says out loud that a node's
    /// placement depends on exactly one other node.
    struct Placed {
        let node: RigNode
        let parent: String?
    }

    public let config: CharacterConfig
    /// Depth-first, declaration order — the order the display list will carry.
    let flat: [Placed]
    /// `config.character.inks` with this scene's variant folded in, identical to
    /// it when there is none. `compose` reads paint from HERE and never from the
    /// config, which is what keeps a variant from leaking anywhere else.
    let inks: [String: Ink]

    /// `variant` names a `character.variants` entry and is applied once, here.
    /// The loader has already guaranteed each patch names a real ink whose fields
    /// exist, or a real node that has no `.shape` channel and whose named fields
    /// exist with the same type and arity — so the folding below has nothing left
    /// to validate. An unknown name throws; `nil` means the true rig.
    public init(_ config: CharacterConfig, variant: String? = nil) throws {
        var patch: Variant?
        if let variant {
            guard let found = config.character.variants[variant] else {
                throw SceneError("unknown variant \"\(variant)\"")
            }
            patch = found
        }

        var flat: [Placed] = []
        func walk(_ node: RigNode, _ parent: String?) {
            var node = node
            if var shape = node.shape, let fields = patch?.shapes?[node.id] {
                for (name, value) in fields.sorted(by: { $0.key < $1.key }) {
                    shape.patch(name, value)
                }
                node.shape = shape
            }
            flat.append(Placed(node: node, parent: parent))
            for child in node.children ?? [] { walk(child, node.id) }
        }
        walk(config.rig.root, nil)

        var inks = config.character.inks
        for (name, over) in (patch?.inks ?? [:]).sorted(by: { $0.key < $1.key }) {
            guard var ink = inks[name] else { continue }
            for (field, value) in over.sorted(by: { $0.key < $1.key }) {
                switch (field, value) {
                case ("kind", .string(let v)): ink.kind = Ink.Kind(rawValue: v) ?? ink.kind
                case ("color", .string(let v)): ink.color = v
                case ("width", .number(let v)): ink.width = v
                default: break     // unreachable: the loader rejected it
                }
            }
            inks[name] = ink
        }

        self.config = config
        self.flat = flat
        self.inks = inks
    }

    public func compose(_ channels: Channels) throws -> DisplayList {
        // Written by id, read by id, never iterated — so a Dictionary is safe
        // here in a way it is not anywhere else in this engine.
        var world: [String: Mat] = [:]
        var out: DisplayList = []
        out.reserveCapacity(flat.count)

        for placed in flat {
            let node = placed.node
            let id = node.id
            let parent = placed.parent.flatMap { world[$0] } ?? .identity
            let local = Mat.from(
                x: num(channels, "\(id).x", 0),
                y: num(channels, "\(id).y", 0),
                rotation: num(channels, "\(id).rotation", 0),
                scaleX: num(channels, "\(id).scaleX", 1),
                scaleY: num(channels, "\(id).scaleY", 1),
                // Channels, not `node.transform.pivot`: the rig only seeds the
                // rest value. The original moves a transform origin as freely as
                // it moves a rotation — the sad droop turns the face about its
                // bbox bottom, the settle turns it about 60% height — so the
                // origin has to be animatable too.
                pivot: (num(channels, "\(id).pivotX", 0),
                        num(channels, "\(id).pivotY", 0)))
            let m = parent * local
            world[id] = m

            // A node with no shape still transforms its children — `body` is
            // exactly that, and it is where the whole character's placement and
            // its late-bound colour live.
            guard let shape = node.shape else { continue }

            let d = try resolvePath(id: id, shape: shape, channels: channels)
            // The channel is authoritative when present: an ink can be swapped
            // at runtime, and the loader seeded this from the rig.
            let inkName = channels.get("\(id).ink")?.text ?? node.ink ?? ""
            // Stroke-vs-fill and the stroke width are properties of the INK, not
            // of the shape. That is what lets one ink restyle six nodes from one
            // place, and it is the single fact CoreGraphics has to agree with SVG
            // about.
            let ink = inks[inkName]
            out.append(DisplayItem(
                id: id,
                m: m,
                d: d,
                kind: try parsePath(d).kind,
                paint: DisplayItem.Paint(
                    ink: try resolveInk(inkName, channels),
                    alpha: num(channels, "\(id).alpha", 1),
                    fill: ink?.kind == .fill,
                    width: ink?.width)))
        }
        return out
    }

    /// Rebuild a node's path.
    ///
    /// A morphable node's geometry lives on its `.shape` channel — seeded from
    /// the rig, then driven by poses, timelines and morphs — so the channel is
    /// authoritative whenever the node has one. The primitives have no `.shape`
    /// channel and are rebuilt from the rig each frame, because their own
    /// parameters and `bend` are what animate them.
    private func resolvePath(id: String, shape: Shape, channels: Channels) throws -> String {
        if let driven = channels.get("\(id).shape")?.text { return driven }
        // `Build` speaks flat number pairs — the Path module knows nothing
        // about config types, so `Pt` is unpacked here.
        let pairs = { (points: [Pt]) -> [[Double]] in points.map { [$0.x, $0.y] } }
        switch shape.kind {
        case .ring:
            return Build.ring(cx: shape.cx!, cy: shape.cy!, r: shape.r!, band: shape.band!)
        case .disc:
            return Build.disc(cx: shape.cx!, cy: shape.cy!, r: shape.r!)
        case .arc:
            return Build.arc(cx: shape.cx!, cy: shape.cy!, r: shape.r!,
                             from: shape.from!, to: shape.to!)
        case .cubicO:
            return Build.cubicO(cx: shape.cx!, cy: shape.cy!, rx: shape.rx!, ry: shape.ry!)
        case .polyline:
            return try Build.polyline(pairs(shape.points!))
        case .bezier:
            guard let bend = shape.bend else { return try Build.bezier(pairs(shape.points!)) }
            // `bend` offsets each control point along one axis by its weight.
            // The channel ALREADY carries the inward damp —
            // `CharacterConfig.respond` applies it where the value is written,
            // because the original damps a tween's endpoints and lerps the
            // paths between them. Damping again here would bend the line a
            // second time, and the kink would land mid-stroke.
            let a = num(channels, "\(id).bend", 0)
            let axis = bend.axis == "x" ? 0 : 1
            var moved = pairs(shape.points!)
            for i in moved.indices {
                moved[i][axis] += (i < bend.weights.count ? bend.weights[i] : 0) * a
            }
            return try Build.bezier(moved)
        }
    }

    /// ink key | palette key | `"@nodeId"` | `#rrggbb` -> a literal colour.
    ///
    /// `"@body"` is late-bound: one channel recolours the whole character, so the
    /// rig never repeats a mood colour on fourteen nodes. The depth guard is not
    /// decoration — a config that made `"@x"` resolve back to itself would
    /// otherwise hang the render loop rather than fail, and the loader cannot see
    /// a cycle that only closes through a runtime channel value.
    private func resolveInk(_ raw: String, _ channels: Channels, depth: Int = 0) throws -> String {
        guard depth <= 8 else {
            throw SceneError("ink \"\(raw)\" does not resolve to a colour")
        }
        // A colour channel already holds a literal: the loader normalised the
        // resting value, and a tween mid-flight produces a new one every frame.
        if raw.hasPrefix("#") { return raw }
        if raw.hasPrefix("@") { return try resolveLateBound(raw, channels, depth: depth) }
        if let ink = inks[raw] {
            return try resolveColourRef(ink.color, channels, depth: depth + 1)
        }
        guard let colour = config.character.palette[raw] else {
            throw SceneError("unknown colour \"\(raw)\"")
        }
        return colour
    }

    /// Resolves an `Ink.color` field. By that field's own contract it is always
    /// `"#hex"`, `"@nodeId"`, or a bare PALETTE key -- never another ink key --
    /// so, unlike `resolveInk`, this never re-enters the ink table. That
    /// distinction is load-bearing on real data, not pedantry: an ink is
    /// routinely named after the very palette colour it points at, and recursing
    /// through the ink table would find that same-named ink again and resolve it
    /// to itself. On the web that spins; here the depth guard above catches it
    /// and throws instead -- which is worse to diagnose, not better, because the
    /// character simply refuses to paint and the config it was handed is valid.
    private func resolveColourRef(_ raw: String, _ channels: Channels, depth: Int) throws -> String {
        guard depth <= 8 else {
            throw SceneError("ink \"\(raw)\" does not resolve to a colour")
        }
        if raw.hasPrefix("#") { return raw }
        if raw.hasPrefix("@") { return try resolveLateBound(raw, channels, depth: depth) }
        guard let colour = config.character.palette[raw] else {
            throw SceneError("unknown colour \"\(raw)\"")
        }
        return colour
    }

    /// A `.ink` channel's value may name an ink, so this re-enters the full lookup.
    private func resolveLateBound(_ raw: String, _ channels: Channels, depth: Int) throws -> String {
        let node = String(raw.dropFirst())
        guard let driven = channels.get("\(node).ink")?.text else {
            throw SceneError("late-bound ink \"\(raw)\" has no value on \(node).ink")
        }
        return try resolveInk(driven, channels, depth: depth + 1)
    }
}

extension CharacterConfig {
    /// Write every channel's rest value into the store. The loader already
    /// derived the map from the rig tree (Task 29), so there is exactly one
    /// definition of "at rest" and this cannot drift from it.
    public func seed(into channels: Channels) {
        for name in rest.keys.sorted() { channels.set(name, rest[name]!) }
    }
}

private func num(_ channels: Channels, _ name: String, _ fallback: Double) -> Double {
    channels.get(name)?.number ?? fallback
}
