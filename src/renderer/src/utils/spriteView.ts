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
  label: string
  /** Tooltip: what this layout does, and when it is the right one. */
  hint: string
}

export const SPRITE_VIEWS: readonly SpriteViewInfo[] = [
  {
    view: 'sheet',
    label: 'Sheet',
    hint: 'Sheet — every slot at once, scaled to fit the space. Best with height to spare.',
  },
  {
    view: 'grid',
    label: 'Grid',
    hint: 'Grid — fixed-size slots, as many a row as fit, scrolling. Best for picking one out.',
  },
  {
    view: 'list',
    label: 'List',
    hint: 'List — one slot a row with its number, colour and patterns. Best for finding a sprite by number.',
  },
]

export const DEFAULT_SPRITE_VIEW: SpriteView = 'sheet'

export function isSpriteView(value: unknown): value is SpriteView {
  return SPRITE_VIEWS.some((entry) => entry.view === value)
}
