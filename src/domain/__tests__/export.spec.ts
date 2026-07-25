import { describe, expect, it } from 'vitest'
import { createProject } from '../factory'
import {
  ASM_DIALECTS,
  LABEL_CASES,
  applyLabelCase,
  charsetSegments,
  colorTableBytes,
  multicolorScreenSegments,
  nameTableBytes,
  patternTableBytes,
  screenSegments,
  segmentsToAsm,
  segmentsToBasic,
  segmentsToBinary,
  spriteColorBytes,
  spriteFrameBytes,
  spritePatternBytes,
  spriteSegments,
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

describe('spriteSegments', () => {
  const sprite = (size: 8 | 16 = 16) => createProject({ name: 'S', type: 'sprite', spriteSize: size })
  const ALL = { patterns: true, colors: true, animations: [] as number[] }

  it('emits the full 2048-byte pattern table, unreordered', () => {
    const project = sprite(16)
    // Slot 1 = patterns 4–7; write the bottom-right quadrant (pattern 7).
    project.charsets[0]![7] = [0x80, 0, 0, 0, 0, 0, 0, 0]
    const [patterns] = spriteSegments(project, ALL)

    expect(patterns!.label).toBe('sprite_patterns')
    expect(patterns!.bytes).toHaveLength(2048)
    expect(patterns!.perLine).toBe(8)
    // Byte order is hardware order, so pattern 7 starts at offset 56.
    expect(patterns!.bytes[56]).toBe(0x80)
    expect(spritePatternBytes(project)).toEqual(patterns!.bytes)
  })

  it('emits one colour byte per slot — 256 at 8×8, 64 at 16×16', () => {
    const eight = sprite(8)
    expect(spriteColorBytes(eight)).toHaveLength(256)

    const sixteen = sprite(16)
    const colors = sixteen.colors as { sprites: number[] }
    colors.sprites[4] = 2 // slot 1's quad base
    colors.sprites[5] = 9 // sibling — must not be emitted
    const bytes = spriteColorBytes(sixteen)
    expect(bytes).toHaveLength(64)
    expect(bytes[1]).toBe(2)
  })

  it('masks the colour byte to the low nibble, leaving the early-clock bit clear', () => {
    const project = sprite(8)
    const colors = project.colors as { sprites: number[] }
    colors.sprites[0] = 15
    const [, colorSeg] = spriteSegments(project, ALL)
    expect(colorSeg!.label).toBe('sprite_colors')
    expect(colorSeg!.bytes[0]).toBe(0x0f)
    expect(colorSeg!.bytes.every((b) => (b & 0x80) === 0)).toBe(true)
  })

  it('emits animation frames as SAT pattern names (slot × 4 at 16×16)', () => {
    const project = sprite(16)
    project.animations = [{ name: 'Walk Cycle', frames: [0, 1, 2, 1], fps: 12 }]
    const segs = spriteSegments(project, { ...ALL, animations: [0] })
    const anim = segs[segs.length - 1]!

    expect(anim.label).toBe('sprite_anim_walk_cycle')
    expect(anim.bytes).toEqual([0, 4, 8, 4])
    expect(anim.description).toContain('4 frames @ 12 fps')
  })

  it('emits the slot itself as the pattern name at 8×8', () => {
    const project = sprite(8)
    project.animations = [{ name: 'A', frames: [0, 5, 200], fps: 8 }]
    expect(spriteFrameBytes(project, 0)).toEqual([0, 5, 200])
  })

  it('skips empty animations rather than emitting a zero-byte segment', () => {
    const project = sprite(8)
    project.animations = [
      { name: 'Empty', frames: [], fps: 8 },
      { name: 'Real', frames: [1], fps: 8 },
    ]
    const segs = spriteSegments(project, { ...ALL, animations: [0, 1] })
    expect(segs.map((s) => s.label)).toEqual([
      'sprite_patterns',
      'sprite_colors',
      'sprite_anim_real',
    ])
  })

  it('de-duplicates labels when animations slugify the same', () => {
    const project = sprite(8)
    project.animations = [
      { name: 'Walk', frames: [1], fps: 8 },
      { name: 'walk!', frames: [2], fps: 8 },
      { name: 'WALK', frames: [3], fps: 8 },
    ]
    const segs = spriteSegments(project, { patterns: false, colors: false, animations: [0, 1, 2] })
    expect(segs.map((s) => s.label)).toEqual([
      'sprite_anim_walk',
      'sprite_anim_walk_2',
      'sprite_anim_walk_3',
    ])
  })

  it('honours the table toggles', () => {
    const project = sprite(8)
    project.animations = [{ name: 'A', frames: [1], fps: 8 }]
    expect(
      spriteSegments(project, { patterns: false, colors: true, animations: [] }).map((s) => s.label),
    ).toEqual(['sprite_colors'])
    expect(
      spriteSegments(project, { patterns: true, colors: false, animations: [0] }).map(
        (s) => s.label,
      ),
    ).toEqual(['sprite_patterns', 'sprite_anim_a'])
    expect(spriteSegments(project, { patterns: false, colors: false, animations: [] })).toEqual([])
  })

  it('renders through the existing assembly pipeline with label casing', () => {
    const project = sprite(16)
    project.animations = [{ name: 'Walk', frames: [1], fps: 8 }]
    const segs = spriteSegments(project, { patterns: true, colors: false, animations: [0] })
    const out = segmentsToAsm(segs, ASM_DIALECTS.ca65, 'S', { labelCase: 'pascal' })
    expect(out).toContain('SpritePatterns:')
    expect(out).toContain('SpriteAnimWalk:')
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

  it('recases labels when asked, leaving the data untouched', () => {
    const out = segmentsToAsm(SAMPLE, ASM_DIALECTS.ca65, 'X', { labelCase: 'pascal' })
    expect(out).toContain('CharPatterns:')
    expect(out).not.toContain('char_patterns:')
    expect(out).toContain('    .byte $00, $3C, $42, $FF')
  })

  it('defaults to snake_case so existing output is unchanged', () => {
    expect(segmentsToAsm(SAMPLE, ASM_DIALECTS.ca65, 'X')).toBe(
      segmentsToAsm(SAMPLE, ASM_DIALECTS.ca65, 'X', { labelCase: 'snake' }),
    )
  })
})

describe('applyLabelCase', () => {
  it.each([
    ['snake', 'char_patterns_1'],
    ['upper', 'CHAR_PATTERNS_1'],
    ['camel', 'charPatterns1'],
    ['pascal', 'CharPatterns1'],
  ] as const)('renders %s', (labelCase, expected) => {
    expect(applyLabelCase('char_patterns_1', labelCase)).toBe(expected)
  })

  it('handles single-token labels', () => {
    expect(applyLabelCase('screen', 'pascal')).toBe('Screen')
    expect(applyLabelCase('screen', 'camel')).toBe('screen')
    expect(applyLabelCase('mc_names', 'camel')).toBe('mcNames')
  })

  it('never emits a character an assembler would read as an operator', () => {
    for (const { id } of LABEL_CASES) {
      expect(applyLabelCase('screen_1', id)).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/)
    }
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
