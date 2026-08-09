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
  // Every timer `say` has in flight. A line types at one character per ~40ms and the promise
  // resolves on the last one, so a caller that unmounts mid-line — a route change, a test
  // returning — leaves the rest of the chain scheduled against a component that is gone.
  const typingTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

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
      return new Promise<void>((resolve) => {
        let i = 0
        // Scheduling goes through here so the pending timer is always in the set the unmount
        // cleanup drains, including the one queued from inside `step` itself.
        const schedule = (delay: number) => {
          const timer = setTimeout(() => {
            typingTimersRef.current.delete(timer)
            step()
          }, delay)
          typingTimersRef.current.add(timer)
        }
        const step = () => {
          i += 1
          const slice = text.slice(0, i)
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: slice } : m)))
          if (i >= text.length) {
            setMessages((prev) =>
              prev.map((m) => (m.id === id ? { ...m, isStreaming: false } : m)),
            )
            resolve()
            return
          }
          schedule(26 + Math.random() * 28)
        }
        schedule(0)
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
  // is no reason to cut a line off mid-word. The in-flight `say` promises are left unresolved
  // on purpose: they mean "the line landed", and it did not. Nothing is awaiting them once the
  // component is gone, and resolving would be a lie a scripted intro would act on.
  useEffect(() => {
    const timers = typingTimersRef.current
    return () => {
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  return useMemo(
    () => ({ messages, isTyping, sendMessage, say, selectedIndex, selectMessage }),
    [messages, isTyping, sendMessage, say, selectedIndex, selectMessage],
  )
}
