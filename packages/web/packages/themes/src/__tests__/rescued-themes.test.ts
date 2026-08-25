import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// These two stylesheets existed only in the fork this package replaced in 2026-08.
// The merge took the other repo's version wholesale, which would have dropped them
// silently — a theme vanishing is invisible until someone's site renders unstyled.
const STYLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'styles')

describe('themes rescued from the retired fork', () => {
  it.each(['crt-monitor.css', 'handheld-communicator.css'])('still ships %s', (name) => {
    expect(existsSync(join(STYLES, name))).toBe(true)
  })
})
