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

describe('TypingIndicator tint', () => {
  const only: StatusWordPair[] = [{ present: 'thinking', past: 'thought' }]

  it('tints only the glyph when applies is "icons"', () => {
    const { container } = render(
      <TypingIndicator isTyping labels={only} tint={{ color: 'rgb(1, 2, 3)', applies: 'icons' }} />,
    )
    expect(container.querySelector<HTMLElement>('.pc-thinking-glyph')!.style.color).toBe('rgb(1, 2, 3)')
    expect(container.querySelector<HTMLElement>('.pc-thinking-label')!.style.color).toBe('')
  })

  it('tints only the words when applies is "words"', () => {
    const { container } = render(
      <TypingIndicator isTyping labels={only} tint={{ color: 'rgb(1, 2, 3)', applies: 'words' }} />,
    )
    expect(container.querySelector<HTMLElement>('.pc-thinking-glyph')!.style.color).toBe('')
    expect(container.querySelector<HTMLElement>('.pc-thinking-label')!.style.color).toBe('rgb(1, 2, 3)')
  })

  it('tints both when applies is "both"', () => {
    const { container } = render(
      <TypingIndicator isTyping labels={only} tint={{ color: 'rgb(1, 2, 3)', applies: 'both' }} />,
    )
    expect(container.querySelector<HTMLElement>('.pc-thinking-glyph')!.style.color).toBe('rgb(1, 2, 3)')
    expect(container.querySelector<HTMLElement>('.pc-thinking-label')!.style.color).toBe('rgb(1, 2, 3)')
  })

  it('leaves the settled line untinted', () => {
    // Assert the property ("no colour anywhere in the settled line"), not a specific
    // element/class — that holds regardless of which element the done branch uses.
    const tint = { color: 'rgb(1, 2, 3)', applies: 'both' } as const
    const { container, rerender } = render(<TypingIndicator isTyping labels={only} tint={tint} />)
    rerender(<TypingIndicator isTyping={false} labels={only} tint={tint} />)
    const tintedNodes = Array.from(container.querySelectorAll<HTMLElement>('*')).filter(
      (el) => el.style.color !== '',
    )
    expect(tintedNodes).toHaveLength(0)
  })

  it('tints the utterance branch too', () => {
    // `utterance` overrides every phase, rendering its own glyph/label pair distinct
    // from the thinking branch's — confirm it reads `tint` (via the same spans) and
    // shows the utterance text, so this is provably the utterance branch, not the
    // thinking branch under a different label.
    const { container } = render(
      <TypingIndicator
        isTyping
        labels={only}
        utterance="hey!"
        tint={{ color: 'rgb(1, 2, 3)', applies: 'both' }}
      />,
    )
    const glyph = container.querySelector<HTMLElement>('.pc-thinking-glyph')!
    const label = container.querySelector<HTMLElement>('.pc-thinking-label')!
    expect(label.textContent).toBe('hey!')
    expect(glyph.style.color).toBe('rgb(1, 2, 3)')
    expect(label.style.color).toBe('rgb(1, 2, 3)')
  })

  it('leaves the thinking phase untinted when no tint prop is given', () => {
    const { container } = render(<TypingIndicator isTyping labels={only} />)
    // Confirm this actually rendered the thinking phase with real glyph/label nodes —
    // otherwise "no coloured elements" would hold vacuously on an empty render.
    const glyph = container.querySelector<HTMLElement>('.pc-thinking-glyph')
    const label = container.querySelector<HTMLElement>('.pc-thinking-label')
    expect(glyph).not.toBeNull()
    expect(label).not.toBeNull()
    expect(label!.textContent).toBe('thinking')
    expect(glyph!.style.color).toBe('')
    expect(label!.style.color).toBe('')
  })
})
