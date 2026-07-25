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
    it.each(['text', 'graphics1', 'graphics2', 'multicolor', 'sprite'] as const)(
      'round-trips a %s project',
      (type) => {
        const project = createProject({ name: 'RT', type })
        expect(deserializeProject(serializeProject(project))).toEqual(project)
      },
    )

    it('round-trips a 16×16 sprite project with animations', () => {
      const project = createProject({ name: 'RT', type: 'sprite', spriteSize: 16 })
      project.animations = [
        { name: 'Walk', frames: [0, 1, 2, 1], fps: 12 },
        { name: 'Idle', frames: [], fps: 1 },
      ]
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
      expect(rejectionOf({ ...p, type: 'graphics3' }).message).toContain('"type"')
    })

    it('rejects multicolor without a backdrop setting', () => {
      const p = clone(createProject({ name: 'X', type: 'multicolor' }))
      expect(rejectionOf({ ...p, settings: {} }).message).toContain('backdrop')
    })

    it('rejects multicolor with a non-empty colors table', () => {
      const p = clone(createProject({ name: 'X', type: 'multicolor' }))
      expect(rejectionOf({ ...p, colors: { fg: 1, bg: 0 } }).message).toContain('empty object')
    })

    it('rejects multicolor cells outside the palette range', () => {
      const p = clone(createProject({ name: 'X', type: 'multicolor' }))
      p.screens[0]!.cells[0] = 16
      expect(rejectionOf(p).message).toContain('palette indices')
    })

    it('rejects the wrong multicolor cell count', () => {
      const p = clone(createProject({ name: 'X', type: 'multicolor' }))
      p.screens[0]!.cells.pop()
      expect(rejectionOf(p).message).toContain('3072')
    })

    describe('sprite projects', () => {
      const sprite = (size: 8 | 16 = 8) =>
        clone(createProject({ name: 'X', type: 'sprite', spriteSize: size }))

      it('rejects a missing or invalid spriteSize / spriteMag / backdrop', () => {
        const p = sprite()
        expect(rejectionOf({ ...p, settings: { backdrop: 1, spriteMag: 1 } }).message).toContain(
          'spriteSize',
        )
        expect(
          rejectionOf({ ...p, settings: { backdrop: 1, spriteSize: 12, spriteMag: 1 } }).message,
        ).toContain('spriteSize')
        expect(
          rejectionOf({ ...p, settings: { backdrop: 1, spriteSize: 8, spriteMag: 3 } }).message,
        ).toContain('spriteMag')
        expect(rejectionOf({ ...p, settings: { spriteSize: 8, spriteMag: 1 } }).message).toContain(
          'backdrop',
        )
      })

      it('rejects a colour table that is not 256 palette indices', () => {
        const p = sprite()
        expect(rejectionOf({ ...p, colors: {} }).message).toContain('256 palette indices')
        expect(rejectionOf({ ...p, colors: { sprites: [15] } }).message).toContain('256')
        const bad = sprite()
        ;(bad.colors as { sprites: number[] }).sprites[3] = 16
        expect(rejectionOf(bad).message).toContain('palette indices')
      })

      it('rejects any screen at all', () => {
        const p = sprite()
        const withScreen = { ...p, screens: [{ name: 'Screen 1', cells: [] }] }
        expect(rejectionOf(withScreen).message).toContain('empty "screens"')
      })

      it('requires an animations array', () => {
        const p = sprite()
        delete p.animations
        expect(rejectionOf(p).message).toContain('"animations"')
      })

      it('rejects malformed animations', () => {
        const p = sprite()
        expect(rejectionOf({ ...p, animations: [{ frames: [0], fps: 8 }] }).message).toContain(
          '"name"',
        )
        expect(
          rejectionOf({ ...p, animations: [{ name: 'A', frames: [0], fps: 0 }] }).message,
        ).toContain('"fps"')
        expect(
          rejectionOf({ ...p, animations: [{ name: 'A', frames: [0], fps: 31 }] }).message,
        ).toContain('"fps"')
        expect(
          rejectionOf({ ...p, animations: [{ name: 'A', frames: [1.5], fps: 8 }] }).message,
        ).toContain('"frames"')
      })

      it('bounds frame slot indices by the project sprite size', () => {
        const eight = sprite(8)
        eight.animations = [{ name: 'A', frames: [255], fps: 8 }]
        expect(validateProject(eight)).toBe(eight)

        const sixteen = sprite(16)
        sixteen.animations = [{ name: 'A', frames: [64], fps: 8 }]
        expect(rejectionOf(sixteen).message).toContain('0–63')
      })

      it('rejects animations on non-sprite projects', () => {
        const p = clone(createProject({ name: 'X', type: 'text' }))
        const withAnimations = { ...p, animations: [{ name: 'A', frames: [0], fps: 8 }] }
        expect(rejectionOf(withAnimations).message).toContain('Only sprite projects')
      })
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
