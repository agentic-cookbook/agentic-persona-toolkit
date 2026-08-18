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
    /* A form, not a div, and that is what stops iOS offering "AutoFill Contact"
       above the keyboard. An input with no form ancestor is scoped for autofill
       against the whole DOCUMENT, so Safari classifies it from whatever else the
       page happens to say — on a site with a contact section and an address to
       write to, a lone text field reads as the place to put your details, and the
       keyboard offers the reader's own contact card.

       This was measured on iOS 26, not reasoned about: stripping EVERY attribute
       off the input (name, aria-label, placeholder, autocomplete, the data-*
       opt-outs — down to a bare `<input type="text">`) did not move it, and the
       same markup on a page without contact copy never triggered it at all. What
       fixed it was giving the field a form of its own to be scoped against; the
       classifier then sees a one-field form that asks for nothing.

       The element carries `pc-input-area` unchanged, so it is still the flex bar
       every skin styles — the tag is the only thing that changed. Submitting is
       now a real submit, which is also what `enterKeyHint="send"` has been
       promising the on-screen keyboard all along. */
    <form
      className="pc-input-area"
      data-form-type="other"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault()
        handleSend()
      }}
    >
      {/* A chat composer is never a credential field. Opt password managers out
          so they don't inject autofill attributes (data-dashlane-rid, etc.) that
          mutate the DOM before hydration and trip React's hydration mismatch:
          Dashlane reads data-form-type="other" (its SAWF "ignore" value, set on
          both this field and its container); 1Password/LastPass/Bitwarden/Proton
          Pass read their own ignore attrs, and none of them reads another's.
          autoComplete="off" alone is not enough — it speaks only to the browser.
          The list of record is `@agentic-toolkit/ui/lib/autofill`; it is spelled
          out here because this package ships zero runtime dependencies. */}
      {/* `name` and `aria-label` are kept for their own sake, not as an autofill
          hint — the measurement above showed they do nothing for that. A
          placeholder is a weak accessible name at the best of times, and a
          persona joke that re-rolls on every send is no name at all. */}
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
        data-protonpass-ignore="true"
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
      {/* Submits the form rather than calling handleSend directly — one send
          path, so the button and the keyboard's Send key cannot drift apart.
          The Enter handler above still preventDefaults, so it never also
          submits and nothing is sent twice. */}
      <button className="pc-send-btn" type="submit" aria-label="Send" disabled={disabled || !hasText}>
        <SendIcon />
      </button>
    </form>
  )
}
