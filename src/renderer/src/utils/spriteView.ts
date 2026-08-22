/**
 * How the sprite picker arranges its slots.
 *
 * The sheet is a *picture* of the set: it answers "which one looks like the
 * ship" and nothing else. It cannot say what is in slot `$2A`, which slots are
 * still free to draw in, or why a slot that clearly has pixels shows up blank
 * on screen — and at 8×8, where the sheet is 16 slots across, each one is about
 * 25 px in a 440 px column. So the layout is a choice, remembered per browser
 * rather than per project: it is a property of the window you are working in,
 * not of the file (PLAN.md §16, Decision 35).
 *
 * Named here rather than in the picker so `persistence/preferences.ts` can
 * validate a stored value without importing a component. Its own preference and
 * its own guard, separate from the character set's — `blocks` is not a sprite
 * view, and a project is only ever one panel or the other (Decision 37).
 */

export type SpriteView = 'sheet' | 'grid' | 'list'

export interface SpriteViewInfo {
  view: SpriteView
  /**
   * The layout's button: its tooltip and its accessible name. Names the view
   * the way the rest of the app's tooltips name their action — when each is
   * the right one is the file comment above, not something to read on hover.
   */
  label: string
}

export const SPRITE_VIEWS: readonly SpriteViewInfo[] = [
  { view: 'sheet', label: 'Sheet View' },
  { view: 'grid', label: 'Grid View' },
  { view: 'list', label: 'List View' },
]

export const DEFAULT_SPRITE_VIEW: SpriteView = 'sheet'

/** Below this the sheet has no height to scale into. Tailwind's `sm`. */
const NARROW_VIEWPORT_PX = 640

/**
 * Where a browser with no stored choice starts. The sheet scales every slot to
 * the space it is given, and on a phone that is a sliver — the scrolling grid is
 * the readable one there. Only ever a starting point: an explicit choice is
 * stored and always wins. Mirrors `defaultCharsetView`, separately, because the
 * two pickers keep separate preferences (Decision 37).
 */
export function defaultSpriteView(): SpriteView {
  if (typeof window === 'undefined') return DEFAULT_SPRITE_VIEW
  return window.innerWidth < NARROW_VIEWPORT_PX ? 'grid' : DEFAULT_SPRITE_VIEW
}

export function isSpriteView(value: unknown): value is SpriteView {
  return SPRITE_VIEWS.some((entry) => entry.view === value)
}
