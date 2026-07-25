/**
 * Sprite Mode domain — the slot vocabulary and the pattern-table plumbing that
 * every sprite-aware part of the app shares. See PLAN.md §14.3.
 *
 * A sprite project's single charset *is* the hardware Sprite Pattern Table:
 * 256 patterns × 8 bytes = 2048 bytes, one bit per pixel, MSB = leftmost
 * (Decision 23). What changes with `spriteSize` is only how those patterns are
 * *grouped*:
 *
 *   8×8   → 256 slots; slot n = pattern n
 *   16×16 →  64 slots; slot n = patterns 4n…4n+3, laid out column-major:
 *
 *     ┌───────┬───────┐
 *     │ 4n    │ 4n+2  │   4n   = top-left      4n+2 = top-right
 *     ├───────┼───────┤   4n+1 = bottom-left   4n+3 = bottom-right
 *     │ 4n+1  │ 4n+3  │
 *     └───────┴───────┘
 *
 * That column-major order is the single most common bug in TMS9918 sprite code,
 * so it lives here and nowhere else (Decision 26).
 *
 * Standalone by design (no `modes` import) to avoid an import cycle — the same
 * shape as `multicolor.ts`.
 */

import type { Charset, CharPattern, SpriteMag, SpriteSize } from './types'

/** Patterns in the Sprite Pattern Table. */
export const SPRITE_PATTERN_COUNT = 256

/** Bytes per pattern (one per pixel row). */
export const SPRITE_PATTERN_BYTES = 8

/** Sprite Pattern Table size in bytes. */
export const SPRITE_PATTERN_TABLE_SIZE = SPRITE_PATTERN_COUNT * SPRITE_PATTERN_BYTES // 2048

/** Patterns consumed by one 16×16 sprite. */
export const SPRITE_QUAD = 4

/** Sprites the VDP can display at once. */
export const SPRITE_MAX_ON_SCREEN = 32

/** Sprites the VDP can display on any one scan line; the 5th is dropped. */
export const SPRITE_MAX_PER_LINE = 4

/** Bytes per Sprite Attribute Table entry (Y, X, pattern name, colour + EC). */
export const SAT_ENTRY_BYTES = 4

/** Sprite Attribute Table size in bytes. */
export const SAT_SIZE = SPRITE_MAX_ON_SCREEN * SAT_ENTRY_BYTES // 128

/**
 * A Y position of 208 terminates the sprite list: that sprite and every later
 * one is not displayed.
 */
export const SPRITE_TERMINATOR_Y = 0xd0

/** Early-clock bit in Sprite Attribute Table byte 4 — shifts the sprite 32px left. */
export const SPRITE_EARLY_CLOCK = 0x80

/** Playback rate bounds for animations. */
export const MIN_FPS = 1
export const MAX_FPS = 30

const ROW_MASK = 0xff

function bit(x: number): number {
  return 0x80 >> x
}

function blankPattern(): CharPattern {
  return Array.from({ length: SPRITE_PATTERN_BYTES }, () => 0)
}

/** Selectable sprite slots at a given size: 256 at 8×8, 64 at 16×16. */
export function spriteCount(size: SpriteSize): number {
  return size === 16 ? SPRITE_PATTERN_COUNT / SPRITE_QUAD : SPRITE_PATTERN_COUNT
}

/** First pattern of a slot — also the Sprite Attribute Table pattern-name byte. */
export function slotToPattern(slot: number, size: SpriteSize): number {
  return size === 16 ? slot * SPRITE_QUAD : slot
}

/** Slot a pattern belongs to (the hardware masks the low two bits at 16×16). */
export function patternToSlot(pattern: number, size: SpriteSize): number {
  return size === 16 ? Math.floor(pattern / SPRITE_QUAD) : pattern
}

/** Every pattern a slot occupies, in hardware order (1 at 8×8, 4 at 16×16). */
export function patternsForSlot(slot: number, size: SpriteSize): number[] {
  const base = slotToPattern(slot, size)
  if (size === 8) return [base]
  return [base, base + 1, base + 2, base + 3]
}

/**
 * The SAT pattern-name byte for a frame: `slot` at 8×8, `slot * 4` at 16×16,
 * so exported frame tables need no arithmetic at runtime (Decision 32).
 */
export function frameToPatternName(slot: number, size: SpriteSize): number {
  return slotToPattern(slot, size) & 0xff
}

