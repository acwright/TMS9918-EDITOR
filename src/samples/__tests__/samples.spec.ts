import { describe, expect, it } from 'vitest'
import { SAMPLES } from '../index'
import { validateProject } from '@/domain/serialization'
import { MODES } from '@/domain/modes'

describe('samples', () => {
  it.each(SAMPLES)('$name builds a schema-valid project', (sample) => {
    // validateProject throws on any structural problem in the authored data
    expect(() => validateProject(sample.build())).not.toThrow()
  })

  it('builds independent projects with unique ids on each call', () => {
    const a = SAMPLES[0]!.build()
    const b = SAMPLES[0]!.build()
    expect(a.id).not.toBe(b.id)
    a.name = 'changed'
    expect(b.name).not.toBe('changed')
  })

  it('places content on the screen (not blank)', () => {
    for (const sample of SAMPLES) {
      const project = sample.build()
      const painted = project.screens[0]!.cells.some((c) => c !== 0)
      expect(painted, `${sample.name} should have a non-empty screen`).toBe(true)
    }
  })

  it('only references in-bounds character codes', () => {
    for (const sample of SAMPLES) {
      const project = sample.build()
      const { cellCount } = MODES[project.type]
      expect(project.screens[0]!.cells).toHaveLength(cellCount)
      expect(project.screens[0]!.cells.every((c) => c >= 0 && c < 256)).toBe(true)
    }
  })
})
