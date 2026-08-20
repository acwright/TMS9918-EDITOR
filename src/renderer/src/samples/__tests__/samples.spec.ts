import { describe, expect, it } from 'vitest'
import { SAMPLES } from '../index'
import { validateProject } from '@/domain/serialization'
import { MODES } from '@/domain/modes'
import { spriteCount, spriteGrid } from '@/domain/sprites'
import { isSpriteColors } from '@/domain/types'

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
      if (!MODES[project.type].hasScreen) continue // sprite projects have no screen
      const painted = project.screens[0]!.cells.some((c) => c !== 0)
      expect(painted, `${sample.name} should have a non-empty screen`).toBe(true)
    }
  })

  it('only references in-bounds character codes', () => {
    for (const sample of SAMPLES) {
      const project = sample.build()
      const { cellCount, hasScreen } = MODES[project.type]
      if (!hasScreen) continue
      expect(project.screens[0]!.cells).toHaveLength(cellCount)
      expect(project.screens[0]!.cells.every((c) => c >= 0 && c < 256)).toBe(true)
    }
  })

  describe('sprite samples', () => {
    const spriteSamples = SAMPLES.filter((s) => s.build().type === 'sprite')

    it('bundles at least one', () => {
      expect(spriteSamples.length).toBeGreaterThan(0)
    })

    it.each(spriteSamples)('$name draws pixels into its sprites', (sample) => {
      const project = sample.build()
      const charset = project.charsets[0]!
      expect(charset.some((pattern) => pattern.some((b) => b !== 0))).toBe(true)
    })

    it.each(spriteSamples)('$name animates real, in-range, non-blank frames', (sample) => {
      const project = sample.build()
      const size = project.settings.spriteSize === 16 ? 16 : 8
      const slots = spriteCount(size)
      const animations = project.animations ?? []

      expect(animations.length).toBeGreaterThan(0)
      for (const animation of animations) {
        expect(animation.frames.length, `${animation.name} should have frames`).toBeGreaterThan(0)
        for (const slot of animation.frames) {
          expect(slot).toBeGreaterThanOrEqual(0)
          expect(slot).toBeLessThan(slots)
          // A frame pointing at an empty slot would animate a blank tile.
          const painted = spriteGrid(project.charsets[0]!, slot, size).flat().some(Boolean)
          expect(painted, `${animation.name} frame ${slot} should not be blank`).toBe(true)
        }
      }
    })

    it.each(spriteSamples)('$name colours every animated sprite visibly', (sample) => {
      const project = sample.build()
      const colors = project.colors
      if (!isSpriteColors(colors)) throw new Error('expected sprite colors')
      const size = project.settings.spriteSize === 16 ? 16 : 8
      for (const animation of project.animations ?? []) {
        for (const slot of animation.frames) {
          // Colour 0 is transparent — an invisible sprite in a sample would look broken.
          expect(colors.sprites[slot * (size === 16 ? 4 : 1)]).not.toBe(0)
        }
      }
    })
  })
})
