import { useRef, type ReactNode } from 'react'
import type { ChatMessage } from '../types'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator, type StatusWordPair } from './TypingIndicator'
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
  /** Don't render the in-transcript indicator (a host renders it elsewhere). */
  suppressTypingIndicator?: boolean
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
  suppressTypingIndicator,
  fadeOlder = false,
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

  return (
    <div ref={ref} className={cls}>
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
        />
      )}
    </div>
  )
}
