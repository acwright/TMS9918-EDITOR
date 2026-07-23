import { describe, expect, it } from 'vitest'
import { createProject } from '../factory'
import {
  ProjectValidationError,
  deserializeProject,
  serializeProject,
  validateProject,
} from '../serialization'
import type { Project } from '../types'

function clone(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project
}

describe('serialization', () => {
  describe('round-trip', () => {
    it.each(['text', 'graphics1', 'graphics2'] as const)('round-trips a %s project', (type) => {
      const project = createProject({ name: 'RT', type })
      expect(deserializeProject(serializeProject(project))).toEqual(project)
    })

    it('round-trips an independent graphics2 project', () => {
      const project = createProject({ name: 'RT', type: 'graphics2', g2CharsetMode: 'independent' })
      expect(deserializeProject(serializeProject(project))).toEqual(project)
    })

    it('serializes pretty-printed JSON', () => {
      const json = serializeProject(createProject({ name: 'Pretty', type: 'text' }))
      expect(json).toContain('\n  "version": 1')
    })
  })

  describe('rejection of malformed input', () => {
    /** Returns the ProjectValidationError thrown for `data`; fails if none is thrown. */
    const rejectionOf = (data: unknown): ProjectValidationError => {
      try {
        validateProject(data)
      } catch (error) {
        if (error instanceof ProjectValidationError) return error
        throw error
      }
      throw new Error('expected validateProject to throw')
    }

    it('rejects invalid JSON text', () => {
      expect(() => deserializeProject('{not json')).toThrowError('File is not valid JSON.')
    })

    it('rejects non-objects', () => {
      expect(rejectionOf([]).message).toContain('must be a JSON object')
      expect(rejectionOf('hi').message).toContain('must be a JSON object')
      expect(rejectionOf(null).message).toContain('must be a JSON object')
    })

    it('rejects unsupported versions', () => {
      const p = clone(createProject({ name: 'V', type: 'text' }))
      expect(rejectionOf({ ...p, version: 2 }).message).toContain('Unsupported project version')
    })

    it('rejects missing id / name', () => {
      const p = clone(createProject({ name: 'X', type: 'text' }))
      expect(rejectionOf({ ...p, id: '' }).message).toContain('"id"')
      expect(rejectionOf({ ...p, name: 42 }).message).toContain('"name"')
    })

    it('rejects an unknown type', () => {
      const p = clone(createProject({ name: 'X', type: 'text' }))
      expect(rejectionOf({ ...p, type: 'multicolor' }).message).toContain('"type"')
    })

    it('rejects bad dates', () => {
      const p = clone(createProject({ name: 'X', type: 'text' }))
      expect(rejectionOf({ ...p, createdAt: 'not-a-date' }).message).toContain('"createdAt"')
    })

    it('rejects graphics2 without a charset mode', () => {
      const p = clone(createProject({ name: 'X', type: 'graphics2' }))
      expect(rejectionOf({ ...p, settings: {} }).message).toContain('g2CharsetMode')
    })

    it('rejects the wrong charset count', () => {
      const p = clone(createProject({ name: 'X', type: 'graphics2', g2CharsetMode: 'independent' }))
      p.charsets.pop()
      expect(rejectionOf(p).message).toContain('exactly 3 charset(s)')
    })

    it('rejects a truncated charset', () => {
      const p = clone(createProject({ name: 'X', type: 'text' }))
      p.charsets[0]?.pop()
      expect(rejectionOf(p).message).toContain('256 characters')
    })

    it('rejects out-of-range pattern bytes', () => {
      const p = clone(createProject({ name: 'X', type: 'text' }))
      p.charsets[0]![3]![0] = 256
      expect(rejectionOf(p).message).toContain('character 3')
    })

    it('rejects out-of-range color indices', () => {
      const text = clone(createProject({ name: 'X', type: 'text' }))
      expect(rejectionOf({ ...text, colors: { fg: 16, bg: 0 } }).message).toContain(
        'palette indices',
      )

      const g1 = clone(createProject({ name: 'X', type: 'graphics1' }))
      expect(rejectionOf({ ...g1, colors: { groups: [] } }).message).toContain('32 fg/bg pairs')

      const g2 = clone(createProject({ name: 'X', type: 'graphics2' }))
      expect(rejectionOf({ ...g2, colors: { rows: [] } }).message).toContain(
        'one entry per charset',
      )
    })

    it('rejects a mismatched colors shape for the mode', () => {
      const p = clone(createProject({ name: 'X', type: 'text' }))
      expect(rejectionOf({ ...p, colors: { groups: [] } }).message).toContain('fg, bg')
    })

    it('rejects missing screens', () => {
      const p = clone(createProject({ name: 'X', type: 'text' }))
      expect(rejectionOf({ ...p, screens: [] }).message).toContain('at least one screen')
    })

    it('rejects the wrong screen cell count for the mode', () => {
      // A graphics screen (768 cells) presented as a text project (960 expected).
      const p = clone(createProject({ name: 'X', type: 'text' }))
      p.screens[0]!.cells = Array.from({ length: 768 }, () => 0)
      expect(rejectionOf(p).message).toContain('960 character codes')
    })

    it('rejects out-of-range cell codes', () => {
      const p = clone(createProject({ name: 'X', type: 'graphics1' }))
      p.screens[0]!.cells[0] = 999
      expect(rejectionOf(p).message).toContain('character codes')
    })
  })
})
