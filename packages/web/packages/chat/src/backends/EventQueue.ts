/**
 * Single-consumer async queue. `Backend.inboundEvents` is a push stream —
 * events originate from turns rather than from the act of iterating — so
 * something has to hold events that arrive before the consumer asks.
 */
export class EventQueue<T> {
  private readonly buffered: T[] = []
  private readonly waiting: Array<(r: IteratorResult<T>) => void> = []
  private closed = false

  push(value: T): void {
    if (this.closed) return
    const waiter = this.waiting.shift()
    if (waiter) waiter({ value, done: false })
    else this.buffered.push(value)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    let waiter = this.waiting.shift()
    while (waiter) {
      waiter({ value: undefined as never, done: true })
      waiter = this.waiting.shift()
    }
  }

  async *drain(): AsyncGenerator<T> {
    for (;;) {
      const buffered = this.buffered.shift()
      if (buffered !== undefined) {
        yield buffered
        continue
      }
      if (this.closed) return
      const next = await new Promise<IteratorResult<T>>((resolve) => {
        this.waiting.push(resolve)
      })
      if (next.done) return
      yield next.value
    }
  }
}
