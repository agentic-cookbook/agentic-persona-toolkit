import Foundation

/// A flat string-keyed store of animatable values. Everything the engine animates
/// — a node property, an ink, a mouth path, a shape family — is a channel, so the
/// scene tree never has to know what an animation is and animation never has to
/// know what the scene tree looks like.
public enum ChannelValue: Equatable, Sendable {
    case number(Double)
    case text(String)

    public var number: Double? {
        if case .number(let n) = self { return n }
        return nil
    }

    public var text: String? {
        if case .text(let s) = self { return s }
        return nil
    }
}

// The literal conformances exist so a Swift channel dictionary reads the same as
// the TypeScript object it mirrors: `["eye.scaleY": 1, "body.ink": "#00ff41"]`.
// Without them every fixture, pose default and test in the engine would be a wall
// of `.number(...)` / `.text(...)`, which is exactly the kind of transcription
// noise that hides a wrong value.
extension ChannelValue: ExpressibleByIntegerLiteral {
    public init(integerLiteral value: Int) { self = .number(Double(value)) }
}

extension ChannelValue: ExpressibleByFloatLiteral {
    public init(floatLiteral value: Double) { self = .number(value) }
}

extension ChannelValue: ExpressibleByStringLiteral {
    public init(stringLiteral value: String) { self = .text(value) }
}

/// Properties that jump to their target instead of interpolating towards it.
///
/// A pivot is not a quantity that moves — it is WHERE the moving happens. Slide
/// one across a tween and every frame in between composes a rotation about an
/// origin nobody authored, dragging the whole subtree sideways for the length of
/// the tween. GSAP says the same thing by construction: `transformOrigin` is
/// applied when a tween starts and is never part of the interpolation.
///
/// A delay still applies — the jump lands when the tween would have STARTED,
/// which is exactly where GSAP puts it.
private let SNAP_PROPS: Set<String> = ["pivotX", "pivotY"]

/// Does this concrete `"<nodeId>.<prop>"` channel snap rather than tween?
public func snaps(_ channel: String) -> Bool {
    guard let dot = channel.lastIndex(of: ".") else { return false }
    return SNAP_PROPS.contains(String(channel[channel.index(after: dot)...]))
}

public final class Channels {
    private var values: [String: ChannelValue]

    public init(_ initial: [String: ChannelValue] = [:]) {
        values = initial
    }

    public func get(_ name: String) -> ChannelValue? {
        values[name]
    }

    public func set(_ name: String, _ value: ChannelValue) {
        values[name] = value
    }

    /// Sorted, always. A `Dictionary`'s own order is seeded per process, so any
    /// caller that walked `values.keys` directly would produce a different
    /// display list on every launch.
    public func names() -> [String] {
        values.keys.sorted()
    }
}
