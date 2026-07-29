import { themes, type ThemeKey } from './manifest'

const GLOBAL_ID = 'agentic-toolkit-theme'
const SCOPED_ID = 'agentic-toolkit-theme-scoped'

/** One id per scope, not one id for all scoped blocks. A page can carry several
 *  scoped themes at once (a chat theming itself, plus a host app theming the
 *  wrapper it sits in), and a shared id makes those duplicates — invalid HTML, and
 *  `getElementById` silently resolves to whichever happens to come first. */
const scopedId = (scope: string): string =>
  `${SCOPED_ID}-${scope.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/(^-+|-+$)/g, '').toLowerCase()}`

const IMPORT_RE = /^@import\s+url\([^)]+\);\s*$/gm
const ROOT_DARK_RE = /(^|,\s*):root\.dark\b/gm
const ROOT_NOT_DARK_RE = /(^|,\s*):root:not\(\.dark\)/gm
const ROOT_RE = /(^|,\s*):root(?=[\s,{:])/gm
const BODY_RE = /(^|,\s*)body(?=[\s,{:.])/gm

/** A scoped selector that never matches — used to drop the unwanted variant. */
const NEVER = ':scope.pc-colormode-off'

export type ThemeColorMode = 'system' | 'light' | 'dark'

function buildScopedCss(
  css: string,
  scope: string,
  colorMode: ThemeColorMode,
): string {
  const imports = (css.match(IMPORT_RE) || []).join('\n')
  // `system` (default) follows the document's `html.dark` class. When forced,
  // resolve the chosen variant's `:root` selectors to `:scope` (always apply)
  // and the other variant's to a never-matching selector (drop it), so the
  // theme renders in that mode regardless of `html.dark`.
  const darkSel =
    colorMode === 'dark' ? ':scope'
      : colorMode === 'light' ? NEVER
        : 'html.dark :scope'
  const lightSel =
    colorMode === 'light' ? ':scope'
      : colorMode === 'dark' ? NEVER
        : 'html:not(.dark) :scope'
  const body = css
    .replace(IMPORT_RE, '')
    .replace(ROOT_DARK_RE, `$1${darkSel}`)
    .replace(ROOT_NOT_DARK_RE, `$1${lightSel}`)
    .replace(ROOT_RE, '$1:scope')
    .replace(BODY_RE, '$1:scope')
  return `${imports}\n@scope (${scope}) {\n${body}\n}`
}

export interface ThemeStyleProps {
  theme: ThemeKey
  scope?: string
  /**
   * Force the theme's color variant regardless of the document's `html.dark`
   * class. `system` (default) follows `html.dark` — the prior behavior. Only
   * affects scoped usage (when `scope` is set).
   */
  colorMode?: ThemeColorMode
}

export function ThemeStyle({ theme, scope, colorMode = 'system' }: ThemeStyleProps) {
  const css = scope
    ? buildScopedCss(themes[theme].css, scope, colorMode)
    : themes[theme].css
  const id = scope ? scopedId(scope) : GLOBAL_ID
  // Render the <style> inline (so it's in the SSR HTML and applied on the very
  // first paint — no flash of default-sized, unstyled chat before a client
  // effect runs). The content is the resolved theme CSS, so re-rendering on a
  // theme/CSS change (incl. HMR) swaps it live. dangerouslySetInnerHTML is the
  // standard way to emit a <style> body without React escaping CSS punctuation
  // (e.g. `>`); the source is our own static theme manifest, not user input.
  return <style id={id} dangerouslySetInnerHTML={{ __html: css }} />
}
