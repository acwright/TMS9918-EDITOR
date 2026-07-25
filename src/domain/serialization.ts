/**
 * Project (de)serialization — to/from the JSON schema in PLAN.md §5, with
 * structural validation of uploaded files. `deserializeProject` and
 * `validateProject` throw `ProjectValidationError` with a human-readable
 * message identifying what is wrong.
 */

import type { ColorPair, G2CharsetMode, Project, ProjectType, SpriteSize } from './types'
import { CHAR_BYTES, CHAR_COUNT, COLOR_GROUP_COUNT, MODES, charsetCount } from './modes'
import { isValidColorIndex } from './palette'
import { MAX_FPS, MIN_FPS, SPRITE_PATTERN_COUNT, spriteCount } from './sprites'

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectValidationError'
  }
}

function fail(message: string): never {
  throw new ProjectValidationError(message)
}

/** Pretty-printed JSON, suitable for download as `<name>.tms9918.json`. */
export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2)
}

/** Parse and validate a project JSON string (e.g. an uploaded file). */
export function deserializeProject(json: string): Project {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    fail('File is not valid JSON.')
  }
  return validateProject(data)
}

/** Validate an unknown value against the project schema; returns it typed. */
export function validateProject(data: unknown): Project {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    fail('Project must be a JSON object.')
  }
  const p = data as Record<string, unknown>

  if (p.version !== 1) fail(`Unsupported project version: ${JSON.stringify(p.version)}.`)
  if (typeof p.id !== 'string' || p.id.length === 0)
    fail('Project "id" must be a non-empty string.')
  if (typeof p.name !== 'string' || p.name.length === 0) {
    fail('Project "name" must be a non-empty string.')
  }
  const type = p.type
  if (
    type !== 'text' &&
    type !== 'graphics1' &&
    type !== 'graphics2' &&
    type !== 'multicolor' &&
    type !== 'sprite'
  ) {
    fail(
      `Project "type" must be "text", "graphics1", "graphics2", "multicolor", or "sprite" (got ${JSON.stringify(type)}).`,
    )
  }
  if (typeof p.createdAt !== 'string' || Number.isNaN(Date.parse(p.createdAt))) {
    fail('Project "createdAt" must be an ISO-8601 date string.')
  }
  if (typeof p.modifiedAt !== 'string' || Number.isNaN(Date.parse(p.modifiedAt))) {
    fail('Project "modifiedAt" must be an ISO-8601 date string.')
  }

  const { g2CharsetMode, spriteSize } = validateSettings(type, p.settings)
  const sets = charsetCount(type, g2CharsetMode)
  validateCharsets(p.charsets, sets)
  validateColors(type, sets, p.colors)
  validateScreens(type, p.screens)
  validateAnimations(type, spriteSize, p.animations)

  return data as Project
}

interface ValidatedSettings {
  g2CharsetMode?: G2CharsetMode
  spriteSize?: SpriteSize
}

function validateSettings(type: ProjectType, settings: unknown): ValidatedSettings {
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    fail('Project "settings" must be an object.')
  }
  const s = settings as Record<string, unknown>
  if (type === 'multicolor') {
    if (!isValidColorIndex(s.backdrop)) {
      fail('Multicolor projects require "settings.backdrop" (palette index 0–15).')
    }
    return {}
  }
  if (type === 'sprite') {
    if (!isValidColorIndex(s.backdrop)) {
      fail('Sprite projects require "settings.backdrop" (palette index 0–15).')
    }
    if (s.spriteSize !== 8 && s.spriteSize !== 16) {
      fail('Sprite projects require "settings.spriteSize" of 8 or 16.')
    }
    if (s.spriteMag !== 1 && s.spriteMag !== 2) {
      fail('Sprite projects require "settings.spriteMag" of 1 or 2.')
    }
    return { spriteSize: s.spriteSize }
  }
  if (type !== 'graphics2') return {}
  const mode = s.g2CharsetMode
  if (mode !== 'mirrored' && mode !== 'independent') {
    fail('Graphics II projects require "settings.g2CharsetMode" of "mirrored" or "independent".')
  }
  return { g2CharsetMode: mode }
}

function validateCharsets(charsets: unknown, expectedSets: number): void {
  if (!Array.isArray(charsets) || charsets.length !== expectedSets) {
    fail(`Project must have exactly ${expectedSets} charset(s).`)
  }
  charsets.forEach((charset, s) => {
    if (!Array.isArray(charset) || charset.length !== CHAR_COUNT) {
      fail(`Charset ${s} must contain ${CHAR_COUNT} characters.`)
    }
    charset.forEach((pattern, c) => {
      if (!Array.isArray(pattern) || pattern.length !== CHAR_BYTES || !pattern.every(isByte)) {
        fail(`Charset ${s}, character ${c}: pattern must be ${CHAR_BYTES} bytes (0–255).`)
      }
    })
  })
}

function isByte(value: unknown): boolean {
  return isIntInRange(value, 255)
}

function isIntInRange(value: unknown, max: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max
}

function isColorPair(value: unknown): value is ColorPair {
  return (
    typeof value === 'object' &&
    value !== null &&
    isValidColorIndex((value as ColorPair).fg) &&
    isValidColorIndex((value as ColorPair).bg)
  )
}

