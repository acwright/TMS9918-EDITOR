/**
 * Per-mode metadata: screen dimensions, cell sizes, charset counts
 * (PLAN.md §1 table and §4.2).
 */

import type { G2CharsetMode, ProjectType } from './types'

/** Characters per charset. */
export const CHAR_COUNT = 256

/** Pattern bytes (pixel rows) per character. */
export const CHAR_BYTES = 8

/** Graphics I: consecutive characters sharing one color-table entry. */
export const COLOR_GROUP_SIZE = 8

/** Graphics I: number of color groups (256 / 8). */
export const COLOR_GROUP_COUNT = CHAR_COUNT / COLOR_GROUP_SIZE

export interface ModeInfo {
  type: ProjectType
  label: string
  /** Screen grid dimensions in cells. Zero when the mode has no screen. */
  columns: number
  rows: number
  /** Displayed cell size in pixels. Text Mode shows only the leftmost 6 of 8 pattern columns. */
  cellWidth: number
  cellHeight: number
  /** columns × rows. */
  cellCount: number
  /**
   * Whether the mode has a screen document at all. False for sprite projects,
   * which are an overlay layer rather than a screen (PLAN.md Decision 28).
   * Gate on this rather than testing `cellCount === 0`.
   */
  hasScreen: boolean
}

export const MODES: Record<ProjectType, ModeInfo> = {
  text: {
    type: 'text',
    label: 'Text Mode',
    columns: 40,
    rows: 24,
    cellWidth: 6,
    cellHeight: 8,
    cellCount: 40 * 24,
    hasScreen: true,
  },
  graphics1: {
    type: 'graphics1',
    label: 'Graphics Mode I',
    columns: 32,
    rows: 24,
    cellWidth: 8,
    cellHeight: 8,
    cellCount: 32 * 24,
    hasScreen: true,
  },
  graphics2: {
    type: 'graphics2',
    label: 'Graphics Mode II',
    columns: 32,
    rows: 24,
    cellWidth: 8,
    cellHeight: 8,
    cellCount: 32 * 24,
    hasScreen: true,
  },
  multicolor: {
    type: 'multicolor',
    label: 'Multicolor Mode',
    // 64×48 chunky blocks of 4×4 pixels (64·4 = 256, 48·4 = 192). Each cell is
    // a palette index, not a character code (PLAN.md §10.3).
    columns: 64,
    rows: 48,
    cellWidth: 4,
    cellHeight: 4,
    cellCount: 64 * 48,
    hasScreen: true,
  },
  sprite: {
    type: 'sprite',
    label: 'Sprite Mode',
    // Sprites overlay someone else's screen, so this mode has no screen document
    // of its own (PLAN.md Decision 28). The cell size is the pattern size; the
    // sprite's on-screen size follows settings.spriteSize/spriteMag.
    columns: 0,
    rows: 0,
    cellWidth: 8,
    cellHeight: 8,
    cellCount: 0,
    hasScreen: false,
  },
}

/**
 * Every project type, in presentation order. Derive mode lists from this rather
 * than hand-writing them — a stale copy in `repository.ts` silently hid saved
 * multicolor projects in Round 3 (PLAN.md §14.7).
 */
export const PROJECT_TYPES = Object.keys(MODES) as ProjectType[]

/** True when `value` names a project type. */
export function isProjectType(value: unknown): value is ProjectType {
  return typeof value === 'string' && PROJECT_TYPES.includes(value as ProjectType)
}

/**
 * Number of charsets a project carries: 0 for multicolor (no glyph data),
 * 3 for independent GMII, otherwise 1. A sprite project's single "charset" is
 * the 2048-byte Sprite Pattern Table (PLAN.md Decision 23).
 */
export function charsetCount(type: ProjectType, g2CharsetMode?: G2CharsetMode): number {
  if (type === 'multicolor') return 0
  return type === 'graphics2' && g2CharsetMode === 'independent' ? 3 : 1
}

/**
 * Charset a screen row renders from. Independent GMII splits the screen into
 * thirds (rows 0–7 / 8–15 / 16–23 → sets 0/1/2); everything else uses set 0.
 */
export function charsetForRow(
  type: ProjectType,
  g2CharsetMode: G2CharsetMode | undefined,
  row: number,
): number {
  return type === 'graphics2' && g2CharsetMode === 'independent' ? Math.floor(row / 8) : 0
}
