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
  ProjectType,
} from './types'
import { CHAR_BYTES, CHAR_COUNT, COLOR_GROUP_COUNT, MODES, charsetCount } from './modes'

const DEFAULT_FG = 15 // White
const DEFAULT_BG = 1 // Black

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
  }
}

export function createProject(options: CreateProjectOptions): Project {
  const { name, type } = options
  const g2CharsetMode = type === 'graphics2' ? (options.g2CharsetMode ?? 'mirrored') : undefined
  const sets = charsetCount(type, g2CharsetMode)
  const now = new Date().toISOString()

  return {
    version: 1,
    id: crypto.randomUUID(),
    name,
    type,
    createdAt: now,
    modifiedAt: now,
    settings: g2CharsetMode ? { g2CharsetMode } : {},
    charsets: Array.from({ length: sets }, blankCharset),
    colors: defaultColors(type, sets),
    screens: [{ name: 'Screen 1', cells: Array.from({ length: MODES[type].cellCount }, () => 0) }],
  }
}
