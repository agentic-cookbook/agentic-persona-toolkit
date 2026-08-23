import { describe, it, expect } from 'vitest'
import { act, render } from '@testing-library/react'
import { Transcript } from '../components/Transcript'
import type { ChatMessage } from '../types'

/* jsdom has no layout, so a scroll container has to be described by hand.
 * `scrollHeight` is derived from the rendered text: that is the whole point of
 * these tests — a streamed reply grows the text of ONE bubble without changing
 * how many bubbles there are, and the question is whether the transcript
 * follows it down. */
function describeAsScrollable(el: HTMLElement, clientHeight: number): void {
  let scrollTop = 0
  Object.defineProperty(el, 'clientHeight', {
    get: () => clientHeight,
    configurable: true,
  })
  Object.defineProperty(el, 'scrollHeight', {
    get: () => (el.textContent ?? '').length,
    configurable: true,
  })
  Object.defineProperty(el, 'scrollTop', {
    get: () => scrollTop,
    set: (v: number) => {
      scrollTop = v
      el.dispatchEvent(new Event('scroll'))
    },
    configurable: true,
  })
}

/* A MutationObserver callback is a microtask that then asks for a frame, so
 * settling takes more than one turn. Two frames and a macrotask covers it. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    await new Promise((r) => setTimeout(r, 0))
  })
}

const DRAFT_ID = 'draft:persona'

function draft(text: string): ChatMessage {
  return {
    id: DRAFT_ID,
    sender: { name: 'Bot' },
    text,
    timestamp: new Date(0),
    isPersona: true,
  }
}

describe('transcript autoscroll', () => {
  it('follows a streamed reply that grows one bubble', async () => {
    const { container, rerender } = render(
      <Transcript messages={[draft('a')]} isTyping={false} />,
    )
    const el = container.querySelector('.pc-transcript') as HTMLElement
    describeAsScrollable(el, 10)

    await settle()
    el.scrollTop = el.scrollHeight // the reader is at the bottom, watching

    rerender(<Transcript messages={[draft('a'.repeat(500))]} isTyping={false} />)
    await settle()

    expect(el.scrollTop).toBe(el.scrollHeight)
  })

  it('leaves a reader who scrolled up where they are', async () => {
    const { container, rerender } = render(
      <Transcript messages={[draft('a'.repeat(200))]} isTyping={false} />,
    )
    const el = container.querySelector('.pc-transcript') as HTMLElement
    describeAsScrollable(el, 10)

    await settle()
    el.scrollTop = 0 // scrolled back to read something older

    rerender(<Transcript messages={[draft('a'.repeat(500))]} isTyping={false} />)
    await settle()

    expect(el.scrollTop).toBe(0)
  })
})
