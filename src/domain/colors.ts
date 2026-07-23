/**
 * Color resolution — maps a character to the fg/bg pair of each of its 8
 * pixel rows, per the active mode's color model (PLAN.md §1 table):
 * Text = one global pair; Graphics I = pair per 8-character group;
 * Graphics II = pair per pixel row per character (per charset).
 */

import type { ColorPair, Project } from './types'
import { isGraphics1Colors, isTextColors } from './types'
import { CHAR_BYTES, COLOR_GROUP_SIZE } from './modes'
import { PALETTE } from './palette'

const FALLBACK: ColorPair = { fg: 15, bg: 1 }

/** sRGB hex for a palette index; null for transparent (index 0). */
export function colorHex(index: number): string | null {
  return PALETTE[index]?.hex ?? null
}

function uniform(pair: ColorPair): ColorPair[] {
  return Array.from({ length: CHAR_BYTES }, () => ({ ...pair }))
}

/** fg/bg pair for each pixel row of a character (always 8 entries). */
export function resolveRowColors(
  project: Project,
  charsetIndex: number,
  charCode: number,
): ColorPair[] {
  const { colors } = project
  if (isTextColors(colors)) {
    return uniform({ fg: colors.fg, bg: colors.bg })
  }
  if (isGraphics1Colors(colors)) {
    return uniform(colors.groups[Math.floor(charCode / COLOR_GROUP_SIZE)] ?? FALLBACK)
  }
  const rows = colors.rows[charsetIndex]?.[charCode]
  return rows && rows.length === CHAR_BYTES ? rows.map((pair) => ({ ...pair })) : uniform(FALLBACK)
}
