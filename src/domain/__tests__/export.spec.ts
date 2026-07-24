import { describe, expect, it } from 'vitest'
import { createProject } from '../factory'
import {
  ASM_DIALECTS,
  charsetSegments,
  colorTableBytes,
  multicolorScreenSegments,
  nameTableBytes,
  patternTableBytes,
  screenSegments,
  segmentsToAsm,
  segmentsToBasic,
  segmentsToBinary,
  type ByteSegment,
} from '../export'
import { MC_COLUMNS } from '../multicolor'
import { isGraphics1Colors, isGraphics2Colors, isTextColors } from '../types'

describe('table extraction', () => {
  it('flattens a pattern table to 2048 bytes', () => {
    const project = createProject({ name: 'Test', type: 'graphics1' })
    project.charsets[0]![1] = [0x00, 0x3c, 0x42, 0x42, 0x7e, 0x42, 0x42, 0x00]
    const bytes = patternTableBytes(project, 0)
    expect(bytes.length).toBe(256 * 8)
    expect(bytes.slice(8, 16)).toEqual([0x00, 0x3c, 0x42, 0x42, 0x7e, 0x42, 0x42, 0x00])
  })

  it('packs Text-mode colour into one (fg<<4)|bg byte', () => {
    const project = createProject({ name: 'T', type: 'text' })
    if (!isTextColors(project.colors)) throw new Error('expected text colors')
    project.colors.fg = 15
    project.colors.bg = 4
    expect(colorTableBytes(project, 0)).toEqual([0xf4])
  })

  it('packs Graphics I colour into 32 group bytes', () => {
    const project = createProject({ name: 'G1', type: 'graphics1' })
    if (!isGraphics1Colors(project.colors)) throw new Error('expected g1 colors')
    project.colors.groups[0] = { fg: 2, bg: 1 }
    const bytes = colorTableBytes(project, 0)
    expect(bytes.length).toBe(32)
    expect(bytes[0]).toBe(0x21)
  })

  it('packs Graphics II colour into 2048 per-row bytes', () => {
    const project = createProject({ name: 'G2', type: 'graphics2' })
    if (!isGraphics2Colors(project.colors)) throw new Error('expected g2 colors')
    project.colors.rows[0]![0]![0] = { fg: 7, bg: 5 }
    const bytes = colorTableBytes(project, 0)
    expect(bytes.length).toBe(256 * 8)
    expect(bytes[0]).toBe(0x75)
  })

  it('reads a screen name table', () => {
    const project = createProject({ name: 'S', type: 'graphics1' })
    project.screens[0]!.cells[0] = 65
    const bytes = nameTableBytes(project, 0)
    expect(bytes.length).toBe(32 * 24)
    expect(bytes[0]).toBe(65)
  })
})

describe('charsetSegments', () => {
  it('emits pattern then colour for a single-set mode with no set suffix', () => {
    const project = createProject({ name: 'G1', type: 'graphics1' })
    const segs = charsetSegments(project, { sets: [0], patterns: true, colors: true })
    expect(segs.map((s) => s.label)).toEqual(['char_patterns', 'char_colors'])
  })

  it('suffixes labels and groups by table type for independent GMII', () => {
    const project = createProject({ name: 'G2', type: 'graphics2', g2CharsetMode: 'independent' })
    const segs = charsetSegments(project, { sets: [0, 1, 2], patterns: true, colors: true })
    expect(segs.map((s) => s.label)).toEqual([
      'char_patterns_1',
      'char_patterns_2',
      'char_patterns_3',
      'char_colors_1',
      'char_colors_2',
      'char_colors_3',
    ])
  })

  it('honours the table toggles', () => {
    const project = createProject({ name: 'G1', type: 'graphics1' })
    const segs = charsetSegments(project, { sets: [0], patterns: false, colors: true })
    expect(segs.map((s) => s.label)).toEqual(['char_colors'])
  })
})

