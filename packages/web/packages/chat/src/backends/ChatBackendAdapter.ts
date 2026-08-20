import type { Attachment } from '../contract/attachments/Attachment'
import type { WidgetResponse } from '../contract/attachments/WidgetResponse'
import type { Backend } from '../contract/backend/Backend'
import type { InboundEvent } from '../contract/backend/InboundEvent'
import type { ChatMessage, ContentItem, PopoverData, ToolCallInfo } from '../types'
import { encodeRichDisplay, type RichDisplay } from '../projection/richContent'
import { EventQueue } from './EventQueue'
import type { ChatBackend } from './types'

export interface ChatBackendAdapterOptions {
  /** Identifies the persona in emitted events. */
  readonly personaID: string
  /**
   * The transcript as the legacy backend expects to see it, read at the
   * moment of send.
   *
   * `Backend.send` takes no history — under A1 the server holds it — but
   * `ChatBackend.sendMessage` requires it, and the adapter has no transcript
   * of its own to give. Reading it back from the orchestrator keeps one
   * transcript rather than a mirror that drifts, and it is the only way lines
   * the persona spoke locally (a scripted welcome, an intro ritual) reach a
   * backend that never saw them go out.
   */
  readonly history: () => ChatMessage[]
}

/**
 * Presents a `ChatBackend` — the React chat package's original, web-only
 * transport interface — as a contract `Backend`.
 *
 * The two describe the same conversation in different vocabularies.
 * `ChatBackend` streams `ChatStreamEvent`s that mutate a placeholder bubble in
 * place; the contract streams `InboundEvent`s into an immutable transcript
 * plus an `ActiveDraft`. Translating between them here, once, is what lets
 * `useChatSession` own no transport at all: every backend it can be handed —
 * legacy or contract — reaches it as `InboundEvent`s through an orchestrator.
 *
 * Behaviour is preserved rather than improved. A stream that never emits
 * produces no message, an `error` event commits whatever text arrived before
 * it, and a thrown `sendMessage` commits the same apology it always did —
 * because sites are rendering those cases today.
 */
export class ChatBackendAdapter implements Backend {
  readonly inboundEvents: AsyncIterable<InboundEvent>

  private readonly queue = new EventQueue<InboundEvent>()
  private readonly abort = new AbortController()
  /**
   * Turns run one at a time, in submission order. Two sends racing would
   * interleave their `draftUpdated` events into one draft — there is a single
   * draft per participant — and produce a bubble containing both replies
   * shuffled together.
   */
  private tail: Promise<void> = Promise.resolve()
  private destroyed = false

  constructor(
    private readonly backend: ChatBackend,
    private readonly options: ChatBackendAdapterOptions,
  ) {
    this.inboundEvents = this.queue.drain()
  }

  async send(text: string, attachments: ReadonlyArray<Attachment>): Promise<string> {
    if (this.destroyed) throw new Error('ChatBackendAdapter has been destroyed.')
    if (attachments.length > 0) {
      throw new Error('ChatBackend has no attachment channel; send text only.')
    }
    const localID = crypto.randomUUID()
    // Snapshot before returning. `submitMessage` appends the outgoing message
    // to the transcript only after this resolves, and the legacy contract is
    // that history is what preceded the turn.
    const history = this.options.history()
    this.tail = this.tail.then(() => this.runTurn(text, history))
    return localID
  }

  async setLocalTyping(): Promise<void> {
    // `ChatBackend` has no presence channel. Nothing to forward, and nothing
    // is lost: the persona is the only other participant.
  }

  async submitWidgetResponse(_response: WidgetResponse): Promise<void> {
    throw new Error('ChatBackend does not support interactive widgets.')
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.abort.abort()
    this.backend.destroy?.()
    this.queue.close()
  }

  private emit(event: InboundEvent): void {
    this.queue.push(event)
  }

  private async runTurn(text: string, history: ChatMessage[]): Promise<void> {
    if (this.destroyed) return
    try {
      if (this.backend.sendMessageStream) {
        await this.runStreamingTurn(text, history)
      } else {
        await this.runUnaryTurn(text, history)
      }
    } catch {
      if (this.destroyed) return
      this.commit("Sorry, something went wrong. Let's try again.", {})
    }
  }

  private async runUnaryTurn(text: string, history: ChatMessage[]): Promise<void> {
    const response = await this.backend.sendMessage(text, history)
    if (this.destroyed) return
    if (typeof response === 'string') {
      this.commit(response, {})
      return
    }
    this.commit(response.text || '', {
      content: response.content,
      popover: response.popover,
    })
  }

