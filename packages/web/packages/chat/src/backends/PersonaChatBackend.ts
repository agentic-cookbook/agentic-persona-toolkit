import type { Attachment } from '../contract/attachments/Attachment'
import type { WidgetResponse } from '../contract/attachments/WidgetResponse'
import type { Backend } from '../contract/backend/Backend'
import type { InboundEvent } from '../contract/backend/InboundEvent'
import type { CommandInvocation } from '../contract/commands/CommandInvocation'
import { EventQueue } from './EventQueue'

/**
 * Implements the `persona-chat-coordinator` ingredient.
 * See docs/specs/ingredients/persona-chat-coordinator.md — requirement ids
 * in comments below (`ci-*`) refer to that spec, and the conformance
 * vectors (`pcc-*`) are the tests.
 *
 * adh orchestrates the turn: it resolves the persona from its slug,
 * assembles the prompt, reads and writes history, calls the provider, and
 * streams the reply back. This class holds no history, no prompt, and no
 * credentials.
 */

/** Turn phase, for the status line. Not a transcript event (ci-status-out-of-band). */
export type TurnStatus = 'thinking' | 'responding' | 'retrying'

export interface PersonaChatBackendOptions {
  /** Persona to converse with. adh resolves everything else from this. */
  readonly personaSlug: string
  /** Overrides the persona's configured model when set. */
  readonly model?: string | null
  /** Root of the adh chat API. */
  readonly baseURL?: string
  /**
   * Credential-attaching fetch, INJECTED by the host (ci: configuration).
   * Importing an auth module here would close an `auth -> chat -> auth`
   * cycle in every consumer that builds auth on top of chat.
   */
  readonly authorize: (path: string, init: RequestInit) => Promise<Response>
  /** Receives turn-phase transitions. Cleared with `null` when a turn ends. */
  readonly onStatus?: (status: TurnStatus | null) => void
  /** Identifies the persona in emitted events. Defaults to `personaSlug`. */
  readonly participantID?: string
}

interface CreatedConversation {
  readonly id: string
}

/** Pull a typed payload out of an SSE `data:` string, tolerating bad JSON. */
function parseData<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T
  } catch {
    return null
  }
}

/** Split one `event:`/`data:` SSE block into its event name and payload. */
function parseSseBlock(block: string): { event: string; data: string } {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
    // `:` comments and `id:` / `retry:` are ignored.
  }
  return { event, data: dataLines.join('\n') }
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

export class PersonaChatBackend implements Backend {
  private readonly queue = new EventQueue<InboundEvent>()
  private readonly participantID: string
  private readonly conversationsPath: string
  private conversationID: string | null = null
  private controller: AbortController | null = null
  private destroyed = false

  /** Open invocations, oldest first, keyed by command name (see ci-invocation-ids). */
  private readonly openInvocations = new Map<string, string[]>()

  constructor(private readonly opts: PersonaChatBackendOptions) {
    this.participantID = opts.participantID ?? opts.personaSlug
    this.conversationsPath = `${opts.baseURL ?? '/api'}/chat/conversations`
  }

  get inboundEvents(): AsyncIterable<InboundEvent> {
    return this.queue.drain()
  }

  /**
   * Submit a message and start its turn. Returns immediately with the
   * `localID`; the reply arrives on `inboundEvents`.
   *
   * No history is sent (ci-no-history) — adh owns it. That is why the
   * `Backend` contract has no history parameter to begin with.
   */
  async send(text: string, attachments: ReadonlyArray<Attachment>): Promise<string> {
    if (this.destroyed) {
      // Reuse after destroy fails fast rather than silently reconnecting
      // onto a conversation the caller believes is gone.
      throw new Error('PersonaChatBackend has been destroyed.')
    }
    if (attachments.length > 0) {
      // adh's chat endpoint carries a message and nothing else. Dropping
      // attachments silently would send a message the user believes had
      // a file on it.
      throw new Error('PersonaChatBackend does not support attachments.')
    }

    const localID = crypto.randomUUID()
    void this.runTurn(text, localID)
    return localID
  }

