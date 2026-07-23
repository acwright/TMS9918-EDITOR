/**
 * Domain types for TMS9918 project files.
 * Mirrors the JSON schema in PLAN.md §5 — keep the two in sync.
 */

export type ProjectType = 'text' | 'graphics1' | 'graphics2'

/** Graphics Mode II charset arrangement (PLAN.md Decision 1). */
export type G2CharsetMode = 'mirrored' | 'independent'

/** Palette index 0–15 (0 = transparent). */
export type ColorIndex = number

export interface ColorPair {
  fg: ColorIndex
  bg: ColorIndex
}

/** 8 pattern-row bytes (0–255); MSB = leftmost pixel. */
export type CharPattern = number[]

/** 256 characters. */
export type Charset = CharPattern[]

/** Text Mode: one global fg/bg pair. */
export interface TextColors {
  fg: ColorIndex
  bg: ColorIndex
}

/** Graphics I: one fg/bg pair per group of 8 consecutive characters (32 groups). */
export interface Graphics1Colors {
  groups: ColorPair[]
}

/**
 * Graphics II: one fg/bg pair per pixel row of each character.
 * Indexed as rows[charsetIndex][charCode][pixelRow].
 */
export interface Graphics2Colors {
  rows: ColorPair[][][]
}

export type ProjectColors = TextColors | Graphics1Colors | Graphics2Colors

export interface Screen {
  name: string
  /** Character codes (0–255), row-major; length = mode cellCount (768 or 960). */
  cells: number[]
}

export interface ProjectSettings {
  /** Present for graphics2 projects only. */
  g2CharsetMode?: G2CharsetMode
}

export interface Project {
  version: 1
  /** UUID; doubles as the localStorage key suffix. */
  id: string
  name: string
  type: ProjectType
  createdAt: string
  modifiedAt: string
  settings: ProjectSettings
  charsets: Charset[]
  colors: ProjectColors
  screens: Screen[]
}

/** Narrowing helpers for the per-mode color models. */
export function isTextColors(colors: ProjectColors): colors is TextColors {
  return 'fg' in colors
}

export function isGraphics1Colors(colors: ProjectColors): colors is Graphics1Colors {
  return 'groups' in colors
}

export function isGraphics2Colors(colors: ProjectColors): colors is Graphics2Colors {
  return 'rows' in colors
}
