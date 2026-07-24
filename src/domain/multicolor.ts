/**
 * Multicolor Mode synthesis — turns the editable 64×48 colour grid into the
 * TMS9918 hardware tables (Name Table + Pattern Generator). None of this is
 * stored in the project; it is derived only at export time. See PLAN.md §10.3.
 *
 * The grid is a row-major array of palette indices (0–15), `cells[y*64 + x]`,
 * `y` top→bottom (0–47), `x` left→right (0–63). Each cell is one 4×4 block.
 */

/** Chunky-block grid dimensions. */
export const MC_COLUMNS = 64
export const MC_ROWS = 48
export const MC_CELL_COUNT = MC_COLUMNS * MC_ROWS // 3072

/** Underlying character grid the VDP addresses (32×24 cells of 8×8 px). */
const CHAR_COLS = 32
const CHAR_ROWS = 24

/** Fixed Name Table size (bytes). */
export const MC_NAME_TABLE_SIZE = CHAR_COLS * CHAR_ROWS // 768
/** Pattern Generator size (bytes): 192 patterns × 8. */
export const MC_PATTERN_TABLE_SIZE = 192 * 8 // 1536

/**
 * The fixed framebuffer Name Table: `name[r*32 + c] = (r >> 2)*32 + c`, which
 * makes patterns 0–191 tile the whole screen. Identical for every multicolor
 * screen, so it is emitted once.
 */
export function nameTableBytes(): number[] {
  const out = Array.from<number>({ length: MC_NAME_TABLE_SIZE })
  for (let r = 0; r < CHAR_ROWS; r++) {
    for (let c = 0; c < CHAR_COLS; c++) {
      out[r * CHAR_COLS + c] = (r >> 2) * CHAR_COLS + c
    }
  }
  return out
}

/**
 * The Pattern Generator (1536 bytes) synthesised from a 64×48 colour grid.
 * For char cell (c, r) the two owned bytes sit at offset `2*(r & 3)` within
 * pattern `(r >> 2)*32 + c`; each byte packs two horizontally-adjacent blocks
 * as `(left << 4) | right`.
 */
export function patternTableBytes(cells: number[]): number[] {
  const out = Array.from<number>({ length: MC_PATTERN_TABLE_SIZE }).fill(0)
  const at = (x: number, y: number): number => (cells[y * MC_COLUMNS + x] ?? 0) & 0x0f

  for (let r = 0; r < CHAR_ROWS; r++) {
    for (let c = 0; c < CHAR_COLS; c++) {
      const p = (r >> 2) * CHAR_COLS + c
      const k = 2 * (r & 3)
      const bx = 2 * c // top-left block column
      const by = 2 * r // top-left block row
      out[p * 8 + k] = (at(bx, by) << 4) | at(bx + 1, by)
      out[p * 8 + k + 1] = (at(bx, by + 1) << 4) | at(bx + 1, by + 1)
    }
  }
  return out
}
