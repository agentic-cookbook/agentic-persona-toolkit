// src/__tests__/useMouseGaze.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createRef } from 'react'
import { useMouseGaze } from '../hooks/useMouseGaze'
import { appendToBody, installCaretRectStub } from './helpers/caretDom'

// jsdom does no layout; this stub lets the anchor report a meaningful rect.
const { setRect } = installCaretRectStub()

// Pin the viewport so the half-width/half-height denominators are known.
let origW: number
let origH: number
beforeEach(() => {
  origW = window.innerWidth
  origH = window.innerHeight
  Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
})
afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: origW, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: origH, configurable: true })
  vi.restoreAllMocks()
})

// A plain Event carrying clientX/clientY — avoids jsdom's MouseEvent-init
// inconsistencies; the hook only reads e.clientX / e.clientY.
function pointerMove(clientX: number, clientY: number): void {
  const e = new Event('pointermove')
  Object.assign(e, { clientX, clientY })
  window.dispatchEvent(e)
}

function mountAnchor(): { anchorRef: { current: HTMLDivElement | null }; anchor: HTMLDivElement } {
  const anchor = document.createElement('div')
  appendToBody(anchor)
  // Centre at (200, 150): left 100 + width/2 100; top 100 + height/2 50.
  setRect(anchor, { left: 100, top: 100, width: 200, height: 100 })
  const anchorRef = createRef<HTMLDivElement>()
  Object.assign(anchorRef, { current: anchor })
  return { anchorRef, anchor }
}

describe('useMouseGaze', () => {
  it('points the eyes at the cursor, as a unit direction from the anchor centre', () => {
    const { anchorRef } = mountAnchor()
    const onGaze = vi.fn()
    renderHook(() => useMouseGaze(anchorRef, true, onGaze))
    // (450-200)/500 = 0.5 ; (350-150)/400 = 0.5
    pointerMove(450, 350)
    expect(onGaze).toHaveBeenCalledWith({ x: 0.5, y: 0.5 })
  })

  it('clamps each axis to -1..1 when the cursor is beyond half a viewport away', () => {
    const { anchorRef } = mountAnchor()
    const onGaze = vi.fn()
    renderHook(() => useMouseGaze(anchorRef, true, onGaze))
    pointerMove(5000, -5000)
    expect(onGaze).toHaveBeenCalledWith({ x: 1, y: -1 })
  })

  it('does nothing while disabled', () => {
    const { anchorRef } = mountAnchor()
    const onGaze = vi.fn()
    renderHook(() => useMouseGaze(anchorRef, false, onGaze))
    pointerMove(450, 350)
    expect(onGaze).not.toHaveBeenCalled()
  })

  it('does nothing when there is no anchor to measure against', () => {
    const onGaze = vi.fn()
    renderHook(() => useMouseGaze(undefined, true, onGaze))
    pointerMove(450, 350)
    expect(onGaze).not.toHaveBeenCalled()
  })

  it('stops tracking after unmount', () => {
    const { anchorRef } = mountAnchor()
    const onGaze = vi.fn()
    const { unmount } = renderHook(() => useMouseGaze(anchorRef, true, onGaze))
    unmount()
    pointerMove(450, 350)
    expect(onGaze).not.toHaveBeenCalled()
  })
})
