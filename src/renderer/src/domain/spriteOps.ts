/**
 * Sprite operations — pure functions over a square `size × size` boolean grid,
 * so the same transform buttons drive 8×8 and 16×16 sprites (PLAN.md §14.8,
 * Phase 25). Every function returns a new grid; inputs are never mutated.
 *
 * `grid[y][x]`, y top→bottom, x left→right. At 8×8 these are exact parity with
 * `charOps` (shifts and rotations wrap, rotations are 90°), which the specs
 * assert directly against the pattern-level implementations.
 *
 * Intended usage: `import * as spriteOps from './spriteOps'`.
 */

import type { Charset, CharPattern, SpriteSize } from './types'
import { gridToPatterns, spriteGrid } from './sprites'

/** A square sprite bitmap: `grid[y][x]`, true = the sprite's colour. */
export type SpriteGrid = boolean[][]

/** Side length of a (square) sprite grid. */
export function gridSize(grid: SpriteGrid): number {
  return grid.length
}

function build(size: number, at: (x: number, y: number) => boolean): SpriteGrid {
  return Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => at(x, y)))
}

function read(grid: SpriteGrid, x: number, y: number): boolean {
  return grid[y]?.[x] ?? false
}

export function fill(size: number): SpriteGrid {
  return build(size, () => true)
}

export function clear(size: number): SpriteGrid {
  return build(size, () => false)
}

export function invert(grid: SpriteGrid): SpriteGrid {
  return build(gridSize(grid), (x, y) => !read(grid, x, y))
}

export function shiftLeft(grid: SpriteGrid): SpriteGrid {
  const n = gridSize(grid)
  return build(n, (x, y) => read(grid, (x + 1) % n, y))
}

export function shiftRight(grid: SpriteGrid): SpriteGrid {
  const n = gridSize(grid)
  return build(n, (x, y) => read(grid, (x - 1 + n) % n, y))
}

export function shiftUp(grid: SpriteGrid): SpriteGrid {
  const n = gridSize(grid)
  return build(n, (x, y) => read(grid, x, (y + 1) % n))
}

export function shiftDown(grid: SpriteGrid): SpriteGrid {
  const n = gridSize(grid)
  return build(n, (x, y) => read(grid, x, (y - 1 + n) % n))
}

/** Mirror left↔right. */
export function flipH(grid: SpriteGrid): SpriteGrid {
  const n = gridSize(grid)
  return build(n, (x, y) => read(grid, n - 1 - x, y))
}

/** Mirror top↔bottom. */
export function flipV(grid: SpriteGrid): SpriteGrid {
  const n = gridSize(grid)
  return build(n, (x, y) => read(grid, x, n - 1 - y))
}

/** Rotate 90° clockwise: dest(x, y) ← src(y, n − 1 − x). */
export function rotateRight(grid: SpriteGrid): SpriteGrid {
  const n = gridSize(grid)
  return build(n, (x, y) => read(grid, y, n - 1 - x))
}

/** Rotate 90° counter-clockwise: dest(x, y) ← src(n − 1 − y, x). */
export function rotateLeft(grid: SpriteGrid): SpriteGrid {
  const n = gridSize(grid)
  return build(n, (x, y) => read(grid, n - 1 - y, x))
}

/** Set one pixel, returning a new grid. */
export function setPixel(grid: SpriteGrid, x: number, y: number, on: boolean): SpriteGrid {
  const n = gridSize(grid)
  return build(n, (gx, gy) => (gx === x && gy === y ? on : read(grid, gx, gy)))
}

/**
 * Read a slot out of the pattern table, apply a grid transform, and hand back
 * the slot's patterns in hardware order (index 0 = base pattern). The quadrant
 * mapping stays inside `sprites.ts`.
 */
export function transformSprite(
  charset: Charset,
  slot: number,
  size: SpriteSize,
  op: (grid: SpriteGrid) => SpriteGrid,
): CharPattern[] {
  return gridToPatterns(op(spriteGrid(charset, slot, size)), size)
}
