import { describe, expect, it } from 'vitest'
import * as screenOps from '../screenOps'
import { MODES } from '../modes'

// 3×2 grid for hand-checkable shifts/flips:
//   1 2 3
//   4 5 6
const GRID = [1, 2, 3, 4, 5, 6]
const COLS = 3

/** Blank 32×24 screen with one marker cell. */
function marked(x: number, y: number, code = 7): number[] {
  const { columns, cellCount } = MODES.graphics1
  const cells = Array.from({ length: cellCount }, () => 0)
  cells[y * columns + x] = code
  return cells
}

describe('screenOps', () => {
  describe('cells', () => {
    it('setCell / getCell round-trip', () => {
      const cells = screenOps.setCell(GRID, COLS, 2, 1, 9)
      expect(screenOps.getCell(cells, COLS, 2, 1)).toBe(9)
      expect(cells).toEqual([1, 2, 3, 4, 5, 9])
      expect(GRID).toEqual([1, 2, 3, 4, 5, 6]) // input untouched
    })

    it('clearCell resets to 0', () => {
      expect(screenOps.clearCell(GRID, COLS, 0, 0)).toEqual([0, 2, 3, 4, 5, 6])
    })

    it('fill and clear', () => {
      expect(screenOps.fill(GRID, 8)).toEqual([8, 8, 8, 8, 8, 8])
      expect(screenOps.clear(GRID)).toEqual([0, 0, 0, 0, 0, 0])
    })
  })

  describe('shifts (wrapping)', () => {
    it('shiftLeft wraps the first column to the last', () => {
      expect(screenOps.shiftLeft(GRID, COLS)).toEqual([2, 3, 1, 5, 6, 4])
    })

    it('shiftRight wraps the last column to the first', () => {
      expect(screenOps.shiftRight(GRID, COLS)).toEqual([3, 1, 2, 6, 4, 5])
    })

    it('shiftUp wraps the top row to the bottom', () => {
      expect(screenOps.shiftUp(GRID, COLS)).toEqual([4, 5, 6, 1, 2, 3])
    })

    it('shiftDown wraps the bottom row to the top', () => {
      expect(screenOps.shiftDown(GRID, COLS)).toEqual([4, 5, 6, 1, 2, 3])
    })

    it('opposite shifts cancel on a real screen', () => {
      const { columns } = MODES.graphics1
      const cells = marked(10, 5)
      expect(screenOps.shiftRight(screenOps.shiftLeft(cells, columns), columns)).toEqual(cells)
      expect(screenOps.shiftDown(screenOps.shiftUp(cells, columns), columns)).toEqual(cells)
    })
  })

  describe('flips', () => {
    it('flipH mirrors left-right', () => {
      expect(screenOps.flipH(GRID, COLS)).toEqual([3, 2, 1, 6, 5, 4])
    })

    it('flipV mirrors top-bottom', () => {
      expect(screenOps.flipV(GRID, COLS)).toEqual([4, 5, 6, 1, 2, 3])
    })

    it('double flip is identity', () => {
      expect(screenOps.flipH(screenOps.flipH(GRID, COLS), COLS)).toEqual(GRID)
      expect(screenOps.flipV(screenOps.flipV(GRID, COLS), COLS)).toEqual(GRID)
    })
  })

  describe('content rotation (32×24, PLAN.md Phase 2 note)', () => {
    const { columns } = MODES.graphics1

    it('rotateRight moves content clockwise about the grid center', () => {
      // (10, 5) rotates CW about (15.5, 11.5) to (22, 6).
      expect(screenOps.rotateRight(marked(10, 5), columns)).toEqual(marked(22, 6))
    })

    it('rotateLeft moves content counter-clockwise about the grid center', () => {
      expect(screenOps.rotateLeft(marked(22, 6), columns)).toEqual(marked(10, 5))
    })

    it('drops content whose rotated position falls outside the grid', () => {
      // (0, 0) would land at (27, −4).
      expect(screenOps.rotateRight(marked(0, 0), columns)).toEqual(screenOps.clear(marked(0, 0)))
    })

    it('round-trips content that stays in bounds', () => {
      const cells = marked(14, 10, 42)
      expect(screenOps.rotateLeft(screenOps.rotateRight(cells, columns), columns)).toEqual(cells)
    })

    it('works for the 40×24 Text Mode grid', () => {
      const { columns: textCols, cellCount } = MODES.text
      const cells = Array.from({ length: cellCount }, () => 0)
      // (19, 11) rotates CW about (19.5, 11.5) to (20, 11).
      cells[11 * textCols + 19] = 5
      const rotated = screenOps.rotateRight(cells, textCols)
      expect(screenOps.getCell(rotated, textCols, 20, 11)).toBe(5)
      expect(rotated.filter((c) => c !== 0)).toHaveLength(1)
    })
  })
})