  /** adh has no typing channel for the local participant; nothing to report. */
  async setLocalTyping(_isTyping: boolean): Promise<void> {}

  async submitWidgetResponse(_response: WidgetResponse): Promise<void> {
    throw new Error('PersonaChatBackend does not support widgets.')
  }

  /**
   * Cancel any in-flight turn and close the event stream. Authoritative:
   * the abort controller is ours, never the caller's (ci-destroy-authoritative).
   */
  destroy(): void {
    this.destroyed = true
    this.controller?.abort()
    // Emitted here rather than left to the aborted turn's own cleanup: the
    // abort unwinds asynchronously, and the queue closes on the next line.
    // A surface holding a half-written draft would otherwise keep it forever.
    this.queue.push({ kind: 'draftCleared', participantID: this.participantID })
    this.queue.close()
  }

  /** Create the backing conversation once, then reuse it (ci-lazy-conversation). */
  private async ensureConversation(): Promise<string> {
    if (this.conversationID) return this.conversationID
    const res = await this.opts.authorize(this.conversationsPath, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        personaSlug: this.opts.personaSlug,
        // adh resolves model as persona.model || conversation.model, so
        // passing the persona's model keeps an unset persona.model working.
        model: this.opts.model ?? undefined,
      }),
    })
    if (!res.ok) throw new Error(`Couldn't start the conversation (${res.status}).`)
    const convo = (await res.json()) as CreatedConversation
    this.conversationID = convo.id
    return convo.id
  }

  /**
   * Drive one turn end to end. Every exit path clears the status line and
   * the draft, so an aborted or failed turn never leaves the UI pinned
   * mid-reply.
   */
  private async runTurn(text: string, localID: string): Promise<void> {
    const status = this.opts.onStatus
    let committed = false
    try {
      status?.('thinking')

      let id: string
      try {
        id = await this.ensureConversation()
      } catch (err) {
        // Nothing reached adh, so this is the message's failure, not the
        // transport's (ci-transport-vs-message).
        this.emit({
          kind: 'messageFailed',
          localID,
          reason: errorMessage(err, "Couldn't start the conversation."),
        })
        return
      }

      const controller = new AbortController()
      this.controller = controller

      let res: Response
      try {
        res = await this.opts.authorize(`${this.conversationsPath}/${id}/messages`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', Accept: 'text/event-stream' },
          body: JSON.stringify({ message: text }),
          signal: controller.signal,
        })
      } catch (err) {
        this.emit({
          kind: 'messageFailed',
          localID,
          reason: errorMessage(err, 'The chat request failed.'),
        })
        return
      }

      const body = res.body
      if (!body) {
        this.emit({ kind: 'transportError', message: 'No response stream from adh.' })
        return
      }

      committed = await this.consumeStream(body, localID, status)
    } finally {
      // A stream that ended without `done` left a draft behind. Truncated
      // replies must not commit as though complete (ci-no-commit-on-abort).
      if (!committed) this.emit({ kind: 'draftCleared', participantID: this.participantID })
      this.clearOpenInvocations()
      status?.(null)
    }
  }

  /**
   * Read SSE blocks and translate them. Returns whether the turn committed
   * a message, so the caller knows whether a draft is still outstanding.
   */
  private async consumeStream(
    body: ReadableStream<Uint8Array>,
    localID: string,
    status: ((s: TurnStatus | null) => void) | undefined,
  ): Promise<boolean> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    // adh streams fragments; `draftUpdated.text` is the accumulation
    // (ci-accumulate), so we hold the running text here.
    let accumulated = ''
    let responded = false
    let committed = false

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let sep: number
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const { event, data } = parseSseBlock(buffer.slice(0, sep))
          buffer = buffer.slice(sep + 2)

          switch (event) {
            // Connection heartbeat, not a transcript event (ci-drop-open).
            case 'open':
              break

            // Out-of-band progress. A retry is not something that happened
            // in the conversation (ci-status-out-of-band).
            case 'status':
              if (parseData<{ phase?: string }>(data)?.phase === 'retrying') status?.('retrying')
              break

            case 'token': {
              const fragment = parseData<{ text: string }>(data)?.text ?? ''
              if (!responded) {
                responded = true
                status?.('responding')
              }
              accumulated += fragment
              this.emit({
                kind: 'draftUpdated',
                participantID: this.participantID,
                text: accumulated,
                attachments: [],
              })
              break
            }

            case 'tool_call_started': {
              const d = parseData<{ name: string; arguments: string }>(data)
              if (!d) break
              this.emit({
                kind: 'commandInvoked',
                participantID: this.participantID,
                invocation: this.openInvocation(d.name, d.arguments),
              })
              break
            }

            case 'tool_call_completed': {
              const d = parseData<{ name: string; ok: boolean; result: string }>(data)
              if (!d) break
              const invocationID = this.closeInvocation(d.name)
              // A completion for a call we never saw start is dropped
              // rather than invented.
              if (!invocationID) break
              this.emit({
                kind: 'commandCompleted',
                participantID: this.participantID,
                result: {
                  invocationID,
                  ok: d.ok,
                  resultJSON: d.ok ? d.result : undefined,
                  errorMessage: d.ok ? undefined : d.result,
                  completedAt: new Date(),
                },
              })
              break
            }

            case 'done':
              // Commit exactly once, then clear the draft (ci-commit-once).
              // An empty reply still commits, so the transcript records
              // that the turn happened.
              this.emit({
                kind: 'messageReceived',
                message: {
                  localID: crypto.randomUUID(),
                  senderID: this.participantID,
                  text: accumulated,
                  timestamp: new Date(),
                  attachments: [],
                  deliveryStatus: { kind: 'delivered' },
                },
              })
              this.emit({ kind: 'draftCleared', participantID: this.participantID })
              committed = true
              return committed

            case 'error':
              // adh answers 200 and reports failure in-band, so status
              // codes prove nothing (ci-in-band-errors).
              this.emit({
                kind: 'messageFailed',
                localID,
                reason: parseData<{ message: string }>(data)?.message ?? 'Chat failed.',
              })
              return committed

            // Unknown events are ignored so adh can add some without
            // breaking older clients (ci-unknown-events).
            default:
              break
          }
        }
      }
    } catch (err) {
      // An abort lands here too; the turn simply ends without committing.
      if (!this.destroyed) {
        this.emit({ kind: 'transportError', message: errorMessage(err, 'The chat stream failed.') })
      }
    } finally {
      reader.releaseLock()
    }
    return committed
  }

  /**
   * Assign a fresh id per invocation (ci-invocation-ids). adh's
   * `tool_call_completed` carries a name and no id, so correlation is by
   * name and arrival order — oldest open call of that name wins.
   */
  private openInvocation(commandName: string, argumentsJSON: string): CommandInvocation {
    const id = crypto.randomUUID()
    const open = this.openInvocations.get(commandName)
    if (open) open.push(id)
    else this.openInvocations.set(commandName, [id])
    return {
      id,
      commandName,
      invokerID: this.participantID,
      // CommandInvoker is 'user' | 'other'; the persona is not the local user.
      invokerKind: 'other',
      argumentsJSON,
      requestedAt: new Date(),
    }
  }

  private closeInvocation(commandName: string): string | null {
    const open = this.openInvocations.get(commandName)
    const id = open?.shift()
    if (open && open.length === 0) this.openInvocations.delete(commandName)
    return id ?? null
  }

  private clearOpenInvocations(): void {
    this.openInvocations.clear()
  }

  private emit(event: InboundEvent): void {
    this.queue.push(event)
  }
}
