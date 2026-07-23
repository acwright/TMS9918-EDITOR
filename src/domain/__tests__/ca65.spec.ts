import { describe, expect, it } from 'vitest'
import { formatCharBytes } from '../ca65'

describe('ca65', () => {
  it('formats a character as a .byte directive with uppercase hex', () => {
    expect(formatCharBytes([0x00, 0x3c, 0x42, 0x42, 0x7e, 0x42, 0x42, 0x00])).toBe(
      '.byte $00, $3C, $42, $42, $7E, $42, $42, $00',
    )
  })

  it('zero-pads single-digit bytes', () => {
    expect(formatCharBytes([0, 1, 10, 15, 16, 128, 255, 5])).toBe(
      '.byte $00, $01, $0A, $0F, $10, $80, $FF, $05',
    )
  })
})
