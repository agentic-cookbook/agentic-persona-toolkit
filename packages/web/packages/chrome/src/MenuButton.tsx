"use client"
import type { ButtonHTMLAttributes, ReactElement } from 'react'

interface MenuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `menu` is three stacked bars; `close` is two of the same bars crossed.
   * They are the one figure in two states, which is why they are one
   * component: the X is derived from the bar geometry, so a change to the
   * bars has to reach it or the two stop matching.
   */
  icon?: 'menu' | 'close'
  /** The button's accessible name — it has no text of its own. */
  label: string
}

/**
 * The burger, and the close glyph it turns into.
 *
 * The bars are plain elements rather than an SVG on purpose: they animate
 * (the X is two of them rotated), they take the button's `color`, and they
 * have to land on whole device pixels, which an SVG's internal coordinate
 * system makes harder rather than easier. See css/base.css for why the
 * thickness and the pitch are both whole numbers.
 */
export function MenuButton({ icon = 'menu', label, className, ...rest }: MenuButtonProps): ReactElement {
  const cls = ['menu-button', icon === 'close' ? 'menu-button--close' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button type="button" className={cls} aria-label={label} {...rest}>
      <span className="mb-bar" />
      <span className="mb-bar" />
      {icon === 'menu' ? <span className="mb-bar" /> : null}
    </button>
  )
}
