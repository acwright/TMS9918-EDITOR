/**
 * Export table extraction — turns a project's charsets, colors, and screens
 * into flat byte arrays and named segments that the format renderers
 * (assembly / BASIC / binary) consume. See PLAN.md §9.3 for the table layout.
 *
 * Color bytes pack as `(fg << 4) | bg`, matching the TMS9918 colour table.
 */

import type { Project, SpriteSize } from '../types'
import { isGraphics1Colors, isGraphics2Colors, isSpriteColors, isTextColors } from '../types'
import { CHAR_BYTES, MODES, charsetCount } from '../modes'
import {
  nameTableBytes as multicolorNameTable,
  patternTableBytes as multicolorPatternTable,
} from '../multicolor'
import { frameToPatternName, slotToPattern, spriteCount } from '../sprites'

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
  // Multicolor and sprite projects have no colour table of this shape.
  if (!isGraphics2Colors(colors)) return []
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

/** The project's sprite size, defaulting to 8×8 for a malformed settings block. */
function spriteSizeOf(project: Project): SpriteSize {
  return project.settings.spriteSize === 16 ? 16 : 8
}

/**
 * Sprite Pattern Table: the whole 256 × 8 = 2048-byte table, already in
 * hardware quadrant order (PLAN.md §14.3), so nothing is reordered here.
 */
export function spritePatternBytes(project: Project): number[] {
  return patternTableBytes(project, 0)
}

/**
 * One colour byte per sprite *slot* — `colour & 0x0F`, early-clock bit clear —
 * ready to drop into Sprite Attribute Table byte 4. At 16×16 only the quad-base
 * entries are meaningful, so the table is 64 bytes rather than 256.
 */
export function spriteColorBytes(project: Project): number[] {
  const { colors } = project
  if (!isSpriteColors(colors)) return []
  const size = spriteSizeOf(project)
  return Array.from(
    { length: spriteCount(size) },
    (_, slot) => (colors.sprites[slotToPattern(slot, size)] ?? 0) & 0x0f,
  )
}

/**
 * An animation's frames as SAT pattern-name bytes — `slot` at 8×8, `slot * 4`
 * at 16×16 — so the emitted data needs no arithmetic at runtime (Decision 32).
 */
export function spriteFrameBytes(project: Project, animationIndex: number): number[] {
  const size = spriteSizeOf(project)
  const frames = project.animations?.[animationIndex]?.frames ?? []
  return frames.map((slot) => frameToPatternName(slot, size))
}

export interface SpriteSelection {
  patterns: boolean
  colors: boolean
  /** Animation indices to emit; empty (or all-empty animations) emits none. */
  animations: number[]
}

/**
 * Segments for a sprite export (PLAN.md §14.6): the Sprite Pattern Table, the
 * per-slot colour table, then one frame table per selected animation. Empty
 * animations are skipped — a zero-byte segment is noise, not data.
 *
 * Labels are slugified from the animation name and de-duplicated, since two
 * animations may legitimately share a name (or slugify to the same thing) and
 * duplicate labels would not assemble.
 */
export function spriteSegments(project: Project, selection: SpriteSelection): ByteSegment[] {
  const segments: ByteSegment[] = []
  const size = spriteSizeOf(project)

  if (selection.patterns) {
    segments.push({
      label: 'sprite_patterns',
      description: `Sprite pattern table (${size}×${size})`,
      bytes: spritePatternBytes(project),
      perLine: CHAR_BYTES,
    })
  }

  if (selection.colors) {
    segments.push({
      label: 'sprite_colors',
      description: 'Sprite colours (one byte per sprite, for attribute byte 4)',
      bytes: spriteColorBytes(project),
      perLine: 16,
    })
  }

  const used = new Set<string>()
  for (const index of selection.animations) {
    const animation = project.animations?.[index]
    if (!animation || animation.frames.length === 0) continue
    let label = `sprite_anim_${labelSlug(animation.name)}`
    if (used.has(label)) {
      let suffix = 2
      while (used.has(`${label}_${suffix}`)) suffix++
      label = `${label}_${suffix}`
    }
    used.add(label)
    const count = animation.frames.length
    segments.push({
      label,
      description: `Animation: ${animation.name} (${count} frame${count === 1 ? '' : 's'} @ ${animation.fps} fps)`,
      bytes: spriteFrameBytes(project, index),
      perLine: 16,
    })
  }

  return segments
}

/** Segments for a screen export — one name-table segment per selected screen. */
export function screenSegments(project: Project, screenIndices: number[]): ByteSegment[] {
  if (project.type === 'multicolor') return multicolorScreenSegments(project, screenIndices)
  const { columns } = MODES[project.type]
  return screenIndices.map((index) => ({
    label: `screen_${index + 1}`,
    description: `Screen: ${project.screens[index]?.name ?? `Screen ${index + 1}`}`,
    bytes: nameTableBytes(project, index),
    perLine: columns,
  }))
}

/**
 * Segments for a multicolor screen export (PLAN.md §10.4): one Pattern
 * Generator (1536 bytes) synthesised from each selected screen's 64×48 grid,
 * followed by a single shared Name Table (768 bytes, fixed framebuffer layout).
 */
export function multicolorScreenSegments(project: Project, screenIndices: number[]): ByteSegment[] {
  const multi = screenIndices.length > 1
  const suffix = (index: number) => (multi ? `_${index + 1}` : '')
  const segments: ByteSegment[] = screenIndices.map((index) => ({
    label: `mc_patterns${suffix(index)}`,
    description: multi
      ? `Pattern generator: ${project.screens[index]?.name ?? `Screen ${index + 1}`}`
      : 'Pattern generator',
    bytes: multicolorPatternTable(project.screens[index]?.cells ?? []),
    perLine: CHAR_BYTES,
  }))
  segments.push({
    label: 'mc_names',
    description: 'Name table (fixed framebuffer layout — shared by all screens)',
    bytes: multicolorNameTable(),
    perLine: 32,
  })
  return segments
}