function validateColors(type: ProjectType, sets: number, colors: unknown): void {
  if (typeof colors !== 'object' || colors === null || Array.isArray(colors)) {
    fail('Project "colors" must be an object.')
  }
  const c = colors as Record<string, unknown>

  switch (type) {
    case 'text':
      if (!isValidColorIndex(c.fg) || !isValidColorIndex(c.bg)) {
        fail('Text Mode colors must be { fg, bg } with palette indices 0–15.')
      }
      break
    case 'graphics1':
      if (
        !Array.isArray(c.groups) ||
        c.groups.length !== COLOR_GROUP_COUNT ||
        !c.groups.every(isColorPair)
      ) {
        fail(`Graphics I colors must be { groups } with ${COLOR_GROUP_COUNT} fg/bg pairs.`)
      }
      break
    case 'multicolor':
      // No colour table — colour lives per-cell in the screen grid.
      if ('fg' in c || 'groups' in c || 'rows' in c || 'sprites' in c) {
        fail('Multicolor "colors" must be an empty object.')
      }
      break
    case 'sprite':
      if (
        !Array.isArray(c.sprites) ||
        c.sprites.length !== SPRITE_PATTERN_COUNT ||
        !c.sprites.every(isValidColorIndex)
      ) {
        fail(`Sprite colors must be { sprites } with ${SPRITE_PATTERN_COUNT} palette indices 0–15.`)
      }
      break
    case 'graphics2': {
      const rows = c.rows
      if (!Array.isArray(rows) || rows.length !== sets) {
        fail(`Graphics II colors must be { rows } with one entry per charset (${sets}).`)
      }
      rows.forEach((charsetRows, s) => {
        if (!Array.isArray(charsetRows) || charsetRows.length !== CHAR_COUNT) {
          fail(`Graphics II colors, charset ${s}: expected ${CHAR_COUNT} character entries.`)
        }
        charsetRows.forEach((charRows, ch) => {
          if (
            !Array.isArray(charRows) ||
            charRows.length !== CHAR_BYTES ||
            !charRows.every(isColorPair)
          ) {
            fail(
              `Graphics II colors, charset ${s}, character ${ch}: expected ${CHAR_BYTES} fg/bg pairs.`,
            )
          }
        })
      })
      break
    }
  }
}

function validateScreens(type: ProjectType, screens: unknown): void {
  const { cellCount, hasScreen } = MODES[type]
  // Sprites are an overlay layer, not a screen document (Decision 28).
  if (!hasScreen) {
    if (!Array.isArray(screens) || screens.length !== 0) {
      fail('Sprite projects must have an empty "screens" array.')
    }
    return
  }
  // Multicolor cells are palette indices (0–15); other modes are char codes (0–255).
  const maxCell = type === 'multicolor' ? 15 : 255
  const cellNoun = type === 'multicolor' ? 'palette indices' : 'character codes'
  if (!Array.isArray(screens) || screens.length === 0) {
    fail('Project must have at least one screen.')
  }
  screens.forEach((screen, i) => {
    if (typeof screen !== 'object' || screen === null) fail(`Screen ${i} must be an object.`)
    const s = screen as Record<string, unknown>
    if (typeof s.name !== 'string' || s.name.length === 0) {
      fail(`Screen ${i} "name" must be a non-empty string.`)
    }
    if (
      !Array.isArray(s.cells) ||
      s.cells.length !== cellCount ||
      !s.cells.every((v) => isIntInRange(v, maxCell))
    ) {
      fail(`Screen ${i} "cells" must be ${cellCount} ${cellNoun} (0–${maxCell}).`)
    }
  })
}

/**
 * Animations exist only on sprite projects (Decision 29). Frames are slot
 * indices, so their upper bound follows `settings.spriteSize`.
 */
function validateAnimations(
  type: ProjectType,
  spriteSize: SpriteSize | undefined,
  animations: unknown,
): void {
  if (type !== 'sprite') {
    if (animations !== undefined) {
      fail('Only sprite projects may carry "animations".')
    }
    return
  }
  if (!Array.isArray(animations)) {
    fail('Sprite projects require an "animations" array.')
  }
  const maxSlot = spriteCount(spriteSize ?? 8) - 1
  animations.forEach((animation, i) => {
    if (typeof animation !== 'object' || animation === null || Array.isArray(animation)) {
      fail(`Animation ${i} must be an object.`)
    }
    const a = animation as Record<string, unknown>
    if (typeof a.name !== 'string' || a.name.length === 0) {
      fail(`Animation ${i} "name" must be a non-empty string.`)
    }
    if (!Array.isArray(a.frames) || !a.frames.every((v) => isIntInRange(v, maxSlot))) {
      fail(`Animation ${i} "frames" must be sprite slot indices (0–${maxSlot}).`)
    }
    if (
      typeof a.fps !== 'number' ||
      !Number.isInteger(a.fps) ||
      a.fps < MIN_FPS ||
      a.fps > MAX_FPS
    ) {
      fail(`Animation ${i} "fps" must be an integer between ${MIN_FPS} and ${MAX_FPS}.`)
    }
  })
}
