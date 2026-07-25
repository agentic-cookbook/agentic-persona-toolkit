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
