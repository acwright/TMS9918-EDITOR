import { describe, expect, it } from 'vitest'
import { blankCharset, blankPattern, createProject } from '../factory'
import { CHAR_BYTES, CHAR_COUNT, COLOR_GROUP_COUNT, MODES } from '../modes'
import { isGraphics1Colors, isGraphics2Colors, isTextColors } from '../types'

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
