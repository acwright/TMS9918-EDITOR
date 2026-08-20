import { describe, expect, it } from 'vitest'
import { blankCharset } from '../factory'
import {
  MAX_FPS,
  MIN_FPS,
  SAT_SIZE,
  SPRITE_PATTERN_COUNT,
  SPRITE_PATTERN_TABLE_SIZE,
  SPRITE_TERMINATOR_Y,
  bytesToPatterns,
  clampFps,
  clampSlot,
  frameToPatternName,
  getSpritePixel,
  gridToPatterns,
  isValidSlot,
  moveFrame,
  patternToSlot,
  patternsForSlot,
  quadrantFor,
  slotToPattern,
  spriteBytes,
  spriteCount,
  spriteGrid,
  spritePixelSize,
} from '../sprites'
import type { Charset } from '../types'

/** A charset with `patterns` written at the given indices, rest blank. */
function charsetWith(patterns: Record<number, number[]>): Charset {
  const charset = blankCharset()
  for (const [index, bytes] of Object.entries(patterns)) {
    charset[Number(index)] = bytes.slice()
  }
  return charset
}

/** All (x, y) coordinates of a `size × size` grid. */
function coords(size: number): [number, number][] {
  const out: [number, number][] = []
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) out.push([x, y])
  return out
}

