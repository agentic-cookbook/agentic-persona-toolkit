/**
 * SSE bodies shaped like adh's, for the coordinator's conformance vectors and
 * for the recipe's end-to-end ones. Shared so both describe the same wire.
 */

/** Build an SSE body from `[event, data]` pairs. */
export function sse(blocks: Array<[string, unknown]>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const [event, data] of blocks) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      controller.close()
    },
  })
}

/** A stream that emits, then hangs until aborted — for cancellation vectors. */
export function hangingSse(
  blocks: Array<[string, unknown]>,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const [event, data] of blocks) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      signal.addEventListener('abort', () => controller.error(new Error('aborted')), { once: true })
    },
  })
}

/** A stream that emits, then dies without `done` — a truncated reply. */
export function truncatedSse(blocks: Array<[string, unknown]>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  // Pull-based: erroring from start() would discard the queued chunks, so
  // the tokens would never reach the coordinator at all.
  return new ReadableStream({
    pull(controller) {
      const block = blocks[i++]
      if (!block) {
        controller.error(new Error('connection lost'))
        return
      }
      const [event, data] = block
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
    },
  })
}

/** A stream the test feeds one event at a time. */
export interface ScriptedSse {
  readonly stream: ReadableStream<Uint8Array>
  emit(event: string, data: unknown): void
  close(): void
}

/**
 * An open connection with nothing on it yet, for vectors that need to observe
 * the surface BETWEEN events. A stream built from a fixed list delivers every
 * chunk inside a single flush, and React coalesces the whole turn into one
 * render — the growing draft that the vector exists to check never appears.
 */
export function scriptedSse(): ScriptedSse {
  const encoder = new TextEncoder()
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  return {
    stream,
    emit(event, data) {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
    },
    close() {
      controller.close()
    },
  }
}
