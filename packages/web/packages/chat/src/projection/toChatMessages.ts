import type { ActiveCommand } from '../contract/commands/ActiveCommand'
import type { ChatViewModel } from '../contract/chat/ChatViewModel'
import type { Message } from '../contract/messages/Message'
import type { ChatMessage, ChatParticipant, ToolCallInfo } from '../types'
import { decodeRichDisplay } from './richContent'

export interface ProjectionParticipants {
  readonly persona: ChatParticipant
  readonly user: ChatParticipant
  readonly localParticipantID: string
}

/**
 * A timestamp for something the contract gave none for: an unacknowledged
 * message, or a draft — `ActiveDraft` has no time field at all, because on the
 * contract side a draft is not yet an event that happened.
 *
 * The bubble renders a clock regardless, so the projection has to produce
 * one. It MUST be stable per key: projection runs on every render, and a
 * `new Date()` here would tick the displayed time forward for the whole
 * transcript on each pass. Callers back this with a first-seen cache.
 */
export type StampFor = (key: string) => Date

/**
 * The draft bubble's id is derived from the participant rather than freshly
 * generated, so a draft that grows over dozens of `draftUpdated` events keeps
 * one React key and one DOM node. A new key per token would remount the bubble
 * on every character — losing focus, restarting animations, and defeating the
 * scroll anchoring the transcript relies on.
 */
export function draftMessageID(participantID: string): string {
  return `draft:${participantID}`
}

function toToolCallInfo(command: ActiveCommand): ToolCallInfo {
  const { invocation, result } = command
  if (result === undefined) {
    return {
      name: invocation.commandName,
      arguments: invocation.argumentsJSON,
      status: 'started',
    }
  }
  return {
    name: invocation.commandName,
    arguments: invocation.argumentsJSON,
    status: result.ok ? 'completed' : 'failed',
    ok: result.ok,
    result: result.resultJSON ?? result.errorMessage ?? '',
  }
}

/**
 * Projects the contract's view-model onto the display type the transcript
 * renders. One direction only: nothing here writes back.
 *
 * Committed messages come first, in order, then any in-progress draft — which
 * is what puts a streaming reply at the bottom of the transcript where the
 * user is already looking. Drafts are never mixed into `messages` on the
 * contract side (`ActiveDraft` exists precisely so `Message` can stay
 * immutable); flattening the two is this layer's job and no one else's.
 */
export function projectMessages(
  view: Pick<ChatViewModel, 'messages' | 'activeDrafts' | 'activeCommands'>,
  parts: ProjectionParticipants,
  stampFor: StampFor,
): ChatMessage[] {
  const senderOf = (senderID: string): ChatParticipant =>
    senderID === parts.localParticipantID ? parts.user : parts.persona

  const projected: ChatMessage[] = view.messages.map((m: Message) => {
    const display = decodeRichDisplay(m.attachments)
    const id = m.id ?? m.localID
    return {
      id,
      sender: senderOf(m.senderID),
      text: m.text,
      content: display.content,
      popover: display.popover,
      toolCalls: display.toolCalls,
      timestamp: m.timestamp ?? stampFor(id),
      isPersona: m.senderID !== parts.localParticipantID,
      failure: m.deliveryStatus.kind === 'failed' ? m.deliveryStatus.reason : undefined,
    }
  })

  for (const draft of view.activeDrafts) {
    const display = decodeRichDisplay(draft.attachments)
    // Running commands come from the live channel; a committed record, if the
    // backend kept one, comes from the payload. Never both — the live list is
    // the truth while the turn is open.
    const running = view.activeCommands
      .filter((c) => c.participantID === draft.participantID)
      .map(toToolCallInfo)
    const id = draftMessageID(draft.participantID)
    projected.push({
      id,
      sender: senderOf(draft.participantID),
      text: draft.text,
      content: display.content,
      popover: display.popover,
      toolCalls: running.length > 0 ? running : display.toolCalls,
      timestamp: stampFor(id),
      isPersona: draft.participantID !== parts.localParticipantID,
      isStreaming: true,
    })
  }

  return projected
}
