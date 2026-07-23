import { describe, expect, it } from 'vitest'
import * as charOps from '../charOps'

/** Pattern with a single pixel at (x, y). */
function single(x: number, y: number): number[] {
  const p = charOps.clear()
  p[y] = 0x80 >> x
  return p
}

describe('charOps', () => {
  describe('getPixel / setPixel', () => {
    it('sets and reads a pixel', () => {
      const p = charOps.setPixel(charOps.clear(), 1, 2, true)
      expect(p).toEqual(single(1, 2))
      expect(charOps.getPixel(p, 1, 2)).toBe(true)
      expect(charOps.getPixel(p, 2, 1)).toBe(false)
    })

    it('clears a pixel', () => {
      const p = charOps.setPixel(charOps.fill(), 0, 0, false)
      expect(p[0]).toBe(0x7f)
      expect(charOps.getPixel(p, 0, 0)).toBe(false)
    })

    it('does not mutate its input', () => {
      const before = charOps.clear()
      charOps.setPixel(before, 3, 3, true)
      expect(before).toEqual(charOps.clear())
    })

    it('MSB is the leftmost pixel', () => {
      expect(charOps.getPixel([0x80, 0, 0, 0, 0, 0, 0, 0], 0, 0)).toBe(true)
      expect(charOps.getPixel([0x01, 0, 0, 0, 0, 0, 0, 0], 7, 0)).toBe(true)
    })
  })

  describe('fill / clear / invert', () => {
    it('fill is all 0xFF', () => {
      expect(charOps.fill()).toEqual([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])
    })

    it('clear is all 0x00', () => {
      expect(charOps.clear()).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
    })

    it('invert flips every bit', () => {
      expect(charOps.invert(charOps.clear())).toEqual(charOps.fill())
      expect(charOps.invert([0xf0, 0x0f, 0xaa, 0x55, 0, 0xff, 0x01, 0x80])).toEqual([
        0x0f, 0xf0, 0x55, 0xaa, 0xff, 0, 0xfe, 0x7f,
      ])
    })

    it('double invert is identity', () => {
      const p = [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0]
      expect(charOps.invert(charOps.invert(p))).toEqual(p)
    })
  })

  describe('shifts (wrapping)', () => {
    it('shiftLeft moves pixels left and wraps column 0 to 7', () => {
      expect(charOps.shiftLeft(single(1, 2))).toEqual(single(0, 2))
      expect(charOps.shiftLeft(single(0, 2))).toEqual(single(7, 2))
    })

    it('shiftRight moves pixels right and wraps column 7 to 0', () => {
      expect(charOps.shiftRight(single(1, 2))).toEqual(single(2, 2))
      expect(charOps.shiftRight(single(7, 2))).toEqual(single(0, 2))
    })

    it('shiftUp moves rows up and wraps row 0 to 7', () => {
      expect(charOps.shiftUp(single(1, 2))).toEqual(single(1, 1))
      expect(charOps.shiftUp(single(1, 0))).toEqual(single(1, 7))
    })

    it('shiftDown moves rows down and wraps row 7 to 0', () => {
      expect(charOps.shiftDown(single(1, 2))).toEqual(single(1, 3))
      expect(charOps.shiftDown(single(1, 7))).toEqual(single(1, 0))
    })

    it('opposite shifts cancel', () => {
      const p = [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0]
      expect(charOps.shiftRight(charOps.shiftLeft(p))).toEqual(p)
      expect(charOps.shiftDown(charOps.shiftUp(p))).toEqual(p)
    })
  })

  describe('flips', () => {
    it('flipH mirrors left-right', () => {
      expect(charOps.flipH(single(1, 2))).toEqual(single(6, 2))
      expect(charOps.flipH([0xf0, 0, 0, 0, 0, 0, 0, 0])).toEqual([0x0f, 0, 0, 0, 0, 0, 0, 0])
    })

    it('flipV mirrors top-bottom', () => {
      expect(charOps.flipV(single(1, 2))).toEqual(single(1, 5))
    })

    it('double flip is identity', () => {
      const p = [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0]
      expect(charOps.flipH(charOps.flipH(p))).toEqual(p)
      expect(charOps.flipV(charOps.flipV(p))).toEqual(p)
    })
  })

  describe('rotations', () => {
    it('rotateRight moves (x, y) to (7 − y, x)', () => {
      expect(charOps.rotateRight(single(1, 2))).toEqual(single(5, 1))
      expect(charOps.rotateRight(single(0, 0))).toEqual(single(7, 0))
    })

    it('rotateLeft moves (x, y) to (y, 7 − x)', () => {
      expect(charOps.rotateLeft(single(1, 2))).toEqual(single(2, 6))
      expect(charOps.rotateLeft(single(0, 0))).toEqual(single(0, 7))
    })

    it('rotateLeft undoes rotateRight', () => {
      const p = [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0]
      expect(charOps.rotateLeft(charOps.rotateRight(p))).toEqual(p)
    })

    it('four rotations are identity', () => {
      const p = [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0]
      let q = p
      for (let i = 0; i < 4; i++) q = charOps.rotateRight(q)
      expect(q).toEqual(p)
    })
  })
})
