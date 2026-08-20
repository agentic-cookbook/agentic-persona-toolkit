import type { Attachment } from '../attachments/Attachment'
import type { InteractiveWidget } from '../attachments/InteractiveWidget'
import type { WidgetResponse } from '../attachments/WidgetResponse'
import type { ActiveCommand } from '../commands/ActiveCommand'
import type { Command } from '../commands/Command'
import type { Conversation } from '../messages/Conversation'
import type { Message } from '../messages/Message'
import type { ReadReceipt } from '../messages/ReadReceipt'
import type { Participant } from '../participants/Participant'
import type { PermissionDecision } from '../permissions/PermissionDecision'
import type { PermissionPrompt } from '../permissions/PermissionPrompt'
import type { DisplayConfig } from '../configuration/DisplayConfig'
import type { ActiveDraft } from './ActiveDraft'
import type { ChatStateObserver } from './ChatStateObserver'

export interface ChatViewModel {
  readonly conversation: Conversation
  readonly participants: ReadonlyArray<Participant>
  readonly messages: ReadonlyArray<Message>
  readonly displayConfig: DisplayConfig
  readonly pendingPermissions: ReadonlyArray<PermissionPrompt>
  readonly pendingWidgets: ReadonlyArray<InteractiveWidget>
  readonly typingParticipants: ReadonlyArray<string>

  /**
   * One cursor per participant who has read something in this
   * conversation. Absence of a participant means they have read
   * nothing yet. UIs derive unread state by comparing each cursor's
   * `upToMessageID` against `messages`.
   */
  readonly readMarkers: ReadonlyArray<ReadReceipt>

  /**
   * In-progress, uncommitted drafts. One per participant who is
   * currently composing or streaming. Drafts commit into `messages`
   * as immutable `Message` values; they never live in `messages`
   * themselves.
   */
  readonly activeDrafts: ReadonlyArray<ActiveDraft>

  /**
   * Commands invoked during the current turn, running or finished.
   * Cleared when the invoking participant's turn ends. Command activity
   * is its own channel — it never appears in `messages` or in an
   * `ActiveDraft`.
   */
  readonly activeCommands: ReadonlyArray<ActiveCommand>

  addObserver(observer: ChatStateObserver): void
  removeObserver(observer: ChatStateObserver): void

  submitMessage(text: string, attachments: ReadonlyArray<Attachment>): Promise<string>

  /**
   * Advance the local participant's read cursor to `messageID`.
   * Implicitly marks everything earlier as read.
   */
  markRead(messageID: string): Promise<void>

  setLocalTyping(isTyping: boolean): Promise<void>
  respondToWidget(response: WidgetResponse): Promise<void>
  respondToPermission(promptID: string, decision: PermissionDecision): Promise<void>

  listCommands(): ReadonlyArray<Command>
}
