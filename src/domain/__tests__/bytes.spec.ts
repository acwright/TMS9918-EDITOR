import { describe, expect, it } from 'vitest'
import { formatBytes, parseBytes } from '../bytes'

const PATTERN = [0x00, 0x3c, 0x42, 0x42, 0x7e, 0x42, 0x42, 0x00]

describe('formatBytes', () => {
  it('renders uppercase, zero-padded hex with $ prefixes', () => {
    expect(formatBytes(PATTERN, 'hex')).toBe('$00, $3C, $42, $42, $7E, $42, $42, $00')
  })

  it('renders plain decimal', () => {
    expect(formatBytes(PATTERN, 'dec')).toBe('0, 60, 66, 66, 126, 66, 66, 0')
  })
})

describe('parseBytes', () => {
  it('round-trips its own hex output', () => {
    expect(parseBytes(formatBytes(PATTERN, 'hex'))).toEqual(PATTERN)
  })

  it('round-trips its own decimal output', () => {
    expect(parseBytes(formatBytes(PATTERN, 'dec'))).toEqual(PATTERN)
  })

  it('reads bare decimal (BASIC) values', () => {
    expect(parseBytes('0, 60, 66, 66, 126, 66, 66, 0')).toEqual(PATTERN)
  })

  it('reads hex with $, 0x, or bare hex letters', () => {
    expect(parseBytes('$00, 0x3C, 42, 42, 7E, 42, 42, 00')).toEqual(PATTERN)
  })

  it('tolerates messy whitespace and newline separators', () => {
    expect(parseBytes('  $00\n$3C  $42,$42 , $7E,$42,$42,$00 ')).toEqual(PATTERN)
  })

  it('strips a leading ca65 .byte directive', () => {
    expect(parseBytes('.byte $00, $3C, $42, $42, $7E, $42, $42, $00')).toEqual(PATTERN)
  })

  it('strips a leading Z80 db directive', () => {
    expect(parseBytes('db 0,60,66,66,126,66,66,0')).toEqual(PATTERN)
  })

  it('strips a BASIC line number and DATA keyword', () => {
    expect(parseBytes('1000 DATA 0,60,66,66,126,66,66,0')).toEqual(PATTERN)
  })

  it('rejects the wrong number of bytes', () => {
    expect(parseBytes('$3C, $42')).toBeNull()
    expect(parseBytes('1,2,3,4,5,6,7,8,9')).toBeNull()
  })

  it('rejects out-of-range values', () => {
    expect(parseBytes('0,60,66,66,126,66,66,256')).toBeNull()
    expect(parseBytes('$00,$3C,$42,$42,$7E,$42,$42,$1FF')).toBeNull()
  })

  it('rejects non-numeric tokens', () => {
    expect(parseBytes('0,60,66,xy,126,66,66,0')).toBeNull()
  })
})
