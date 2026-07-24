import { describe, expect, it } from 'vitest'
import {
  MC_CELL_COUNT,
  MC_COLUMNS,
  MC_NAME_TABLE_SIZE,
  MC_PATTERN_TABLE_SIZE,
  MC_ROWS,
  nameTableBytes,
  patternTableBytes,
} from '../multicolor'

const CHAR_COLS = 32
const CHAR_ROWS = 24

/**
 * Reconstruct the 64×48 grid the way the VDP would render it, from the Name
 * Table + Pattern Generator. A faithful mapping must round-trip exactly.
 */
function decode(names: number[], patterns: number[]): number[] {
  const grid = Array.from<number>({ length: MC_CELL_COUNT }).fill(0)
  const put = (x: number, y: number, v: number) => {
    grid[y * MC_COLUMNS + x] = v
  }
  for (let r = 0; r < CHAR_ROWS; r++) {
    for (let c = 0; c < CHAR_COLS; c++) {
      const name = names[r * CHAR_COLS + c]!
      const k = 2 * (r & 3)
      const top = patterns[name * 8 + k]!
      const bot = patterns[name * 8 + k + 1]!
      put(2 * c, 2 * r, top >> 4)
      put(2 * c + 1, 2 * r, top & 0x0f)
      put(2 * c, 2 * r + 1, bot >> 4)
      put(2 * c + 1, 2 * r + 1, bot & 0x0f)
    }
  }
  return grid
}

describe('multicolor synthesis', () => {
  it('exposes the expected table dimensions', () => {
    expect(MC_CELL_COUNT).toBe(3072)
    expect(MC_COLUMNS).toBe(64)
    expect(MC_ROWS).toBe(48)
    expect(MC_NAME_TABLE_SIZE).toBe(768)
    expect(MC_PATTERN_TABLE_SIZE).toBe(1536)
  })

  describe('nameTableBytes', () => {
    const names = nameTableBytes()

    it('is a fixed 768-byte framebuffer fill using patterns 0–191', () => {
      expect(names).toHaveLength(768)
      expect(Math.min(...names)).toBe(0)
      expect(Math.max(...names)).toBe(191)
    })

    it('follows name[r*32 + c] = (r >> 2)*32 + c', () => {
      expect(names[0]).toBe(0) // r0 c0
      expect(names[31]).toBe(31) // r0 c31
      expect(names[1 * 32 + 0]).toBe(0) // r1 c0 — same group as r0
      expect(names[4 * 32 + 0]).toBe(32) // r4 c0 — next row-group
      expect(names[767]).toBe(191) // r23 c31
    })
  })

  describe('patternTableBytes', () => {
    it('produces 1536 zero bytes for a blank (transparent) grid', () => {
      const bytes = patternTableBytes(Array.from<number>({ length: MC_CELL_COUNT }).fill(0))
      expect(bytes).toHaveLength(1536)
      expect(bytes.every((b) => b === 0)).toBe(true)
    })

    it('packs two horizontally-adjacent blocks as (left << 4) | right', () => {
      const grid = Array.from<number>({ length: MC_CELL_COUNT }).fill(0)
      grid[0] = 5 // block (0,0) top-left of char cell (0,0)
      grid[1] = 7 // block (1,0) top-right
      const bytes = patternTableBytes(grid)
      expect(bytes[0]).toBe((5 << 4) | 7)
    })

    it('routes a block to the right pattern/offset for a non-zero cell', () => {
      // block (x=3, y=5) → char cell (c=1, r=2), bottom-right, pattern 1, byte 5.
      const grid = Array.from<number>({ length: MC_CELL_COUNT }).fill(0)
      grid[5 * MC_COLUMNS + 3] = 9
      const bytes = patternTableBytes(grid)
      // pattern (2>>2)*32+1 = 1, byte offset 2*(2&3)+1 = 5 → index 1*8 + 5 = 13.
      expect(bytes[13]).toBe(9)
    })

    it('maps the next row-group to patterns 32+', () => {
      // block (x=0, y=8) → char cell (c=0, r=4) → pattern 32, byte 0, high nibble.
      const grid = Array.from<number>({ length: MC_CELL_COUNT }).fill(0)
      grid[8 * MC_COLUMNS + 0] = 15
      const bytes = patternTableBytes(grid)
      expect(bytes[32 * 8]).toBe(15 << 4)
    })

    it('round-trips an arbitrary grid through name + pattern tables', () => {
      const grid = Array.from({ length: MC_CELL_COUNT }, (_, i) => (i * 7 + (i >> 5)) & 0x0f)
      const decoded = decode(nameTableBytes(), patternTableBytes(grid))
      expect(decoded).toEqual(grid)
    })
  })
})
