/**
 * The keyboard map, in one place.
 *
 * Three surfaces used to be able to disagree about a key: the handler that
 * acts on it, the tooltip that advertises it, and the README that documents
 * it. Here the keys are declared once, the views dispatch on the *action*
 * rather than on the key, and their handler tables are `Record<Action, …>` —
 * so adding a shortcut without wiring it up is a type error rather than a
 * quietly dead key. `shortcuts.spec.ts` holds the README to the same list.
 *
 * Key tokens are `event.key` values with optional `Shift+`, `Mod+` and `Alt+`
 * prefixes, in that order. `Mod` is Ctrl on Windows/Linux and Cmd on Apple
 * platforms — the same key under both names, as every other editor spells it.
 *
 * Matching is mode-aware, because the modes are not the same editor: a sprite
 * project has no screen, so `,` / `.` page its animations, and a multicolor
 * project has no character panel, so the pattern keys mean nothing there. A
 * key that means nothing in the open mode does not match, which is what keeps
 * `Space` out of the way of a focused button outside sprite projects.
 */

import type { ProjectType } from '@/domain/types'
import { isMac } from './platform'

/** Everything the editor view acts on. */
export type EditorAction =
  | 'undo'
  | 'redo'
  | 'save'
  | 'help'
  | 'back'
  | 'prevChar'
  | 'nextChar'
  | 'fill'
  | 'clear'
  | 'invert'
  | 'flipH'
  | 'flipV'
  | 'rotateRight'
  | 'rotateLeft'
  | 'shiftLeft'
  | 'shiftRight'
  | 'shiftUp'
  | 'shiftDown'
  | 'prevScreen'
  | 'nextScreen'
  | 'zoomIn'
  | 'zoomOut'
  | 'toggleGrid'
  | 'playPause'

/** Everything the project manager acts on. */
export type ManagerAction = 'newProject' | 'help'

/**
 * Section ids. The printed title depends on the open mode — the pattern keys
 * edit a character in most modes and a whole sprite in a sprite project — so
 * the group is an id here and a title only at display time.
 */
export type GroupId = 'project' | 'pattern' | 'screen' | 'list' | 'manager'

export interface Shortcut<A extends string = string> {
  action: A
  /** Key tokens; any one of them fires the action. */
  keys: readonly string[]
  /** Imperative description, as shown in the help dialog and the README. */
  description: string
  /** The description in a sprite project, where a few keys mean something else. */
  spriteDescription?: string
  /** `screen` — everywhere but sprite projects; `sprite` — only there. */
  only?: 'screen' | 'sprite'
  group: GroupId
}

export const EDITOR_SHORTCUTS: readonly Shortcut<EditorAction>[] = [
  { action: 'undo', keys: ['Mod+Z'], description: 'Undo', group: 'project' },
  { action: 'redo', keys: ['Shift+Mod+Z'], description: 'Redo', group: 'project' },
  { action: 'save', keys: ['Mod+S'], description: 'Save now', group: 'project' },
  { action: 'help', keys: ['?'], description: 'Keyboard shortcuts', group: 'project' },
  { action: 'back', keys: ['Escape'], description: 'Back to the project list', group: 'project' },

  {
    action: 'prevChar',
    keys: ['['],
    description: 'Previous character',
    spriteDescription: 'Previous sprite',
    group: 'pattern',
  },
  {
    action: 'nextChar',
    keys: [']'],
    description: 'Next character',
    spriteDescription: 'Next sprite',
    group: 'pattern',
  },
  {
    action: 'fill',
    keys: ['F'],
    description: 'Fill the character',
    spriteDescription: 'Fill the sprite',
    group: 'pattern',
  },
  {
    action: 'clear',
    keys: ['C'],
    description: 'Clear the character',
    spriteDescription: 'Clear the sprite',
    group: 'pattern',
  },
  {
    action: 'invert',
    keys: ['I'],
    description: 'Invert the character',
    spriteDescription: 'Invert the sprite',
    group: 'pattern',
  },
  { action: 'flipH', keys: ['H'], description: 'Flip horizontal', group: 'pattern' },
  { action: 'flipV', keys: ['V'], description: 'Flip vertical', group: 'pattern' },
  { action: 'rotateRight', keys: ['R'], description: 'Rotate right', group: 'pattern' },
  { action: 'rotateLeft', keys: ['Shift+R'], description: 'Rotate left', group: 'pattern' },
  {
    action: 'shiftLeft',
    keys: ['Alt+ArrowLeft'],
    description: 'Shift the pattern left',
    group: 'pattern',
  },
  {
    action: 'shiftRight',
    keys: ['Alt+ArrowRight'],
    description: 'Shift the pattern right',
    group: 'pattern',
  },
  {
    action: 'shiftUp',
    keys: ['Alt+ArrowUp'],
    description: 'Shift the pattern up',
    group: 'pattern',
  },
  {
    action: 'shiftDown',
    keys: ['Alt+ArrowDown'],
    description: 'Shift the pattern down',
    group: 'pattern',
  },

  {
    action: 'prevScreen',
    keys: [','],
    description: 'Previous screen',
    spriteDescription: 'Previous animation',
    group: 'screen',
  },
  {
    action: 'nextScreen',
    keys: ['.'],
    description: 'Next screen',
    spriteDescription: 'Next animation',
    group: 'screen',
  },
  { action: 'zoomIn', keys: ['+', '='], description: 'Zoom in', group: 'screen' },
  { action: 'zoomOut', keys: ['-'], description: 'Zoom out', group: 'screen' },
  {
    action: 'toggleGrid',
    keys: ['G'],
    description: 'Grid overlay',
    only: 'screen',
    group: 'screen',
  },
  {
    action: 'playPause',
    keys: ['Space'],
    description: 'Play or pause the animation',
    only: 'sprite',
    group: 'screen',
  },
]

