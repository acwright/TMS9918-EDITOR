import { describe, expect, it } from 'vitest'
import { createProject } from '../factory'
import { MODES } from '../modes'
import { formatScreenStatus, screenStatus } from '../screenStatus'

describe('screenStatus', () => {
  it('reports the idle form with the screen dimensions when nothing is hovered', () => {
    const project = createProject({ name: 'G1', type: 'graphics1' })
    const status = screenStatus(project, project.screens[0]!, null)
    expect(status).toEqual({
      active: false,
      coords: '32 × 24 cells',
      pixel: '256 × 192 px',
      details: [],
    })
  })

  it('reports blocks and the pixel size for multicolor when idle', () => {
    const project = createProject({ name: 'MC', type: 'multicolor' })
    const status = screenStatus(project, project.screens[0]!, null)
    expect(status.coords).toBe('64 × 48 blocks')
    expect(status.pixel).toBe('256 × 192 px')
  })

  it('gives cell coordinates, the cell origin in pixels, and the character code', () => {
    const project = createProject({ name: 'G1', type: 'graphics1' })
    const screen = project.screens[0]!
    screen.cells[5 * 32 + 12] = 0x41
    const status = screenStatus(project, screen, { x: 12, y: 5 })
    expect(status.active).toBe(true)
    expect(status.coords).toBe('X 12  Y 5')
    expect(status.pixel).toBe('px 96, 40')
    expect(status.details).toEqual(['char $41 (65)', 'group 8'])
  })

  it('uses the 6px cell width of Text Mode for the pixel origin', () => {
    const project = createProject({ name: 'T', type: 'text' })
    const status = screenStatus(project, project.screens[0]!, { x: 10, y: 2 })
    expect(status.pixel).toBe('px 60, 16')
    expect(status.details).toEqual(['char $00 (0)'])
  })

  it('names the screen third for Graphics II, as a set when charsets are independent', () => {
    const mirrored = createProject({ name: 'M', type: 'graphics2', g2CharsetMode: 'mirrored' })
    expect(screenStatus(mirrored, mirrored.screens[0]!, { x: 0, y: 9 }).details).toEqual([
      'char $00 (0)',
      'third 2',
    ])

    const independent = createProject({
      name: 'I',
      type: 'graphics2',
      g2CharsetMode: 'independent',
    })
    expect(screenStatus(independent, independent.screens[0]!, { x: 0, y: 20 }).details).toEqual([
      'char $00 (0)',
      'set 3',
    ])
  })

  it('reports the palette index and colour name for multicolor', () => {
    const project = createProject({ name: 'MC', type: 'multicolor' })
    const screen = project.screens[0]!
    screen.cells[3 * MODES.multicolor.columns + 7] = 7
    const status = screenStatus(project, screen, { x: 7, y: 3 })
    expect(status.coords).toBe('X 7  Y 3')
    expect(status.pixel).toBe('px 28, 12')
    expect(status.details).toEqual(['colour 7 (Cyan)'])
  })

  it('falls back to the idle form for out-of-bounds cells', () => {
    const project = createProject({ name: 'G1', type: 'graphics1' })
    for (const cell of [
      { x: -1, y: 0 },
      { x: 32, y: 0 },
      { x: 0, y: 24 },
    ]) {
      expect(screenStatus(project, project.screens[0]!, cell).active).toBe(false)
    }
  })

  it('formats a status as one separated line', () => {
    const project = createProject({ name: 'G1', type: 'graphics1' })
    expect(formatScreenStatus(screenStatus(project, project.screens[0]!, { x: 1, y: 1 }))).toBe(
      'X 1  Y 1  ·  px 8, 8  ·  char $00 (0)  ·  group 0',
    )
  })
})
