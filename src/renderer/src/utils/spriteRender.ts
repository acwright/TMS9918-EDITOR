/**
 * Canvas rendering for sprites, shared by the sprite picker, the preview, and
 * (from Phase 28) PNG export. Draws at 1 logical pixel per VDP pixel; callers
 * scale the canvas.
 *
 * Sprites are monochrome: a set bit paints the sprite's colour and a clear bit
 * paints nothing at all, so whatever is behind shows through. Here that is the
 * project's backdrop (PLAN.md Decision 31), matching what the VDP would show
 * over an empty screen.
 */

import { colorHex } from '@/domain/colors'
import { getSpritePixel, isValidSlot, slotToPattern } from '@/domain/sprites'
import type { Project, SpriteSize } from '@/domain/types'
import { renderToScaledCanvas } from './screenRender'

/** ink-950 — transparent (palette 0) shows the app background beneath. */
const NEUTRAL = '#0a0a0a'

/**
 * A colour-0 sprite is invisible on hardware. The picker still has to show its
 * shape, so it draws in this neutral grey — deliberately outside the TMS9918
 * palette so it reads as UI chrome rather than a colour choice.
 */
export const INVISIBLE_HEX = '#4a4a4a'

/** Non-palette magenta marking colour-0 slots, matching CharsetGrid's convention. */
export const INVISIBLE_MARKER_HEX = '#FF00FF'

export interface SpriteDrawOptions {
  /** Palette index the set pixels paint. 0 (transparent) draws as `INVISIBLE_HEX`. */
  color: number
  originX?: number
  originY?: number
}

/** The project's sprite size, defaulting to 8×8 for a malformed settings block. */
export function spriteSizeOf(project: Project): SpriteSize {
  return project.settings.spriteSize === 16 ? 16 : 8
}

/** The project's magnification, defaulting to 1×. */
export function spriteMagOf(project: Project): 1 | 2 {
  return project.settings.spriteMag === 2 ? 2 : 1
}

/**
 * Draw one sprite's set pixels. Clear pixels are left untouched so the caller
 * controls the background (backdrop fill, checkerboard, or another sprite).
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  project: Project,
  slot: number,
  options: SpriteDrawOptions,
): void {
  const size = spriteSizeOf(project)
  const charset = project.charsets[0]
  if (!charset || !isValidSlot(slot, size)) return
  const originX = options.originX ?? 0
  const originY = options.originY ?? 0
  ctx.fillStyle = colorHex(options.color) ?? INVISIBLE_HEX
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!getSpritePixel(charset, slot, size, x, y)) continue
      ctx.fillRect(originX + x, originY + y, 1, 1)
    }
  }
}

/** The palette index a slot paints with (16×16 reads the quad base — Decision 27). */
export function spriteColorOf(project: Project, slot: number): number {
  const colors = project.colors
  if (!('sprites' in colors)) return 15
  return colors.sprites[slotToPattern(slot, spriteSizeOf(project))] ?? 15
}

/** Fill `ctx` with the project's backdrop colour over the neutral base. */
export function fillBackdrop(
  ctx: CanvasRenderingContext2D,
  project: Project,
  width: number,
  height: number,
): void {
  ctx.fillStyle = NEUTRAL
  ctx.fillRect(0, 0, width, height)
  const hex = colorHex(project.settings.backdrop ?? 1)
  if (!hex) return // transparent backdrop → leave the neutral base showing
  ctx.fillStyle = hex
  ctx.fillRect(0, 0, width, height)
}

/**
 * Draw one sprite centred on a backdrop-filled stage of `stage × stage` logical
 * pixels — the preview's single-frame render.
 */
export function renderSpriteFrame(
  ctx: CanvasRenderingContext2D,
  project: Project,
  slot: number,
  stage: number,
): void {
  fillBackdrop(ctx, project, stage, stage)
  const size = spriteSizeOf(project)
  const offset = Math.floor((stage - size) / 2)
  drawSprite(ctx, project, slot, {
    color: spriteColorOf(project, slot),
    originX: offset,
    originY: offset,
  })
}

/** PNG canvas for one sprite frame at `scale`×. */
export function spriteFrameToCanvas(
  project: Project,
  slot: number,
  stage: number,
  scale: number,
): HTMLCanvasElement {
  return renderToScaledCanvas(stage, stage, scale, (ctx) =>
    renderSpriteFrame(ctx, project, slot, stage),
  )
}

/**
 * Side of the square sprite sheet in logical pixels — 16 × 16 slots of 8×8 or
 * 8 × 8 slots of 16×16, so it is 128 either way.
 */
export const SPRITE_SHEET_SIZE = 128

/** Slot columns (and rows) in the sheet at a given sprite size. */
export function sheetColumns(size: SpriteSize): number {
  return SPRITE_SHEET_SIZE / size
}

/**
 * Every sprite slot laid out in a grid over the backdrop, each in its own
 * colour. `markInvisible` adds the picker's colour-0 corner marker; export
 * leaves it off.
 */
export function renderSpriteSheet(
  ctx: CanvasRenderingContext2D,
  project: Project,
  options: { markInvisible?: boolean } = {},
): void {
  const size = spriteSizeOf(project)
  const columns = sheetColumns(size)
  const slots = columns * columns
  fillBackdrop(ctx, project, SPRITE_SHEET_SIZE, SPRITE_SHEET_SIZE)
  for (let slot = 0; slot < slots; slot++) {
    const originX = (slot % columns) * size
    const originY = Math.floor(slot / columns) * size
    const color = spriteColorOf(project, slot)
    drawSprite(ctx, project, slot, { color, originX, originY })
    // Colour 0 is invisible on hardware — mark it so an "empty-looking" slot is
    // distinguishable from one that simply has no pixels set.
    if (color === 0 && options.markInvisible) {
      ctx.fillStyle = INVISIBLE_MARKER_HEX
      ctx.fillRect(originX, originY, 2, 2)
    }
  }
}

/** PNG canvas for the whole sprite sheet at `scale`×. */
export function spriteSheetToCanvas(project: Project, scale: number): HTMLCanvasElement {
  return renderToScaledCanvas(SPRITE_SHEET_SIZE, SPRITE_SHEET_SIZE, scale, (ctx) =>
    renderSpriteSheet(ctx, project),
  )
}

/**
 * An animation's frames left to right, one `stage`-wide cell each, over the
 * backdrop — the film-strip form of a PNG export.
 */
export function renderFilmstrip(
  ctx: CanvasRenderingContext2D,
  project: Project,
  frames: number[],
  stage: number,
): void {
  fillBackdrop(ctx, project, Math.max(stage, frames.length * stage), stage)
  const size = spriteSizeOf(project)
  const offset = Math.floor((stage - size) / 2)
  frames.forEach((slot, i) => {
    drawSprite(ctx, project, slot, {
      color: spriteColorOf(project, slot),
      originX: i * stage + offset,
      originY: offset,
    })
  })
}

/** PNG canvas for an animation film strip at `scale`×. */
export function filmstripToCanvas(
  project: Project,
  frames: number[],
  stage: number,
  scale: number,
): HTMLCanvasElement {
  const width = Math.max(stage, frames.length * stage)
  return renderToScaledCanvas(width, stage, scale, (ctx) =>
    renderFilmstrip(ctx, project, frames, stage),
  )
}
