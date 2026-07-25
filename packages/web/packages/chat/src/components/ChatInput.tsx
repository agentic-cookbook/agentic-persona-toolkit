import { useRef, useState, type RefObject } from 'react'
import { SendIcon } from './SendIcon'

interface ChatInputProps {
  onSend: (text: string) => void
  placeholder?: string
  autoFocus?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  /** When true, the box is shown but can't be typed in or sent from. */
  disabled?: boolean
}

export function ChatInput({
  onSend,
  placeholder = 'Type a message...',
  autoFocus = false,
  inputRef: externalRef,
  disabled = false,
}: ChatInputProps) {
  const internalRef = useRef<HTMLInputElement>(null)
  const ref = externalRef || internalRef
  // Track whether the box has non-whitespace text so the send button (and
  // thus the Enter affordance) can be disabled while it's empty.
  const [hasText, setHasText] = useState(false)

  const handleSend = () => {
    const input = ref.current
    if (!input) return
    const text = input.value.trim()
    if (!text) return
    input.value = ''
    setHasText(false)
    onSend(text)
  }

  return (
    <div className="pc-input-area" data-form-type="other">
      {/* A chat composer is never a credential field. Opt password managers out
          so they don't inject autofill attributes (data-dashlane-rid, etc.) that
          mutate the DOM before hydration and trip React's hydration mismatch:
          Dashlane reads data-form-type="other" (its SAWF "ignore" value, set on
          both this field and its container); 1Password/LastPass/Bitwarden read
          their own ignore attrs. autoComplete="off" alone is not enough. */}
      {/* iOS offers "AutoFill Contact" above the keyboard for fields it can't
          classify, and Safari classifies from the name, the label and the
          placeholder — of which this field had none, none, and a rotating
          persona joke. `autoComplete="off"` does not settle it: WebKit treats
          `off` as a hint it may override for contact autofill, which is why the
          `::-webkit-contacts-auto-fill-button` pseudo-element exists at all
          (base.css hides it). The fix is to stop leaving Safari to guess and
          name the field honestly — `name` and an accessible label that both say
          "message", which is not a contact field in anyone's heuristic. The
          label is worth having on its own: a placeholder is a weak accessible
          name at the best of times, and a joke that re-rolls per send is no
          name at all. */}
      <input
        ref={ref}
        className="pc-input"
        type="text"
        inputMode="text"
        name="message"
        aria-label="Message"
        placeholder={placeholder}
        autoComplete="off"
        data-form-type="other"
        data-1p-ignore="true"
        data-lpignore="true"
        data-bwignore="true"
        autoFocus={autoFocus}
        disabled={disabled}
        enterKeyHint="send"
        onChange={(e) => setHasText(e.currentTarget.value.trim().length > 0)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
          }
        }}
      />
      <button
        className="pc-send-btn"
        aria-label="Send"
        disabled={disabled || !hasText}
        onClick={handleSend}
      >
        <SendIcon />
      </button>
    </div>
  )
}
