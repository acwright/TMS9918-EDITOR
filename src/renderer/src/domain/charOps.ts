/**
 * Character operations — pure functions over 8-byte patterns.
 * Every function returns a new array; inputs are never mutated.
 * Bit layout: MSB = leftmost pixel (x = 0).
 *
 * Intended usage: `import * as charOps from './charOps'`.
 */

import type { CharPattern } from './types'
import { CHAR_BYTES } from './modes'

const ROW_MASK = 0xff

function bit(x: number): number {
  return 0x80 >> x
}

export function getPixel(pattern: CharPattern, x: number, y: number): boolean {
  return ((pattern[y] ?? 0) & bit(x)) !== 0
}

export function setPixel(pattern: CharPattern, x: number, y: number, on: boolean): CharPattern {
  const next = pattern.slice()
  const row = next[y] ?? 0
  next[y] = on ? row | bit(x) : row & ~bit(x) & ROW_MASK
  return next
}

export function fill(): CharPattern {
  return Array.from({ length: CHAR_BYTES }, () => ROW_MASK)
}

export function clear(): CharPattern {
  return Array.from({ length: CHAR_BYTES }, () => 0)
}

export function invert(pattern: CharPattern): CharPattern {
  return pattern.map((row) => ~row & ROW_MASK)
}

export function shiftLeft(pattern: CharPattern): CharPattern {
  return pattern.map((row) => ((row << 1) | (row >> 7)) & ROW_MASK)
}

export function shiftRight(pattern: CharPattern): CharPattern {
  return pattern.map((row) => ((row >> 1) | (row << 7)) & ROW_MASK)
}

export function shiftUp(pattern: CharPattern): CharPattern {
  return [...pattern.slice(1), pattern[0] ?? 0]
}

export function shiftDown(pattern: CharPattern): CharPattern {
  return [pattern[CHAR_BYTES - 1] ?? 0, ...pattern.slice(0, CHAR_BYTES - 1)]
}

/** Mirror left↔right (reverses the bits of each row). */
export function flipH(pattern: CharPattern): CharPattern {
  return pattern.map((row) => {
    let out = 0
    for (let x = 0; x < 8; x++) {
      if (row & bit(x)) out |= bit(7 - x)
    }
    return out
  })
}

/** Mirror top↔bottom (reverses row order). */
export function flipV(pattern: CharPattern): CharPattern {
  return pattern.slice().reverse()
}

/** Rotate 90° clockwise: dest(x, y) ← src(y, 7 − x). */
export function rotateRight(pattern: CharPattern): CharPattern {
  const out = clear()
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (getPixel(pattern, y, 7 - x)) out[y] = (out[y] ?? 0) | bit(x)
    }
  }
  return out
}

/** Rotate 90° counter-clockwise: dest(x, y) ← src(7 − y, x). */
export function rotateLeft(pattern: CharPattern): CharPattern {
  const out = clear()
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (getPixel(pattern, 7 - y, x)) out[y] = (out[y] ?? 0) | bit(x)
    }
  }
  return out
}
