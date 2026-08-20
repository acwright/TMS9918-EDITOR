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
  SpriteSize,
} from './types'
import { CHAR_BYTES, CHAR_COUNT, COLOR_GROUP_COUNT, MODES, charsetCount } from './modes'
import { SPRITE_PATTERN_COUNT } from './sprites'

const DEFAULT_FG = 15 // White
const DEFAULT_BG = 1 // Black
const DEFAULT_BACKDROP = 1 // Black — behind transparent multicolor blocks / sprite pixels
const DEFAULT_SPRITE_COLOR = 15 // White
const DEFAULT_FPS = 8

export interface CreateProjectOptions {
  name: string
  type: ProjectType
  /** Required for graphics2; ignored otherwise. Defaults to 'mirrored'. */
  g2CharsetMode?: G2CharsetMode
  /** Sprite projects only; ignored otherwise. Defaults to 8 (8×8 patterns). */
  spriteSize?: SpriteSize
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
    case 'sprite':
      // One solid colour per pattern slot; 16×16 sprites read the quad base.
      return { sprites: Array.from({ length: SPRITE_PATTERN_COUNT }, () => DEFAULT_SPRITE_COLOR) }
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
  if (type === 'sprite') {
    settings.backdrop = DEFAULT_BACKDROP
    settings.spriteSize = options.spriteSize ?? 8
    settings.spriteMag = 1
  }

  const project: Project = {
    version: 1,
    id: crypto.randomUUID(),
    name,
    type,
    createdAt: now,
    modifiedAt: now,
    settings,
    charsets: Array.from({ length: sets }, blankCharset),
    colors: defaultColors(type, sets),
    // Sprite projects have no screen (Decision 28). Multicolor cells are palette
    // indices (0 = transparent → backdrop); other modes fill with char code 0.
    screens:
      type === 'sprite'
        ? []
        : [{ name: 'Screen 1', cells: Array.from({ length: MODES[type].cellCount }, () => 0) }],
  }

  if (type === 'sprite') {
    project.animations = [{ name: 'Animation 1', frames: [0], fps: DEFAULT_FPS }]
  }

  return project
}
