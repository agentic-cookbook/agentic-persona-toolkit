import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { ChatBackend } from '../backends/types'
import type {
  ChatParticipant,
  ChatMessage,
  ChatResponse,
  ToolCallInfo,
} from '../types'

export interface UseChatSessionOptions {
  backend: ChatBackend
  persona: ChatParticipant
  user?: ChatParticipant
  welcomeMessage?: string
}

export interface ChatSession {
  messages: ChatMessage[]
  isTyping: boolean
  sendMessage: (text: string) => void
  /**
   * Make the persona "speak" a line unprompted, typed in letter-by-letter.
   * Resolves once the whole line has landed. Useful for scripted intros.
   */
  say: (text: string) => Promise<void>
  selectedIndex: number
  selectMessage: (index: number) => void
}

function createMessage(
  sender: ChatParticipant,
  text: string,
  isPersona: boolean,
  response?: Exclude<ChatResponse, string>,
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    sender,
    text,
    content: response?.content,
    popover: response?.popover,
    timestamp: new Date(),
    isPersona,
  }
}

async function consumeStream(
  backend: ChatBackend,
  text: string,
  history: ChatMessage[],
  persona: ChatParticipant,
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>,
  setIsTyping: Dispatch<SetStateAction<boolean>>,
): Promise<void> {
  const placeholderId = crypto.randomUUID()
  let placeholderInserted = false

  const ensurePlaceholder = () => {
    if (placeholderInserted) return
    placeholderInserted = true
    setIsTyping(false)
    setMessages((prev) => [
      ...prev,
      {
        id: placeholderId,
        sender: persona,
        text: '',
        timestamp: new Date(),
        isPersona: true,
        isStreaming: true,
      },
    ])
  }

  const updatePlaceholder = (mutator: (msg: ChatMessage) => ChatMessage) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === placeholderId ? mutator(m) : m)),
    )
  }

  const completeToolCall = (
    toolCalls: ToolCallInfo[] | undefined,
    name: string,
    ok: boolean,
    result: string,
  ): ToolCallInfo[] => {
    const list = toolCalls ?? []
    // Update the most recent 'started' entry with this name.
    for (let i = list.length - 1; i >= 0; i--) {
      const entry = list[i]
      if (entry && entry.name === name && entry.status === 'started') {
        const next = [...list]
        next[i] = {
          ...entry,
          status: ok ? 'completed' : 'failed',
          ok,
          result,
        }
        return next
      }
    }
    // No matching started — append synthetic completed entry.
    return [
      ...list,
      {
        name,
        arguments: '',
        status: ok ? 'completed' : 'failed',
        ok,
        result,
      },
    ]
  }

  try {
    const stream = backend.sendMessageStream!(text, history)
    for await (const event of stream) {
      ensurePlaceholder()
      switch (event.type) {
        case 'token':
          updatePlaceholder((m) => ({ ...m, text: m.text + event.text }))
          break
        case 'tool_call_started':
          updatePlaceholder((m) => ({
            ...m,
            toolCalls: [
              ...(m.toolCalls ?? []),
              {
                name: event.name,
                arguments: event.arguments,
                status: 'started',
              },
            ],
          }))
          break
        case 'tool_call_completed':
          updatePlaceholder((m) => ({
            ...m,
            toolCalls: completeToolCall(m.toolCalls, event.name, event.ok, event.result),
          }))
          break
        case 'content':
          updatePlaceholder((m) => ({ ...m, content: event.items }))
          break
        case 'popover':
          updatePlaceholder((m) => ({ ...m, popover: event.data }))
          break
        case 'error':
          updatePlaceholder((m) => ({
            ...m,
            text: m.text || event.message,
            isStreaming: false,
          }))
          return
        case 'done':
          updatePlaceholder((m) => ({ ...m, isStreaming: false }))
          return
      }
    }
    // Stream ended without 'done' — clear streaming flag anyway.
    if (placeholderInserted) {
      updatePlaceholder((m) => ({ ...m, isStreaming: false }))
    }
  } finally {
    setIsTyping(false)
  }
}