describe('screenSegments', () => {
  it('produces one segment per selected screen at column width', () => {
    const project = createProject({ name: 'S', type: 'text' })
    const [seg] = screenSegments(project, [0])
    expect(seg!.label).toBe('screen_1')
    expect(seg!.perLine).toBe(40)
    expect(seg!.bytes.length).toBe(40 * 24)
  })
})

describe('multicolorScreenSegments', () => {
  it('emits one Pattern Generator (1536 B) + the shared Name Table (768 B) for one screen', () => {
    const project = createProject({ name: 'MC', type: 'multicolor' })
    const segs = multicolorScreenSegments(project, [0])
    expect(segs.map((s) => s.label)).toEqual(['mc_patterns', 'mc_names'])
    expect(segs[0]!.bytes.length).toBe(1536)
    expect(segs[1]!.bytes.length).toBe(768)
    // Fixed framebuffer name table runs 0…191.
    expect(segs[1]!.bytes[0]).toBe(0)
    expect(segs[1]!.bytes[767]).toBe(191)
  })

  it('suffixes pattern labels per screen and keeps a single shared name table', () => {
    const project = createProject({ name: 'MC', type: 'multicolor' })
    project.screens.push({ name: 'Screen 2', cells: [...project.screens[0]!.cells] })
    const segs = multicolorScreenSegments(project, [0, 1])
    expect(segs.map((s) => s.label)).toEqual(['mc_patterns_1', 'mc_patterns_2', 'mc_names'])
  })

  it('packs a painted block into the pattern generator', () => {
    const project = createProject({ name: 'MC', type: 'multicolor' })
    // block (0,0) top-left, block (1,0) top-right of char cell (0,0).
    project.screens[0]!.cells[0] = 5
    project.screens[0]!.cells[1] = 7
    const [patterns] = multicolorScreenSegments(project, [0])
    expect(patterns!.bytes[0]).toBe((5 << 4) | 7)
  })

  it('screenSegments dispatches to the multicolor builder for multicolor projects', () => {
    const project = createProject({ name: 'MC', type: 'multicolor' })
    project.screens[0]!.cells[MC_COLUMNS] = 9 // block (0,1)
    const segs = screenSegments(project, [0])
    expect(segs.map((s) => s.label)).toEqual(['mc_patterns', 'mc_names'])
  })
})

const SAMPLE: ByteSegment[] = [
  { label: 'char_patterns', description: 'Character patterns', bytes: [0, 60, 66, 255], perLine: 4 },
]

describe('segmentsToAsm', () => {
  it('renders ca65 .byte lines with a header and label', () => {
    const out = segmentsToAsm(SAMPLE, ASM_DIALECTS.ca65, 'My Project — Graphics Mode I')
    expect(out).toContain('; My Project — Graphics Mode I')
    expect(out).toContain('char_patterns:')
    expect(out).toContain('    .byte $00, $3C, $42, $FF')
  })

  it('renders Z80 db lines', () => {
    const out = segmentsToAsm(SAMPLE, ASM_DIALECTS.z80, 'X')
    expect(out).toContain('    db $00, $3C, $42, $FF')
  })
})

describe('segmentsToBasic', () => {
  it('numbers REM and DATA lines from the start line by the step', () => {
    const out = segmentsToBasic(SAMPLE, { startLine: 1000, step: 10 }, 'X')
    const lines = out.trimEnd().split('\n')
    expect(lines).toEqual(['1000 REM X', '1010 REM CHARACTER PATTERNS', '1020 DATA 0,60,66,255'])
  })
})

describe('segmentsToBinary', () => {
  it('concatenates all segment bytes', () => {
    const two: ByteSegment[] = [
      { label: 'a', description: 'a', bytes: [1, 2, 3], perLine: 8 },
      { label: 'b', description: 'b', bytes: [4, 5], perLine: 8 },
    ]
    expect(Array.from(segmentsToBinary(two))).toEqual([1, 2, 3, 4, 5])
  })
})
