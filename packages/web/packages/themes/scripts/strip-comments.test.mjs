import { describe, expect, it } from 'vitest'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments } from './strip-comments.mjs'

const STYLES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles')

/* The failure this guards is SILENT. `ThemeStyle` rewrites a theme's `:root`,
 * `body` and `@import` with line-anchored regexes before wrapping it in
 * `@scope`; a selector that ends up sharing a line with anything else is simply
 * never rewritten, and the rule then applies to the host page's real <body>
 * instead of to the theme's own root. Nothing throws, nothing logs — the page
 * just gets repainted by a theme that was supposed to be scoped to one widget.
 * So every case below is about line structure surviving the strip. */
describe('stripComments', () => {
  it('removes block comments', () => {
    expect(stripComments('a { /* why */ color: red; }\n')).toBe('a {  color: red; }\n')
  })

  it('keeps the line break a multi-line comment carried', () => {
    const out = stripComments('a { color: red; } /* one\ntwo */ :root {\n  --x: 1;\n}\n')
    expect(out.split('\n')).toEqual(['a { color: red; } ', ' :root {', '  --x: 1;', '}', ''])
  })

  it('keeps a selector line-anchored when the comment ends on the line above it', () => {
    const out = stripComments('/* one\n   two */\n:root {\n  --x: 1;\n}\n')
    expect(out).toBe(':root {\n  --x: 1;\n}\n')
    expect(/^:root/m.test(out)).toBe(true)
  })

  it('does not treat a comment opener inside a string as a comment', () => {
    const css = 'a::before { content: "/* not a comment */"; }\n'
    expect(stripComments(css)).toBe(css)
  })

  it('does not treat a comment opener inside a single-quoted url as a comment', () => {
    const css = "@import url('https://x.test/a/*b');\n:root { --y: 2; }\n"
    expect(stripComments(css)).toBe(css)
  })

  it('drops the blank lines a stripped comment leaves behind', () => {
    expect(stripComments('a { color: red; }\n\n/* gone */\n\nb { color: blue; }\n')).toBe(
      'a { color: red; }\nb { color: blue; }\n',
    )
  })

  /* The bug a string-first regex has and a scanner does not: prose is full of
   * apostrophes, and one of them opening a "string" runs past the comment's
   * own terminator and leaves the NEXT comment in the output. */
  it('does not let an apostrophe inside a comment swallow its terminator', () => {
    const out = stripComments("/* the tube's glass */\n/* second */\na { color: red; }\n")
    expect(out).toBe('a { color: red; }\n')
  })

  it('is idempotent', () => {
    const once = stripComments('/* x */\na {\n  color: red; /* y */\n}\n')
    expect(stripComments(once)).toBe(once)
  })
})

/* The unit cases above are the mechanism; this is the actual contract, checked
 * against every stylesheet that ships rather than against a fixture. */
const files = (await readdir(STYLES_DIR)).filter((f) => f.endsWith('.css')).sort()

describe('every theme survives the strip', () => {
  it('has themes to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s', async (file) => {
    const src = await readFile(join(STYLES_DIR, file), 'utf8')
    const out = stripComments(src)

    expect(out.includes('/' + '*')).toBe(false)

    /* An orphaned terminator is the failure this catches, and it is the one
     * that actually shipped: an edit inside a long comment left a stray `*` +
     * `/` mid-prose, so the comment closed early and the remaining sentences
     * became a selector that swallowed the `{` of the next rule. Valid CSS,
     * silently one rule short — the transcript kept the palette's padding and
     * the theme's looked like a cascade problem for an afternoon. */
    expect(out.includes('*' + '/')).toBe(false)

    // Every top-level hook ThemeStyle rewrites is still at the start of a line.
    for (const re of [/^@import/gm, /^:root(?=[\s,{:])/gm, /^body(?=[\s,{:.])/gm]) {
      const before = (src.match(re) || []).length
      const after = (out.match(re) || []).length
      expect(after).toBe(before)
    }

    // Braces balance — the crude check that catches a strip which ate real CSS.
    // Only the OUTPUT is checked: comments quote CSS at each other, so a source
    // file is routinely unbalanced until the comments come out of it.
    const braces = (s) => [...s].reduce((n, c) => n + (c === '{') - (c === '}'), 0)
    expect(braces(out)).toBe(0)
  })
})
