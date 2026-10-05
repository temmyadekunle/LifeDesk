/**
 * Translucent version of a colour, as a CSS value for an inline style.
 *
 * The obvious `${color}14` trick only works when `color` is a hex literal.
 * These colours are CSS custom properties, and appending an alpha byte to
 * `var(--home)` yields `var(--home)14`, which is not a colour at all, so the
 * browser drops the declaration and the tint silently disappears.
 * color-mix() accepts custom properties, so it is what the inline styles use.
 *
 * Kept in its own module with no imports so that low-level presentational
 * components can use it without depending on the icon/label maps, which in
 * turn depend on the module registry.
 */
export function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

/** Faint background for an icon tile or chip: enough to read as a tint. */
export const TINT_SOFT = 8;

/** Border for a selected tile: strong enough to read as an outline. */
export const TINT_BORDER = 20;