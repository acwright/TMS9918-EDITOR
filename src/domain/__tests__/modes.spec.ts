import { describe, expect, it } from 'vitest'
import { MODES, PROJECT_TYPES, charsetCount, charsetForRow, isProjectType } from '../modes'

describe('modes', () => {
  it('mode metadata matches the PLAN.md §1 table', () => {
    expect(MODES.text).toMatchObject({ columns: 40, rows: 24, cellWidth: 6, cellCount: 960 })
    expect(MODES.graphics1).toMatchObject({ columns: 32, rows: 24, cellWidth: 8, cellCount: 768 })
    expect(MODES.graphics2).toMatchObject({ columns: 32, rows: 24, cellWidth: 8, cellCount: 768 })
    expect(MODES.multicolor).toMatchObject({
      columns: 64,
      rows: 48,
      cellWidth: 4,
      cellHeight: 4,
      cellCount: 3072,
    })
    expect(MODES.sprite).toMatchObject({
      columns: 0,
      rows: 0,
      cellWidth: 8,
      cellHeight: 8,
      cellCount: 0,
    })
  })

  it('flags sprite as the only mode without a screen', () => {
    expect(MODES.text.hasScreen).toBe(true)
    expect(MODES.graphics1.hasScreen).toBe(true)
    expect(MODES.graphics2.hasScreen).toBe(true)
    expect(MODES.multicolor.hasScreen).toBe(true)
    expect(MODES.sprite.hasScreen).toBe(false)
  })

  describe('PROJECT_TYPES', () => {
    it('lists every mode in MODES', () => {
      expect(PROJECT_TYPES).toEqual(['text', 'graphics1', 'graphics2', 'multicolor', 'sprite'])
    })

    it('recognises every type and rejects everything else', () => {
      for (const type of PROJECT_TYPES) expect(isProjectType(type)).toBe(true)
      expect(isProjectType('graphics3')).toBe(false)
      expect(isProjectType('')).toBe(false)
      expect(isProjectType(undefined)).toBe(false)
      expect(isProjectType(7)).toBe(false)
      // Prototype members must not pass as modes.
      expect(isProjectType('toString')).toBe(false)
      expect(isProjectType('constructor')).toBe(false)
    })
  })

  it('charsetCount is 3 only for independent GMII, 0 for multicolor, 1 for sprite', () => {
    expect(charsetCount('text')).toBe(1)
    expect(charsetCount('graphics1')).toBe(1)
    expect(charsetCount('graphics2', 'mirrored')).toBe(1)
    expect(charsetCount('graphics2', 'independent')).toBe(3)
    expect(charsetCount('multicolor')).toBe(0)
    expect(charsetCount('sprite')).toBe(1)
  })

  describe('charsetForRow', () => {
    it('independent GMII splits the screen into thirds', () => {
      expect(charsetForRow('graphics2', 'independent', 0)).toBe(0)
      expect(charsetForRow('graphics2', 'independent', 7)).toBe(0)
      expect(charsetForRow('graphics2', 'independent', 8)).toBe(1)
      expect(charsetForRow('graphics2', 'independent', 15)).toBe(1)
      expect(charsetForRow('graphics2', 'independent', 16)).toBe(2)
      expect(charsetForRow('graphics2', 'independent', 23)).toBe(2)
    })

    it('everything else renders from set 0', () => {
      expect(charsetForRow('graphics2', 'mirrored', 20)).toBe(0)
      expect(charsetForRow('graphics1', undefined, 20)).toBe(0)
      expect(charsetForRow('text', undefined, 20)).toBe(0)
    })
  })
})
