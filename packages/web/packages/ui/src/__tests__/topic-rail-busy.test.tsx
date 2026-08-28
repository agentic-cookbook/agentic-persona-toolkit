/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TopicRail } from '../blocks/topic-detail'

afterEach(cleanup)

const props = {
  items: [{ id: 'a', label: 'Alpha' }],
  selectedId: null,
  onSelect: () => {},
  emptyLabel: 'Nothing here yet.',
  collapsed: false,
  onToggle: () => {},
  title: 'Topics',
}

// The visual spinner, wherever in the header it ended up. Queried by its data attribute rather
// than by role: the icon is `aria-hidden` on purpose (the live region below is what speaks), so
// there is no accessible query that could find it.
const spinner = () => document.querySelector('[data-htd-busy]')

describe('the topic list busy spinner', () => {
  it('is absent when the list is not busy', () => {
    render(<TopicRail {...props} />)
    expect(spinner()).toBeNull()
    // The region is mounted (see the last case) — what must be absent is anything for it to say.
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('appears when the list is busy', () => {
    render(<TopicRail {...props} busy />)
    expect(spinner()).not.toBeNull()
  })

  // The title must not move when the spinner appears (Mike). It hangs OFF the title's left edge,
  // absolutely positioned, exactly as the `+` hangs off its right edge.
  it('rides in flow after the title, and cannot be clipped by it', () => {
    // It used to hang out of flow off the header's left edge, because a CENTRED title moved
    // sideways the moment a spinner appeared beside it. The title is left-justified now
    // (its leading edge on the row-label column), so there is nothing left to protect: the
    // spinner is an in-flow sibling that pushes nothing, and being a sibling rather than an
    // absolutely-positioned escapee is what keeps it outside the title's `truncate` box.
    render(<TopicRail {...props} busy />)
    expect(spinner()?.className).not.toContain('absolute')
    expect(spinner()?.className).toContain('shrink-0')
  })

  // Collapsing a rail to an icon strip is a first-class gesture, and the strip has no title for
  // the spinner to hang beside — so the header falls through to a control-strip shape that has to
  // carry it anyway. Without this the read a click starts is completely invisible.
  it('still appears when the rail is collapsed to an icon strip', () => {
    render(<TopicRail {...props} collapsed busy />)
    expect(spinner()).not.toBeNull()
  })

  // A live region announces its MUTATIONS, not its arrival, so the region has to be in the DOM
  // before the read starts — mounting it together with its text says nothing to a screen reader.
  it('keeps one live region mounted whether or not the list is busy', () => {
    const { rerender } = render(<TopicRail {...props} />)
    const regions = () => document.querySelectorAll('[role="status"]')
    expect(regions()).toHaveLength(1)
    expect(regions()[0]).toHaveTextContent('')

    rerender(<TopicRail {...props} busy />)
    expect(regions()).toHaveLength(1)
    // The SAME node now has text: the announcement is a mutation of a region that was already
    // there, which is the only kind a screen reader reads out. `role="status"` takes its name from
    // the author, never from content, so the assertion has to be on what it CONTAINS.
    expect(regions()[0]).toHaveTextContent('Loading')
  })
})
