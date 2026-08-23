import { useEffect, useRef, type RefObject } from 'react'

/**
 * Keeps a scroll container pinned to its newest content — but only for a reader
 * who is already there. Scroll up to read something older and the transcript
 * stops chasing you; return to the bottom and it resumes.
 *
 * `deps` is not enough on its own, and this is the whole reason the observer
 * below exists. A streamed reply is ONE bubble whose text grows a token at a
 * time: same message id, same React key, same DOM node, so `messages.length`
 * never moves and neither does `isTyping` — the container gets taller inside
 * while every dependency this hook could be given stays exactly as it was.
 * Watching the subtree instead asks the only question that matters: did what we
 * are scrolling through change size? That also covers content a dependency list
 * cannot see at all — rich content swapping in, an image finishing its load, a
 * reflow that rewraps a paragraph.
 */
export function useScrollToBottom(
  ref: RefObject<HTMLElement | null>,
  deps: unknown[],
): void {
  const isAtBottomRef = useRef(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 30
    }

    el.addEventListener('scroll', onScroll, { passive: true })

    /* One frame per burst, not one per token. Streaming fires mutations far
     * faster than the compositor paints, and `scrollTop` only needs to be right
     * at the next frame. */
    let queued = false
    const followToBottom = () => {
      if (queued || !isAtBottomRef.current) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        // Re-read: the guard was true when the frame was asked for, and a
        // reader can scroll away in between.
        if (isAtBottomRef.current) el.scrollTop = el.scrollHeight
      })
    }

    /* `characterData` because a streamed token lands as a text-node edit and
     * nothing else; `childList` for bubbles and the typing indicator arriving
     * and leaving. Writing `scrollTop` mutates no DOM, so this cannot feed
     * itself. */
    const observer = new MutationObserver(followToBottom)
    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    return () => {
      el.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [ref])

  useEffect(() => {
    const el = ref.current
    if (el && isAtBottomRef.current) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
