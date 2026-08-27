"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { ShuffleBag } from '../backends/ShuffleBag'

// A classic terminal spinner — rotates smoothly in a monospace font.
const DEFAULT_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
// Settled glyph for the completed (grey) state, à la Claude's "✱ Churned for…".
const DEFAULT_DONE_GLYPH = '✱'

/**
 * One action word in both the forms the status line needs: "thinking" while it runs,
 * "thought" once it settles. BOTH are authored — nothing here derives one from the other,
 * because no rule can turn "thinking" into "thought" and a rule that turns it into
 * "thinked" is worse than no rule.
 *
 * A consuming application may define a SECOND, DIFFERENT `StatusWordPair` in its persona
 * data layer — one that adds `tags`, so a persona's status words can be scoped to a status
 * `kind`. Where it does, both are reachable one import apart from the persona editor, and
 * this one is the RENDERER's view: it deliberately does not know about tags, because the
 * data layer's status resolver strips them before handing words to this component. Do not
 * rename this one; it is a published prop type.
 */
export interface StatusWordPair {
  present: string
  past: string
}

/**
 * One colour and what it colours. The settled "thought for 8s" line is deliberately NOT
 * tinted: it is the persona's finished work, and the grey is what makes the running line
 * read as active.
 */
export interface StatusTintSpec {
  color: string
  applies: 'words' | 'icons' | 'both'
}

export interface TypingIndicatorProps {
  /** Whether a reply is currently in flight. */
  isTyping: boolean
  /**
   * "Thinking" word pairs to cycle through while in flight (e.g.
   * [{ present: 'zeeping', past: 'zeeped' }, …]). When omitted, falls back to
   * the classic three-dot indicator and nothing persists — so existing
   * consumers are unaffected.
   */
  labels?: readonly StatusWordPair[]
  /** Frames for the rotating glyph. Defaults to a braille spinner. */
  frames?: readonly string[]
  /** Settled glyph for the grey done line. Defaults to "✱". */
  doneGlyph?: string
  /** Flash random non-green colors while thinking (settles to grey when done). */
  colorful?: boolean
  /** Tint the glyph, the words, or both while thinking. Absent means untinted. */
  tint?: StatusTintSpec
  /** Spinner frame interval (ms). */
  frameMs?: number
  /** How often to switch to a new random word (ms). */
  labelMs?: number
  /**
   * When set and nothing has been in flight yet, show this as an idle status
   * line with the animating glyph (e.g. "waiting to zeeble"). It yields to the
   * thinking state on the first reply and never returns.
   */
  idlePhrase?: string
  /**
   * A transient utterance the persona just "said" (e.g. "yes!", "zzz"). When set,
   * it overrides whatever the status would otherwise show, in any phase. The
   * caller clears it after a beat.
   */
  utterance?: string | null
}

export function TypingIndicator({
  isTyping,
  labels,
  frames,
  doneGlyph,
  colorful,
  tint,
  frameMs,
  labelMs,
  idlePhrase,
  utterance,
}: TypingIndicatorProps) {
  // Classic three-dot fallback when no words are configured (no persisted state).
  if (!labels || labels.length === 0) {
    return isTyping ? (
      <div className="pc-message pc-persona pc-typing">
        <div className="pc-bubble">
          <div className="pc-dots">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    ) : null
  }
  return (
    <ThinkingStatus
      active={isTyping}
      idlePhrase={idlePhrase}
      utterance={utterance}
      labels={labels}
      frames={frames ?? DEFAULT_FRAMES}
      doneGlyph={doneGlyph ?? DEFAULT_DONE_GLYPH}
      colorful={colorful ?? false}
      tint={tint}
      frameMs={frameMs ?? 260}
      labelMs={labelMs ?? 1800}
    />
  )
}

/**
 * A vivid color that is never green — skips the ~75°–165° hue band — and stays
 * bright enough to read on a dark surface.
 */
function randomNonGreen(): string {
  const r = Math.floor(Math.random() * 270)
  const hue = r < 75 ? r : r + 90
  return `hsl(${hue}, 85%, 62%)`
}

