/**
 * Screen operations — pure functions over row-major cell arrays of character
 * codes. Every function returns a new array; inputs are never mutated.
 * The grid width is passed as `columns`; height is derived from length.
 *
 * Intended usage: `import * as screenOps from './screenOps'`.
 */

const BLANK = 0

export function cellIndex(columns: number, x: number, y: number): number {
  return y * columns + x
}

export function getCell(cells: number[], columns: number, x: number, y: number): number {
  return cells[cellIndex(columns, x, y)] ?? BLANK
}

export function setCell(
  cells: number[],
  columns: number,
  x: number,
  y: number,
  code: number,
): number[] {
  const next = cells.slice()
  next[cellIndex(columns, x, y)] = code
  return next
}

export function clearCell(cells: number[], columns: number, x: number, y: number): number[] {
  return setCell(cells, columns, x, y, BLANK)
}

export function fill(cells: number[], code: number): number[] {
  return Array.from({ length: cells.length }, () => code)
}

export function clear(cells: number[]): number[] {
  return fill(cells, BLANK)
}

export function shiftLeft(cells: number[], columns: number): number[] {
  return cells.map((_, i) => {
    const x = i % columns
    const src = x === columns - 1 ? i - (columns - 1) : i + 1
    return cells[src] ?? BLANK
  })
}

export function shiftRight(cells: number[], columns: number): number[] {
  return cells.map((_, i) => {
    const x = i % columns
    const src = x === 0 ? i + (columns - 1) : i - 1
    return cells[src] ?? BLANK
  })
}

export function shiftUp(cells: number[], columns: number): number[] {
  return cells.map((_, i) => cells[(i + columns) % cells.length] ?? BLANK)
}

export function shiftDown(cells: number[], columns: number): number[] {
  return cells.map((_, i) => cells[(i - columns + cells.length) % cells.length] ?? BLANK)
}

/** Mirror left↔right. */
export function flipH(cells: number[], columns: number): number[] {
  return cells.map((_, i) => {
    const x = i % columns
    return cells[i - x + (columns - 1 - x)] ?? BLANK
  })
}

/** Mirror top↔bottom. */
export function flipV(cells: number[], columns: number): number[] {
  const rows = cells.length / columns
  return cells.map((_, i) => {
    const x = i % columns
    const y = Math.floor(i / columns)
    return cells[cellIndex(columns, x, rows - 1 - y)] ?? BLANK
  })
}

/**
 * Rotate the screen *content* 90° about the grid center, within the same
 * bounds (PLAN.md Phase 2 note): a non-square grid cannot rotate in place, so
 * cells whose rotated position falls outside the grid are dropped and vacated
 * cells are cleared. Assumes columns and rows have the same parity (all
 * TMS9918 grids are even × even), which keeps rotated positions on the grid.
 */
function rotateContent(cells: number[], columns: number, clockwise: boolean): number[] {
  const rows = cells.length / columns
  const cx = (columns - 1) / 2
  const cy = (rows - 1) / 2
  const out = Array.from({ length: cells.length }, () => BLANK)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      // Inverse rotation: where must the source cell be for it to land here?
      const sx = clockwise ? cx + (y - cy) : cx - (y - cy)
      const sy = clockwise ? cy - (x - cx) : cy + (x - cx)
      if (sx >= 0 && sx < columns && sy >= 0 && sy < rows) {
        out[cellIndex(columns, x, y)] = cells[cellIndex(columns, sx, sy)] ?? BLANK
      }
    }
  }
  return out
}

export function rotateRight(cells: number[], columns: number): number[] {
  return rotateContent(cells, columns, true)
}

export function rotateLeft(cells: number[], columns: number): number[] {
  return rotateContent(cells, columns, false)
}
