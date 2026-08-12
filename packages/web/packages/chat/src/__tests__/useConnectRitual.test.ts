// src/__tests__/useConnectRitual.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useConnectRitual } from '../hooks/useConnectRitual'
import { useChatSession } from '../hooks/useChatSession'
import type { ChatBackend } from '../backends/types'

const cfg = {
  say: async () => {},
  welcome: 'connected.',
  greeting: 'hello.',
  waitLines: ['summoning...', 'accepted...'],
  stallLines: ['stalling a...', 'stalling b...'],
  connectingLine: 'connecting...',
  connectedLine: 'connected!',
  // Pinned explicitly (they equal the hook's defaults) so the timer advances
  // below read against a stated value instead of an implicit one.
  readyAfterMs: 2000,
  giveUpAfterMs: 30000,
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useConnectRitual', () => {
  it('starts disabled, unengaged, on the first wait line', () => {
    const { result } = renderHook(() => useConnectRitual(cfg))
    expect(result.current.inputDisabled).toBe(true)
    expect(result.current.engaged).toBe(false)
    expect(result.current.statusLine).toBe('summoning...')
  })

  it('steps through the wait lines then loops the stall lines, on the wait/stall cadence', () => {
    const { result } = renderHook(() => useConnectRitual(cfg))
    act(() => { vi.advanceTimersByTime(900) })
    expect(result.current.statusLine).toBe('accepted...')
    act(() => { vi.advanceTimersByTime(900) })
    expect(result.current.statusLine).toBe('stalling a...')
    // The stall cadence is 1600ms, not the 900ms wait cadence — 900ms alone must
    // NOT be enough to advance past the first stall line.
    act(() => { vi.advanceTimersByTime(900) })
    expect(result.current.statusLine).toBe('stalling a...')
    act(() => { vi.advanceTimersByTime(700) }) // completes the 1600ms stall step
    expect(result.current.statusLine).toBe('stalling b...')
    act(() => { vi.advanceTimersByTime(1600) })
    expect(result.current.statusLine).toBe('stalling a...') // loops back to index 0
  })

  it('connects on the give-up timeout and enables the input', async () => {
    const { result } = renderHook(() => useConnectRitual(cfg))
    await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
    expect(result.current.engaged).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(result.current.connected).toBe(true)
    expect(result.current.inputDisabled).toBe(false)
  })

  describe('wait lines with no stall loop', () => {
    // The shape a fixture uses: a couple of lines while it settles, and then
    // nothing to loop — no endless "still thinking" theater.
    const noStall = { ...cfg, stallLines: [] }

    it('holds the last wait line instead of blanking it', () => {
      const { result } = renderHook(() => useConnectRitual(noStall))
      act(() => { vi.advanceTimersByTime(900) })
      expect(result.current.statusLine).toBe('accepted...')
      // Past the last wait line there is nothing to step to. The index used to run
      // on regardless and land on `% 0` — NaN — so the status silently vanished.
      act(() => { vi.advanceTimersByTime(900) })
      expect(result.current.statusLine).toBe('accepted...')
      act(() => { vi.advanceTimersByTime(10000) })
      expect(result.current.statusLine).toBe('accepted...')
    })

    it('stops stepping once nothing can advance', () => {
      let renders = 0
      renderHook(() => {
        renders += 1
        return useConnectRitual(noStall)
      })
      // One step at a time: each advance has to flush before the next timer is
      // armed, so a single 1800ms jump would leave the last step still pending.
      act(() => { vi.advanceTimersByTime(900) })
      act(() => { vi.advanceTimersByTime(900) })
      const settled = renders
      expect(settled).toBeGreaterThan(1) // the steps really did happen
      // Well past several stall cadences, and short of the 30s give-up. Nothing
      // may re-render: the timer used to re-arm forever against an index no
      // longer read, so this counted a render every 1600ms.
      act(() => { vi.advanceTimersByTime(10000) })
      expect(renders).toBe(settled)
    })
  })

  describe('engagedByUser', () => {
    it('stays false when the give-up timeout starts the ritual', async () => {
      const { result } = renderHook(() => useConnectRitual(cfg))
      await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
      // The ritual ran, but nobody reached for him — behavior that follows the
      // reader's attention (his gaze) must not fire off a timer alone.
      expect(result.current.engaged).toBe(true)
      expect(result.current.engagedByUser).toBe(false)
    })

    it('stays false on a mount arrival', async () => {
      const { result } = renderHook(() => useConnectRitual({ ...cfg, engageOn: 'mount' }))
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      expect(result.current.engaged).toBe(true)
      expect(result.current.engagedByUser).toBe(false)
    })

    it('is true on a real pointer move', async () => {
      const { result } = renderHook(() => useConnectRitual(cfg))
      await act(async () => { await vi.advanceTimersByTimeAsync(2000) }) // readyAfterMs
      await act(async () => {
        window.dispatchEvent(new Event('pointermove'))
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(result.current.engagedByUser).toBe(true)
    })

    it('is true on a deliberate pointerdown in element mode', async () => {
      const el = document.createElement('div')
      document.body.appendChild(el)
      const { result } = renderHook(() => useConnectRitual({ ...cfg, engageOn: { current: el } }))
      await act(async () => {
        el.dispatchEvent(new Event('pointerdown', { bubbles: true }))
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(result.current.engagedByUser).toBe(true)
      el.remove()
    })
  })

  describe('unmount', () => {
    it('abandons the ritual mid-beat instead of speaking into a torn-down tree', async () => {
      const said: string[] = []
      const { unmount } = renderHook(() =>
        useConnectRitual({
          ...cfg,
          engageOn: 'mount',
          say: async (text: string) => {
            said.push(text)
          },
        }),
      )
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(said).toEqual(['connected.']) // the welcome landed; the beat is pending

      unmount()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000) // well past the 800ms beat
      })
      // The greeting must never be spoken after the component is gone. `say` renders
      // it letter by letter through timers whose unmount cleanup has already run, so
      // a line started now belongs to nobody: the timers fire into a torn-down
      // document and React reaches for a `window` the environment no longer has.
      expect(said).toEqual(['connected.'])
    })
  })

  describe('React Strict Mode', () => {
    // In development React runs every effect mount → cleanup → mount. The ritual is a chain
    // of awaits started from an effect and guarded by `started`, a ref, so it must survive
    // that cleanup: the chain belongs to the SESSION, not to one run of the effect. When the
    // liveness flag was a plain `let`, the cleanup between the two runs killed run 1's chain
    // and `started` made run 2 a no-op — so in dev the ritual died at its first await and the
    // composer stayed shut forever. Driven through a real `useChatSession` because that is
    // where the awaited promises come from, and its own teardown lands them.
    const persona = { name: 'Bot' }
    const backend: ChatBackend = { sendMessage: async () => 'ok' }

    // `reactStrictMode: true`, not `wrapper: StrictMode` — with a wrapper, RTL mounts the
    // hook's component outside the boundary and the effects run exactly once, so the test
    // passes against the broken hook and proves nothing.
    const renderRitual = (strict: boolean) =>
      renderHook(
        () => {
          const session = useChatSession({ backend, persona })
          const ritual = useConnectRitual({ ...cfg, engageOn: 'mount', say: session.say })
          return { session, ritual }
        },
        { reactStrictMode: strict },
      )

    it('completes the ritual through the dev double-mount', async () => {
      const { result } = renderRitual(true)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000) // well past the beat and both typed lines
      })
      expect(result.current.ritual.connected).toBe(true)
      expect(result.current.ritual.inputDisabled).toBe(false)
      // Spoken once each, whole, and in order — the second mount must not re-run the ritual.
      expect(result.current.session.messages.map((m) => m.text)).toEqual([
        'connected.',
        'hello.',
      ])
    })

    it('reaches the same end state without Strict Mode', async () => {
      const { result } = renderRitual(false)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })
      expect(result.current.ritual.inputDisabled).toBe(false)
      expect(result.current.session.messages.map((m) => m.text)).toEqual([
        'connected.',
        'hello.',
      ])
    })
  })

  it('ignores a pointer move before the ready delay has elapsed', async () => {
    const { result } = renderHook(() => useConnectRitual(cfg))
    await act(async () => {
      window.dispatchEvent(new Event('pointermove'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.engaged).toBe(false)
  })

  it('engages on a pointer move once ready, without waiting for the give-up timeout', async () => {
    const { result } = renderHook(() => useConnectRitual(cfg))
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) }) // readyAfterMs
    expect(result.current.engaged).toBe(false) // becoming ready alone doesn't engage
    await act(async () => {
      window.dispatchEvent(new Event('pointermove'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.engaged).toBe(true)
    expect(result.current.connected).toBe(true)
  })

  it('ignores a ready pointer move when the window lacks focus', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    const { result } = renderHook(() => useConnectRitual(cfg))
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) }) // readyAfterMs
    await act(async () => {
      window.dispatchEvent(new Event('pointermove'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.engaged).toBe(false)
  })

  describe('engageOn an element', () => {
    it('never engages on a window pointer move or the give-up timeout', async () => {
      const el = document.createElement('div')
      document.body.appendChild(el)
      const { result } = renderHook(() => useConnectRitual({ ...cfg, engageOn: { current: el } }))
      // Well past both the ready arm and the give-up fallback: neither applies here.
      await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
      await act(async () => {
        window.dispatchEvent(new Event('pointermove'))
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(result.current.engaged).toBe(false)
      expect(result.current.inputDisabled).toBe(true)
      el.remove()
    })

    it('engages on a deliberate pointerdown inside the element', async () => {
      const el = document.createElement('div')
      document.body.appendChild(el)
      const { result } = renderHook(() => useConnectRitual({ ...cfg, engageOn: { current: el } }))
      await act(async () => {
        el.dispatchEvent(new Event('pointerdown', { bubbles: true }))
        await vi.advanceTimersByTimeAsync(1000)
      })
      expect(result.current.engaged).toBe(true)
      expect(result.current.connected).toBe(true)
      expect(result.current.inputDisabled).toBe(false)
      el.remove()
    })

    it('engages on focus landing inside the element', async () => {
      const el = document.createElement('div')
      document.body.appendChild(el)
      const { result } = renderHook(() => useConnectRitual({ ...cfg, engageOn: { current: el } }))
      await act(async () => {
        el.dispatchEvent(new Event('focusin', { bubbles: true }))
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(result.current.engaged).toBe(true)
      el.remove()
    })
  })
})
