import type { CommandInvocation } from './CommandInvocation'
import type { CommandResult } from './CommandResult'

/**
 * A command invocation and, once it finishes, its result. Lives in
 * `ChatViewModel.activeCommands` for the duration of the turn that
 * produced it.
 *
 * This is the observable counterpart to `CommandInvocation`, which on its
 * own could be described but never watched — no event carried it and no
 * state surface held it.
 *
 * `result === undefined` means still running. A command that never
 * completes stays that way until the turn ends and the participant's
 * active commands are cleared, so a UI can distinguish "running" from
 * "finished" without a separate status flag.
 */
export interface ActiveCommand {
  readonly participantID: string
  readonly invocation: CommandInvocation
  readonly result?: CommandResult
}
