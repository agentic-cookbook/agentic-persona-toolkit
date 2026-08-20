import type { Attachment } from '../contract/attachments/Attachment'
import type { InteractiveWidget } from '../contract/attachments/InteractiveWidget'
import type { WidgetResponse } from '../contract/attachments/WidgetResponse'
import type { Backend } from '../contract/backend/Backend'
import type { InboundEvent } from '../contract/backend/InboundEvent'
import type { ActiveDraft } from '../contract/chat/ActiveDraft'
import type { ChatStateObserver } from '../contract/chat/ChatStateObserver'
import type { ChatUpdate } from '../contract/chat/ChatUpdate'
import type { ActiveCommand } from '../contract/commands/ActiveCommand'
import type { Command } from '../contract/commands/Command'
import type { ChatConfig } from '../contract/configuration/ChatConfig'
import type { DisplayConfig } from '../contract/configuration/DisplayConfig'
import type { Conversation } from '../contract/messages/Conversation'
import type { Message } from '../contract/messages/Message'
import type { MessageDeliveryStatus } from '../contract/messages/MessageDeliveryStatus'
import type { ReadReceipt } from '../contract/messages/ReadReceipt'
import type { Orchestrator } from '../contract/orchestrator/Orchestrator'
import type { Participant } from '../contract/participants/Participant'
import type { PermissionDecision } from '../contract/permissions/PermissionDecision'
import type { PermissionPrompt } from '../contract/permissions/PermissionPrompt'
import type { PermissionStore } from '../contract/permissions/PermissionStore'

/**
 * Reference TypeScript implementation of the chat contract. Consumes
 * `Backend.inboundEvents` and maintains the `ChatViewModel` state surface
 * that UI layers render. Observers are notified after every state change.
 *
 * `start()` must be called once to begin consuming events. `stop()`
 * cancels the consumer loop; the backend is the owner of the underlying
 * stream.
 */
export class DefaultOrchestrator implements Orchestrator {
  conversation: Conversation
  participants: ReadonlyArray<Participant>
  messages: ReadonlyArray<Message> = []
  displayConfig: DisplayConfig
  pendingPermissions: ReadonlyArray<PermissionPrompt> = []
  pendingWidgets: ReadonlyArray<InteractiveWidget> = []
  typingParticipants: ReadonlyArray<string> = []
  readMarkers: ReadonlyArray<ReadReceipt> = []
  activeDrafts: ReadonlyArray<ActiveDraft> = []
  activeCommands: ReadonlyArray<ActiveCommand> = []

  readonly permissionStore: PermissionStore

  private readonly backend: Backend
  private readonly localParticipantID: string
  private readonly commands: ReadonlyArray<Command>
  private readonly observers = new Set<ChatStateObserver>()
  private readonly widgetMessageMap = new Map<string, string>()
  private started = false
  private stopped = false
  private iterator: AsyncIterator<InboundEvent> | null = null

  constructor(config: ChatConfig) {
    this.conversation = {
      id: config.conversationID,
      createdAt: new Date(),
      participants: config.initialParticipants,
    }
    this.participants = config.initialParticipants
    this.displayConfig = config.display
    this.permissionStore = config.permissionStore
    this.commands = config.commands
    this.localParticipantID = config.localParticipantID
    this.backend = config.backend
  }

  start(): void {
    if (this.started) return
    this.started = true
    void this.runEventLoop()
  }

  stop(): void {
    this.stopped = true
    void this.iterator?.return?.()
  }

  addObserver(observer: ChatStateObserver): void {
    this.observers.add(observer)
  }

  removeObserver(observer: ChatStateObserver): void {
    this.observers.delete(observer)
  }