/** On-screen pixel size of a sprite, magnification included. */
export function spritePixelSize(size: SpriteSize, mag: SpriteMag): number {
  return size * mag
}

/**
 * Which pattern (relative to the slot base) and which byte hold sprite-local
 * pixel (x, y). The column-major quadrant order lives here — see the module
 * header and PLAN.md §14.3.
 */
export function quadrantFor(x: number, y: number): { offset: number; byte: number } {
  return { offset: (x >> 3) * 2 + (y >> 3), byte: y & 7 }
}

/** Clamp a slot index into range for the given size. */
export function clampSlot(slot: number, size: SpriteSize): number {
  const max = spriteCount(size) - 1
  if (!Number.isFinite(slot)) return 0
  return Math.min(max, Math.max(0, Math.trunc(slot)))
}

/** True when the slot index addresses a real sprite at this size. */
export function isValidSlot(slot: number, size: SpriteSize): boolean {
  return Number.isInteger(slot) && slot >= 0 && slot < spriteCount(size)
}

/**
 * A slot's pixels as a `size × size` boolean grid, `grid[y][x]`. Missing
 * patterns read as blank, so a truncated charset can't throw.
 */
export function spriteGrid(charset: Charset, slot: number, size: SpriteSize): boolean[][] {
  const base = slotToPattern(slot, size)
  const grid: boolean[][] = []
  for (let y = 0; y < size; y++) {
    const row: boolean[] = []
    for (let x = 0; x < size; x++) {
      const { offset, byte } = quadrantFor(x, y)
      const pattern = charset[base + (size === 16 ? offset : 0)] ?? []
      row.push(((pattern[byte] ?? 0) & bit(x & 7)) !== 0)
    }
    grid.push(row)
  }
  return grid
}

/** Read one pixel of a slot without building the whole grid. */
export function getSpritePixel(
  charset: Charset,
  slot: number,
  size: SpriteSize,
  x: number,
  y: number,
): boolean {
  const { offset, byte } = quadrantFor(x, y)
  const pattern = charset[slotToPattern(slot, size) + (size === 16 ? offset : 0)] ?? []
  return ((pattern[byte] ?? 0) & bit(x & 7)) !== 0
}

/**
 * The patterns a slot occupies, rebuilt from a `size × size` grid, in hardware
 * order — index 0 of the result is the slot's base pattern.
 */
export function gridToPatterns(grid: boolean[][], size: SpriteSize): CharPattern[] {
  const patterns = Array.from({ length: size === 16 ? SPRITE_QUAD : 1 }, blankPattern)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!grid[y]?.[x]) continue
      const { offset, byte } = quadrantFor(x, y)
      const pattern = patterns[size === 16 ? offset : 0]
      if (pattern) pattern[byte] = (pattern[byte] ?? 0) | bit(x & 7)
    }
  }
  return patterns
}

/** A slot's patterns as-stored (index 0 = base), for byte-box display. */
export function spritePatterns(charset: Charset, slot: number, size: SpriteSize): CharPattern[] {
  return patternsForSlot(slot, size).map((p) => (charset[p] ?? blankPattern()).slice())
}

/** Flatten a slot's patterns into the byte order the hardware stores them in. */
export function spriteBytes(charset: Charset, slot: number, size: SpriteSize): number[] {
  return spritePatterns(charset, slot, size).flat()
}

/** Split a flat 8- or 32-byte run back into per-pattern arrays. */
export function bytesToPatterns(bytes: number[], size: SpriteSize): CharPattern[] {
  return patternsForSlot(0, size).map((_, i) =>
    bytes.slice(i * SPRITE_PATTERN_BYTES, (i + 1) * SPRITE_PATTERN_BYTES).map((b) => b & ROW_MASK),
  )
}

/** Clamp a playback rate into the supported range; non-numbers fall back to 8. */
export function clampFps(fps: number): number {
  if (!Number.isFinite(fps)) return 8
  return Math.min(MAX_FPS, Math.max(MIN_FPS, Math.round(fps)))
}

/**
 * Move a frame within an animation. Returns a new array; an out-of-range source
 * or destination leaves the list untouched.
 */
export function moveFrame(frames: number[], from: number, to: number): number[] {
  if (from < 0 || from >= frames.length || to < 0 || to >= frames.length || from === to) {
    return frames.slice()
  }
  const next = frames.slice()
  const [frame] = next.splice(from, 1)
  next.splice(to, 0, frame as number)
  return next
}
