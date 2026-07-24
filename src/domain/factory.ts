/**
 * Project factory — builds a blank, valid project for each mode with
 * sensible defaults: empty charset(s), white-on-black colors, one empty screen.
 */

import type {
  Charset,
  ColorPair,
  G2CharsetMode,
  Project,
  ProjectColors,
  ProjectSettings,
  ProjectType,
} from './types'
import { CHAR_BYTES, CHAR_COUNT, COLOR_GROUP_COUNT, MODES, charsetCount } from './modes'

const DEFAULT_FG = 15 // White
const DEFAULT_BG = 1 // Black
const DEFAULT_BACKDROP = 1 // Black — shown behind transparent multicolor blocks

export interface CreateProjectOptions {
  name: string
  type: ProjectType
  /** Required for graphics2; ignored otherwise. Defaults to 'mirrored'. */
  g2CharsetMode?: G2CharsetMode
}

export function blankPattern(): number[] {
  return Array.from({ length: CHAR_BYTES }, () => 0)
}

export function blankCharset(): Charset {
  return Array.from({ length: CHAR_COUNT }, blankPattern)
}

function defaultPair(): ColorPair {
  return { fg: DEFAULT_FG, bg: DEFAULT_BG }
}

function defaultColors(type: ProjectType, charsets: number): ProjectColors {
  switch (type) {
    case 'text':
      return { fg: DEFAULT_FG, bg: DEFAULT_BG }
    case 'graphics1':
      return { groups: Array.from({ length: COLOR_GROUP_COUNT }, defaultPair) }
    case 'graphics2':
      return {
        rows: Array.from({ length: charsets }, () =>
          Array.from({ length: CHAR_COUNT }, () => Array.from({ length: CHAR_BYTES }, defaultPair)),
        ),
      }
    case 'multicolor':
      // No colour table — every 4×4 block's colour lives in the screen grid.
      return {}
  }
}

export function createProject(options: CreateProjectOptions): Project {
  const { name, type } = options
  const g2CharsetMode = type === 'graphics2' ? (options.g2CharsetMode ?? 'mirrored') : undefined
  const sets = charsetCount(type, g2CharsetMode)
  const now = new Date().toISOString()

  const settings: ProjectSettings = {}
  if (g2CharsetMode) settings.g2CharsetMode = g2CharsetMode
  if (type === 'multicolor') settings.backdrop = DEFAULT_BACKDROP

  return {
    version: 1,
    id: crypto.randomUUID(),
    name,
    type,
    createdAt: now,
    modifiedAt: now,
    settings,
    charsets: Array.from({ length: sets }, blankCharset),
    colors: defaultColors(type, sets),
    // Multicolor cells are palette indices (0 = transparent → backdrop); other
    // modes fill with character code 0.
    screens: [{ name: 'Screen 1', cells: Array.from({ length: MODES[type].cellCount }, () => 0) }],
  }
}
