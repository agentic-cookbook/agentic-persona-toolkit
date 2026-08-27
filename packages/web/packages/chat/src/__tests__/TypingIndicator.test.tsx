import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { TypingIndicator, type StatusWordPair } from '../components/TypingIndicator'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  // Restores the `Math.random` spy the Fix 1 test below installs — every other test relies
  // on the real shuffle being genuinely random.
  vi.restoreAllMocks()
})

const PAIRS: StatusWordPair[] = [
  { present: 'thinking', past: 'thought' },
  { present: 'fleeping', past: 'fleeped' },
]

describe('TypingIndicator', () => {
  it('shows the authored past word when the turn settles, not a derived one', () => {
    // "thought" is unreachable by any -ing → -ed rule. A test using only regular
    // words would pass whether or not the derivation is still there.
    //
    // Scoped to the visible `.pc-thinking-label` (not `screen.getByText`, which would throw
    // "multiple elements" here): Fix 3's live region also carries the text "thinking" the
    // instant the turn starts (it announces the phase-entry word), so two distinct nodes
    // legitimately hold that exact string at once — that duplication is the whole point of
    // the live region, not a bug.
    const only: StatusWordPair[] = [{ present: 'thinking', past: 'thought' }]
    const { container, rerender } = render(<TypingIndicator isTyping labels={only} />)
    expect(container.querySelector('.pc-thinking-label')?.textContent).toBe('thinking')

    rerender(<TypingIndicator isTyping={false} labels={only} />)
    expect(container.querySelector('.pc-thinking-label')?.textContent).toBe('thought')
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

  // Finding 2 regression guard: a mid-turn status change (e.g. `retry`) re-resolves the
  // caller's `labels` array to a NEW identity while `isTyping` stays `true` the whole time —
  // that must not restart the elapsed-time clock the settled "for Ns" line reports.
  it('keeps the elapsed-time clock running through a mid-turn label-list change', () => {
    vi.useFakeTimers()
    // Deliberately non-zero: `startRef`'s own unseeded default is 0, so seeding the clock
    // at system time 0 would make a missing seed indistinguishable from a correct one —
    // both give the same elapsed time. A non-zero start makes a missing seed obviously wrong.
    vi.setSystemTime(1_700_000_000_000)
    const thinkWords: StatusWordPair[] = [{ present: 'thinking', past: 'thought' }]
    const retryWords: StatusWordPair[] = [{ present: 'trying again', past: 'tried again' }]
    const { container, rerender } = render(<TypingIndicator isTyping labels={thinkWords} />)

    act(() => { vi.advanceTimersByTime(37_000) })
    // The turn is still going (`isTyping` stays true) but the resolved word list changed —
    // this is what a mid-turn `onStatus(kind)` looks like from the indicator's perspective.
    rerender(<TypingIndicator isTyping labels={retryWords} />)
    act(() => { vi.advanceTimersByTime(3_000) })
    rerender(<TypingIndicator isTyping={false} labels={retryWords} />)

    expect(container.querySelector('.pc-thinking-for')?.textContent).toBe(' for 40s')
  })

  // Regression guard: a chat surface can remount into a turn that is already in flight, so
  // `active` is `true` on the very first render — there is no prior false render to have
  // seeded the clock. `wasActiveRef` must start `false` so this still reads as a false→true
  // edge and seeds `startRef`, rather than leaving it at its unseeded `0` default (which
  // would make the settled line report elapsed time since the Unix epoch).
  it('seeds the elapsed-time clock when it mounts already active', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    const thinkWords: StatusWordPair[] = [{ present: 'thinking', past: 'thought' }]
    const { container, rerender } = render(<TypingIndicator isTyping labels={thinkWords} />)

    act(() => { vi.advanceTimersByTime(10_000) })
    rerender(<TypingIndicator isTyping={false} labels={thinkWords} />)

    expect(container.querySelector('.pc-thinking-for')?.textContent).toBe(' for 10s')
  })

  // Finding 3 regression guard: a kind change can swap in a shorter glyph set than the
  // frame the spinner is currently on. The rendered glyph must stay one of the CURRENT
  // frame set's characters rather than going blank for a tick.
  it('keeps the glyph in bounds when a kind change shrinks the frame set', () => {
    vi.useFakeTimers()
    const only: StatusWordPair[] = [{ present: 'thinking', past: 'thought' }]
    const long = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const short = ['x', 'y']
    const { container, rerender } = render(
      <TypingIndicator isTyping labels={only} frames={long} frameMs={10} />,
    )

    // Advance the spinner past `short.length` so the retained frame index would be
    // out of bounds for `short` if it were used verbatim.
    act(() => { vi.advanceTimersByTime(10 * 7) })
    rerender(<TypingIndicator isTyping labels={only} frames={short} frameMs={10} />)

    const glyph = container.querySelector('.pc-thinking-glyph')?.textContent
    expect(short).toContain(glyph)
  })

  // Fix 1 regression guard: a consuming application's status resolver typically hands
  // back a freshly `.filter()`ed array on every call, so a think->respond transition — or a
  // keystroke in the persona editor — mints a NEW array holding the exact same words. Keying
  // the bag's `useMemo` on that array's IDENTITY (pre-fix `TypingIndicator.tsx:159`) threw the
  // in-progress bag away on every such change, so a word could repeat immediately.
  //
  // Pins `Math.random` so the Fisher-Yates shuffle in `ShuffleBag.ts` is fully deterministic:
  // with `Math.random()` always 0, tracing the shuffle loop shows a fresh
  // `ShuffleBag(['a-ing','b-ing','c-ing','d-ing'])` always draws in the exact order
  // a, d, c, b. That makes the assertions below exact-value checks, not a "no repeat in N
  // samples" check — the latter would only be PROBABLY violated by the bug (a false reset
  // reshuffles randomly, so it doesn't reliably produce an observable repeat in a short
  // window), which would make the test flaky in both directions.
  it('does not reset the shuffle bag when `labels` gets a new identity with the same content', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    vi.useFakeTimers()
    const four: StatusWordPair[] = [
      { present: 'a-ing', past: 'a-ed' },
      { present: 'b-ing', past: 'b-ed' },
      { present: 'c-ing', past: 'c-ed' },
      { present: 'd-ing', past: 'd-ed' },
    ]
    const { container, rerender } = render(
      <TypingIndicator isTyping labels={four} labelMs={100} />,
    )
    const read = () => container.querySelector('.pc-thinking-label')?.textContent ?? ''

    expect(read()).toBe('a-ing')
    act(() => { vi.advanceTimersByTime(100) })
    expect(read()).toBe('d-ing')

    // A fresh array, byte-identical content and order — exactly what `resolveChatStatus`
    // hands back on every call. Keyed on content (Fix 1), the bag survives this untouched, so
    // the displayed word must NOT move just from this rerender.
    rerender(<TypingIndicator isTyping labels={four.map((p) => ({ ...p }))} labelMs={100} />)
    expect(read()).toBe('d-ing')

    // The interrupted permutation continues correctly: c, then b — never an early repeat of
    // a-ing or d-ing.
    act(() => { vi.advanceTimersByTime(100) })
    expect(read()).toBe('c-ing')
    act(() => { vi.advanceTimersByTime(100) })
    expect(read()).toBe('b-ing')
  })

  // Fix 2 regression guard. The bug: `pair` (pre-fix `TypingIndicator.tsx:162`) is seeded ONLY
  // at mount; the redraw that would fix it up lives in an effect gated on `active`
  // (`:203`-`:220`), and effects run AFTER paint. RTL's `act()` flushes effects synchronously
  // on every `rerender()`, so a plain "change `labels` while `active` stays `true`" case can't
  // observe the resulting one-frame flash of stale text — by the time `rerender()` returns,
  // the phase effect's own redraw (via `bag.next()`, re-triggered because `bag`'s identity
  // also changed) has already overwritten it, bug or no bug.
  //
  // This case routes around that: flipping `isTyping` to `false` in the SAME rerender as the
  // vocabulary change sends the update through the SETTLE branch instead, which does not call
  // `bag.next()` — it reads `pairRef.current.past` (pre-fix `:215`). Pre-fix, `pair` (and so
  // `pairRef`, which mirrors it every render at `:170`) was never reset for this commit, so it
  // still holds the OLD vocabulary's word, and the settled line reports a past-tense word that
  // does not exist in the vocabulary the turn actually finished under. That is fully
  // deterministic and needs no timers or mocked randomness — a real, not just a
  // single-frame-transient, divergence.
  it('reflects the new vocabulary immediately when it changes in the same commit the turn settles', () => {
    const oldWords: StatusWordPair[] = [{ present: 'zeeping', past: 'zeeped' }]
    const newWords: StatusWordPair[] = [{ present: 'fleeping', past: 'fleeped' }]
    const { container, rerender } = render(<TypingIndicator isTyping labels={oldWords} />)

    rerender(<TypingIndicator isTyping={false} labels={newWords} />)

    const settled = container.querySelector('.pc-thinking-label')?.textContent
    expect(settled).toBe('fleeped')
    // Never a word absent from the vocabulary the turn settled under.
    expect(settled).not.toBe('zeeped')
  })

  // Fix 3 regression guard. Pre-fix, the running line's `aria-live="polite"` sat on the
  // per-tick text itself (`:300`), so it re-announced on every 1.8s word rotation with no
  // opt-out. There was also no `.pc-status-announce` element at all pre-fix — this assertion
  // is red from the very first line, for that reason alone.
  it('announces the running phase once, and does not re-announce when the word rotates', () => {
    vi.useFakeTimers()
    const two: StatusWordPair[] = [
      { present: 'pondering', past: 'pondered' },
      { present: 'musing', past: 'mused' },
    ]
    const { container } = render(<TypingIndicator isTyping labels={two} labelMs={100} />)
    const announce = () => container.querySelector('.pc-status-announce')?.textContent

    const first = announce()
    expect(first).toMatch(/^(pondering|musing)$/)

    // The visible word rotates on this tick (the interval effect's own `setPair`), but the
    // live region must not follow it.
    act(() => { vi.advanceTimersByTime(100) })
    expect(announce()).toBe(first)
  })

  // Fix 3 regression guard, other direction. Pre-fix, the settled line (`:283`) was a
  // DIFFERENT subtree with no live region at all — the one announcement carrying real
  // information ("thought for 12s") was never spoken. `.pc-status-announce` doesn't exist
  // pre-fix, so this is red immediately.
  it('announces "<past word> for Ns" when the phase settles', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    const only: StatusWordPair[] = [{ present: 'thinking', past: 'thought' }]
    const { container, rerender } = render(<TypingIndicator isTyping labels={only} />)

    act(() => { vi.advanceTimersByTime(5_000) })
    rerender(<TypingIndicator isTyping={false} labels={only} />)

    expect(container.querySelector('.pc-status-announce')?.textContent).toBe('thought for 5s')
  })

  // Fix 4 coverage note (no dedicated test below): the two defects here — `:212`'s
  // `setDone(...)` called from INSIDE the `setPhase` updater, and `:170`'s `pairRef.current =
  // pair` written directly in the render body — are both React purity violations whose only
  // documented detector is `StrictMode`'s dev-mode double-invocation of updater functions and
  // render bodies. That mechanism doesn't itself emit a `console.error`/`warn` for this
  // specific shape (a leaked `setState` inside another `setState`'s updater, or a mutated
  // ref) — it just silently invokes twice, and with `vi.useFakeTimers()` freezing `Date.now()`
  // the duplicated `setDone` call pre-fix computes an identical value both times, so there is
  // no numeric drift to observe either. A test asserting "no console output" would not
  // reliably have been red pre-fix, so — rather than ship an unverified claim — this fix is
  // covered by construction (the rewrite below matches the fix spec exactly: two ordinary
  // top-level `setDone`/`setPhase` calls, `pairRef`/`phaseRef` synced via an effect declared
  // BEFORE the phase effect) and by the "reflects the new vocabulary immediately…" test above,
  // which already depends on that declaration order: it reads `pairRef.current.past` in the
  // very same settle branch FIX 4 rewrote, and would read a STALE ref if the sync effect ran
  // after the phase effect instead of before it.
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

  it('rebuilds the vocabulary when two different word lists would share a naive key', () => {
    // The content key is built by joining the authored words, so the separator has to be a
    // character the author cannot type. With a space, these two lists both key to "a b c":
    // the memo would not rebuild, the render-time reset would not fire, and the status line
    // would keep showing a word the persona no longer has. A NUL separator is what parts them.
    const spaced: StatusWordPair[] = [{ present: 'a b', past: 'c' }]
    const shifted: StatusWordPair[] = [{ present: 'a', past: 'b c' }]
    const { container, rerender } = render(<TypingIndicator isTyping labels={spaced} />)
    expect(container.querySelector('.pc-thinking-label')?.textContent).toBe('a b')

    rerender(<TypingIndicator isTyping labels={shifted} />)
    expect(container.querySelector('.pc-thinking-label')?.textContent).toBe('a')
  })

  it('puts the idle phrase where assistive tech can reach it', () => {
    // Every visible span is `aria-hidden` so the live region is the single AT-facing copy of
    // the status line — which means an idle line whose region is empty is not "quiet", it is
    // absent. Seeding the region at mount also keeps it silent: live regions announce later
    // changes, not the content they mount with.
    const { container } = render(
      <TypingIndicator isTyping={false} labels={only} idlePhrase="waiting to zeeble" />,
    )
    expect(container.querySelector('.pc-thinking')?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.pc-status-announce')?.textContent).toBe('waiting to zeeble')
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