export const MANAGER_SHORTCUTS: readonly Shortcut<ManagerAction>[] = [
  { action: 'newProject', keys: ['N'], description: 'New project', group: 'manager' },
  { action: 'help', keys: ['?'], description: 'Keyboard shortcuts', group: 'manager' },
]

/**
 * The character set list's own keys. These belong to the focused listbox
 * rather than to a window listener — arrows have to mean "move this selection"
 * only while the list holds focus — so they are documentation here, not a
 * dispatch table.
 */
export const LIST_SHORTCUTS: readonly Shortcut[] = [
  {
    action: 'listMove',
    keys: ['ArrowUp', 'ArrowDown'],
    description: 'Previous or next character',
    group: 'list',
  },
  {
    action: 'listPage',
    keys: ['PageUp', 'PageDown'],
    description: 'Jump eight characters',
    group: 'list',
  },
  {
    action: 'listEnds',
    keys: ['Home', 'End'],
    description: 'First or last character',
    group: 'list',
  },
]

/** Section order, and the title each id prints under. */
const GROUPS: readonly { id: GroupId; title: string; spriteTitle?: string }[] = [
  { id: 'project', title: 'Project' },
  { id: 'pattern', title: 'Character', spriteTitle: 'Sprite' },
  { id: 'screen', title: 'Screen', spriteTitle: 'Animation' },
  { id: 'list', title: 'Character set list' },
  { id: 'manager', title: 'Project list' },
]

export const GROUP_IDS: readonly GroupId[] = GROUPS.map((group) => group.id)

/**
 * Whether a key does anything in this mode. With no mode — the project
 * manager, which has no project open — everything is listed, since the dialog
 * there is documenting the app rather than the project in front of you.
 */
function appliesTo(shortcut: Shortcut, type: ProjectType | null): boolean {
  if (!type) return true
  if (shortcut.only === 'screen' && type === 'sprite') return false
  if (shortcut.only === 'sprite' && type !== 'sprite') return false
  // Multicolor paints palette entries straight onto the screen: no character
  // panel, and so nothing for the pattern keys or the set list to act on.
  if (shortcut.group === 'pattern' && type === 'multicolor') return false
  if (shortcut.group === 'list' && (type === 'multicolor' || type === 'sprite')) return false
  return true
}

export interface ShortcutSection {
  title: string
  shortcuts: readonly Shortcut[]
}

/** The description a shortcut carries in this mode. */
export function describeShortcut(shortcut: Shortcut, type: ProjectType | null): string {
  return type === 'sprite' && shortcut.spriteDescription
    ? shortcut.spriteDescription
    : shortcut.description
}

/** Every shortcut that means something in `type`, grouped and ordered for display. */
export function shortcutSections(type: ProjectType | null = null): ShortcutSection[] {
  const all: readonly Shortcut[] = [...EDITOR_SHORTCUTS, ...LIST_SHORTCUTS, ...MANAGER_SHORTCUTS]
  return GROUPS.map((group) => ({
    title: type === 'sprite' && group.spriteTitle ? group.spriteTitle : group.title,
    shortcuts: all.filter((entry) => entry.group === group.id && appliesTo(entry, type)),
  })).filter((section) => section.shortcuts.length > 0)
}

