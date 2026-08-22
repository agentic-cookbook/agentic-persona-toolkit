/**
 * Strip CSS comments, because THIS output is the copy that ships.
 *
 * These stylesheets are heavily commented on purpose — the reasoning for a
 * number is worth more than the number — but that reasoning is for whoever
 * opens `src/styles`, and the generated module is not that file. `ThemeStyle`
 * inlines the string it finds there into a <style> in the SSR HTML of every
 * page that mounts a scoped theme, so every comment is re-sent to the browser
 * on every navigation, uncacheable, to be parsed and discarded. `crt-monitor`
 * is 75% comments; unstripped it was sending 43KB of prose per page view.
 *
 * TWO THINGS THIS MUST NOT BREAK, and both fail silently.
 *
 * LINE STRUCTURE, because `ThemeStyle` rewrites `:root`, `body` and `@import`
 * with line-anchored regexes: a selector that ends up sharing a line with
 * something else is never rewritten, and the rule then aims at the host page's
 * real <body> instead of at the theme's own root. Nothing throws — the page is
 * just repainted by a theme that was supposed to be scoped to one widget. So a
 * comment is replaced by the newlines it contained rather than by nothing, and
 * the blank lines that leaves are dropped whole, which never joins two lines.
 *
 * And NESTING, which is why this is a scanner and not a regex. The obvious
 * regex — string-or-comment, alternating, strings first so a `/*` inside
 * `content: "..."` is safe — is wrong in the direction that actually happens:
 * the apostrophes in this very sentence would open a "string" that runs to the
 * next apostrophe and swallows a comment terminator along the way, leaving the
 * comment after it in the output. Prose has apostrophes in it constantly;
 * stylesheets have comment openers inside string literals essentially never.
 * A scanner needs no bet either way — it recognises a string only outside a
 * comment and a comment only outside a string.
 */
export function stripComments(css) {
  const out = []
  let i = 0
  while (i < css.length) {
    const c = css[i]

    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < css.length) {
        if (css[j] === '\\') {
          j += 2
          continue
        }
        // A CSS string cannot span a raw newline; stopping here keeps an
        // unbalanced quote from swallowing the rest of the file.
        if (css[j] === '\n') break
        if (css[j] === c) {
          j++
          break
        }
        j++
      }
      out.push(css.slice(i, j))
      i = j
      continue
    }

    if (c === '/' && css[i + 1] === '*') {
      const close = css.indexOf('*/', i + 2)
      const stop = close === -1 ? css.length : close + 2
      const newlines = css.slice(i, stop).split('\n').length - 1
      out.push('\n'.repeat(newlines))
      i = stop
      continue
    }

    out.push(c)
    i++
  }

  return out
    .join('')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .join('\n')
    .concat('\n')
}
