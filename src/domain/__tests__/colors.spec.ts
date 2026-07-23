import { describe, expect, it } from 'vitest'
import { colorHex, resolveRowColors } from '../colors'
import { createProject } from '../factory'
import { isGraphics1Colors, isGraphics2Colors } from '../types'

describe('colors', () => {
  describe('colorHex', () => {
    it('maps palette indices to hex', () => {
      expect(colorHex(1)).toBe('#000000')
      expect(colorHex(15)).toBe('#FFFFFF')
    })

    it('returns null for transparent and out-of-range indices', () => {
      expect(colorHex(0)).toBeNull()
      expect(colorHex(16)).toBeNull()
      expect(colorHex(-1)).toBeNull()
    })
  })

  describe('resolveRowColors', () => {
    it('text: one global pair for every row', () => {
      const project = createProject({ name: 'T', type: 'text' })
      project.colors = { fg: 7, bg: 4 }
      const rows = resolveRowColors(project, 0, 123)
      expect(rows).toHaveLength(8)
      expect(rows.every((p) => p.fg === 7 && p.bg === 4)).toBe(true)
    })

    it('graphics1: the pair of the 8-character group', () => {
      const project = createProject({ name: 'G1', type: 'graphics1' })
      if (!isGraphics1Colors(project.colors)) throw new Error('expected graphics1 colors')
      project.colors.groups[2] = { fg: 6, bg: 14 }
      // Characters 16–23 belong to group 2
      expect(resolveRowColors(project, 0, 16)[0]).toEqual({ fg: 6, bg: 14 })
      expect(resolveRowColors(project, 0, 23)[7]).toEqual({ fg: 6, bg: 14 })
      expect(resolveRowColors(project, 0, 24)[0]).toEqual({ fg: 15, bg: 1 })
    })

    it('graphics2: per-row pairs for the character in its charset', () => {
      const project = createProject({ name: 'G2', type: 'graphics2', g2CharsetMode: 'independent' })
      if (!isGraphics2Colors(project.colors)) throw new Error('expected graphics2 colors')
      project.colors.rows[1]![42]![3] = { fg: 2, bg: 13 }
      const rows = resolveRowColors(project, 1, 42)
      expect(rows[3]).toEqual({ fg: 2, bg: 13 })
      expect(rows[0]).toEqual({ fg: 15, bg: 1 })
      // Other charsets are unaffected
      expect(resolveRowColors(project, 0, 42)[3]).toEqual({ fg: 15, bg: 1 })
    })

    it('returns copies that do not alias project state', () => {
      const project = createProject({ name: 'T', type: 'text' })
      const rows = resolveRowColors(project, 0, 0)
      rows[0]!.fg = 3
      expect(resolveRowColors(project, 0, 0)[0]?.fg).toBe(15)
    })
  })
})
