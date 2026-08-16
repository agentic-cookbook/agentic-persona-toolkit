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
 */
export interface StatusWordPair {
  present: string
  past: string
}

export interface TypingIndicatorProps {
  /** Whether a reply is currently in flight. */
  isTyping: boolean
  /**
   * "Thinking" words to cycle through while in flight (e.g. ["zeeping",
   * "zorping"]). When omitted, falls back to the classic three-dot indicator
   * and nothing persists — so existing consumers are unaffected.
   */
  labels?: readonly StatusWordPair[]
  /** Frames for the rotating glyph. Defaults to a braille spinner. */
  frames?: readonly string[]
  /** Settled glyph for the grey done line. Defaults to "✱". */
  doneGlyph?: string
  /** Flash random non-green colors while thinking (settles to grey when done). */
  colorful?: boolean
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
  frameMs,
  labelMs,
}: ThinkingStatusProps) {
  const [phase, setPhase] = useState<Phase>(active ? 'thinking' : 'idle')
  // One bag per label array: draw-without-replacement, so a four-word persona shows
  // all four before any repeats. `labels` identity is the cache key — callers memoize it.
  // `ThinkingStatus` is only reached when `labels.length > 0` (the guard in
  // `TypingIndicator` returns the dots indicator otherwise), which is what keeps
  // `new ShuffleBag([])` — a throw — unreachable.
  const bag = useMemo(() => new ShuffleBag(labels), [labels])
  // Seeded from the first label rather than a bag draw: the mount effect below draws the
  // real first word, and drawing here too would burn a second item before anything renders.
  const [pair, setPair] = useState<StatusWordPair>(() => labels[0]!)
  const [frame, setFrame] = useState(0)
  const [color, setColor] = useState<string | undefined>(undefined)
  const [done, setDone] = useState<{ word: string; secs: number } | null>(null)

  const pairRef = useRef(pair)
  pairRef.current = pair

  // Always-current ref so the active→idle transition reads the latest start time
  // without re-subscribing the effect on every tick.
  const startRef = useRef(0)

  // Phase transitions driven by `active` (the chat's isTyping).
  useEffect(() => {
    if (active) {
      setPair(bag.next())
      if (colorful) setColor(randomNonGreen())
      startRef.current = Date.now()
      setPhase('thinking')
    } else {
      setPhase((p) => {
        if (p !== 'thinking') return p
        const secs = Math.max(1, Math.round((Date.now() - startRef.current) / 1000))
        setDone({ word: pairRef.current.past, secs })
        return 'done'
      })
    }
  }, [active, bag, colorful])

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

  // An utterance he just blurted overrides every phase (idle/thinking/done) for
  // its brief lifetime — shown lit, like he's speaking.
  if (utterance) {
    return (
      <div className="pc-message pc-persona pc-typing">
        <div className="pc-bubble">
          <span
            className="pc-thinking"
            style={colorful && color ? { color } : undefined}
            aria-live="polite"
          >
            <span className="pc-thinking-glyph" aria-hidden="true">{frames[frame]}</span>
            <span className="pc-thinking-label">{utterance}</span>
          </span>
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
          <span className="pc-thinking pc-thinking--done">
            <span className="pc-thinking-glyph" aria-hidden="true">{doneGlyph}</span>
            <span className="pc-thinking-label">{idlePhrase}</span>
            <span className="pc-thinking-ellipsis" aria-hidden="true">…</span>
          </span>
        </div>
      </div>
    )
  }

  if (phase === 'done' && done) {
    return (
      <div className="pc-message pc-persona pc-typing">
        <div className="pc-bubble">
          <span className="pc-thinking pc-thinking--done">
            <span className="pc-thinking-glyph" aria-hidden="true">{doneGlyph}</span>
            <span className="pc-thinking-label">{done.word}</span>
            <span className="pc-thinking-for">{` for ${done.secs}s`}</span>
          </span>
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
          aria-live="polite"
        >
          <span className="pc-thinking-glyph" aria-hidden="true">{frames[frame]}</span>
          <span className="pc-thinking-label">{pair.present}</span>
          <span className="pc-thinking-ellipsis" aria-hidden="true">…</span>
        </span>
      </div>
    </div>
  )
}
