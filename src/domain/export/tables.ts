/**
 * Export table extraction — turns a project's charsets, colors, and screens
 * into flat byte arrays and named segments that the format renderers
 * (assembly / BASIC / binary) consume. See PLAN.md §9.3 for the table layout.
 *
 * Color bytes pack as `(fg << 4) | bg`, matching the TMS9918 colour table.
 */

import type { Project } from '../types'
import { isGraphics1Colors, isTextColors } from '../types'
import { CHAR_BYTES, MODES, charsetCount } from '../modes'

/** A labelled run of bytes — one table (or one table per charset/screen). */
export interface ByteSegment {
  /** Assembler/BASIC label (valid identifier, no punctuation). */
  label: string
  /** Human description for header comments. */
  description: string
  bytes: number[]
  /** Bytes per line when rendered to text. */
  perLine: number
}

function packNibbles(fg: number, bg: number): number {
  return ((fg & 0x0f) << 4) | (bg & 0x0f)
}

/** Pattern table for one charset: 256 chars × 8 bytes = 2048 bytes. */
export function patternTableBytes(project: Project, setIndex: number): number[] {
  const charset = project.charsets[setIndex] ?? []
  const out: number[] = []
  for (const pattern of charset) {
    for (let i = 0; i < CHAR_BYTES; i++) out.push(pattern[i] ?? 0)
  }
  return out
}

/**
 * Colour table bytes for the mode: text = 1 byte; Graphics I = 32 (one per
 * 8-char group); Graphics II = 2048 per set (one per pixel row per char).
 */
export function colorTableBytes(project: Project, setIndex: number): number[] {
  const { colors } = project
  if (isTextColors(colors)) return [packNibbles(colors.fg, colors.bg)]
  if (isGraphics1Colors(colors)) return colors.groups.map((g) => packNibbles(g.fg, g.bg))
  const set = colors.rows[setIndex] ?? []
  const out: number[] = []
  for (const char of set) {
    for (const pair of char) out.push(packNibbles(pair.fg, pair.bg))
  }
  return out
}

/** Name table for one screen: the row-major cell codes (768 or 960 bytes). */
export function nameTableBytes(project: Project, screenIndex: number): number[] {
  return (project.screens[screenIndex]?.cells ?? []).map((code) => code & 0xff)
}

/** Slugify a name into a safe assembler identifier (leading digit → `_`). */
export function labelSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!slug) return 'untitled'
  return /^[0-9]/.test(slug) ? `_${slug}` : slug
}

export interface CharsetSelection {
  /** Charset indices to include (0 for single-set modes; 0–2 for independent GMII). */
  sets: number[]
  patterns: boolean
  colors: boolean
}

/**
 * Segments for a character-set export. Patterns come first (all selected sets),
 * then colours — grouped by table type to match VDP memory layout. Text and
 * Graphics I carry a single global colour table regardless of `sets`.
 */
export function charsetSegments(project: Project, selection: CharsetSelection): ByteSegment[] {
  const multi = charsetCount(project.type, project.settings.g2CharsetMode) > 1
  const suffix = (set: number) => (multi ? `_${set + 1}` : '')
  const setNote = (set: number) => (multi ? ` (set ${set + 1})` : '')
  const segments: ByteSegment[] = []

  if (selection.patterns) {
    for (const set of selection.sets) {
      segments.push({
        label: `char_patterns${suffix(set)}`,
        description: `Character patterns${setNote(set)}`,
        bytes: patternTableBytes(project, set),
        perLine: CHAR_BYTES,
      })
    }
  }

  if (selection.colors) {
    if (project.type === 'graphics2') {
      for (const set of selection.sets) {
        segments.push({
          label: `char_colors${suffix(set)}`,
          description: `Colour table${setNote(set)}`,
          bytes: colorTableBytes(project, set),
          perLine: CHAR_BYTES,
        })
      }
    } else {
      segments.push({
        label: 'char_colors',
        description: 'Colour table',
        bytes: colorTableBytes(project, 0),
        perLine: project.type === 'graphics1' ? 8 : 1,
      })
    }
  }

  return segments
}

/** Segments for a screen export — one name-table segment per selected screen. */
export function screenSegments(project: Project, screenIndices: number[]): ByteSegment[] {
  const { columns } = MODES[project.type]
  return screenIndices.map((index) => ({
    label: `screen_${index + 1}`,
    description: `Screen: ${project.screens[index]?.name ?? `Screen ${index + 1}`}`,
    bytes: nameTableBytes(project, index),
    perLine: columns,
  }))
}