// --- Matching ---

const MODIFIERS = /^(Shift|Mod|Alt)\+/

interface ParsedKey {
  shift: boolean
  mod: boolean
  alt: boolean
  key: string
}

/** Split a token into its modifiers and its key. `'+'` is a key, not a joiner. */
export function parseKey(token: string): ParsedKey {
  const parsed: ParsedKey = { shift: false, mod: false, alt: false, key: token }
  for (;;) {
    const match = MODIFIERS.exec(parsed.key)
    if (!match) return parsed
    if (match[1] === 'Shift') parsed.shift = true
    else if (match[1] === 'Mod') parsed.mod = true
    else parsed.alt = true
    parsed.key = parsed.key.slice(match[0].length)
  }
}

/** True when `key` is a letter — the only keys whose Shift state we enforce. */
function isLetter(key: string): boolean {
  return key.length === 1 && /[a-z]/i.test(key)
}

function matchesEvent(token: string, event: KeyboardEvent): boolean {
  const { shift, mod, alt, key } = parseKey(token)
  if (mod !== (event.metaKey || event.ctrlKey)) return false
  if (alt !== event.altKey) return false
  const eventKey = event.key === ' ' ? 'Space' : event.key
  if (key.length === 1 && eventKey.length === 1) {
    if (key.toLowerCase() !== eventKey.toLowerCase()) return false
  } else if (key !== eventKey) {
    return false
  }
  // `?` and `+` need Shift on most layouts and already say so in `event.key`;
  // only a letter (or a named key) can distinguish `R` from `Shift+R`.
  if (isLetter(key) || key.length > 1) return shift === event.shiftKey
  return true
}

function match<A extends string>(list: readonly Shortcut<A>[], event: KeyboardEvent): A | null {
  return list.find((entry) => entry.keys.some((key) => matchesEvent(key, event)))?.action ?? null
}

/** The editor action this key press means in `type`, or null when it means nothing. */
export function matchEditorShortcut(
  event: KeyboardEvent,
  type: ProjectType | null = null,
): EditorAction | null {
  return match(
    EDITOR_SHORTCUTS.filter((entry) => appliesTo(entry, type)),
    event,
  )
}

/** The project-manager action this key press means, or null. */
export function matchManagerShortcut(event: KeyboardEvent): ManagerAction | null {
  return match(MANAGER_SHORTCUTS, event)
}

// --- Labels ---

/** Keys with a conventional printed name rather than their `event.key`. */
const KEY_GLYPHS: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
  ' ': 'Space',
}

function keyName(key: string): string {
  return KEY_GLYPHS[key] ?? (key.length === 1 ? key.toUpperCase() : key)
}

/**
 * A key token as this platform prints it: `⇧⌘Z` on Apple, `Shift+Ctrl+Z`
 * elsewhere.
 */
export function keyLabel(token: string): string {
  const { shift, mod, alt, key } = parseKey(token)
  if (isMac) {
    return `${shift ? '⇧' : ''}${mod ? '⌘' : ''}${alt ? '⌥' : ''}${keyName(key)}`
  }
  const parts: string[] = []
  if (shift) parts.push('Shift')
  if (mod) parts.push('Ctrl')
  if (alt) parts.push('Alt')
  parts.push(keyName(key))
  return parts.join('+')
}

/**
 * A key token spelled for prose that both platforms read — the form the README
 * uses, where there is no "this machine" to be specific about.
 */
export function keyText(token: string): string {
  const { shift, mod, alt, key } = parseKey(token)
  const parts: string[] = []
  if (shift) parts.push('Shift')
  if (mod) parts.push('Ctrl/Cmd')
  if (alt) parts.push('Alt')
  parts.push(keyName(key))
  return parts.join('+')
}

const BY_ACTION = new Map<string, Shortcut>(
  [...EDITOR_SHORTCUTS, ...MANAGER_SHORTCUTS, ...LIST_SHORTCUTS].map((entry) => [
    entry.action,
    entry,
  ]),
)

/**
 * The key a tooltip advertises for an action — the first of its keys, in this
 * platform's spelling. Buttons take their shortcut from here so the tooltip
 * cannot drift from the handler.
 */
export function shortcutLabel(action: EditorAction | ManagerAction): string {
  const entry = BY_ACTION.get(action)
  return entry?.keys[0] ? keyLabel(entry.keys[0]) : ''
}

/** Every key of a shortcut, in this platform's spelling, for the help dialog. */
export function keyLabels(shortcut: Shortcut): string[] {
  return shortcut.keys.map(keyLabel)
}
