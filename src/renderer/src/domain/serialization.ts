/**
 * Project (de)serialization — to/from the JSON schema in PLAN.md §5, with
 * structural validation of uploaded files. `deserializeProject` and
 * `validateProject` throw `ProjectValidationError` with a human-readable
 * message identifying what is wrong.
 *
 * `serializeProject` is the *only* serialization (Document Storage plan, D4):
 * downloads and, from F3, disk writes both go through it. It is git-first, not
 * merely pretty — the rules below buy a diff that names the characters and
 * screen rows that changed instead of one 34,000-line blob:
 *
 * - keys in a fixed order, so a project built by `createProject` and one parsed
 *   back from a file serialize identically;
 * - one character per line — a pattern's 8 bytes stay together, so a charset is
 *   256 lines;
 * - one screen row per line — `cells` wrapped at the mode's column count, so a
 *   row of the file is a row of the screen;
 * - 2-space indent, LF, trailing newline (both repos are `* text=auto eol=lf`).
 *
 * Formatting is never semantic: `deserialize(serialize(p))` deep-equals `p`,
 * and reserializing a file this wrote reproduces it byte for byte.
 *
 * The share link is deliberately *not* on this path — it compresses compact
 * JSON, where none of this would help (`share.ts`).
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

/**
 * How each node of the document is laid out. `'block'` puts one entry on its
 * own line; a number wraps a flat array at that many entries per line; the
 * default, `'inline'`, keeps the whole node on the line it starts on.
 */
type Layout = 'block' | 'inline' | number

/**
 * Object key order, by node path (`''` is the document itself, `[]` stands for
 * any array index). Keys not listed follow the listed ones, sorted — a
 * hand-added key survives a round-trip rather than being dropped.
 */
const KEY_ORDER: Record<string, string[]> = {
  '': [
    'version',
    'id',
    'name',
    'type',
    'createdAt',
    'modifiedAt',
    'settings',
    'charsets',
    'colors',
    'screens',
    'animations',
  ],
  settings: ['g2CharsetMode', 'backdrop', 'spriteSize', 'spriteMag'],
  colors: ['fg', 'bg', 'groups', 'rows', 'sprites'],
  'colors.groups[]': ['fg', 'bg'],
  'colors.rows[][][]': ['fg', 'bg'],
  'screens[]': ['name', 'cells'],
  'animations[]': ['name', 'frames', 'fps'],
}

/**
 * Layout by node path. What is *absent* matters as much as what is here:
 * `charsets[][]` (a character's 8 pattern bytes) and `colors.rows[][]` (a
 * character's 8 fg/bg pairs) fall through to `'inline'`, which is what puts one
 * character on one line.
 */
const LAYOUT: Record<string, Layout> = {
  '': 'block',
  settings: 'block',
  charsets: 'block',
  'charsets[]': 'block',
  colors: 'block',
  'colors.groups': 'block',
  'colors.rows': 'block',
  'colors.rows[]': 'block',
  'colors.sprites': 16,
  screens: 'block',
  'screens[]': 'block',
  animations: 'block',
  'animations[]': 'block',
}

const INDENT = '  '

function childPath(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`
}

/** Listed keys first in their listed order, then anything else, sorted. */
function orderedEntries(object: Record<string, unknown>, path: string): [string, unknown][] {
  const keys = Object.keys(object).filter((key) => object[key] !== undefined)
  const order = KEY_ORDER[path]
  const ordered = order
    ? [
        ...order.filter((key) => keys.includes(key)),
        ...keys.filter((key) => !order.includes(key)).sort(),
      ]
    : keys.sort()
  return ordered.map((key) => [key, object[key]])
}

/**
 * Renders one node. The first line carries no indent — the caller has already
 * placed it — and every line after it is indented from `depth`.
 */
function render(
  value: unknown,
  path: string,
  depth: number,
  layouts: Record<string, Layout>,
): string {
  const layout = layouts[path] ?? 'inline'
  const pad = INDENT.repeat(depth + 1)
  const close = INDENT.repeat(depth)

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const item = (entry: unknown, itemDepth: number): string =>
      render(entry, `${path}[]`, itemDepth, layouts)
    if (layout === 'inline') return `[${value.map((entry) => item(entry, depth)).join(', ')}]`
    if (typeof layout === 'number') {
      const rows: string[] = []
      for (let i = 0; i < value.length; i += layout) {
        rows.push(
          pad +
            value
              .slice(i, i + layout)
              .map((entry) => item(entry, depth + 1))
              .join(', '),
        )
      }
      return `[\n${rows.join(',\n')}\n${close}]`
    }
    return `[\n${value.map((entry) => pad + item(entry, depth + 1)).join(',\n')}\n${close}]`
  }

  if (typeof value === 'object' && value !== null) {
    const entries = orderedEntries(value as Record<string, unknown>, path)
    if (entries.length === 0) return '{}'
    const property = (key: string, entry: unknown, entryDepth: number): string =>
      `${JSON.stringify(key)}: ${render(entry, childPath(path, key), entryDepth, layouts)}`
    if (layout !== 'block') {
      return `{ ${entries.map(([key, entry]) => property(key, entry, depth)).join(', ')} }`
    }
    const lines = entries.map(([key, entry]) => pad + property(key, entry, depth + 1))
    return `{\n${lines.join(',\n')}\n${close}}`
  }

  return JSON.stringify(value)
}

/**
 * Git-first project text (D4), and the only serialization: what *Download*
 * writes today and what the desktop app writes to disk from F3. Byte-identical
 * for equal projects, whatever order their keys were built in.
 */
export function serializeProject(project: Project): string {
  // One screen row per line: sprite projects have no screen, so the fallback is
  // never reached through `screens` — it only keeps the width positive.
  const columns = MODES[project.type]?.columns || CHAR_BYTES
  const layouts: Record<string, Layout> = { ...LAYOUT, 'screens[].cells': columns }
  return `${render(project, '', 0, layouts)}\n`
}

/**
 * Content identity for D5's "a write that would not change the file does not
 * happen". `modifiedAt` is excluded — it is a consequence of a change, never
 * one — so a project that autosave revisits without an edit hashes the same and
 * is not written. This is change detection, not integrity: two 32-bit FNV-1a
 * passes under different offset bases, printed as 16 hex digits.
 */
export function projectContentHash(project: Project): string {
  const text = serializeProject({ ...project, modifiedAt: '' })
  return fnv1a(text, 0x811c9dc5) + fnv1a(text, 0x9dc5811c)
}

function fnv1a(text: string, basis: number): string {
  let hash = basis
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
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
