import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { TypingIndicator, type StatusWordPair } from '../components/TypingIndicator'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const PAIRS: StatusWordPair[] = [
  { present: 'thinking', past: 'thought' },
  { present: 'fleeping', past: 'fleeped' },
]

describe('TypingIndicator', () => {
  it('shows the authored past word when the turn settles, not a derived one', () => {
    // "thought" is unreachable by any -ing → -ed rule. A test using only regular
    // words would pass whether or not the derivation is still there.
    const only: StatusWordPair[] = [{ present: 'thinking', past: 'thought' }]
    const { rerender } = render(<TypingIndicator isTyping labels={only} />)
    expect(screen.getByText('thinking')).toBeInTheDocument()

    rerender(<TypingIndicator isTyping={false} labels={only} />)
    expect(screen.getByText('thought')).toBeInTheDocument()
    expect(screen.queryByText('thinked')).not.toBeInTheDocument()
  })

  it('renders the plain dots indicator when given no labels', () => {
    const { container } = render(<TypingIndicator isTyping />)
    expect(container.querySelector('.pc-dots')).not.toBeNull()
  })

  it('uses every word once before repeating any', () => {
    vi.useFakeTimers()
    const four: StatusWordPair[] = [
      { present: 'a-ing', past: 'a-ed' },
      { present: 'b-ing', past: 'b-ed' },
      { present: 'c-ing', past: 'c-ed' },
      { present: 'd-ing', past: 'd-ed' },
    ]
    const { container } = render(<TypingIndicator isTyping labels={four} labelMs={100} />)
    const read = () => container.querySelector('.pc-thinking-label')?.textContent ?? ''

    // The mount effect draws item 1; three ticks draw items 2-4. That is exactly one pass
    // of a four-item bag, so all four must be distinct — a Math.random() picker would not be.
    const seen = [read()]
    for (let i = 0; i < 3; i++) {
      act(() => { vi.advanceTimersByTime(100) })
      seen.push(read())
    }
    expect(new Set(seen).size).toBe(4)
  })

  it('animates through the frames it was given', () => {
    vi.useFakeTimers()
    const { container } = render(
      <TypingIndicator isTyping labels={PAIRS} frames={['x', 'y']} frameMs={50} />,
    )
    const glyph = () => container.querySelector('.pc-thinking-glyph')?.textContent
    expect(glyph()).toBe('x')
    act(() => { vi.advanceTimersByTime(50) })
    expect(glyph()).toBe('y')
  })
})
