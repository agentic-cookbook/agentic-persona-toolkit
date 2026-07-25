import { useEffect, type RefObject } from 'react'
import { CHAT_INPUT_SELECTOR } from './useCaretTracker'

/**
 * Keep the chat input focused so the user can always just start typing. Beyond
 * the initial focus-on-enable, this reclaims focus when the tab is re-entered
 * and after a click settles INSIDE the chat — the transcript or the send button
 * hand focus back to the field. Three guards keep it from being obnoxious:
 * a `pointerup` (not `blur`) trigger fires only after the gesture finishes; we
 * bail when the user has actually highlighted text so a drag-to-select isn't
 * clobbered; and we do NOT reclaim when the click landed OUTSIDE the wrapper —
 * that is the user leaving the composer, and a collapsing chat (inactive
 * `minimal`) must be allowed to blur and fold rather than being pinned open by a
 * refocus. The reclaim is deferred a tick so a clicked control's own handler
 * (the send button) runs first, and gated on `document.hasFocus()` so we never
 * fight the OS while another window is active.
 */
export function useInputFocusReclaim<T extends HTMLElement>(
  wrapperRef: RefObject<T | null>,
  enabled: boolean,
  selector: string = CHAT_INPUT_SELECTOR,
): void {
  useEffect(() => {
    if (!enabled) return
    const getInput = (): HTMLInputElement | null =>
      wrapperRef.current?.querySelector<HTMLInputElement>(selector) ?? null
    const refocus = (): void => {
      if (!document.hasFocus()) return
      const input = getInput()
      if (input && !input.disabled && document.activeElement !== input) input.focus()
    }
    const onPointerUp = (e: PointerEvent): void => {
      const sel = window.getSelection()
      if (sel && sel.toString().length > 0) return // user is highlighting — leave it
      // Only reclaim for clicks INSIDE the chat. A click outside is the user
      // leaving the composer — let it blur so a collapsing chat can fold;
      // refocusing would pin it open forever.
      const wrapper = wrapperRef.current
      if (wrapper && e.target instanceof Node && !wrapper.contains(e.target)) return
      setTimeout(refocus, 0) // let the click's own handler run, then reclaim
    }
    refocus() // claim focus the moment the input is enabled
    window.addEventListener('focus', refocus)
    document.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('focus', refocus)
      document.removeEventListener('pointerup', onPointerUp)
    }
  }, [wrapperRef, enabled, selector])
}
