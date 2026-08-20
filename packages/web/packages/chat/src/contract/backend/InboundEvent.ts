import type { Attachment } from '../attachments/Attachment'
import type { CommandInvocation } from '../commands/CommandInvocation'
import type { CommandResult } from '../commands/CommandResult'
import type { InteractiveWidget } from '../attachments/InteractiveWidget'
import type { Message } from '../messages/Message'
import type { Participant } from '../participants/Participant'

export type InboundEvent =
  | {
      readonly kind: 'messageAccepted'
      readonly localID: string
      readonly serverID: string
      readonly at: Date
    }
  | { readonly kind: 'messageDelivered'; readonly messageID: string; readonly at: Date }
  | { readonly kind: 'messageFailed'; readonly localID: string; readonly reason: string }
  | { readonly kind: 'messageReceived'; readonly message: Message }
  /**
   * A participant has advanced their read cursor to `upToMessageID`.
   * Everything before that point is considered read. There is exactly
   * one cursor per (conversation, participant). Mirrors Matrix `m.read`,
   * XMPP XEP-0333 `displayed`, Slack `conversations.mark`, Discord
   * `READ_STATE`.
   */
  | {
      readonly kind: 'readMarkerAdvanced'
      readonly participantID: string
      readonly upToMessageID: string
      readonly at: Date
    }
  /**
   * A streaming participant (typically an LLM persona) has updated their
   * in-progress draft. The draft is NOT a message — it lives in
   * `ChatViewModel.activeDrafts` until it commits as an immutable
   * `Message` via `messageReceived`. Keeps `Message` immutable while
   * preserving the token-by-token UX.
   *
   * `text` is the WHOLE draft so far, not the newest fragment. Each event
   * REPLACES the previous text rather than appending to it. A backend that
   * emits fragments produces a transcript with every reply's prefix
   * missing, with no error to catch it.
   */
  | {
      readonly kind: 'draftUpdated'
      readonly participantID: string
      readonly text: string
      readonly attachments: ReadonlyArray<Attachment>
    }
  /**
   * The participant has aborted or finalized their draft. If finalized,
   * a `messageReceived` event will follow carrying the immutable
   * `Message`. If aborted, no message arrives.
   */
  | { readonly kind: 'draftCleared'; readonly participantID: string }
  | { readonly kind: 'participantJoined'; readonly participant: Participant }
  | { readonly kind: 'participantDeparted'; readonly participantID: string }
  | { readonly kind: 'typing'; readonly participantID: string; readonly isTyping: boolean }
  | {
      readonly kind: 'widgetPresented'
      readonly messageID: string
      readonly widget: InteractiveWidget
    }
  /**
   * A participant invoked a command (tool call). Carries the whole
   * `argumentsJSON` rather than streamed fragments, so there is no
   * accumulation to get wrong. `invocation.id` is per-invocation and MUST
   * NOT be derived from `commandName` — two parallel invocations of the
   * same command would collide.
   *
   * Command activity is its own channel. It MUST NOT be folded into
   * `draftUpdated`, where it would commit into the user-visible `Message`.
   */
  | {
      readonly kind: 'commandInvoked'
      readonly participantID: string
      readonly invocation: CommandInvocation
    }
  /**
   * A previously invoked command finished. `result.invocationID` matches
   * the `invocation.id` it completes.
   */
  | {
      readonly kind: 'commandCompleted'
      readonly participantID: string
      readonly result: CommandResult
    }
  | { readonly kind: 'transportError'; readonly message: string }
