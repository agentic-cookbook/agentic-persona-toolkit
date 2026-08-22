import { useRef, type ReactNode } from 'react'
import type { ChatMessage } from '../types'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator, type StatusWordPair, type StatusTintSpec } from './TypingIndicator'
import { useScrollToBottom } from '../hooks/useScrollToBottom'

interface TranscriptProps {
  messages: ChatMessage[]
  isTyping: boolean
  selectedIndex?: number
  onMessageClick?: (index: number) => void
  renderPopover?: (message: ChatMessage) => ReactNode
  showDetailArrows?: boolean
  onDetailArrowClick?: (index: number) => void
  className?: string
  /** "Thinking" words for the in-flight indicator (falls back to dots). */
  thinkingLabels?: readonly StatusWordPair[]
  /** Frames for the in-flight rotating glyph. */
  thinkingFrames?: readonly string[]
  /** Settled glyph for the grey done line. */
  thinkingDoneGlyph?: string
  /** Flash random non-green colors while thinking. */
  thinkingColorful?: boolean
  /** Tint the glyph, the words, or both while thinking. */
  thinkingTint?: StatusTintSpec
  /** Don't render the in-transcript indicator (a host renders it elsewhere). */
  suppressTypingIndicator?: boolean
  /** Accessible name for the scroll region. */
  label?: string
  /** Fade older messages toward the top via a viewport-anchored gradient mask:
   * the bottom (newest) stays fully opaque, older lines grow transparent as they
   * rise — but scrolling up brings any line back into the readable zone. Off by
   * default. */
  fadeOlder?: boolean
}

export function Transcript({
  messages,
  isTyping,
  selectedIndex = -1,
  onMessageClick,
  renderPopover,
  showDetailArrows = false,
  onDetailArrowClick,
  className,
  thinkingLabels,
  thinkingFrames,
  thinkingDoneGlyph,
  thinkingColorful,
  thinkingTint,
  suppressTypingIndicator,
  fadeOlder = false,
  label = 'Conversation transcript',
}: TranscriptProps) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollToBottom(ref, [messages.length, isTyping])

  const cls = [
    'pc-transcript',
    fadeOlder ? 'pc-transcript--fade' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ')

  /* `tabIndex={0}` because this element scrolls, and a scroll container that
   * cannot take focus cannot be scrolled from the keyboard — there is no way to
   * reach the arrow keys' target. It is usually masked by the scrollbar, which
   * is draggable and visible enough to say the box has more in it; a theme that
   * hides the bar (crt-monitor swaps it for a fade over the tube's curve) takes
   * the last non-pointer affordance with it, and the scrollback is gone for
   * anyone on a keyboard.
   *
   * `role="region"` and a name so the new tab stop announces as something
   * rather than as an unlabelled group. Deliberately NOT `role="log"`, which
   * would be the tighter semantic and carries an implicit `aria-live="polite"`:
   * streamed replies mutate the last bubble a token at a time, and a live
   * region over that announces the same sentence on every frame. */
  return (
    <div ref={ref} className={cls} tabIndex={0} role="region" aria-label={label}>
      {messages.map((msg, i) => (
        <div key={msg.id}>
          <MessageBubble
            message={msg}
            index={i}
            isSelected={i === selectedIndex}
            onClick={onMessageClick ? () => onMessageClick(i) : undefined}
            showDetailArrow={showDetailArrows && !!msg.popover}
            onDetailArrowClick={
              onDetailArrowClick ? () => onDetailArrowClick(i) : undefined
            }
          />
          {renderPopover && msg.popover && renderPopover(msg)}
        </div>
      ))}
      {!suppressTypingIndicator && (
        <TypingIndicator
          isTyping={isTyping}
          labels={thinkingLabels}
          frames={thinkingFrames}
          doneGlyph={thinkingDoneGlyph}
          colorful={thinkingColorful}
          tint={thinkingTint}
        />
      )}
    </div>
  )
}
