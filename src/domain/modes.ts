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
  /** Screen grid dimensions in cells. */
  columns: number
  rows: number
  /** Displayed cell size in pixels. Text Mode shows only the leftmost 6 of 8 pattern columns. */
  cellWidth: number
  cellHeight: number
  /** columns × rows. */
  cellCount: number
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
  },
  graphics1: {
    type: 'graphics1',
    label: 'Graphics Mode I',
    columns: 32,
    rows: 24,
    cellWidth: 8,
    cellHeight: 8,
    cellCount: 32 * 24,
  },
  graphics2: {
    type: 'graphics2',
    label: 'Graphics Mode II',
    columns: 32,
    rows: 24,
    cellWidth: 8,
    cellHeight: 8,
    cellCount: 32 * 24,
  },
}

/** Number of charsets a project carries: 3 for independent GMII, otherwise 1. */
export function charsetCount(type: ProjectType, g2CharsetMode?: G2CharsetMode): number {
  return type === 'graphics2' && g2CharsetMode === 'independent' ? 3 : 1
}
