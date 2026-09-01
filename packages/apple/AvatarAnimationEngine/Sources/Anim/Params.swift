import Foundation

/// Everything a param can be a function of. Deliberately two fields: a param
/// that could read a channel could read a channel a loop writes, and the loop
/// would then be driving its own amplitude.
public struct ParamScope: Equatable, Sendable {
    public var mood: String
    public var idleRung: Int

    public init(mood: String, idleRung: Int) {
        self.mood = mood
        self.idleRung = idleRung
    }
}

/// A number the CURRENT pose supplies through its `loops` block.
public func poseNumber(_ config: CharacterConfig, _ scope: ParamScope, _ name: String) -> Double {
    // Task 29 rejects any config where a pose omits a name a param or an
    // amplitude reads, so this lookup cannot legitimately miss. The `?? 0` is
    // what the optional chain needs; it is not a fallback anyone should reach.
    config.poses.poses[scope.mood]?.loops?[name] ?? 0
}

/// The closed four-form boolean vocabulary, resolved in declaration order.
public func predicate(_ config: CharacterConfig, _ scope: ParamScope, _ name: String) -> Bool {
    if case .gt(let param, let threshold)? = config.behavior.params[name] {
        return poseNumber(config, scope, param) > threshold
    }
    if name == "eyesShut" { return scope.mood == config.behavior.eyesShutMood }
    // A mood whose animation is a timeline rather than a pose. `applyPose`
    // creates every ambient loop and returns before it for a choreographed
    // mood, so "this mood is choreographed" is a fact about the mood in
    // exactly the way `eyesShut` and `curious` are, and belongs here rather
    // than as a second way of asking inside the reflexes.
    if name == "choreographed" { return config.behavior.choreography?[scope.mood] != nil }
    // The MOOD, not the idle rung. `curious` means "awake and unoccupied" —
    // nothing to play, so the idle life may have the face. The ladder's rung
    // is a different question: a mood forced from outside leaves the rung at
    // 0 while the face is very much occupied, and reading the rung here would
    // hand the idle fidget a mood's brows to overwrite.
    if name == "curious" { return scope.mood == config.behavior.ladder.moods["active"] }
    // Unreachable: `requirePredicate` in Task 29's loader walks every gate,
    // every `select` subject and every `gt` operand and refuses the load if any
    // name is outside this vocabulary. Non-throwing on purpose — see the task
    // note; `try!` at twenty call sites crashes just as hard and says less.
    preconditionFailure("unknown predicate \"\(name)\" — Task 29's loader should have refused this")
}

/// A number: a `select` param, or a pose-supplied `loops` value.
public func numberParam(_ config: CharacterConfig, _ scope: ParamScope, _ name: String) -> Double {
    if case .select(let subject, let then, let otherwise)? = config.behavior.params[name] {
        return predicate(config, scope, subject) ? then : otherwise
    }
    return poseNumber(config, scope, name)
}

public func amplitude(_ config: CharacterConfig, _ scope: ParamScope,
                      _ ref: AmplitudeRef) -> Double {
    switch ref {
    case .literal(let value):
        return value
    case .param(let name, let scale):
        return numberParam(config, scope, name) * (scale ?? 1)
    }
}

/// Absent `enabledWhen` means always; absent `disabledWhen` means never.
public func gateOpen(_ config: CharacterConfig, _ scope: ParamScope,
                     enabledWhen: String?, disabledWhen: String?) -> Bool {
    if let name = enabledWhen, !predicate(config, scope, name) { return false }
    if let name = disabledWhen, predicate(config, scope, name) { return false }
    return true
}
