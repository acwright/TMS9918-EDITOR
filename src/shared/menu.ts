/**
 * The native menu's action table.
 *
 * Every menu item that does something the editor already does names the
 * **shortcut action id** it dispatches rather than inventing a command of its
 * own (D10). `src/renderer/src/utils/shortcuts.ts` stays the single source of
 * truth for what an action means; this table only says where it appears in the
 * menu bar and what it is called there. `menu.spec.ts` holds the two together —
 * every action in the union appears here exactly once, and every label matches
 * the shortcut's own description.
 *
 * **No item carries an accelerator, deliberately.** A registered accelerator
 * fires the menu item *and* still delivers the keydown to the page (§3.5), so
 * an accelerated menu item would run its action twice — and would run it while
 * the user is typing in a text field, which the renderer's key handler is
 * careful not to do. Keys stay entirely the renderer's job, exactly as on the
 * web; the menu is a click surface, and Help ▸ Keyboard shortcuts is where the
 * keys are advertised. Menu items built from Electron *roles* (Copy, Reload,
 * Quit) keep their standard accelerators — the editor's map binds none of them.
 */

/**
 * Where an item sits. `pattern` is a submenu of Edit and `view` is the View
 * menu's app-specific block; the rest name their menu.
 */
export type MenuSection = 'file' | 'edit' | 'pattern' | 'view' | 'help'

export interface MenuActionItem {
  /** The `EditorAction` or `ManagerAction` this item dispatches. */
  action: string
  /** The item's label — the shortcut's description, re-worded per mode at runtime. */
  label: string
  section: MenuSection
  /** Start a new separated group at this item. */
  separatorBefore?: boolean
}

export const MENU_ACTIONS: readonly MenuActionItem[] = [
  { action: 'newProject', label: 'New project', section: 'file' },
  { action: 'save', label: 'Save now', section: 'file', separatorBefore: true },
  { action: 'back', label: 'Back to the project list', section: 'file', separatorBefore: true },

  { action: 'undo', label: 'Undo', section: 'edit' },
  { action: 'redo', label: 'Redo', section: 'edit' },

  { action: 'prevChar', label: 'Previous character', section: 'pattern' },
  { action: 'nextChar', label: 'Next character', section: 'pattern' },
  { action: 'fill', label: 'Fill the character', section: 'pattern', separatorBefore: true },
  { action: 'clear', label: 'Clear the character', section: 'pattern' },
  { action: 'invert', label: 'Invert the character', section: 'pattern' },
  { action: 'flipH', label: 'Flip horizontal', section: 'pattern', separatorBefore: true },
  { action: 'flipV', label: 'Flip vertical', section: 'pattern' },
  { action: 'rotateRight', label: 'Rotate right', section: 'pattern' },
  { action: 'rotateLeft', label: 'Rotate left', section: 'pattern' },
  {
    action: 'shiftLeft',
    label: 'Shift the pattern left',
    section: 'pattern',
    separatorBefore: true,
  },
  { action: 'shiftRight', label: 'Shift the pattern right', section: 'pattern' },
  { action: 'shiftUp', label: 'Shift the pattern up', section: 'pattern' },
  { action: 'shiftDown', label: 'Shift the pattern down', section: 'pattern' },

  { action: 'prevScreen', label: 'Previous screen', section: 'view' },
  { action: 'nextScreen', label: 'Next screen', section: 'view' },
  { action: 'zoomIn', label: 'Zoom in', section: 'view', separatorBefore: true },
  { action: 'zoomOut', label: 'Zoom out', section: 'view' },
  { action: 'toggleGrid', label: 'Grid overlay', section: 'view', separatorBefore: true },
  { action: 'playPause', label: 'Play or pause the animation', section: 'view' },

  { action: 'help', label: 'Keyboard shortcuts', section: 'help' },
]

/**
 * What the menu should offer right now, as reported by the renderer.
 *
 * The renderer owns this because the predicate for "does this action mean
 * anything here" already lives in the shortcut map, mode-aware, and restating
 * it in the main process is exactly the drift D10 exists to prevent. Main
 * receives the answer, not the question.
 */
export interface MenuContext {
  /** Action ids that are live; every other item is disabled. */
  enabled: readonly string[]
  /**
   * Labels for the open mode, keyed by action — a sprite project's pattern
   * keys edit a sprite, not a character, and say so.
   */
  labels: Readonly<Record<string, string>>
}

/** Nothing is live until the renderer says otherwise. */
export const EMPTY_MENU_CONTEXT: MenuContext = { enabled: [], labels: {} }