  async submitMessage(text: string, attachments: ReadonlyArray<Attachment>): Promise<string> {
    let localID: string
    try {
      localID = await this.backend.send(text, attachments)
    } catch (error) {
      this.notify({
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
    const message: Message = {
      localID,
      senderID: this.localParticipantID,
      text,
      attachments,
      timestamp: new Date(),
      deliveryStatus: { kind: 'sending' },
    }
    this.messages = [...this.messages, message]
    this.notify({ kind: 'messagesChanged' })
    return localID
  }

  async markRead(messageID: string): Promise<void> {
    this.upsertReadMarker(this.localParticipantID, messageID, new Date())
  }

  async setLocalTyping(isTyping: boolean): Promise<void> {
    await this.backend.setLocalTyping(isTyping)
  }

  async respondToWidget(response: WidgetResponse): Promise<void> {
    const widgetsBefore = this.pendingWidgets
    const mappedMessageID = this.widgetMessageMap.get(response.widgetID)
    const filtered = this.pendingWidgets.filter((w) => w.id !== response.widgetID)
    const removed = filtered.length !== widgetsBefore.length
    if (removed) {
      this.pendingWidgets = filtered
      this.widgetMessageMap.delete(response.widgetID)
      this.notify({ kind: 'pendingWidgetsChanged' })
    }
    try {
      await this.backend.submitWidgetResponse(response)
    } catch (error) {
      if (removed) {
        this.pendingWidgets = widgetsBefore
        if (mappedMessageID !== undefined) {
          this.widgetMessageMap.set(response.widgetID, mappedMessageID)
        }
        this.notify({ kind: 'pendingWidgetsChanged' })
      }
      this.notify({
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  async respondToPermission(promptID: string, decision: PermissionDecision): Promise<void> {
    const prompt = this.pendingPermissions.find((p) => p.id === promptID)
    if (!prompt) return
    this.permissionStore.remember(decision, prompt.permission, prompt.requesterID)
    this.pendingPermissions = this.pendingPermissions.filter((p) => p.id !== promptID)
    this.notify({ kind: 'pendingPermissionsChanged' })
  }

  listCommands(): ReadonlyArray<Command> {
    return this.commands
  }

  /**
   * Push a permission prompt into the view-model. Hooks and policy
   * gates use this to surface a decision request to the UI; the UI then
   * calls `respondToPermission` with the user's choice. Not part of the
   * portable contract — TS-runtime convenience.
   */
  presentPermissionPrompt(prompt: PermissionPrompt): void {
    this.pendingPermissions = [...this.pendingPermissions, prompt]
    this.notify({ kind: 'pendingPermissionsChanged' })
  }

  /**
   * Apply an event as though it had arrived from the backend. Not part of the
   * portable contract — TS-runtime convenience, like
   * `presentPermissionPrompt`.
   *
   * This exists for lines the persona speaks that no backend produced: a
   * scripted welcome, an intro ritual typed in character by character. Those
   * are genuinely persona utterances and belong in the transcript, but there
   * is no request behind them, so `send` is the wrong door and inventing a
   * second transcript beside `messages` is worse — the view-model would stop
   * being the one place the UI reads from.
   *
   * Expressing a scripted line as `draftUpdated` … `messageReceived` rather
   * than as a bespoke "inject" API is what keeps it identical to a streamed
   * reply everywhere downstream, including in a backend that never learns such
   * lines exist.
   */
  deliver(event: InboundEvent): void {
    this.handleEvent(event)
  }

  private async runEventLoop(): Promise<void> {
    const iterable = this.backend.inboundEvents
    this.iterator = iterable[Symbol.asyncIterator]()
    try {
      while (!this.stopped) {
        const step = await this.iterator.next()
        if (step.done) break
        this.handleEvent(step.value)
      }
    } catch (error) {
      this.notify({
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private handleEvent(event: InboundEvent): void {
    switch (event.kind) {
      case 'messageReceived':
        this.messages = [...this.messages, event.message]
        this.clearDraftFor(event.message.senderID)
        this.notify({ kind: 'messagesChanged' })
        return

      case 'messageAccepted':
        this.updateMessage(
          (m) => m.localID === event.localID,
          (m) => ({
            ...m,
            id: event.serverID,
            timestamp: event.at,
            deliveryStatus: { kind: 'sent' },
          }),
        )
        return

      case 'messageDelivered':
        this.updateMessage(
          (m) => m.id === event.messageID || m.localID === event.messageID,
          (m) => ({ ...m, deliveryStatus: { kind: 'delivered' } }),
        )
        return

      case 'messageFailed':
        this.updateMessage(
          (m) => m.localID === event.localID,
          (m): Message => ({
            ...m,
            deliveryStatus: { kind: 'failed', reason: event.reason } satisfies MessageDeliveryStatus,
          }),
        )
        return

      case 'readMarkerAdvanced':
        this.upsertReadMarker(event.participantID, event.upToMessageID, event.at)
        return

      case 'draftUpdated': {
        const next: ActiveDraft = {
          participantID: event.participantID,
          text: event.text,
          attachments: event.attachments,
        }
        const idx = this.activeDrafts.findIndex((d) => d.participantID === event.participantID)
        if (idx >= 0) {
          const copy = this.activeDrafts.slice()
          copy[idx] = next
          this.activeDrafts = copy
        } else {
          this.activeDrafts = [...this.activeDrafts, next]
        }
        this.notify({ kind: 'activeDraftsChanged' })
        return
      }

      case 'draftCleared':
        this.clearDraftFor(event.participantID)
        this.clearCommandsFor(event.participantID)
        return

      case 'commandInvoked':
        this.activeCommands = [
          ...this.activeCommands,
          { participantID: event.participantID, invocation: event.invocation },
        ]
        this.notify({ kind: 'activeCommandsChanged' })
        return

      case 'commandCompleted': {
        const idx = this.activeCommands.findIndex(
          (c) => c.invocation.id === event.result.invocationID,
        )
        // A result for an invocation we never saw is dropped rather than
        // synthesised — inventing the invocation would put a command in the
        // UI with no arguments to show.
        const open = this.activeCommands[idx]
        if (!open) return
        const copy = this.activeCommands.slice()
        copy[idx] = { ...open, result: event.result }
        this.activeCommands = copy
        this.notify({ kind: 'activeCommandsChanged' })
        return
      }

      case 'participantJoined': {
        const existing = this.participants.findIndex((p) => p.id === event.participant.id)
        if (existing >= 0) {
          const copy = this.participants.slice()
          copy[existing] = event.participant
          this.participants = copy
        } else {
          this.participants = [...this.participants, event.participant]
        }
        this.notify({ kind: 'participantsChanged' })
        return
      }

      case 'participantDeparted':
        if (this.participants.some((p) => p.id === event.participantID)) {
          this.participants = this.participants.filter((p) => p.id !== event.participantID)
          this.notify({ kind: 'participantsChanged' })
        }
        return

      case 'typing': {
        const isAlready = this.typingParticipants.includes(event.participantID)
        if (event.isTyping && !isAlready) {
          this.typingParticipants = [...this.typingParticipants, event.participantID]
          this.notify({ kind: 'typingChanged' })
        } else if (!event.isTyping && isAlready) {
          this.typingParticipants = this.typingParticipants.filter((id) => id !== event.participantID)
          this.notify({ kind: 'typingChanged' })
        }
        return
      }

      case 'widgetPresented':
        this.pendingWidgets = [...this.pendingWidgets, event.widget]
        this.widgetMessageMap.set(event.widget.id, event.messageID)
        this.notify({ kind: 'pendingWidgetsChanged' })
        return

      case 'transportError':
        this.notify({ kind: 'error', message: event.message })
        return
    }
  }

  private updateMessage(
    match: (m: Message) => boolean,
    transform: (m: Message) => Message,
  ): void {
    let changed = false
    const next = this.messages.map((m) => {
      if (match(m)) {
        changed = true
        return transform(m)
      }
      return m
    })
    if (changed) {
      this.messages = next
      this.notify({ kind: 'messagesChanged' })
    }
  }

  private clearDraftFor(participantID: string): void {
    if (!this.activeDrafts.some((d) => d.participantID === participantID)) return
    this.activeDrafts = this.activeDrafts.filter((d) => d.participantID !== participantID)
    this.notify({ kind: 'activeDraftsChanged' })
  }

  /**
   * Command activity belongs to the turn that produced it. When the turn
   * ends, anything still running is dropped rather than left pinned in the
   * UI forever.
   */
  private clearCommandsFor(participantID: string): void {
    if (!this.activeCommands.some((c) => c.participantID === participantID)) return
    this.activeCommands = this.activeCommands.filter((c) => c.participantID !== participantID)
    this.notify({ kind: 'activeCommandsChanged' })
  }

  private upsertReadMarker(participantID: string, upToMessageID: string, at: Date): void {
    const existing = this.readMarkers.find((r) => r.participantID === participantID)
    if (existing && this.wouldRegressCursor(existing, upToMessageID, at)) return
    const others = this.readMarkers.filter((r) => r.participantID !== participantID)
    this.readMarkers = [...others, { participantID, upToMessageID, at }]
    this.notify({ kind: 'readMarkersChanged' })
  }

  private wouldRegressCursor(existing: ReadReceipt, newUpToID: string, newAt: Date): boolean {
    const idOf = (m: Message): string => m.id ?? m.localID
    const newIdx = this.messages.findIndex((m) => idOf(m) === newUpToID)
    const oldIdx = this.messages.findIndex((m) => idOf(m) === existing.upToMessageID)
    if (newIdx >= 0 && oldIdx >= 0) return newIdx < oldIdx
    return newAt.getTime() < existing.at.getTime()
  }

  private notify(update: ChatUpdate): void {
    for (const observer of this.observers) {
      observer.chatDidUpdate(update)
    }
  }
}