describe('sprites', () => {
  it('exposes the hardware table sizes', () => {
    expect(SPRITE_PATTERN_COUNT).toBe(256)
    expect(SPRITE_PATTERN_TABLE_SIZE).toBe(2048)
    expect(SAT_SIZE).toBe(128)
    expect(SPRITE_TERMINATOR_Y).toBe(0xd0)
  })

  describe('slot vocabulary', () => {
    it('counts 256 slots at 8×8 and 64 at 16×16', () => {
      expect(spriteCount(8)).toBe(256)
      expect(spriteCount(16)).toBe(64)
    })

    it('maps slots to their base pattern', () => {
      expect(slotToPattern(0, 8)).toBe(0)
      expect(slotToPattern(37, 8)).toBe(37)
      expect(slotToPattern(0, 16)).toBe(0)
      expect(slotToPattern(1, 16)).toBe(4)
      expect(slotToPattern(63, 16)).toBe(252)
    })

    it('maps patterns back to their slot, masking the low two bits at 16×16', () => {
      expect(patternToSlot(37, 8)).toBe(37)
      expect(patternToSlot(4, 16)).toBe(1)
      expect(patternToSlot(5, 16)).toBe(1)
      expect(patternToSlot(6, 16)).toBe(1)
      expect(patternToSlot(7, 16)).toBe(1)
      expect(patternToSlot(8, 16)).toBe(2)
    })

    it('lists the patterns a slot occupies in hardware order', () => {
      expect(patternsForSlot(3, 8)).toEqual([3])
      expect(patternsForSlot(3, 16)).toEqual([12, 13, 14, 15])
    })

    it('emits the SAT pattern-name byte for a frame', () => {
      expect(frameToPatternName(5, 8)).toBe(5)
      expect(frameToPatternName(5, 16)).toBe(20)
      expect(frameToPatternName(63, 16)).toBe(252)
    })

    it('reports the on-screen pixel size with magnification', () => {
      expect(spritePixelSize(8, 1)).toBe(8)
      expect(spritePixelSize(8, 2)).toBe(16)
      expect(spritePixelSize(16, 1)).toBe(16)
      expect(spritePixelSize(16, 2)).toBe(32)
    })

    it('clamps and validates slot indices per size', () => {
      expect(clampSlot(-4, 8)).toBe(0)
      expect(clampSlot(999, 8)).toBe(255)
      expect(clampSlot(999, 16)).toBe(63)
      expect(clampSlot(Number.NaN, 16)).toBe(0)
      expect(isValidSlot(63, 16)).toBe(true)
      expect(isValidSlot(64, 16)).toBe(false)
      expect(isValidSlot(-1, 8)).toBe(false)
      expect(isValidSlot(1.5, 8)).toBe(false)
    })
  })

  describe('quadrant mapping (PLAN.md §14.3)', () => {
    it('places the four 16×16 quadrants in column-major order', () => {
      // TL, BL, TR, BR — the offset is the pattern's distance from the base.
      expect(quadrantFor(0, 0)).toEqual({ offset: 0, byte: 0 }) // top-left
      expect(quadrantFor(7, 7)).toEqual({ offset: 0, byte: 7 })
      expect(quadrantFor(0, 8)).toEqual({ offset: 1, byte: 0 }) // bottom-left
      expect(quadrantFor(7, 15)).toEqual({ offset: 1, byte: 7 })
      expect(quadrantFor(8, 0)).toEqual({ offset: 2, byte: 0 }) // top-right
      expect(quadrantFor(15, 7)).toEqual({ offset: 2, byte: 7 })
      expect(quadrantFor(8, 8)).toEqual({ offset: 3, byte: 0 }) // bottom-right
      expect(quadrantFor(15, 15)).toEqual({ offset: 3, byte: 7 })
    })

    it('reads a pixel from each quadrant of a 16×16 sprite', () => {
      // Slot 1 → patterns 4–7. Set the top-left pixel of each quadrant.
      const charset = charsetWith({
        4: [0x80, 0, 0, 0, 0, 0, 0, 0],
        5: [0x80, 0, 0, 0, 0, 0, 0, 0],
        6: [0x80, 0, 0, 0, 0, 0, 0, 0],
        7: [0x80, 0, 0, 0, 0, 0, 0, 0],
      })
      expect(getSpritePixel(charset, 1, 16, 0, 0)).toBe(true) // TL  ← pattern 4
      expect(getSpritePixel(charset, 1, 16, 0, 8)).toBe(true) // BL  ← pattern 5
      expect(getSpritePixel(charset, 1, 16, 8, 0)).toBe(true) // TR  ← pattern 6
      expect(getSpritePixel(charset, 1, 16, 8, 8)).toBe(true) // BR  ← pattern 7
      expect(getSpritePixel(charset, 1, 16, 1, 0)).toBe(false)
    })

    it('reads an 8×8 slot straight out of its single pattern', () => {
      const charset = charsetWith({ 9: [0b10000001, 0, 0, 0, 0, 0, 0, 0b00011000] })
      expect(getSpritePixel(charset, 9, 8, 0, 0)).toBe(true)
      expect(getSpritePixel(charset, 9, 8, 7, 0)).toBe(true)
      expect(getSpritePixel(charset, 9, 8, 3, 7)).toBe(true)
      expect(getSpritePixel(charset, 9, 8, 0, 7)).toBe(false)
    })
  })

  describe('spriteGrid / gridToPatterns', () => {
    it('builds a grid of the requested size', () => {
      expect(spriteGrid(blankCharset(), 0, 8)).toHaveLength(8)
      expect(spriteGrid(blankCharset(), 0, 8)[0]).toHaveLength(8)
      expect(spriteGrid(blankCharset(), 0, 16)).toHaveLength(16)
      expect(spriteGrid(blankCharset(), 0, 16)[0]).toHaveLength(16)
    })

    it('agrees with getSpritePixel at every 16×16 coordinate', () => {
      const charset = blankCharset()
      for (let p = 4; p < 8; p++) {
        charset[p] = Array.from({ length: 8 }, (_, i) => (p * 37 + i * 11) & 0xff)
      }
      const grid = spriteGrid(charset, 1, 16)
      for (const [x, y] of coords(16)) {
        expect(grid[y]?.[x]).toBe(getSpritePixel(charset, 1, 16, x, y))
      }
    })

    it.each([8, 16] as const)('round-trips an arbitrary %d×%d grid', (size) => {
      const charset = blankCharset()
      const base = size === 16 ? 4 : 1
      for (let i = 0; i < (size === 16 ? 4 : 1); i++) {
        charset[base + i] = Array.from({ length: 8 }, (_, r) => (i * 53 + r * 29 + 7) & 0xff)
      }
      const slot = size === 16 ? 1 : 1
      const grid = spriteGrid(charset, slot, size)
      const patterns = gridToPatterns(grid, size)
      expect(patterns).toEqual(patternsForSlot(slot, size).map((p) => charset[p]))
    })

    it('writes each quadrant back to the pattern the hardware reads it from', () => {
      const grid = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => false))
      grid[8]![8] = true // bottom-right quadrant, local (0, 0)
      const patterns = gridToPatterns(grid, 16)
      expect(patterns[0]?.every((b) => b === 0)).toBe(true)
      expect(patterns[1]?.every((b) => b === 0)).toBe(true)
      expect(patterns[2]?.every((b) => b === 0)).toBe(true)
      expect(patterns[3]).toEqual([0x80, 0, 0, 0, 0, 0, 0, 0])
    })

    it('tolerates a short charset rather than throwing', () => {
      const grid = spriteGrid([], 0, 16)
      expect(grid.flat().every((on) => on === false)).toBe(true)
    })
  })

  describe('byte views', () => {
    it('flattens a slot into 8 bytes at 8×8 and 32 at 16×16', () => {
      const charset = blankCharset()
      for (let p = 0; p < 4; p++) charset[p] = Array.from({ length: 8 }, (_, i) => p * 8 + i)
      expect(spriteBytes(charset, 0, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
      expect(spriteBytes(charset, 0, 16)).toHaveLength(32)
      expect(spriteBytes(charset, 0, 16).slice(24)).toEqual([24, 25, 26, 27, 28, 29, 30, 31])
    })

    it('splits a flat byte run back into per-pattern arrays', () => {
      const bytes = Array.from({ length: 32 }, (_, i) => i)
      expect(bytesToPatterns(bytes, 16)).toEqual([
        [0, 1, 2, 3, 4, 5, 6, 7],
        [8, 9, 10, 11, 12, 13, 14, 15],
        [16, 17, 18, 19, 20, 21, 22, 23],
        [24, 25, 26, 27, 28, 29, 30, 31],
      ])
      expect(bytesToPatterns(bytes.slice(0, 8), 8)).toEqual([[0, 1, 2, 3, 4, 5, 6, 7]])
    })

    it('round-trips bytes → patterns → bytes', () => {
      const charset = blankCharset()
      for (let p = 4; p < 8; p++)
        charset[p] = Array.from({ length: 8 }, (_, i) => (p * 17 + i) & 0xff)
      const bytes = spriteBytes(charset, 1, 16)
      expect(bytesToPatterns(bytes, 16).flat()).toEqual(bytes)
    })
  })

  describe('animation helpers', () => {
    it('clamps fps into the supported range', () => {
      expect(clampFps(0)).toBe(MIN_FPS)
      expect(clampFps(-5)).toBe(MIN_FPS)
      expect(clampFps(100)).toBe(MAX_FPS)
      expect(clampFps(12.4)).toBe(12)
      expect(clampFps(Number.NaN)).toBe(8)
    })

    it('moves a frame without mutating the original', () => {
      const frames = [0, 1, 2, 3]
      expect(moveFrame(frames, 0, 2)).toEqual([1, 2, 0, 3])
      expect(moveFrame(frames, 3, 0)).toEqual([3, 0, 1, 2])
      expect(frames).toEqual([0, 1, 2, 3])
    })

    it('leaves the list untouched for out-of-range or no-op moves', () => {
      const frames = [0, 1, 2]
      expect(moveFrame(frames, 1, 1)).toEqual(frames)
      expect(moveFrame(frames, -1, 0)).toEqual(frames)
      expect(moveFrame(frames, 0, 9)).toEqual(frames)
    })
  })
})
