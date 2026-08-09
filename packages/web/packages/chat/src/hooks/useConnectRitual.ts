import { useEffect, useRef, useState, type RefObject } from 'react'

export interface ConnectRitualConfig {
  /** Emits a persona line into the transcript. Typically `session.say`. */
  say: (text: string) => Promise<void>
  /** The first line the persona types in — "connection established". */
  welcome: string
  /** The persona's greeting; the input opens once it lands. */
  greeting: string
  /** Status lines cycled briskly before the user engages. Omit under `'mount'`,
   *  which never waits and so never shows one. */
  waitLines?: readonly string[]
  /** Status lines looped indefinitely once the wait lines are exhausted. */
  stallLines?: readonly string[]
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
   *
   * `'mount'` skips the waiting entirely: the persona arrives already connected,
   * so the ritual runs straight through — welcome, beat, greeting, input open —
   * from the moment he mounts. For a persona who is a FIXTURE in the corner of a
   * page about something else, where making the reader wait would read as broken
   * rather than as theater. `waitLines`/`stallLines` are never shown.
   */
  engageOn?: 'pointer' | 'mount' | RefObject<HTMLElement | null>
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
  /**
   * True only when a REAL user action started the ritual — a pointer move in
   * pointer mode, a pointerdown/focus in element mode. The give-up timeout and
   * `'mount'` do not set it: they start the ritual without the user having done
   * anything. Behavior that should follow the user's attention (gaze, focus
   * seizing) belongs on this, not on `engaged`.
   */
  engagedByUser: boolean
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
 * he waits for the user to reach for the chat. In `'mount'` mode there is no
 * waiting at all: he arrives connected and runs the ritual through on mount.
 */
export function useConnectRitual(cfg: ConnectRitualConfig): ConnectRitualState {
  const {
    say,
    welcome,
    greeting,
    waitLines = [],
    stallLines = [],
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
  const [engagedByUser, setEngagedByUser] = useState(false)
  const [waitIdx, setWaitIdx] = useState(0)

  // Step the waiting status: briskly through the wait lines, then slower through
  // the looping stall lines — until the user engages. With no lines to show
  // (a `'mount'` arrival) there is no status to step, so the timer never starts.
  const hasWaitStatus = waitLines.length > 0 || stallLines.length > 0
  // Past the wait lines only the stall loop can advance the index. A caller that
  // supplies wait lines but no stall lines has nothing left to step to, so stop —
  // otherwise the timer re-renders forever against an index nothing can read.
  const canStep = waitIdx < waitLines.length || stallLines.length > 0
  useEffect(() => {
    if (engaged || !hasWaitStatus || !canStep) return
    const ms = waitIdx < waitLines.length ? waitStepMs : stallStepMs
    const id = setTimeout(() => setWaitIdx((i) => i + 1), ms)
    return () => clearTimeout(id)
  }, [waitIdx, engaged, hasWaitStatus, canStep, waitLines.length, waitStepMs, stallStepMs])

  // The ritual itself — runs once, whichever trigger fires it. `begin` is
  // trigger-agnostic: the `started` guard makes it idempotent, so every path
  // (pointer move, give-up timeout, or an element pointerdown/focus) just calls it.
  const sayRef = useRef(say)
  sayRef.current = say
  const started = useRef(false)
  useEffect(() => {
    // The ritual is a chain of awaits, so left to itself it outlives the component
    // that started it: the beat between the welcome and the greeting resolves
    // whether or not anyone is still mounted, and a `say` after that renders its
    // line through timers the session's own unmount cleanup has already drained —
    // nothing is left to clear them, and they fire into a torn-down document. So
    // the beat is a timer this effect owns, and the chain checks it is still alive
    // after every await. A pending `say` needs no check: its promise resolves only
    // when the line lands, which after unmount it never does.
    let alive = true
    let beat: ReturnType<typeof setTimeout> | undefined
    const delay = (ms: number) =>
      new Promise<void>((r) => {
        beat = setTimeout(r, ms)
      })
    // Every branch below hangs its own unwiring off this, so abandonment happens on
    // unmount whichever trigger the caller chose.
    const stopOn = (unwire?: () => void) => (): void => {
      alive = false
      if (beat !== undefined) clearTimeout(beat)
      unwire?.()
    }

    // `byUser` separates "the ritual started" from "the user reached for him" —
    // the give-up timeout and mount arrival do the former without the latter.
    const begin = async (byUser: boolean): Promise<void> => {
      if (started.current) return
      started.current = true
      setEngaged(true) // stop the stalling loop; the real ritual proceeds
      if (byUser) setEngagedByUser(true)
      await sayRef.current(welcome)
      if (!alive) return
      setConnected(true)
      await delay(greetDelayMs)
      if (!alive) return
      await sayRef.current(greeting)
      if (!alive) return
      setInputDisabled(false)
    }

    // Mount mode: he is already here. Nothing to wait for and nothing to listen
    // to — the ritual runs straight through from this first effect.
    if (engageOn === 'mount') {
      void begin(false)
      return stopOn()
    }

    // Element mode: engage only on a deliberate pointerdown or focus INSIDE the
    // given element — no passing-cursor trigger, no give-up fallback. He waits.
    if (engageOn !== 'pointer') {
      const el = engageOn.current
      if (!el) return stopOn()
      const onEngage = (): void => void begin(true)
      el.addEventListener('pointerdown', onEngage)
      el.addEventListener('focusin', onEngage)
      return stopOn(() => {
        el.removeEventListener('pointerdown', onEngage)
        el.removeEventListener('focusin', onEngage)
      })
    }

    // Pointer mode (default): engage on the first real pointer move inside the
    // focused window (after a short arming delay so a passing cursor doesn't
    // trigger), or give up and connect anyway after the fallback timeout.
    let ready = false
    const onMove = (): void => {
      if (!ready || started.current || !document.hasFocus()) return
      void begin(true)
    }
    const readyId = setTimeout(() => {
      ready = true
    }, readyAfterMs)
    const giveUpId = setTimeout(() => void begin(false), giveUpAfterMs)
    window.addEventListener('pointermove', onMove)
    return stopOn(() => {
      clearTimeout(readyId)
      clearTimeout(giveUpId)
      window.removeEventListener('pointermove', onMove)
    })
    // Mount-only: the ritual wires its trigger exactly once per session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const waitLine = !hasWaitStatus
    ? null
    : waitIdx < waitLines.length
      ? waitLines[waitIdx]
      : // With no stall loop, hold the last wait line. Indexing `% 0` here would
        // be NaN → undefined → the status silently disappearing mid-wait.
        stallLines.length > 0
        ? stallLines[(waitIdx - waitLines.length) % stallLines.length]
        : (waitLines[waitLines.length - 1] ?? null)
  const statusLine = connected ? connectedLine : engaged ? connectingLine : waitLine ?? null

  return { inputDisabled, connected, engaged, engagedByUser, statusLine }
}
