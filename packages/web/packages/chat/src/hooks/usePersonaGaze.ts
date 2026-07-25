import { useCallback, useRef, type RefObject } from 'react'
import { useCaretGaze, type GazeVector } from './useCaretGaze'
import { useMouseGaze } from './useMouseGaze'

/**
 * The persona's full gaze behavior, arbitrated by engagement — one hook so every
 * app gets the same two-source coordination instead of re-deriving it (and its
 * one subtlety) at each call site.
 *
 * - **Before engagement** (`engaged === false`): the eyes follow the cursor as it
 *   roams the page (`useMouseGaze`).
 * - **After engagement**: the caret leads (`useCaretGaze`) — and its own `null`,
 *   when the input empties or blurs, hands the gaze back to the avatar's idle
 *   reflexes.
 *
 * The two sources are gated to their phase so they can't fight over the one pair
 * of eyes. `onGaze` may fire with `null` (only ever from the caret source) to
 * release the gaze; the mouse source only ever points AT the cursor.
 *
 * `onGaze` need not be memoised: it is read through a ref, so an unstable caller
 * callback won't thrash the underlying listeners. Only `engaged` flipping
 * re-subscribes.
 */
export function usePersonaGaze<T extends HTMLElement>(
  wrapperRef: RefObject<T | null>,
  anchorRef: RefObject<HTMLElement | null> | undefined,
  engaged: boolean,
  onGaze: (gaze: GazeVector | null) => void,
): void {
  const onGazeRef = useRef(onGaze)
  onGazeRef.current = onGaze

  // Pre-engagement: the cursor leads. Stable identity (reads the ref) so mouse
  // tracking isn't torn down and rebuilt on every render.
  const emit = useCallback((g: GazeVector): void => onGazeRef.current(g), [])
  useMouseGaze(anchorRef, !engaged, emit)

  // Post-engagement: the caret leads; gated so a stray measure before engaging
  // can't steal the eyes from the mouse source. Changes only when `engaged` does.
  const emitIfEngaged = useCallback(
    (g: GazeVector | null): void => {
      if (engaged) onGazeRef.current(g)
    },
    [engaged],
  )
  useCaretGaze(wrapperRef, anchorRef, emitIfEngaged)
}
