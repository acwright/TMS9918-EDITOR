/**
 * Canvas rendering shared by the live screen editor (ScreenCanvas.vue) and PNG
 * export. Draws at 1 logical pixel per VDP pixel; callers scale the canvas.
 */

import * as charOps from '@/domain/charOps'
import * as screenOps from '@/domain/screenOps'
import { colorHex, resolveRowColors } from '@/domain/colors'
import { MODES, charsetForRow } from '@/domain/modes'
import type { Project, Screen } from '@/domain/types'

/** ink-950 — transparent (palette 0) shows the app background beneath. */
const NEUTRAL = '#0a0a0a'

/** Draw one screen into `ctx` at logical size (origin 0,0). */
export function renderScreen(ctx: CanvasRenderingContext2D, project: Project, screen: Screen): void {
  if (project.type === 'multicolor') {
    renderMulticolorScreen(ctx, project, screen)
    return
  }
  const { columns, rows, cellWidth, cellHeight } = MODES[project.type]
  ctx.fillStyle = NEUTRAL
  ctx.fillRect(0, 0, columns * cellWidth, rows * cellHeight)
  for (let cy = 0; cy < rows; cy++) {
    // Independent GMII renders each screen third from its own charset
    const charsetIndex = charsetForRow(project.type, project.settings.g2CharsetMode, cy)
    for (let cx = 0; cx < columns; cx++) {
      const code = screenOps.getCell(screen.cells, columns, cx, cy)
      const pattern = project.charsets[charsetIndex]?.[code]
      if (!pattern) continue
      const rowColors = resolveRowColors(project, charsetIndex, code)
      drawCell(ctx, pattern, rowColors, cx * cellWidth, cy * cellHeight, cellWidth)
    }
  }
}

/**
 * Multicolor: each cell is a solid 4×4 block of one palette colour; transparent
 * blocks (index 0) show the backdrop (`settings.backdrop`, itself possibly
 * transparent → neutral base). See PLAN.md §10.
 */
export function renderMulticolorScreen(
  ctx: CanvasRenderingContext2D,
  project: Project,
  screen: Screen,
): void {
  const { columns, rows, cellWidth, cellHeight } = MODES.multicolor
  const width = columns * cellWidth
  const height = rows * cellHeight
  ctx.fillStyle = NEUTRAL
  ctx.fillRect(0, 0, width, height)
  const backdropHex = colorHex(project.settings.backdrop ?? 1)
  if (backdropHex) {
    ctx.fillStyle = backdropHex
    ctx.fillRect(0, 0, width, height)
  }
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < columns; cx++) {
      const index = screenOps.getCell(screen.cells, columns, cx, cy)
      if (index === 0) continue // transparent → backdrop already drawn
      const hex = colorHex(index)
      if (!hex) continue
      ctx.fillStyle = hex
      ctx.fillRect(cx * cellWidth, cy * cellHeight, cellWidth, cellHeight)
    }
  }
}

/** Draw a 16×16 sheet of a charset's 256 glyphs into `ctx` (8×8 logical cells). */
export function renderCharsetSheet(
  ctx: CanvasRenderingContext2D,
  project: Project,
  setIndex: number,
): void {
  const charset = project.charsets[setIndex] ?? []
  ctx.fillStyle = NEUTRAL
  ctx.fillRect(0, 0, CHARSET_SHEET_COLS * 8, CHARSET_SHEET_COLS * 8)
  for (let code = 0; code < charset.length; code++) {
    const pattern = charset[code]
    if (!pattern) continue
    const rowColors = resolveRowColors(project, setIndex, code)
    const col = code % CHARSET_SHEET_COLS
    const row = Math.floor(code / CHARSET_SHEET_COLS)
    drawCell(ctx, pattern, rowColors, col * 8, row * 8, 8)
  }
}

/** Columns (and rows) in the exported charset sheet — 16×16 covers 256 glyphs. */
export const CHARSET_SHEET_COLS = 16

function drawCell(
  ctx: CanvasRenderingContext2D,
  pattern: number[],
  rowColors: { fg: number; bg: number }[],
  originX: number,
  originY: number,
  width: number,
): void {
  for (let y = 0; y < 8; y++) {
    const pair = rowColors[y]
    for (let x = 0; x < width; x++) {
      const index = charOps.getPixel(pattern, x, y) ? (pair?.fg ?? 15) : (pair?.bg ?? 1)
      const hex = colorHex(index)
      if (!hex) continue // transparent → neutral base coat
      ctx.fillStyle = hex
      ctx.fillRect(originX + x, originY + y, 1, 1)
    }
  }
}

/**
 * Render a screen (or charset sheet) to a fresh, upscaled canvas for PNG
 * export. Smoothing is off so the pixels stay crisp.
 */
export function renderToScaledCanvas(
  logicalWidth: number,
  logicalHeight: number,
  scale: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const base = document.createElement('canvas')
  base.width = logicalWidth
  base.height = logicalHeight
  const baseCtx = base.getContext('2d')
  if (!baseCtx) throw new Error('2D canvas context unavailable')
  draw(baseCtx)

  const out = document.createElement('canvas')
  out.width = logicalWidth * scale
  out.height = logicalHeight * scale
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(base, 0, 0, out.width, out.height)
  return out
}

/** PNG canvas for one screen at `scale`× (logical VDP pixels → CSS pixels). */
export function screenToCanvas(project: Project, screen: Screen, scale: number): HTMLCanvasElement {
  const { columns, rows, cellWidth, cellHeight } = MODES[project.type]
  return renderToScaledCanvas(columns * cellWidth, rows * cellHeight, scale, (ctx) =>
    renderScreen(ctx, project, screen),
  )
}

/** PNG canvas for a charset sheet at `scale`× (16×16 grid of 8×8 glyphs). */
export function charsetSheetToCanvas(
  project: Project,
  setIndex: number,
  scale: number,
): HTMLCanvasElement {
  const size = CHARSET_SHEET_COLS * 8
  return renderToScaledCanvas(size, size, scale, (ctx) =>
    renderCharsetSheet(ctx, project, setIndex),
  )
}
