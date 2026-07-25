import { describe, expect, it } from 'vitest'
import * as charOps from '../charOps'
import * as spriteOps from '../spriteOps'
import type { SpriteGrid } from '../spriteOps'
import { blankCharset } from '../factory'
import { gridToPatterns, spriteGrid } from '../sprites'
import type { CharPattern } from '../types'

/** A deterministic, visually asymmetric 8×8 pattern (no symmetry to hide bugs). */
const PATTERN: CharPattern = [0b11110000, 0b10000000, 0b10100000, 0b00010010, 0, 0b1, 0b11, 0b101]

function gridOf(pattern: CharPattern): SpriteGrid {
  return spriteGrid([pattern], 0, 8)
}

/** Run a grid op over an 8×8 pattern and return the resulting pattern. */
function viaGrid(pattern: CharPattern, op: (grid: SpriteGrid) => SpriteGrid): CharPattern {
  return gridToPatterns(op(gridOf(pattern)), 8)[0] as CharPattern
}

function render(grid: SpriteGrid): string[] {
  return grid.map((row) => row.map((on) => (on ? '#' : '.')).join(''))
}

describe('spriteOps', () => {
  describe('parity with charOps at 8×8', () => {
    const cases: [string, (g: SpriteGrid) => SpriteGrid, (p: CharPattern) => CharPattern][] = [
      ['invert', spriteOps.invert, charOps.invert],
      ['shiftLeft', spriteOps.shiftLeft, charOps.shiftLeft],
      ['shiftRight', spriteOps.shiftRight, charOps.shiftRight],
      ['shiftUp', spriteOps.shiftUp, charOps.shiftUp],
      ['shiftDown', spriteOps.shiftDown, charOps.shiftDown],
      ['flipH', spriteOps.flipH, charOps.flipH],
      ['flipV', spriteOps.flipV, charOps.flipV],
      ['rotateRight', spriteOps.rotateRight, charOps.rotateRight],
      ['rotateLeft', spriteOps.rotateLeft, charOps.rotateLeft],
    ]

    it.each(cases)('%s matches the character-level implementation', (_label, grid, chars) => {
      expect(viaGrid(PATTERN, grid)).toEqual(chars(PATTERN))
    })

    it('fill and clear match', () => {
      expect(gridToPatterns(spriteOps.fill(8), 8)[0]).toEqual(charOps.fill())
      expect(gridToPatterns(spriteOps.clear(8), 8)[0]).toEqual(charOps.clear())
    })
  })

  describe('16×16', () => {
    /** A 16×16 grid with a single pixel at (x, y). */
    function dot(x: number, y: number): SpriteGrid {
      const grid = spriteOps.clear(16)
      grid[y]![x] = true
      return grid
    }

    function only(grid: SpriteGrid): [number, number] {
      for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid.length; x++) {
          if (grid[y]?.[x]) return [x, y]
        }
      }
      throw new Error('grid is empty')
    }

    it('fills and clears the whole 16×16 grid', () => {
      expect(spriteOps.fill(16).flat().every(Boolean)).toBe(true)
      expect(spriteOps.clear(16).flat().some(Boolean)).toBe(false)
    })

    it('rotates a corner pixel through all four corners', () => {
      let grid = dot(0, 0)
      grid = spriteOps.rotateRight(grid)
      expect(only(grid)).toEqual([15, 0])
      grid = spriteOps.rotateRight(grid)
      expect(only(grid)).toEqual([15, 15])
      grid = spriteOps.rotateRight(grid)
      expect(only(grid)).toEqual([0, 15])
      grid = spriteOps.rotateRight(grid)
      expect(only(grid)).toEqual([0, 0])
    })

    it('rotateLeft undoes rotateRight', () => {
      const grid = dot(3, 11)
      expect(spriteOps.rotateLeft(spriteOps.rotateRight(grid))).toEqual(grid)
    })

    it('flips across the full 16-pixel span, not per quadrant', () => {
      expect(only(spriteOps.flipH(dot(2, 5)))).toEqual([13, 5])
      expect(only(spriteOps.flipV(dot(2, 5)))).toEqual([2, 10])
    })

    it('wraps shifts around the full 16-pixel span', () => {
      expect(only(spriteOps.shiftLeft(dot(0, 4)))).toEqual([15, 4])
      expect(only(spriteOps.shiftRight(dot(15, 4)))).toEqual([0, 4])
      expect(only(spriteOps.shiftUp(dot(4, 0)))).toEqual([4, 15])
      expect(only(spriteOps.shiftDown(dot(4, 15)))).toEqual([4, 0])
    })

    it('inverts every pixel', () => {
      expect(spriteOps.invert(dot(1, 1)).flat().filter(Boolean)).toHaveLength(16 * 16 - 1)
    })

    it('sets a single pixel without mutating the source', () => {
      const grid = spriteOps.clear(16)
      const next = spriteOps.setPixel(grid, 9, 12, true)
      expect(next[12]?.[9]).toBe(true)
      expect(grid[12]?.[9]).toBe(false)
    })

    it('keeps a shape recognisable across the quadrant boundary', () => {
      // A horizontal bar spanning the left/right quadrant seam.
      let grid = spriteOps.clear(16)
      for (let x = 6; x < 10; x++) grid[7]![x] = true
      grid = spriteOps.flipV(grid)
      expect(render(grid)[8]).toBe('......####......')
      expect(render(grid)[7]).toBe('................')
    })
  })

  describe('transformSprite', () => {
    it('reads a 16×16 slot, transforms it, and returns its four patterns', () => {
      const charset = blankCharset()
      charset[4] = [0x80, 0, 0, 0, 0, 0, 0, 0] // slot 1, top-left pixel

      const patterns = spriteOps.transformSprite(charset, 1, 16, spriteOps.flipH)

      expect(patterns).toHaveLength(4)
      // Flipping horizontally moves the pixel to x=15 → top-right quadrant (offset 2).
      expect(patterns[0]?.every((b) => b === 0)).toBe(true)
      expect(patterns[2]).toEqual([0x01, 0, 0, 0, 0, 0, 0, 0])
    })

    it('returns a single pattern for an 8×8 slot', () => {
      const charset = blankCharset()
      charset[3] = PATTERN.slice()
      const patterns = spriteOps.transformSprite(charset, 3, 8, spriteOps.rotateRight)
      expect(patterns).toEqual([charOps.rotateRight(PATTERN)])
    })

    it('does not mutate the source charset', () => {
      const charset = blankCharset()
      charset[0] = PATTERN.slice()
      spriteOps.transformSprite(charset, 0, 8, spriteOps.invert)
      expect(charset[0]).toEqual(PATTERN)
    })
  })
})
