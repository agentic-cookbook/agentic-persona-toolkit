// src/__tests__/useConnectRitual.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useConnectRitual } from '../hooks/useConnectRitual'

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
