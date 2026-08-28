import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import * as React from 'react'
import { SplitDivider } from '../components/split-divider'

/**
 * The separator gained an `orientation` because a left/right split had nowhere else to
 * come from: `ResizableSplit` is top/bottom only, so the alternative was a private copy
 * of the drag, keyboard and WCAG step-button work inside whichever feature needed a
 * side-by-side pane first.
 *
 * The two orientations differ on FOUR axes, and each one is a thing that reads correct
 * and behaves wrong if it is missed: which axis a drag is measured on, which arrow keys
 * move it, which way the step buttons point, and what `aria-orientation` claims. A
 * vertical divider that still measures `clientY` tracks the pointer's height as if it
 * were the pointer's position along the split — it moves, so it looks alive, and it
 * moves the wrong way.
 */

/** A host that owns the ratio, so a case can assert on what the divider reported back
 *  rather than on the prop it was handed. The container ref is the rect drags are
 *  measured against — the caller's job, per the primitive's contract. */
function Host({
  orientation,
  rect,
  onRatio,
}: {
  orientation?: 'horizontal' | 'vertical'
  rect?: Partial<DOMRect>
  onRatio?: (r: number) => void
}): React.ReactElement {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [ratio, setRatio] = React.useState(0.5)
  React.useEffect(() => {
    if (!rect || !ref.current) return
    ref.current.getBoundingClientRect = () =>
      ({ top: 0, left: 0, width: 0, height: 0, ...rect }) as DOMRect
  }, [rect])
  return (
    <div ref={ref}>
      <SplitDivider
        ratio={ratio}
        onRatioChange={(r) => {
          setRatio(r)
          onRatio?.(r)
        }}
        containerRef={ref}
        orientation={orientation}
        minRatio={0.1}
        maxRatio={0.9}
        step={0.1}
      />
    </div>
  )
}

/** jsdom has no pointer capture; the component calls it optionally, but fireEvent's
 *  synthetic element still needs the method to exist on the prototype for React's
 *  currentTarget. Supplying a no-op keeps the drag path identical to a browser's. */
function silencePointerCapture(): void {
  Object.assign(HTMLElement.prototype, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
  })
}

describe('SplitDivider — orientation is the SEPARATOR’s own', () => {
  it('defaults to a horizontal line, which splits top/bottom', () => {
    render(<Host />)
    expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe('horizontal')
  })

  it('reports a vertical line when asked for one', () => {
    // A vertical separator splits LEFT/RIGHT — the opposite of how "a vertical split" is
    // usually said out loud, and the reason this is asserted rather than assumed.
    render(<Host orientation="vertical" />)
    expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe('vertical')
  })
})

