import type { AmplitudeRef, CharacterConfig } from "../config/types";

/** Everything a param can be a function of. Deliberately two fields: a param
 *  that could read a channel could read a channel a loop writes, and the loop
 *  would then drive its own amplitude. */
export interface ParamScope {
  mood: string;
}

/** A number the CURRENT pose supplies through its `loops` block. */
export function poseNumber(config: CharacterConfig, scope: ParamScope, name: string): number {
  // Task 11 rejects any config where a pose omits a name a param or an amplitude
  // reads, so this lookup cannot legitimately miss. The `?? 0` is what TypeScript
  // needs to see; it is not a fallback anyone should ever reach.
  return config.poses.poses[scope.mood]?.loops?.[name] ?? 0;
}

/** The closed three-form boolean vocabulary, resolved in declaration order. */
export function predicate(config: CharacterConfig, scope: ParamScope, name: string): boolean {
  const def = config.behavior.params[name];
  if (def !== undefined && "gt" in def) return poseNumber(config, scope, def.gt[0]) > def.gt[1];
  if (name === "eyesShut") return scope.mood === config.behavior.eyesShutMood;
  // A mood whose animation is a timeline rather than a pose. The original
  // creates every ambient loop inside `applyPose` and returns before it for a
  // choreographed mood, so "this mood is choreographed" is a fact about the
  // mood in exactly the way `eyesShut` and `curious` are, and belongs here
  // rather than as a second way of asking inside the reflexes.
  if (name === "choreographed") return config.behavior.choreography?.[scope.mood] !== undefined;
  // The MOOD, not the ladder rung. `curious` means "awake and unoccupied" —
  // nothing to play, so the idle life may have the face. The ladder's rung is a
  // different question: a mood forced from outside leaves the rung at 0 while
  // the face is very much occupied, and reading the rung there hands the idle
  // fidget a mood's brows to overwrite.
  if (name === "curious") return scope.mood === config.behavior.ladder.moods.active;
  throw new Error(`unknown predicate "${name}"`);
}

/** A number: a `select` param, or a pose-supplied `loops` value. */
export function numberParam(config: CharacterConfig, scope: ParamScope, name: string): number {
  const def = config.behavior.params[name];
  if (def !== undefined && "select" in def) {
    return predicate(config, scope, def.select) ? def.then : def.else;
  }
  return poseNumber(config, scope, name);
}

export function amplitude(config: CharacterConfig, scope: ParamScope, ref: AmplitudeRef): number {
  if (typeof ref === "number") return ref;
  return numberParam(config, scope, ref.param) * (ref.scale ?? 1);
}

/** Absent `enabledWhen` means always; absent `disabledWhen` means never. */
export function gateOpen(
  config: CharacterConfig,
  scope: ParamScope,
  def: { enabledWhen?: string; disabledWhen?: string },
): boolean {
  if (def.enabledWhen !== undefined && !predicate(config, scope, def.enabledWhen)) return false;
  if (def.disabledWhen !== undefined && predicate(config, scope, def.disabledWhen)) return false;
  return true;
}
