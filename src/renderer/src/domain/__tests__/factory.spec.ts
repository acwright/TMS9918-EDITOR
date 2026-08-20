import { describe, expect, it } from 'vitest'
import { blankCharset, blankPattern, createProject } from '../factory'
import { CHAR_BYTES, CHAR_COUNT, COLOR_GROUP_COUNT, MODES } from '../modes'
import {
  isGraphics1Colors,
  isGraphics2Colors,
  isMulticolorColors,
  isSpriteColors,
  isTextColors,
} from '../types'
import { SPRITE_PATTERN_COUNT } from '../sprites'

describe('factory', () => {
  it('blankPattern is 8 zero bytes', () => {
    expect(blankPattern()).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('blankCharset is 256 distinct blank patterns', () => {
    const charset = blankCharset()
    expect(charset).toHaveLength(CHAR_COUNT)
    expect(charset[0]).toEqual(blankPattern())
    expect(charset[0]).not.toBe(charset[1]) // no shared references
  })

  it('creates a text project', () => {
    const p = createProject({ name: 'Test', type: 'text' })
    expect(p.version).toBe(1)
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(p.name).toBe('Test')
    expect(p.type).toBe('text')
    expect(Date.parse(p.createdAt)).not.toBeNaN()
    expect(p.modifiedAt).toBe(p.createdAt)
    expect(p.settings).toEqual({})
    expect(p.charsets).toHaveLength(1)
    expect(isTextColors(p.colors) && p.colors).toEqual({ fg: 15, bg: 1 })
    expect(p.screens).toHaveLength(1)
    expect(p.screens[0]?.name).toBe('Screen 1')
    expect(p.screens[0]?.cells).toEqual(Array.from({ length: MODES.text.cellCount }, () => 0))
  })

  it('creates a graphics1 project with 32 color groups', () => {
    const p = createProject({ name: 'G1', type: 'graphics1' })
    expect(p.charsets).toHaveLength(1)
    expect(p.screens[0]?.cells).toHaveLength(MODES.graphics1.cellCount)
    if (!isGraphics1Colors(p.colors)) throw new Error('expected graphics1 colors')
    expect(p.colors.groups).toHaveLength(COLOR_GROUP_COUNT)
    expect(p.colors.groups[0]).toEqual({ fg: 15, bg: 1 })
    expect(p.colors.groups[0]).not.toBe(p.colors.groups[1]) // no shared references
  })

  it('creates a mirrored graphics2 project by default', () => {
    const p = createProject({ name: 'G2', type: 'graphics2' })
    expect(p.settings.g2CharsetMode).toBe('mirrored')
    expect(p.charsets).toHaveLength(1)
    if (!isGraphics2Colors(p.colors)) throw new Error('expected graphics2 colors')
    expect(p.colors.rows).toHaveLength(1)
    expect(p.colors.rows[0]).toHaveLength(CHAR_COUNT)
    expect(p.colors.rows[0]?.[0]).toHaveLength(CHAR_BYTES)
    expect(p.colors.rows[0]?.[0]?.[0]).toEqual({ fg: 15, bg: 1 })
  })

  it('creates an independent graphics2 project with 3 charsets', () => {
    const p = createProject({ name: 'G2i', type: 'graphics2', g2CharsetMode: 'independent' })
    expect(p.settings.g2CharsetMode).toBe('independent')
    expect(p.charsets).toHaveLength(3)
    expect(p.charsets[0]).not.toBe(p.charsets[1]) // no shared references
    if (!isGraphics2Colors(p.colors)) throw new Error('expected graphics2 colors')
    expect(p.colors.rows).toHaveLength(3)
  })

  it('creates a multicolor project with no charsets and an empty colour table', () => {
    const p = createProject({ name: 'MC', type: 'multicolor' })
    expect(p.type).toBe('multicolor')
    expect(p.charsets).toEqual([])
    expect(isMulticolorColors(p.colors) && p.colors).toEqual({})
    expect(p.settings).toEqual({ backdrop: 1 })
    expect(p.screens).toHaveLength(1)
    expect(p.screens[0]?.cells).toEqual(Array.from({ length: MODES.multicolor.cellCount }, () => 0))
    expect(MODES.multicolor.cellCount).toBe(3072)
  })

  it('creates an 8×8 sprite project with one pattern table and no screens', () => {
    const p = createProject({ name: 'SP', type: 'sprite' })
    expect(p.type).toBe('sprite')
    expect(p.charsets).toHaveLength(1)
    expect(p.charsets[0]).toHaveLength(CHAR_COUNT)
    expect(p.settings).toEqual({ backdrop: 1, spriteSize: 8, spriteMag: 1 })
    expect(p.screens).toEqual([])
    if (!isSpriteColors(p.colors)) throw new Error('expected sprite colors')
    expect(p.colors.sprites).toHaveLength(SPRITE_PATTERN_COUNT)
    expect(p.colors.sprites.every((c) => c === 15)).toBe(true)
    expect(p.animations).toEqual([{ name: 'Animation 1', frames: [0], fps: 8 }])
  })

  it('honours the requested sprite size', () => {
    const p = createProject({ name: 'SP16', type: 'sprite', spriteSize: 16 })
    expect(p.settings.spriteSize).toBe(16)
    // The pattern table is the same size either way — only the grouping changes.
    expect(p.charsets[0]).toHaveLength(CHAR_COUNT)
  })

  it('does not narrow sprite colors as multicolor', () => {
    const p = createProject({ name: 'SP', type: 'sprite' })
    expect(isSpriteColors(p.colors)).toBe(true)
    expect(isMulticolorColors(p.colors)).toBe(false)
  })

  it('adds animations only to sprite projects', () => {
    for (const type of ['text', 'graphics1', 'graphics2', 'multicolor'] as const) {
      expect(createProject({ name: type, type }).animations).toBeUndefined()
    }
  })

  it('ignores spriteSize for non-sprite modes', () => {
    const p = createProject({ name: 'T', type: 'text', spriteSize: 16 })
    expect(p.settings).toEqual({})
  })

  it('ignores g2CharsetMode for non-graphics2 modes', () => {
    const p = createProject({ name: 'T', type: 'text', g2CharsetMode: 'independent' })
    expect(p.settings).toEqual({})
    expect(p.charsets).toHaveLength(1)
  })

  it('generates unique ids', () => {
    const a = createProject({ name: 'A', type: 'text' })
    const b = createProject({ name: 'B', type: 'text' })
    expect(a.id).not.toBe(b.id)
  })
})
