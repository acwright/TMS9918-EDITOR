import { describe, expect, it } from 'vitest'
import { createProject } from '@/domain/factory'
import type { Project, SpriteSize } from '@/domain/types'
import {
  INVISIBLE_HEX,
  INVISIBLE_MARKER_HEX,
  SPRITE_SHEET_SIZE,
  drawSprite,
  fillBackdrop,
  renderFilmstrip,
  renderSpriteFrame,
  renderSpriteSheet,
  sheetColumns,
  spriteColorOf,
  spriteMagOf,
  spriteSizeOf,
} from '../spriteRender'

/** A stub 2D context recording every fill as `[x, y, w, h, style]`. */
function stubContext() {
  const fills: [number, number, number, number, string][] = []
  const ctx = {
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      fills.push([x, y, w, h, ctx.fillStyle])
    },
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills }
}

function spriteProject(size: SpriteSize = 16): Project {
  return createProject({ name: 'S', type: 'sprite', spriteSize: size })
}

/** Pixels (1×1 fills) painted in `style`. */
function pixelsOf(fills: [number, number, number, number, string][], style: string) {
  return fills.filter((f) => f[2] === 1 && f[3] === 1 && f[4] === style).map((f) => [f[0], f[1]])
}

describe('spriteRender', () => {
  it('reads size and magnification defensively', () => {
    expect(spriteSizeOf(spriteProject(16))).toBe(16)
    expect(spriteSizeOf(spriteProject(8))).toBe(8)

    const broken = spriteProject(8)
    delete broken.settings.spriteSize
    delete broken.settings.spriteMag
    expect(spriteSizeOf(broken)).toBe(8)
    expect(spriteMagOf(broken)).toBe(1)
  })

  it('reads a 16×16 sprite colour from the quad base', () => {
    const project = spriteProject(16)
    const colors = project.colors as { sprites: number[] }
    colors.sprites[8] = 3 // slot 2 → patterns 8–11
    colors.sprites[9] = 11 // sibling must be ignored
    expect(spriteColorOf(project, 2)).toBe(3)
  })

  it('draws set pixels from every hardware quadrant at the right coordinates', () => {
    const project = spriteProject(16)
    const charset = project.charsets[0]!
    charset[0] = [0x80, 0, 0, 0, 0, 0, 0, 0] // top-left     → (0, 0)
    charset[1] = [0x80, 0, 0, 0, 0, 0, 0, 0] // bottom-left  → (0, 8)
    charset[2] = [0x80, 0, 0, 0, 0, 0, 0, 0] // top-right    → (8, 0)
    charset[3] = [0x80, 0, 0, 0, 0, 0, 0, 0] // bottom-right → (8, 8)

    const { ctx, fills } = stubContext()
    drawSprite(ctx, project, 0, { color: 15 })

    expect(pixelsOf(fills, '#FFFFFF')).toEqual([
      [0, 0],
      [8, 0],
      [0, 8],
      [8, 8],
    ])
  })

  it('honours the draw origin', () => {
    const project = spriteProject(8)
    project.charsets[0]![5] = [0x80, 0, 0, 0, 0, 0, 0, 0]
    const { ctx, fills } = stubContext()
    drawSprite(ctx, project, 5, { color: 15, originX: 24, originY: 40 })
    expect(pixelsOf(fills, '#FFFFFF')).toEqual([[24, 40]])
  })

  it('leaves clear pixels untouched so the background shows through', () => {
    const project = spriteProject(8)
    project.charsets[0]![0] = [0xff, 0, 0, 0, 0, 0, 0, 0] // one full row only
    const { ctx, fills } = stubContext()
    drawSprite(ctx, project, 0, { color: 15 })
    expect(pixelsOf(fills, '#FFFFFF')).toHaveLength(8)
  })

  it('draws a colour-0 sprite in the out-of-palette grey', () => {
    const project = spriteProject(8)
    project.charsets[0]![0] = [0x80, 0, 0, 0, 0, 0, 0, 0]
    const { ctx, fills } = stubContext()
    drawSprite(ctx, project, 0, { color: 0 })
    expect(pixelsOf(fills, INVISIBLE_HEX)).toEqual([[0, 0]])
  })

  it('ignores an out-of-range slot rather than throwing', () => {
    const { ctx, fills } = stubContext()
    drawSprite(ctx, spriteProject(16), 64, { color: 15 })
    expect(fills).toHaveLength(0)
  })

  it('fills the backdrop over the neutral base, and leaves it bare when transparent', () => {
    const project = spriteProject(8)
    project.settings.backdrop = 4 // Dark Blue
    const opaque = stubContext()
    fillBackdrop(opaque.ctx, project, 32, 32)
    expect(opaque.fills).toEqual([
      [0, 0, 32, 32, '#0a0a0a'],
      [0, 0, 32, 32, '#5955E0'],
    ])

    project.settings.backdrop = 0 // Transparent → neutral only
    const clear = stubContext()
    fillBackdrop(clear.ctx, project, 32, 32)
    expect(clear.fills).toEqual([[0, 0, 32, 32, '#0a0a0a']])
  })

  it('centres the sprite on the stage', () => {
    const project = spriteProject(8)
    project.charsets[0]![0] = [0x80, 0, 0, 0, 0, 0, 0, 0]
    const { ctx, fills } = stubContext()
    renderSpriteFrame(ctx, project, 0, 32)
    // (32 − 8) / 2 = 12
    expect(pixelsOf(fills, '#FFFFFF')).toEqual([[12, 12]])
  })

  describe('renderSpriteSheet', () => {
    it('lays 8×8 slots out 16 across and 16×16 slots 8 across', () => {
      expect(sheetColumns(8)).toBe(16)
      expect(sheetColumns(16)).toBe(8)
      expect(SPRITE_SHEET_SIZE).toBe(128)
    })

    it('places each slot at its grid origin', () => {
      const project = spriteProject(8)
      const charset = project.charsets[0]!
      charset[0] = [0x80, 0, 0, 0, 0, 0, 0, 0] // slot 0  → (0, 0)
      charset[15] = [0x80, 0, 0, 0, 0, 0, 0, 0] // slot 15 → (120, 0), end of row 0
      charset[16] = [0x80, 0, 0, 0, 0, 0, 0, 0] // slot 16 → (0, 8), start of row 1

      const { ctx, fills } = stubContext()
      renderSpriteSheet(ctx, project)

      expect(pixelsOf(fills, '#FFFFFF')).toEqual([
        [0, 0],
        [120, 0],
        [0, 8],
      ])
    })

    it('marks colour-0 slots only when asked', () => {
      const project = spriteProject(8)
      const colors = project.colors as { sprites: number[] }
      colors.sprites[0] = 0

      const plain = stubContext()
      renderSpriteSheet(plain.ctx, project)
      expect(plain.fills.some((f) => f[4] === INVISIBLE_MARKER_HEX)).toBe(false)

      const marked = stubContext()
      renderSpriteSheet(marked.ctx, project, { markInvisible: true })
      expect(marked.fills).toContainEqual([0, 0, 2, 2, INVISIBLE_MARKER_HEX])
    })
  })

  describe('renderFilmstrip', () => {
    it('spaces frames one stage apart, centred in their cell', () => {
      const project = spriteProject(8)
      project.charsets[0]![0] = [0x80, 0, 0, 0, 0, 0, 0, 0]
      project.charsets[0]![1] = [0x80, 0, 0, 0, 0, 0, 0, 0]

      const { ctx, fills } = stubContext()
      renderFilmstrip(ctx, project, [0, 1, 0], 16)

      // (16 − 8) / 2 = 4 offset within each 16px cell
      expect(pixelsOf(fills, '#FFFFFF')).toEqual([
        [4, 4],
        [20, 4],
        [36, 4],
      ])
    })

    it('backs the whole strip, and keeps one stage wide when empty', () => {
      const project = spriteProject(8)
      project.settings.backdrop = 4
      const strip = stubContext()
      renderFilmstrip(strip.ctx, project, [0, 1], 16)
      expect(strip.fills[1]).toEqual([0, 0, 32, 16, '#5955E0'])

      const empty = stubContext()
      renderFilmstrip(empty.ctx, project, [], 16)
      expect(empty.fills[1]).toEqual([0, 0, 16, 16, '#5955E0'])
    })
  })
})
