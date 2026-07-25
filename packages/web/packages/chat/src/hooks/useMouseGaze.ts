import { useEffect, type RefObject } from 'react'
import type { GazeVector } from './useCaretGaze'

const clampUnit = (n: number): number => Math.max(-1, Math.min(1, n))

/**
 * Mouse-follow gaze: while `enabled`, point the avatar's eyes at the cursor,
 * measured as a unit-square direction from `anchorRef`'s centre (half the
 * viewport on each axis → ±1; x right-positive, y down-positive, matching the
 * caret-gaze convention).
 *
 * This is the persona's pre-engagement reflex — it watches the cursor roam the
 * page until the user reaches for the chat — so it is deliberately
 * one-directional: it only ever points the eyes AT the cursor and never hands
 * the gaze back on its own. Disabling it simply stops the tracking; the
 * caret-follow (once engaged) or the avatar's idle reflexes take over from
 * wherever the eyes last landed.
 *
 * `onGaze` fires only from the pointermove DOM callback registered inside the
 * effect — never in the effect body — so there is no synchronous
 * set-state-in-effect (keeps strict react-compiler consumers clean).
 */
export function useMouseGaze(
  anchorRef: RefObject<HTMLElement | null> | undefined,
  enabled: boolean,
  onGaze: (gaze: GazeVector) => void,
): void {
  useEffect(() => {
    if (!enabled) return
    const onMove = (e: PointerEvent): void => {
      const anchor = anchorRef?.current
      if (!anchor) return
      const a = anchor.getBoundingClientRect()
      const cx = a.left + a.width / 2
      const cy = a.top + a.height / 2
      onGaze({
        x: clampUnit((e.clientX - cx) / (window.innerWidth / 2 || 1)),
        y: clampUnit((e.clientY - cy) / (window.innerHeight / 2 || 1)),
      })
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [enabled, anchorRef, onGaze])
}