describe('SplitDivider — the axis a drag is measured on', () => {
  it('measures a horizontal split against the container’s HEIGHT', () => {
    silencePointerCapture()
    const onRatio = vi.fn()
    render(<Host rect={{ top: 0, left: 0, width: 1000, height: 400 }} onRatio={onRatio} />)
    const sep = screen.getByRole('separator')
    fireEvent.pointerDown(sep, { pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(sep, { pointerId: 1, buttons: 1, clientX: 900, clientY: 100 })
    // 100 / 400 — and NOT 900/1000, which is what an unswitched axis would report.
    expect(onRatio).toHaveBeenCalledWith(0.25)
  })

  it('measures a vertical split against the container’s WIDTH', () => {
    silencePointerCapture()
    const onRatio = vi.fn()
    render(
      <Host
        orientation="vertical"
        rect={{ top: 0, left: 0, width: 1000, height: 400 }}
        onRatio={onRatio}
      />,
    )
    const sep = screen.getByRole('separator')
    fireEvent.pointerDown(sep, { pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(sep, { pointerId: 1, buttons: 1, clientX: 300, clientY: 380 })
    // 300 / 1000. The pointer is near the BOTTOM of the container, so a divider that
    // still read clientY would report 0.9 and pin the split to its maximum.
    expect(onRatio).toHaveBeenCalledWith(0.3)
  })

  it('ignores a move made with the button already up', () => {
    silencePointerCapture()
    const onRatio = vi.fn()
    render(
      <Host
        orientation="vertical"
        rect={{ top: 0, left: 0, width: 1000, height: 400 }}
        onRatio={onRatio}
      />,
    )
    const sep = screen.getByRole('separator')
    fireEvent.pointerDown(sep, { pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(sep, { pointerId: 1, buttons: 0, clientX: 300 })
    expect(onRatio).not.toHaveBeenCalled()
  })

  it('ignores a drag before the container has been laid out', () => {
    // width 0 — a first paint, or a hidden tab. The division would be by zero, and the
    // NaN it produces is not recovered from by any later drag.
    silencePointerCapture()
    const onRatio = vi.fn()
    render(<Host orientation="vertical" rect={{ width: 0, height: 400 }} onRatio={onRatio} />)
    const sep = screen.getByRole('separator')
    fireEvent.pointerDown(sep, { pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(sep, { pointerId: 1, buttons: 1, clientX: 300 })
    expect(onRatio).not.toHaveBeenCalled()
  })
})

describe('SplitDivider — the keys that move it', () => {
  it('moves a horizontal split with Up and Down', () => {
    render(<Host />)
    const sep = screen.getByRole('separator')
    fireEvent.keyDown(sep, { key: 'ArrowUp' })
    expect(Number(sep.getAttribute('aria-valuenow'))).toBe(40)
    fireEvent.keyDown(sep, { key: 'ArrowDown' })
    expect(Number(sep.getAttribute('aria-valuenow'))).toBe(50)
  })

  it('moves a vertical split with Left and Right', () => {
    render(<Host orientation="vertical" />)
    const sep = screen.getByRole('separator')
    fireEvent.keyDown(sep, { key: 'ArrowLeft' })
    expect(Number(sep.getAttribute('aria-valuenow'))).toBe(40)
    fireEvent.keyDown(sep, { key: 'ArrowRight' })
    expect(Number(sep.getAttribute('aria-valuenow'))).toBe(50)
  })

  it('leaves the OTHER axis’s arrows alone, so they still scroll', () => {
    render(<Host orientation="vertical" />)
    const sep = screen.getByRole('separator')
    fireEvent.keyDown(sep, { key: 'ArrowUp' })
    fireEvent.keyDown(sep, { key: 'ArrowDown' })
    expect(Number(sep.getAttribute('aria-valuenow'))).toBe(50)
  })

  it('takes Home and End to the limits in both orientations', () => {
    const { unmount } = render(<Host />)
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'Home' })
    expect(Number(screen.getByRole('separator').getAttribute('aria-valuenow'))).toBe(10)
    unmount()
    render(<Host orientation="vertical" />)
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'End' })
    expect(Number(screen.getByRole('separator').getAttribute('aria-valuenow'))).toBe(90)
  })
})

describe('SplitDivider — the non-drag alternative (WCAG 2.2 SC 2.5.7)', () => {
  it('names its step buttons for the panes a top/bottom split actually has', () => {
    render(<Host />)
    expect(screen.getByRole('button', { name: 'Grow bottom pane' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Grow top pane' })).toBeTruthy()
  })

  it('names them for the panes a left/right split actually has', () => {
    // "Grow bottom pane" on a side-by-side split is not a cosmetic slip: it is the only
    // description a screen-reader user gets of what the button does.
    render(<Host orientation="vertical" />)
    expect(screen.getByRole('button', { name: 'Grow right pane' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Grow left pane' })).toBeTruthy()
  })

  it('still steps the ratio without a drag', () => {
    render(<Host orientation="vertical" />)
    fireEvent.click(screen.getByRole('button', { name: 'Grow left pane' }))
    expect(Number(screen.getByRole('separator').getAttribute('aria-valuenow'))).toBe(60)
  })

  it('lets a caller override the labels', () => {
    render(
      <SplitDivider
        ratio={0.5}
        onRatioChange={() => {}}
        containerRef={{ current: null }}
        orientation="vertical"
        growTopLabel="Widen the tree"
        growBottomLabel="Widen the log"
      />,
    )
    expect(screen.getByRole('button', { name: 'Widen the tree' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Widen the log' })).toBeTruthy()
  })
})
