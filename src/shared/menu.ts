/**
 * The native menu's action table.
 *
 * Every menu item that does something the editor already does names the
 * **shortcut action id** it dispatches rather than inventing a command of its
 * own (D10). `src/renderer/src/utils/shortcuts.ts` stays the single source of
 * truth for what an action means; this table only says where it appears in the
 * menu bar and what it is called there. `menu.spec.ts` holds the two together —
 * every action in the union appears here exactly once, and nothing here is an
 * action the map does not declare.
 *
 * A handful of items are worded differently in the two shells, for the same
 * reason the shortcut map words their descriptions differently: on the desktop
 * `back` closes a document rather than returning to a list that does not exist
 * there (D14). The renderer picks, because it is the side that knows which
 * shell it is; main is sent the answer.
 *
 * Labels are **menu titles, not the shortcut descriptions**: Title Case, and as
 * short as the surrounding menu allows, per the macOS HIG. "Save now" reads
 * correctly in the help sheet and wrongly in a File menu, so the two are worded
 * separately and `menu.spec.ts` checks the capitalisation.
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
  /** The item's title, in Title Case. */
  label: string
  /**
   * The title in a sprite project, for the handful of items that page through
   * something else there. Only an action whose shortcut carries a
   * `spriteDescription` may have one — most items are short enough here to
   * read correctly in every mode.
   */
  spriteLabel?: string
  /**
   * The title in the desktop shell, for an item that acts on a *document*
   * rather than on a list (D14). Only an action whose shortcut carries a
   * `desktopDescription` may have one, and it wins over `spriteLabel` — the
   * same precedence the shortcut map uses.
   */
  desktopLabel?: string
  section: MenuSection
  /** Start a new separated group at this item. */
  separatorBefore?: boolean
}

export const MENU_ACTIONS: readonly MenuActionItem[] = [
  // The ellipsis is the HIG's promise that the command asks for something
  // before it does anything.
  { action: 'newProject', label: 'New Project…', section: 'file' },
  { action: 'save', label: 'Save', section: 'file', separatorBefore: true },
  {
    action: 'back',
    label: 'Back to Projects',
    // The desktop has no project list to go back to; it has a document to
    // close, and the start screen behind it (§4, D14).
    desktopLabel: 'Close Document',
    section: 'file',
    separatorBefore: true,
  },

  { action: 'undo', label: 'Undo', section: 'edit' },
  { action: 'redo', label: 'Redo', section: 'edit' },

  {
    action: 'prevChar',
    label: 'Previous Character',
    spriteLabel: 'Previous Sprite',
    section: 'pattern',
  },
  { action: 'nextChar', label: 'Next Character', spriteLabel: 'Next Sprite', section: 'pattern' },
  { action: 'fill', label: 'Fill', section: 'pattern', separatorBefore: true },
  { action: 'clear', label: 'Clear', section: 'pattern' },
  { action: 'invert', label: 'Invert', section: 'pattern' },
  { action: 'flipH', label: 'Flip Horizontal', section: 'pattern', separatorBefore: true },
  { action: 'flipV', label: 'Flip Vertical', section: 'pattern' },
  { action: 'rotateRight', label: 'Rotate Right', section: 'pattern' },
  { action: 'rotateLeft', label: 'Rotate Left', section: 'pattern' },
  { action: 'shiftLeft', label: 'Shift Left', section: 'pattern', separatorBefore: true },
  { action: 'shiftRight', label: 'Shift Right', section: 'pattern' },
  { action: 'shiftUp', label: 'Shift Up', section: 'pattern' },
  { action: 'shiftDown', label: 'Shift Down', section: 'pattern' },

  {
    action: 'prevScreen',
    label: 'Previous Screen',
    spriteLabel: 'Previous Animation',
    section: 'view',
  },
  { action: 'nextScreen', label: 'Next Screen', spriteLabel: 'Next Animation', section: 'view' },
  { action: 'zoomIn', label: 'Zoom In', section: 'view', separatorBefore: true },
  { action: 'zoomOut', label: 'Zoom Out', section: 'view' },
  { action: 'toggleGrid', label: 'Grid Overlay', section: 'view', separatorBefore: true },
  { action: 'playPause', label: 'Play/Pause', section: 'view' },

  { action: 'help', label: 'Keyboard Shortcuts', section: 'help' },
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