interface ThinkingStatusProps {
  active: boolean
  idlePhrase?: string
  utterance?: string | null
  labels: readonly StatusWordPair[]
  frames: readonly string[]
  doneGlyph: string
  colorful: boolean
  tint?: StatusTintSpec
  frameMs: number
  labelMs: number
}

type Phase = 'idle' | 'thinking' | 'done'

/**
 * While `active`, shows `[rotating glyph] [silly word]…`, optionally flashing
 * random non-green colors. When it stops, freezes into a grey
 * `[done glyph] [past-tense word] for Ns` that persists until the next think,
 * mirroring Claude's completed-thinking line.
 */
function ThinkingStatus({
  active,
  idlePhrase,
  utterance,
  labels,
  frames,
  doneGlyph,
  colorful,
  tint,
  frameMs,
  labelMs,
}: ThinkingStatusProps) {
  const [phase, setPhase] = useState<Phase>(active ? 'thinking' : 'idle')

  // Keyed on the CONTENT of `labels`, not its identity: the producer returns freshly filtered
  // arrays on every call, so a think->respond transition (or a keystroke in the editor) mints a
  // new array even when the words are byte-identical. Keying on identity threw away the
  // draw-without-replacement bag on every such change — the word could repeat immediately, and
  // the glyph interval was cleared and restarted before it could tick.
  // The separator is a NUL (`\u0000`) rather than a space or a comma because the words are AUTHORED:
  // an owner may type anything, including whatever we picked as a separator. With a space,
  // `[{present: 'a b', past: 'c'}]` and `[{present: 'a', past: 'b c'}]` produce the same key,
  // and a key collision means the bag is NOT rebuilt — so the status line keeps drawing from
  // the vocabulary the persona no longer has. A NUL cannot appear in the input.
  const labelsKey = labels.map((p) => `${p.present}\u0000${p.past}`).join('\u0000')
  // One bag per DISTINCT label vocabulary (see `labelsKey` above): draw-without-replacement,
  // so a four-word persona shows all four before any repeats. `ThinkingStatus` is only reached
  // when `labels.length > 0` (the guard in `TypingIndicator` returns the dots indicator
  // otherwise), which is what keeps `new ShuffleBag([])` — a throw — unreachable.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on `labelsKey` (content), not `labels` (identity); see the comment above `labelsKey`
  const bag = useMemo(() => new ShuffleBag(labels), [labelsKey])
  // Seeded from the first label rather than a bag draw: the mount effect below draws the
  // real first word, and drawing here too would burn a second item before anything renders.
  const [pair, setPair] = useState<StatusWordPair>(() => labels[0]!)

  // Adjusting state during render (React's documented pattern for "reset state when a prop
  // changes"), guarded by `labelsKey` so it fires only on a genuine vocabulary change, not on
  // every render. Without this, `pair` still points into the PREVIOUS, now-discarded word set
  // for one committed frame: the phase effect below that redraws the real word only runs AFTER
  // paint (effects always do), so the stale word would flash on screen first. Resetting to
  // `labels[0]` rather than a bag draw is deliberate — drawing here would mutate `bag` during
  // render, which StrictMode double-invokes, drawing (and discarding) an extra item per render.
  const seenKeyRef = useRef(labelsKey)
  if (seenKeyRef.current !== labelsKey) {
    seenKeyRef.current = labelsKey
    setPair(labels[0]!)
  }

  const [frame, setFrame] = useState(0)
  const [color, setColor] = useState<string | undefined>(undefined)
  const [done, setDone] = useState<{ word: string; secs: number } | null>(null)
  // Screen-reader announcement, held separately from the visible spans below and updated ONLY
  // where a phase actually changes (entering `thinking`, settling, or a fresh utterance) — see
  // the live-region markup near the bottom of this component for why it exists at all: the
  // running line's own `aria-live` used to be on the per-tick text, so it re-announced every
  // word rotation (no opt-out) and then, because the settled line is a DIFFERENT subtree with
  // no live region of its own, the one announcement that actually carries information —
  // "thought for 12s" — was never spoken.
  // Seeded with the idle phrase rather than empty, because the visible spans below are all
  // `aria-hidden` — this region is the ONLY copy of the status line that assistive tech can
  // reach, so an empty seed leaves a rendered "waiting to zeeble" with nothing behind it. A
  // live region that MOUNTS with content is not announced (only later changes are), which is
  // exactly what the idle line wants: readable when navigated to, silent on page load.
  const [announcement, setAnnouncement] = useState(() => (active ? '' : (idlePhrase ?? '')))

  // Always-current refs, kept in sync via effect rather than written during render (a ref
  // write during render is a side effect React can't see, and unsafe to rely on for
  // correctness). Declared BEFORE the phase effect below so both are already current by the
  // time that effect — which reads them — runs on the same commit.
  const pairRef = useRef(pair)
  const phaseRef = useRef(phase)
  useEffect(() => {
    pairRef.current = pair
    phaseRef.current = phase
  })

  // Always-current ref so the active→idle transition reads the latest start time
  // without re-subscribing the effect on every tick.
  const startRef = useRef(0)

  // Tracks whether `active` was already true on the PREVIOUS run of the phase effect below,
  // so that effect can tell "the turn just began" from "the turn is still going and only the
  // word list changed" (a mid-turn status change re-resolves `labels`, which mints a new
  // `bag` identity and re-runs the effect via its `bag` dependency, even though `active`
  // itself never left `true`). Only a false→true edge should seed `startRef` — otherwise a
  // mid-turn kind change restarts the elapsed-time clock and understates the turn's real
  // length (a 40s turn that changed kind at t=37 would settle to "for 3s").
  // Always starts `false` — never `active` — so a component that mounts with the turn
  // already in flight (a chat surface remounted into an active turn) still reads as a
  // false→true edge on the effect's first run and seeds `startRef`. Seeding it from
  // `active` would leave `startRef` at its `0` default in that case, so the settled line
  // would report elapsed time since the Unix epoch instead of since the turn began.
  const wasActiveRef = useRef(false)

  // In-bounds by construction: a kind change can swap in a shorter glyph set than the frame
  // the spinner is currently on (the effect below re-subscribes to the new `frames.length`
  // asynchronously), so the render below must not trust `frame` to already be in range.
  const frameIndex = frames.length > 0 ? frame % frames.length : 0

  // Applied to the SPANS rather than the wrapper so `applies` can name one of them; an
  // inherited colour on the wrapper would tint both or neither.
  const glyphStyle =
    tint && (tint.applies === 'icons' || tint.applies === 'both') ? { color: tint.color } : undefined
  const labelStyle =
    tint && (tint.applies === 'words' || tint.applies === 'both') ? { color: tint.color } : undefined

  // Phase transitions driven by `active` (the chat's isTyping).
  useEffect(() => {
    if (active) {
      const next = bag.next()
      setPair(next)
      // Announce the drawn word ONCE, on the transition into `thinking` — not on every 1.8s
      // rotation (that redraw lives in the interval effect below and deliberately never
      // touches `announcement`).
      setAnnouncement(next.present)
      if (colorful) setColor(randomNonGreen())
      // Seed the clock only on the false→true edge — a mid-turn re-run of this effect
      // (triggered by `bag` changing while `active` stays `true`) must not touch it.
      if (!wasActiveRef.current) startRef.current = Date.now()
      setPhase('thinking')
    } else if (phaseRef.current === 'thinking') {
      // Two ordinary top-level calls, not a `setPhase` updater with `setDone` called from
      // inside it (updaters must be pure — the old version wasn't). `phaseRef.current` stands
      // in for the `p` the updater used to receive; it's current because the ref-sync effect
      // above is declared first and so runs first on this same commit.
      const secs = Math.max(1, Math.round((Date.now() - startRef.current) / 1000))
      setDone({ word: pairRef.current.past, secs })
      setAnnouncement(`${pairRef.current.past} for ${secs}s`)
      setPhase('done')
    }
    wasActiveRef.current = active
  }, [active, bag, colorful])

  // A fresh utterance is announced once — this effect fires only when `utterance` itself
  // changes value (the caller clears it after a beat, which naturally produces a new value on
  // the next one), not on every render while the same utterance is still showing.
  useEffect(() => {
    if (utterance) setAnnouncement(utterance)
  }, [utterance])

  // Spinner cycles while thinking AND while an utterance is showing (so his
  // "speech" glyph animates too); the word cycles only during an actual think.
  // Colors cycle in BOTH phases — the status text flashes the same non-green
  // hues whether thinking or uttering (e.g. the summoning status).
  useEffect(() => {
    const spinning = phase === 'thinking' || !!utterance
    if (!spinning) return
    const f = setInterval(() => setFrame((i) => (i + 1) % frames.length), frameMs)
    const l = phase === 'thinking' ? setInterval(() => setPair(bag.next()), labelMs) : undefined
    let c: ReturnType<typeof setInterval> | undefined
    if (colorful) {
      setColor(randomNonGreen())
      c = setInterval(() => setColor(randomNonGreen()), 1000)
    }
    return () => {
      clearInterval(f)
      if (l) clearInterval(l)
      if (c) clearInterval(c)
    }
  }, [phase, frames.length, frameMs, bag, labelMs, colorful, utterance])

  // ONE persistent live region, present in the same tree position across every phase below
  // (so React never tears it down mid-turn) and carrying PHASE-LEVEL announcements only — see
  // `announcement`'s doc comment above for the screen-reader bug this replaces. Visually
  // hidden, not display:none — an AT-only region has to stay in the accessibility tree, which
  // `display:none`/`visibility:hidden` remove it from. No existing "hide from sight, not from
  // AT" utility was found anywhere in this package or its sibling web packages, so the
  // standard clip-rect technique is added locally as `.pc-visually-hidden` in `base.css`.
  const liveRegion = (
    <span className="pc-visually-hidden pc-status-announce" aria-live="polite">
      {announcement}
    </span>
  )

  // An utterance he just blurted overrides every phase (idle/thinking/done) for
  // its brief lifetime — shown lit, like he's speaking.
  if (utterance) {
    return (
      <div className="pc-message pc-persona pc-typing">
        <div className="pc-bubble">
          <span
            className="pc-thinking"
            style={colorful && color ? { color } : undefined}
            aria-hidden="true"
          >
            <span className="pc-thinking-glyph" aria-hidden="true" style={glyphStyle}>{frames[frameIndex]}</span>
            <span className="pc-thinking-label" style={labelStyle}>{utterance}</span>
          </span>
          {liveRegion}
        </div>
      </div>
    )
  }

  // Before the first reply, an idle status rendered in the settled/completed
  // (grey) style — it's a quiet "waiting", not an active think.
  if (phase === 'idle') {
    if (!idlePhrase) return null
    return (
      <div className="pc-message pc-persona pc-typing">
        <div className="pc-bubble">
          <span className="pc-thinking pc-thinking--done" aria-hidden="true">
            <span className="pc-thinking-glyph" aria-hidden="true">{doneGlyph}</span>
            <span className="pc-thinking-label">{idlePhrase}</span>
            <span className="pc-thinking-ellipsis" aria-hidden="true">…</span>
          </span>
          {liveRegion}
        </div>
      </div>
    )
  }

  if (phase === 'done' && done) {
    return (
      <div className="pc-message pc-persona pc-typing">
        <div className="pc-bubble">
          <span className="pc-thinking pc-thinking--done" aria-hidden="true">
            <span className="pc-thinking-glyph" aria-hidden="true">{doneGlyph}</span>
            <span className="pc-thinking-label">{done.word}</span>
            <span className="pc-thinking-for">{` for ${done.secs}s`}</span>
          </span>
          {liveRegion}
        </div>
      </div>
    )
  }

  return (
    <div className="pc-message pc-persona pc-typing">
      <div className="pc-bubble">
        <span
          className="pc-thinking"
          style={colorful && color ? { color } : undefined}
          aria-hidden="true"
        >
          <span className="pc-thinking-glyph" aria-hidden="true" style={glyphStyle}>{frames[frameIndex]}</span>
          <span className="pc-thinking-label" style={labelStyle}>{pair.present}</span>
          <span className="pc-thinking-ellipsis" aria-hidden="true">…</span>
        </span>
        {liveRegion}
      </div>
    </div>
  )
}
