import { describe, expect, it } from 'vitest'
import { themes, themeIds, type ThemeKey } from '../manifest'

// These two themes existed only in the fork this package replaced in 2026-08.
// A file on disk at src/styles/*.css proves nothing on its own — a theme is
// only usable once it is registered in the manifest, because that registry
// (ThemeKey, `themes`, `themeIds`) is the only path any consumer — including
// websites/demo/app/ThemeMenu.tsx's picker — has to reach it. A CSS file the
// merge carried over but nobody registered is invisible until someone goes
// looking for it by name.
const RESCUED: ThemeKey[] = ['crt-monitor', 'handheld-communicator']

describe('themes rescued from the retired fork', () => {
  it.each(RESCUED)('%s is a member of themeIds', (id) => {
    expect(themeIds).toContain(id)
  })

  it.each(RESCUED)('%s resolves in the themes record with non-empty css', (id) => {
    const entry = themes[id]
    expect(entry).toBeDefined()
    expect(entry.id).toBe(id)
    expect(typeof entry.css).toBe('string')
    expect(entry.css.length).toBeGreaterThan(0)
  })
})
