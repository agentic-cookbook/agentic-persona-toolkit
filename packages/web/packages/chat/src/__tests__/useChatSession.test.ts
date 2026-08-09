import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChatSession } from '../hooks/useChatSession'
import type { ChatBackend } from '../backends/types'

function createMockBackend(response: string = 'mock reply'): ChatBackend {
  return {
    sendMessage: vi.fn().mockResolvedValue(response),
  }
}

describe('useChatSession', () => {
  it('initializes with welcome message', () => {
    const backend = createMockBackend()
    const { result } = renderHook(() =>
      useChatSession({
        backend,
        persona: { name: 'Bot' },
        welcomeMessage: 'Hello!',
      }),
    )

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].text).toBe('Hello!')
    expect(result.current.messages[0].isPersona).toBe(true)
  })

  it('initializes empty without welcome message', () => {
    const backend = createMockBackend()
    const { result } = renderHook(() =>
      useChatSession({ backend, persona: { name: 'Bot' } }),
    )

    expect(result.current.messages).toHaveLength(0)
  })

  it('adds user message on send', async () => {
    const backend = createMockBackend()
    const { result } = renderHook(() =>
      useChatSession({ backend, persona: { name: 'Bot' } }),
    )

    await act(async () => {
      result.current.sendMessage('hi')
    })

    // User message + bot response
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0].text).toBe('hi')
    expect(result.current.messages[0].isPersona).toBe(false)
  })

  it('adds persona response after send', async () => {
    const backend = createMockBackend('bot says hi')
    const { result } = renderHook(() =>
      useChatSession({ backend, persona: { name: 'Bot' } }),
    )

    await act(async () => {
      result.current.sendMessage('hi')
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1].text).toBe('bot says hi')
    expect(result.current.messages[1].isPersona).toBe(true)
  })

  it('handles rich response objects', async () => {
    const richResponse = {
      text: 'Check this out',
      content: [{ type: 'link' as const, url: 'https://example.com', label: 'Example' }],
      popover: { title: 'Details', description: 'More info' },
    }
    const backend: ChatBackend = {
      sendMessage: vi.fn().mockResolvedValue(richResponse),
    }

    const { result } = renderHook(() =>
      useChatSession({ backend, persona: { name: 'Bot' } }),
    )

    await act(async () => {
      result.current.sendMessage('show me')
    })

    const botMessage = result.current.messages[1]
    expect(botMessage.text).toBe('Check this out')
    expect(botMessage.content).toHaveLength(1)
    expect(botMessage.popover?.title).toBe('Details')
  })

  it('handles backend errors gracefully', async () => {
    const backend: ChatBackend = {
      sendMessage: vi.fn().mockRejectedValue(new Error('Network error')),
    }

    const { result } = renderHook(() =>
      useChatSession({ backend, persona: { name: 'Bot' } }),
    )

    await act(async () => {
      result.current.sendMessage('hi')
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1].text).toContain('something went wrong')
  })

  it('ignores empty messages', async () => {
    const backend = createMockBackend()
    const { result } = renderHook(() =>
      useChatSession({ backend, persona: { name: 'Bot' } }),
    )

    await act(async () => {
      result.current.sendMessage('')
      result.current.sendMessage('   ')
    })

    expect(result.current.messages).toHaveLength(0)
    expect(backend.sendMessage).not.toHaveBeenCalled()
  })

  it('passes history to backend', async () => {
    const sendMessage = vi.fn().mockResolvedValue('response')
    const backend: ChatBackend = { sendMessage }

    const { result } = renderHook(() =>
      useChatSession({
        backend,
        persona: { name: 'Bot' },
        welcomeMessage: 'Welcome',
      }),
    )

    await act(async () => {
      result.current.sendMessage('hi')
    })

    // Backend receives history as of the send (welcome + user message)
    const history = sendMessage.mock.calls[0][1]
    expect(history.length).toBeGreaterThanOrEqual(1)
    expect(history[0].text).toBe('Welcome')
  })

  it('selects messages', () => {
    const backend = createMockBackend()
    const { result } = renderHook(() =>
      useChatSession({
        backend,
        persona: { name: 'Bot' },
        welcomeMessage: 'Hello',
      }),
    )

    expect(result.current.selectedIndex).toBe(-1)

    act(() => {
      result.current.selectMessage(0)
    })
    expect(result.current.selectedIndex).toBe(0)
  })

  it('uses default user name', async () => {
    const backend = createMockBackend()
    const { result } = renderHook(() =>
      useChatSession({ backend, persona: { name: 'Bot' } }),
    )

    await act(async () => {
      result.current.sendMessage('hi')
    })

    expect(result.current.messages[0].sender.name).toBe('You')
  })

  it('calls destroy on unmount', () => {
    const destroy = vi.fn()
    const backend: ChatBackend = {
      sendMessage: vi.fn().mockResolvedValue('ok'),
      destroy,
    }

    const { unmount } = renderHook(() =>
      useChatSession({ backend, persona: { name: 'Bot' } }),
    )

    unmount()
    expect(destroy).toHaveBeenCalled()
  })

  // `say` types a line one character at a time, each character scheduling the next, and the
  // whole chain outlives any caller that leaves mid-line — a route change, or a test file
  // returning. Every remaining tick then calls `setMessages` on a component that is gone. In a
  // jsdom run that lands after teardown, where React reads `window` to pick an update priority
  // and finds it undefined: `ReferenceError: window is not defined`, attributed to whichever
  // test file happened to be running, having passed.
  //
  // Asserted as "unmount leaves no scheduled work" rather than by watching for the update,
  // because React 19 no longer warns about setState on an unmounted component — the write is
  // silent, and the crash it causes surfaces somewhere else entirely.
  it('cancels the typing chain on unmount', () => {
    vi.useFakeTimers()
    try {
      const backend = createMockBackend()
      const { result, unmount } = renderHook(() =>
        useChatSession({ backend, persona: { name: 'Bot' } }),
      )

      act(() => {
        void result.current.say('a line long enough to still be mid-word')
      })
      act(() => {
        vi.advanceTimersByTime(100)
      })
      // Guard the guard: a line that had already finished typing would leave nothing
      // scheduled and pass this test without exercising anything.
      expect(vi.getTimerCount()).toBeGreaterThan(0)

      unmount()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
