import { describe, expect, it } from 'vitest'
import { MODES, charsetCount, charsetForRow } from '../modes'

describe('modes', () => {
  it('mode metadata matches the PLAN.md §1 table', () => {
    expect(MODES.text).toMatchObject({ columns: 40, rows: 24, cellWidth: 6, cellCount: 960 })
    expect(MODES.graphics1).toMatchObject({ columns: 32, rows: 24, cellWidth: 8, cellCount: 768 })
    expect(MODES.graphics2).toMatchObject({ columns: 32, rows: 24, cellWidth: 8, cellCount: 768 })
  })

  it('charsetCount is 3 only for independent GMII', () => {
    expect(charsetCount('text')).toBe(1)
    expect(charsetCount('graphics1')).toBe(1)
    expect(charsetCount('graphics2', 'mirrored')).toBe(1)
    expect(charsetCount('graphics2', 'independent')).toBe(3)
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
