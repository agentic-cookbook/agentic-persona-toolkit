// src/__tests__/usePersonaGaze.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createRef } from 'react'
import { usePersonaGaze } from '../hooks/usePersonaGaze'
import { appendToBody, installCaretRectStub } from './helpers/caretDom'

// jsdom does no layout; the stub gives the anchor/input meaningful rects, which
// both the mouse source (anchor centre) and the caret source (caret geometry) read.
const { setRect } = installCaretRectStub()

let origW: number
let origH: number
beforeEach(() => {
  // The caret source is rAF-coalesced (useCaretTracker) — needs fake timers to flush.
  vi.useFakeTimers()
  origW = window.innerWidth
  origH = window.innerHeight
  Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
})
afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(window, 'innerWidth', { value: origW, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: origH, configurable: true })
  vi.restoreAllMocks()
})

function pointerMove(clientX: number, clientY: number): void {
  const e = new Event('pointermove')
  Object.assign(e, { clientX, clientY })
  window.dispatchEvent(e)
}

function flush(): void {
  act(() => {
    vi.advanceTimersByTime(20)
  })
}

function mount(value: string): {
  wrapperRef: { current: HTMLDivElement | null }
  anchorRef: { current: HTMLDivElement | null }
  input: HTMLInputElement
} {
  const wrapper = document.createElement('div')
  const input = document.createElement('input')
  input.className = 'pc-input'
  input.value = value
  input.style.fontSize = '20px'
  wrapper.appendChild(input)
  const anchor = document.createElement('div')
  appendToBody(wrapper)
  appendToBody(anchor)
  // Anchor centre (200, 150) for the mouse source.
  setRect(anchor, { left: 100, top: 100, width: 200, height: 100 })
  // Input geometry for the caret source (mirrors the useCaretGaze suite).
  setRect(input, { left: 50, right: 350, width: 300, top: 100, bottom: 140, height: 40 })
  const wrapperRef = createRef<HTMLDivElement>()
  const anchorRef = createRef<HTMLDivElement>()
  Object.assign(wrapperRef, { current: wrapper })
  Object.assign(anchorRef, { current: anchor })
  return { wrapperRef, anchorRef, input }
}

describe('usePersonaGaze', () => {
  it('before engagement, the cursor leads — a page pointer move points the eyes', () => {
    const { wrapperRef, anchorRef } = mount('')
    const onGaze = vi.fn()
    renderHook(() => usePersonaGaze(wrapperRef, anchorRef, false, onGaze))
    pointerMove(450, 350)
    expect(onGaze).toHaveBeenCalledWith({ x: 0.5, y: 0.5 })
  })

  it('after engagement, the mouse source is silenced — a pointer move no longer points the eyes', () => {
    const { wrapperRef, anchorRef } = mount('')
    const onGaze = vi.fn()
    renderHook(() => usePersonaGaze(wrapperRef, anchorRef, true, onGaze))
    pointerMove(450, 350)
    // The caret source may report null (unfocused), but the mouse vector must never appear.
    expect(onGaze).not.toHaveBeenCalledWith({ x: 0.5, y: 0.5 })
  })

  it('after engagement, the caret leads — a focused, non-empty input drives the gaze downward', () => {
    const { wrapperRef, anchorRef, input } = mount('hihihi')
    input.focus()
    const onGaze = vi.fn()
    renderHook(() => usePersonaGaze(wrapperRef, anchorRef, true, onGaze))
    flush()
    // Exact caret math is covered by the useCaretGaze suite; here just prove the
    // caret source is wired when engaged — its signature downward bias (y: 0.9).
    expect(onGaze).toHaveBeenCalledWith(expect.objectContaining({ y: 0.9 }))
  })

  it('before engagement, the caret source stays gated even if the input is focused', () => {
    // Focused with text, but not engaged: the caret must NOT drive the gaze —
    // only the mouse does, and only on a move.
    const { wrapperRef, anchorRef, input } = mount('hihihi')
    input.focus()
    const onGaze = vi.fn()
    renderHook(() => usePersonaGaze(wrapperRef, anchorRef, false, onGaze))
    flush()
    expect(onGaze).not.toHaveBeenCalled()
  })
})