export function useChatSession(options: UseChatSessionOptions): ChatSession {
  const { backend, persona, user = { name: 'You', avatar: 'Y' } } = options

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (options.welcomeMessage) {
      return [createMessage(persona, options.welcomeMessage, true)]
    }
    return []
  })
  const [isTyping, setIsTyping] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const queueRef = useRef<string[]>([])
  const processingRef = useRef(false)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  // Every line `say` has in flight, held as the function that LANDS it: stop the typing timer,
  // put the whole line in the message, resolve. A line types at one character per ~40ms and the
  // promise resolves on the last one, so a caller that leaves mid-line — a route change, a test
  // returning — otherwise leaves the rest of the chain scheduled against a component that is
  // gone. Landing rather than merely cancelling is what makes teardown survivable for a caller
  // that AWAITS the line; see the cleanup at the bottom of this hook.
  const pendingLinesRef = useRef<Set<() => void>>(new Set())

  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return
    processingRef.current = true

    while (queueRef.current.length > 0) {
      const text = queueRef.current.shift()!
      setIsTyping(true)

      try {
        if (backend.sendMessageStream) {
          await consumeStream(backend, text, messagesRef.current, persona, setMessages, setIsTyping)
        } else {
          const response = await backend.sendMessage(text, messagesRef.current)
          setIsTyping(false)

          if (typeof response === 'string') {
            setMessages((prev) => [...prev, createMessage(persona, response, true)])
          } else {
            setMessages((prev) => [
              ...prev,
              createMessage(persona, response.text || '', true, response),
            ])
          }
        }
      } catch {
        setIsTyping(false)
        setMessages((prev) => [
          ...prev,
          createMessage(persona, "Sorry, something went wrong. Let's try again.", true),
        ])
      }
    }

    processingRef.current = false
  }, [backend, persona])

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      setMessages((prev) => [...prev, createMessage(user, trimmed, false)])
      queueRef.current.push(trimmed)
      processQueue()
    },
    [user, processQueue],
  )

  // The persona speaks a line unprompted, typed in letter-by-letter (a scripted
  // message, not a reply). Resolves when the whole line has landed.
  const say = useCallback(
    (text: string): Promise<void> => {
      const id = crypto.randomUUID()
      setMessages((prev) => [
        ...prev,
        {
          id,
          sender: persona,
          text: '',
          timestamp: new Date(),
          isPersona: true,
          isStreaming: true,
        },
      ])
      const pending = pendingLinesRef.current
      return new Promise<void>((resolve) => {
        let i = 0
        let timer: ReturnType<typeof setTimeout> | undefined
        // The end of the line, however it is reached: typed to the last character, or cut short
        // by teardown with no time left to type. Both want the same three things, and writing
        // the full `text` rather than the slice reached so far is what keeps a cut-short line a
        // whole sentence instead of a fragment frozen mid-word.
        const land = (): void => {
          if (timer !== undefined) clearTimeout(timer)
          pending.delete(land)
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, text, isStreaming: false } : m)),
          )
          resolve()
        }
        const step = (): void => {
          i += 1
          if (i >= text.length) {
            land()
            return
          }
          const slice = text.slice(0, i)
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: slice } : m)))
          timer = setTimeout(step, 26 + Math.random() * 28)
        }
        pending.add(land)
        timer = setTimeout(step, 0)
      })
    },
    [persona],
  )

  const selectMessage = useCallback(
    (index: number) => {
      if (index >= -1 && index < messages.length) {
        setSelectedIndex(index)
      }
    },
    [messages.length],
  )

  useEffect(() => {
    return () => {
      backend.destroy?.()
    }
  }, [backend])

  // Unmount only — an empty dependency list, unlike the effect above, because a new `backend`
  // is no reason to cut a line off mid-word.
  //
  // Each in-flight line is LANDED rather than abandoned: its timer is cleared, its text is
  // written whole, and its promise resolves. The promises were left hanging here once, on the
  // argument that resolving means "the line landed" and it had not — which is true of the
  // animation and false of everything a caller does with it. React's Strict Mode runs every
  // effect mount → cleanup → mount in development, so that argument cost the intro ritual its
  // whole chain on the first render of every dev session: `await say(welcome)` never settled,
  // and bitbag sat behind a disabled composer with one empty bubble streaming forever. A
  // promise nothing can ever settle is not a truthful "it did not happen" — it is a caller
  // stuck at an await with no way to find out.
  //
  // Landing is the honest version of the same intent. Nothing is scheduled past teardown (the
  // timers are still cleared, which is what the test below pins), a real unmount's setMessages
  // is a no-op React ignores, and a caller that is still there — Strict Mode's second mount —
  // finds its line whole and carries on.
  useEffect(() => {
    const pending = pendingLinesRef.current
    return () => {
      // A copy: `land` deletes itself from this set as it runs.
      for (const land of [...pending]) land()
      pending.clear()
    }
  }, [])

  return useMemo(
    () => ({ messages, isTyping, sendMessage, say, selectedIndex, selectMessage }),
    [messages, isTyping, sendMessage, say, selectedIndex, selectMessage],
  )
}
