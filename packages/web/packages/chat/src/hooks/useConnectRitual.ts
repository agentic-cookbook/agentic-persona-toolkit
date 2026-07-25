import { useEffect, useRef, useState, type RefObject } from 'react'

export interface ConnectRitualConfig {
  /** Emits a persona line into the transcript. Typically `session.say`. */
  say: (text: string) => Promise<void>
  /** The first line the persona types in — "connection established". */
  welcome: string
  /** The persona's greeting; the input opens once it lands. */
  greeting: string
  /** Status lines cycled briskly before the user engages. */
  waitLines: readonly string[]
  /** Status lines looped indefinitely once the wait lines are exhausted. */
  stallLines: readonly string[]
  /** Status held once the user engages, until the welcome lands. */
  connectingLine: string
  /** Status shown once the welcome has landed. */
  connectedLine: string
  /**
   * What triggers engagement. `'pointer'` (default) engages on the first real
   * pointer move inside the focused window. Pass a ref to an element to instead
   * engage only on a deliberate `pointerdown` or focus INSIDE that element — no
   * passing-cursor trigger and no give-up fallback (`readyAfterMs` /
   * `giveUpAfterMs` are ignored); the caller owns "the user reached for the chat."
   */
  engageOn?: 'pointer' | RefObject<HTMLElement | null>
  /** (pointer mode) Ignore pointer movement for this long, so a passing cursor doesn't trigger. Default 2000ms. */
  readyAfterMs?: number
  /** (pointer mode) Connect anyway if the user never moves the pointer. Default 30000ms. */
  giveUpAfterMs?: number
  /** Beat between the welcome and the greeting. Default 800ms. */
  greetDelayMs?: number
  /** Cadence through `waitLines`. Default 900ms. */
  waitStepMs?: number
  /** Cadence through `stallLines`. Default 1600ms. */
  stallStepMs?: number
}

export interface ConnectRitualState {
  /** True until the persona has greeted the user. */
  inputDisabled: boolean
  /** True once the welcome line has landed. */
  connected: boolean
  /** True the moment the user engages (or the give-up timeout fires). */
  engaged: boolean
  /** The status line to show while `inputDisabled`, or null. */
  statusLine: string | null
}

/**
 * The connection ritual: hold the input closed while a status line cycles, wait
 * for the user to engage, then type the welcome, beat, greet, and open the
 * input. Engagement is a pointer move inside the focused window by default, or a
 * deliberate pointerdown/focus inside `engageOn`'s element when a ref is passed.
 * In pointer mode, if the user never engages the status stalls in a loop until
 * the give-up timeout connects anyway; in element mode there is no fallback —
 * he waits for the user to reach for the chat.
 */
export function useConnectRitual(cfg: ConnectRitualConfig): ConnectRitualState {
  const {
    say,
    welcome,
    greeting,
    waitLines,
    stallLines,
    connectingLine,
    connectedLine,
    engageOn = 'pointer',
    readyAfterMs = 2000,
    giveUpAfterMs = 30000,
    greetDelayMs = 800,
    waitStepMs = 900,
    stallStepMs = 1600,
  } = cfg

  const [inputDisabled, setInputDisabled] = useState(true)
  const [connected, setConnected] = useState(false)
  const [engaged, setEngaged] = useState(false)
  const [waitIdx, setWaitIdx] = useState(0)

  // Step the waiting status: briskly through the wait lines, then slower through
  // the looping stall lines — until the user engages.
  useEffect(() => {
    if (engaged) return
    const ms = waitIdx < waitLines.length ? waitStepMs : stallStepMs
    const id = setTimeout(() => setWaitIdx((i) => i + 1), ms)
    return () => clearTimeout(id)
  }, [waitIdx, engaged, waitLines.length, waitStepMs, stallStepMs])

  // The ritual itself — runs once, whichever trigger fires it. `begin` is
  // trigger-agnostic: the `started` guard makes it idempotent, so every path
  // (pointer move, give-up timeout, or an element pointerdown/focus) just calls it.
  const sayRef = useRef(say)
  sayRef.current = say
  const started = useRef(false)
  useEffect(() => {
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
    const begin = async (): Promise<void> => {
      if (started.current) return
      started.current = true
      setEngaged(true) // stop the stalling loop; the real ritual proceeds
      await sayRef.current(welcome)
      setConnected(true)
      await delay(greetDelayMs)
      await sayRef.current(greeting)
      setInputDisabled(false)
    }

    // Element mode: engage only on a deliberate pointerdown or focus INSIDE the
    // given element — no passing-cursor trigger, no give-up fallback. He waits.
    if (engageOn !== 'pointer') {
      const el = engageOn.current
      if (!el) return
      const onEngage = (): void => void begin()
      el.addEventListener('pointerdown', onEngage)
      el.addEventListener('focusin', onEngage)
      return () => {
        el.removeEventListener('pointerdown', onEngage)
        el.removeEventListener('focusin', onEngage)
      }
    }

    // Pointer mode (default): engage on the first real pointer move inside the
    // focused window (after a short arming delay so a passing cursor doesn't
    // trigger), or give up and connect anyway after the fallback timeout.
    let ready = false
    const onMove = (): void => {
      if (!ready || started.current || !document.hasFocus()) return
      void begin()
    }
    const readyId = setTimeout(() => {
      ready = true
    }, readyAfterMs)
    const giveUpId = setTimeout(() => void begin(), giveUpAfterMs)
    window.addEventListener('pointermove', onMove)
    return () => {
      clearTimeout(readyId)
      clearTimeout(giveUpId)
      window.removeEventListener('pointermove', onMove)
    }
    // Mount-only: the ritual wires its trigger exactly once per session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const waitLine =
    waitIdx < waitLines.length
      ? waitLines[waitIdx]
      : stallLines[(waitIdx - waitLines.length) % stallLines.length]
  const statusLine = connected ? connectedLine : engaged ? connectingLine : waitLine ?? null

  return { inputDisabled, connected, engaged, statusLine }
}