  private async runStreamingTurn(text: string, history: ChatMessage[]): Promise<void> {
    const turn = new Turn(this.options.personaID)
    const stream = this.backend.sendMessageStream!(text, history, this.abort.signal)

    for await (const event of stream) {
      if (this.destroyed) return
      // The first event of any kind opens the draft, even one carrying no
      // text. That is what puts an empty streaming bubble on screen the
      // moment the backend starts answering, and it is the signal the typing
      // indicator stands down on.
      if (!turn.opened) {
        turn.opened = true
        this.emit(turn.draft())
      }
      switch (event.type) {
        case 'token':
          turn.text += event.text
          this.emit(turn.draft())
          break
        case 'tool_call_started': {
          const invocation = turn.open(event.name, event.arguments)
          this.emit({
            kind: 'commandInvoked',
            participantID: this.options.personaID,
            invocation,
          })
          this.emit(turn.draft())
          break
        }
        case 'tool_call_completed': {
          for (const emitted of turn.close(event.name, event.ok, event.result)) {
            this.emit(emitted)
          }
          this.emit(turn.draft())
          break
        }
        case 'content':
          turn.content = event.items
          this.emit(turn.draft())
          break
        case 'popover':
          turn.popover = event.data
          this.emit(turn.draft())
          break
        case 'error':
          // Preserved from the placeholder era: an error event ends the turn
          // by committing what arrived, substituting its message only when
          // nothing did. It is not a `transportError` — that would leave the
          // partial reply on screen as a draft forever.
          this.commit(turn.text || event.message, turn.display())
          return
        case 'done':
          this.commit(turn.text, turn.display())
          return
      }
    }

    // The stream ended without saying so. Whatever arrived is the reply.
    if (turn.opened && !this.destroyed) this.commit(turn.text, turn.display())
  }

  private commit(text: string, display: RichDisplay): void {
    const localID = crypto.randomUUID()
    const attachment = encodeRichDisplay(display, `${localID}:display`)
    this.emit({
      kind: 'messageReceived',
      message: {
        localID,
        senderID: this.options.personaID,
        text,
        timestamp: new Date(),
        attachments: attachment ? [attachment] : [],
        deliveryStatus: { kind: 'delivered' },
      },
    })
    this.emit({ kind: 'draftCleared', participantID: this.options.personaID })
  }
}

/**
 * One streaming reply in progress: the text so far, the display extras that
 * have arrived, and the tool calls still open.
 *
 * Tool calls are tracked once and read twice — as `commandInvoked` /
 * `commandCompleted` on the live command channel, and as the frozen
 * `toolCalls` record that rides along on the committed message. One piece of
 * correlation bookkeeping, so the two can never disagree about which
 * invocation a result belongs to.
 */
class Turn {
  opened = false
  text = ''
  content?: ContentItem[]
  popover?: PopoverData

  private readonly calls: ToolCallInfo[] = []
  private readonly ids: string[] = []

  constructor(private readonly participantID: string) {}

  draft(): InboundEvent {
    const attachment = encodeRichDisplay(this.display(), `${this.participantID}:draft-display`)
    return {
      kind: 'draftUpdated',
      participantID: this.participantID,
      text: this.text,
      attachments: attachment ? [attachment] : [],
    }
  }

  display(): RichDisplay {
    return {
      content: this.content,
      popover: this.popover,
      toolCalls: this.calls.length > 0 ? [...this.calls] : undefined,
    }
  }

  open(name: string, argumentsJSON: string): CommandInvocationRecord {
    const invocation: CommandInvocationRecord = {
      id: crypto.randomUUID(),
      commandName: name,
      invokerID: this.participantID,
      // `CommandInvoker` is 'user' | 'other'. The persona is not the local
      // user, so every tool call it makes is 'other'.
      invokerKind: 'other',
      argumentsJSON,
      requestedAt: new Date(),
    }
    this.calls.push({ name, arguments: argumentsJSON, status: 'started' })
    this.ids.push(invocation.id)
    return invocation
  }

  /**
   * `ChatStreamEvent`'s completion carries a name and no invocation id, so
   * two parallel calls to the same tool cannot be told apart on the wire.
   * Oldest-open-first is the rule the coordinator spec settles on; using it
   * here too means one answer to that question in this package rather than
   * two.
   */
  close(name: string, ok: boolean, result: string): InboundEvent[] {
    for (let i = 0; i < this.calls.length; i++) {
      const call = this.calls[i]
      const id = this.ids[i]
      if (!call || id === undefined || call.name !== name || call.status !== 'started') continue
      this.calls[i] = { ...call, status: ok ? 'completed' : 'failed', ok, result }
      return [
        {
          kind: 'commandCompleted',
          participantID: this.participantID,
          result: { invocationID: id, ok, resultJSON: result, completedAt: new Date() },
        },
      ]
    }
    // A completion for a call we never saw start. Synthesising the invocation
    // keeps the two channels agreeing; dropping it would show the result in
    // the committed record and nowhere in the live one.
    const invocation = this.open(name, '')
    const index = this.calls.length - 1
    this.calls[index] = {
      name,
      arguments: '',
      status: ok ? 'completed' : 'failed',
      ok,
      result,
    }
    return [
      { kind: 'commandInvoked', participantID: this.participantID, invocation },
      {
        kind: 'commandCompleted',
        participantID: this.participantID,
        result: { invocationID: invocation.id, ok, resultJSON: result, completedAt: new Date() },
      },
    ]
  }
}

type CommandInvocationRecord = Extract<
  InboundEvent,
  { kind: 'commandInvoked' }
>['invocation']
