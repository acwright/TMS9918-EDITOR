/**
 * Domain types for TMS9918 project files.
 * Mirrors the JSON schema in PLAN.md §5 — keep the two in sync.
 */

export type ProjectType = 'text' | 'graphics1' | 'graphics2' | 'multicolor' | 'sprite'

/** Sprite Mode pattern size (PLAN.md Decision 24) — the VDP register 1 SIZE bit. */
export type SpriteSize = 8 | 16

/** Sprite Mode magnification (PLAN.md Decision 24) — the VDP register 1 MAG bit. */
export type SpriteMag = 1 | 2

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

/**
 * Multicolor: no colour table — every 4×4 block carries its own palette index
 * directly in the screen grid (`screens[].cells`), so there is nothing to store
 * here. An empty marker keeps the `ProjectColors` union well-formed.
 */
export type MulticolorColors = Record<string, never>

/**
 * Sprite: one solid palette colour per pattern slot (PLAN.md Decision 27).
 * Always 256 entries — at 16×16 the quad-base entry (`sprites[4n]`) governs the
 * sprite and the other three are retained so a size change is lossless.
 */
export interface SpriteColors {
  sprites: ColorIndex[]
}

export type ProjectColors =
  TextColors | Graphics1Colors | Graphics2Colors | SpriteColors | MulticolorColors

export interface Screen {
  name: string
  /** Character codes (0–255), row-major; length = mode cellCount (768 or 960). */
  cells: number[]
}

/**
 * Sprite Mode: an ordered list of sprite slots played back as a preview
 * (PLAN.md Decision 29). Frames are *slot* indices, not pattern numbers.
 */
export interface SpriteAnimation {
  name: string
  /** Sprite slot indices (0–255 at 8×8, 0–63 at 16×16). May repeat; may be empty. */
  frames: number[]
  /** Playback rate in frames per second, 1–30. */
  fps: number
}

export interface ProjectSettings {
  /** Present for graphics2 projects only. */
  g2CharsetMode?: G2CharsetMode
  /**
   * Multicolor and sprite only: palette index (0–15) shown behind transparent
   * blocks/pixels (VDP register 7).
   */
  backdrop?: ColorIndex
  /** Sprite only: 8×8 or 16×16 patterns (VDP register 1 SIZE bit). */
  spriteSize?: SpriteSize
  /** Sprite only: 1× or 2× magnification (VDP register 1 MAG bit). */
  spriteMag?: SpriteMag
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
  /** Empty for sprite projects — sprites are an overlay, not a screen (Decision 28). */
  screens: Screen[]
  /** Sprite projects only; absent for every other type (Decision 29). */
  animations?: SpriteAnimation[]
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

export function isSpriteColors(colors: ProjectColors): colors is SpriteColors {
  return 'sprites' in colors
}

/**
 * Multicolor is the *empty* colour model, so it narrows on the absence of every
 * other model's discriminant — `sprites` included (Decision 27).
 */
export function isMulticolorColors(colors: ProjectColors): colors is MulticolorColors {
  return !('fg' in colors) && !('groups' in colors) && !('rows' in colors) && !('sprites' in colors)
}
