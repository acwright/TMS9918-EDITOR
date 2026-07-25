import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as charOps from '@/domain/charOps'
import { isGraphics1Colors, isGraphics2Colors, isTextColors } from '@/domain/types'
import { useEditorStore } from '../editor'
import { useProjectsStore } from '../projects'

function setup(
  type: 'text' | 'graphics1' | 'graphics2' | 'multicolor' | 'sprite' = 'graphics1',
  options: { spriteSize?: 8 | 16 } = {},
) {
  localStorage.clear()
  setActivePinia(createPinia())
  const projects = useProjectsStore()
  const editor = useEditorStore()
  const project = projects.create({ name: 'Test', type, spriteSize: options.spriteSize })!
  projects.open(project.id)
  editor.reset()
  return { projects, editor }
}

describe('editor store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('exposes the selected character pattern', () => {
    const { editor } = setup()
    expect(editor.currentPattern).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('selectChar wraps around 0–255', () => {
    const { editor } = setup()
    editor.selectChar(-1)
    expect(editor.selectedChar).toBe(255)
    editor.selectChar(256)
    expect(editor.selectedChar).toBe(0)
  })

  describe('transforms', () => {
    it('applies a transform as an undoable command', () => {
      const { editor } = setup()
      editor.transform('Fill', () => charOps.fill())
      expect(editor.currentPattern).toEqual(charOps.fill())
      expect(editor.canUndo).toBe(true)
      expect(editor.undoLabel).toBe('Fill')

      expect(editor.undo()).toBe('Fill')
      expect(editor.currentPattern).toEqual(charOps.clear())
      expect(editor.redo()).toBe('Fill')
      expect(editor.currentPattern).toEqual(charOps.fill())
    })

    it('marks the project dirty', () => {
      const { projects, editor } = setup()
      expect(projects.saveState).toBe('saved')
      editor.transform('Fill', () => charOps.fill())
      expect(projects.saveState).toBe('unsaved')
    })

    it('undo targets the edited character even after the selection moves', () => {
      const { projects, editor } = setup()
      editor.transform('Fill', () => charOps.fill())
      editor.selectChar(9)
      editor.undo()
      expect(projects.current?.charsets[0]?.[0]).toEqual(charOps.clear())
      expect(projects.current?.charsets[0]?.[9]).toEqual(charOps.clear())
    })
  })

  describe('pixel strokes', () => {
    it('paints pixels and coalesces a stroke into one undo entry', () => {
      const { editor } = setup()
      editor.beginStroke('Draw')
      editor.paintPixel(0, 0, true)
      editor.paintPixel(1, 0, true)
      editor.paintPixel(2, 0, true)
      editor.endStroke()

      expect(editor.currentPattern?.[0]).toBe(0b11100000)
      editor.undo()
      expect(editor.currentPattern?.[0]).toBe(0)
      expect(editor.canUndo).toBe(false)
    })

    it('painting an unchanged pixel is not recorded', () => {
      const { editor } = setup()
      editor.beginStroke('Draw')
      editor.paintPixel(0, 0, false) // already off
      editor.endStroke()
      expect(editor.canUndo).toBe(false)
    })

    it('erase strokes undo as one entry too', () => {
      const { editor } = setup()
      editor.transform('Fill', () => charOps.fill())
      editor.beginStroke('Erase')
      editor.paintPixel(0, 0, false)
      editor.paintPixel(0, 1, false)
      editor.endStroke()
      editor.undo()
      expect(editor.currentPattern).toEqual(charOps.fill())
    })
  })

  it('reset clears history and selection', () => {
    const { editor } = setup()
    editor.selectChar(42)
    editor.transform('Fill', () => charOps.fill())
    editor.reset()
    expect(editor.selectedChar).toBe(0)
    expect(editor.canUndo).toBe(false)
  })

  it('works across charsets (independent GMII)', () => {
    const { projects, editor } = setup('graphics2')
    // mirrored by default — single charset still addressable
    editor.transform('Fill', () => charOps.fill())
    expect(projects.current?.charsets[0]?.[0]).toEqual(charOps.fill())
  })

  describe('GMII charset-mode conversion (Decision 1)', () => {
    it('selectCharset clamps to the available sets', () => {
      const { editor } = setup('graphics2') // mirrored → 1 set
      expect(editor.charsets).toBe(1)
      editor.selectCharset(2)
      expect(editor.selectedCharset).toBe(0)
    })

    it('mirrored → independent copies the set ×3 (patterns and colors, no aliasing)', () => {
      const { projects, editor } = setup('graphics2')
      editor.transform('Fill', () => charOps.fill())
      editor.setG2CharsetMode('independent')

      const project = projects.current!
      expect(project.settings.g2CharsetMode).toBe('independent')
      expect(project.charsets).toHaveLength(3)
      expect(editor.charsets).toBe(3)
      expect(project.charsets[1]?.[0]).toEqual(charOps.fill())
      expect(project.charsets[2]?.[0]).toEqual(charOps.fill())

      // Copies are independent: editing set 2 leaves set 1 alone
      editor.selectCharset(1)
      editor.transform('Clear', () => charOps.clear())
      expect(project.charsets[1]?.[0]).toEqual(charOps.clear())
      expect(project.charsets[0]?.[0]).toEqual(charOps.fill())
    })

    it('independent → mirrored keeps set 1 and discards sets 2–3', () => {
      const { projects, editor } = setup('graphics2')
      editor.setG2CharsetMode('independent')
      editor.selectCharset(2)
      editor.transform('Fill', () => charOps.fill())

      editor.setG2CharsetMode('mirrored')
      const project = projects.current!
      expect(project.settings.g2CharsetMode).toBe('mirrored')
      expect(project.charsets).toHaveLength(1)
      expect(project.charsets[0]?.[0]).toEqual(charOps.clear()) // set 1 was untouched
      expect(editor.selectedCharset).toBe(0)
    })

    it('conversion is undoable and restores discarded sets', () => {
      const { projects, editor } = setup('graphics2')
      editor.setG2CharsetMode('independent')
      editor.selectCharset(2)
      editor.transform('Fill', () => charOps.fill())
      editor.setG2CharsetMode('mirrored')

      expect(editor.undo()).toBe('Convert to Mirrored Charset')
      const project = projects.current!
      expect(project.settings.g2CharsetMode).toBe('independent')
      expect(project.charsets).toHaveLength(3)
      expect(project.charsets[2]?.[0]).toEqual(charOps.fill()) // discarded set restored
    })

    it('is a no-op for the current mode and for non-GMII projects', () => {
      const g2 = setup('graphics2')
      g2.editor.setG2CharsetMode('mirrored') // already mirrored
      expect(g2.editor.canUndo).toBe(false)

      const g1 = setup('graphics1')
      g1.editor.setG2CharsetMode('independent')
      expect(g1.editor.canUndo).toBe(false)
      expect(g1.projects.current?.charsets).toHaveLength(1)
    })

    it('marks the project dirty so autosave persists the conversion', () => {
      const { projects, editor } = setup('graphics2')
      expect(projects.saveState).toBe('saved')
      editor.setG2CharsetMode('independent')
      expect(projects.saveState).toBe('unsaved')
    })
  })

  describe('colors (Phase 6)', () => {
    it('text: activeColors is the global pair and setColor targets it', () => {
      const { projects, editor } = setup('text')
      expect(editor.activeColors).toEqual({ fg: 15, bg: 1 })

      editor.setColor('fg', 7)
      editor.setColor('bg', 4)
      const colors = projects.current!.colors
      if (!isTextColors(colors)) throw new Error('expected text colors')
      expect(colors).toMatchObject({ fg: 7, bg: 4 })
      expect(editor.activeColors).toEqual({ fg: 7, bg: 4 })
    })

    it('graphics1: setColor targets the selected character’s 8-char group only', () => {
      const { projects, editor } = setup('graphics1')
      editor.selectChar(17) // group 2 (chars 16–23)
      editor.setColor('fg', 6)

      const colors = projects.current!.colors
      if (!isGraphics1Colors(colors)) throw new Error('expected graphics1 colors')
      expect(colors.groups[2]).toEqual({ fg: 6, bg: 1 })
      expect(colors.groups[1]).toEqual({ fg: 15, bg: 1 }) // neighbors untouched
      expect(colors.groups[3]).toEqual({ fg: 15, bg: 1 })
      expect(editor.activeColors.fg).toBe(6)
    })

    it('graphics2: setColor targets the selected row of the selected character', () => {
      const { projects, editor } = setup('graphics2')
      editor.selectChar(42)
      editor.selectRow(3)
      editor.setColor('bg', 13)

      const colors = projects.current!.colors
      if (!isGraphics2Colors(colors)) throw new Error('expected graphics2 colors')
      expect(colors.rows[0]![42]![3]).toEqual({ fg: 15, bg: 13 })
      expect(colors.rows[0]![42]![2]).toEqual({ fg: 15, bg: 1 }) // other rows untouched
      expect(colors.rows[0]![41]![3]).toEqual({ fg: 15, bg: 1 }) // other chars untouched
    })

    it('painting auto-targets the row (Decision 2 auto-follow)', () => {
      const { editor } = setup('graphics2')
      expect(editor.selectedRow).toBe(0)
      editor.beginStroke('Draw')
      editor.paintPixel(2, 5, true)
      editor.endStroke()
      expect(editor.selectedRow).toBe(5)
    })

    it('color changes are undoable and undo targets the original slot', () => {
      const { projects, editor } = setup('graphics2')
      editor.selectChar(42)
      editor.selectRow(3)
      editor.setColor('fg', 2)
      expect(editor.undoLabel).toBe('Set Foreground Color')

      // Move selection away, then undo — the original slot is restored
      editor.selectChar(0)
      editor.selectRow(0)
      expect(editor.undo()).toBe('Set Foreground Color')
      const colors = projects.current!.colors
      if (!isGraphics2Colors(colors)) throw new Error('expected graphics2 colors')
      expect(colors.rows[0]![42]![3]).toEqual({ fg: 15, bg: 1 })

      expect(editor.redo()).toBe('Set Foreground Color')
      expect(colors.rows[0]![42]![3]).toEqual({ fg: 2, bg: 1 })
    })

    it('no-ops on the same color or an invalid index', () => {
      const { editor } = setup('text')
      editor.setColor('fg', 15) // already white
      editor.setColor('bg', 16) // out of range
      editor.setColor('bg', -1)
      expect(editor.canUndo).toBe(false)
    })

    it('marks the project dirty', () => {
      const { projects, editor } = setup('text')
      editor.setColor('fg', 2)
      expect(projects.saveState).toBe('unsaved')
    })

    it('reset restores the targeted row', () => {
      const { editor } = setup('graphics2')
      editor.selectRow(6)
      editor.reset()
      expect(editor.selectedRow).toBe(0)
    })
  })

  describe('screens (Phase 7)', () => {
    it('exposes the selected screen', () => {
      const { editor } = setup()
      expect(editor.currentScreen?.name).toBe('Screen 1')
      expect(editor.screenCount).toBe(1)
    })

    it('paints and erases cells as undoable commands', () => {
      const { editor } = setup('graphics1')
      editor.selectChar(65)
      editor.beginStroke('Draw')
      editor.paintCell(3, 2, editor.selectedChar)
      editor.paintCell(4, 2, editor.selectedChar)
      editor.endStroke()

      const columns = 32
      expect(editor.currentScreen?.cells[2 * columns + 3]).toBe(65)
      expect(editor.currentScreen?.cells[2 * columns + 4]).toBe(65)

      editor.undo() // whole stroke is one entry
      expect(editor.currentScreen?.cells[2 * columns + 3]).toBe(0)
      expect(editor.currentScreen?.cells[2 * columns + 4]).toBe(0)
    })

    it('painting an unchanged cell is not recorded', () => {
      const { editor } = setup()
      editor.beginStroke('Erase')
      editor.paintCell(0, 0, 0) // already 0
      editor.endStroke()
      expect(editor.canUndo).toBe(false)
    })

    it('screen transforms go through the command layer', () => {
      const { editor } = setup('graphics1')
      editor.screenTransform('Fill Screen', (cells) => cells.map(() => 65))
      expect(editor.currentScreen?.cells.every((c) => c === 65)).toBe(true)
      expect(editor.undo()).toBe('Fill Screen')
      expect(editor.currentScreen?.cells.every((c) => c === 0)).toBe(true)
    })

    it('adds, selects, and undoes screens', () => {
      const { editor } = setup()
      editor.addScreen()
      expect(editor.screenCount).toBe(2)
      expect(editor.selectedScreen).toBe(1)
      expect(editor.currentScreen?.name).toBe('Screen 2')

      editor.undo()
      expect(editor.screenCount).toBe(1)
      expect(editor.selectedScreen).toBe(0)
    })

    it('removes a screen and undo restores it with its contents', () => {
      const { editor } = setup('graphics1')
      editor.addScreen()
      editor.paintCell(0, 0, 65) // draw on screen 2
      editor.removeScreen(1)
      expect(editor.screenCount).toBe(1)
      expect(editor.selectedScreen).toBe(0)

      editor.undo()
      expect(editor.screenCount).toBe(2)
      expect(editor.currentScreen?.cells[0]).toBe(65)
    })

    it('refuses to remove the last screen', () => {
      const { editor } = setup()
      editor.removeScreen(0)
      expect(editor.screenCount).toBe(1)
    })

    it('renames a screen undoably', () => {
      const { editor } = setup()
      editor.renameScreen(0, 'Title Screen')
      expect(editor.currentScreen?.name).toBe('Title Screen')
      editor.undo()
      expect(editor.currentScreen?.name).toBe('Screen 1')
    })

    it('undo of cell edits targets the right screen after switching', () => {
      const { editor } = setup('graphics1')
      editor.beginStroke('Draw')
      editor.paintCell(0, 0, 65)
      editor.endStroke()
      editor.addScreen() // now on screen 2

      editor.undo() // undoes Add Screen
      editor.undo() // undoes the draw on screen 1
      expect(editor.currentScreen?.cells[0]).toBe(0)
    })

    it('reset restores the screen selection', () => {
      const { editor } = setup()
      editor.addScreen()
      editor.reset()
      expect(editor.selectedScreen).toBe(0)
    })
  })

  describe('multicolor (Phase 16)', () => {
    it('paints a palette index onto the 64×48 grid as an undoable command', () => {
      const { editor } = setup('multicolor')
      editor.setPaintColor(7)
      editor.beginStroke('Draw')
      editor.paintCell(3, 2, editor.paintColor)
      editor.endStroke()

      const columns = 64
      expect(editor.currentScreen?.cells[2 * columns + 3]).toBe(7)
      editor.undo()
      expect(editor.currentScreen?.cells[2 * columns + 3]).toBe(0)
    })

    it('setPaintColor clamps out-of-range indices to a no-op', () => {
      const { editor } = setup('multicolor')
      editor.setPaintColor(9)
      expect(editor.paintColor).toBe(9)
      editor.setPaintColor(16) // out of range → ignored
      editor.setPaintColor(-1)
      expect(editor.paintColor).toBe(9)
    })

    it('exposes the backdrop and sets it as an undoable, dirtying command', () => {
      const { projects, editor } = setup('multicolor')
      expect(editor.backdrop).toBe(1)
      expect(projects.saveState).toBe('saved')

      editor.setBackdrop(4)
      expect(editor.backdrop).toBe(4)
      expect(projects.current?.settings.backdrop).toBe(4)
      expect(projects.saveState).toBe('unsaved')

      expect(editor.undo()).toBe('Set Backdrop Color')
      expect(editor.backdrop).toBe(1)
    })

    it('setBackdrop no-ops on the same value, an invalid index, or a non-multicolor project', () => {
      const mc = setup('multicolor')
      mc.editor.setBackdrop(1) // already black
      mc.editor.setBackdrop(99) // out of range
      expect(mc.editor.canUndo).toBe(false)

      const text = setup('text')
      text.editor.setBackdrop(5)
      expect(text.editor.canUndo).toBe(false)
    })
  })

  describe('sprites (Phase 26)', () => {
    it('exposes size-dependent slot counts and a grid of the right size', () => {
      const eight = setup('sprite', { spriteSize: 8 })
      expect(eight.editor.isSprite).toBe(true)
      expect(eight.editor.spriteSize).toBe(8)
      expect(eight.editor.spriteSlots).toBe(256)
      expect(eight.editor.currentSpriteGrid).toHaveLength(8)
      expect(eight.editor.currentSpriteBytes).toHaveLength(8)

      const sixteen = setup('sprite', { spriteSize: 16 })
      expect(sixteen.editor.spriteSlots).toBe(64)
      expect(sixteen.editor.currentSpriteGrid).toHaveLength(16)
      expect(sixteen.editor.currentSpriteBytes).toHaveLength(32)
    })

    it('selectSprite clamps to the slot range rather than wrapping', () => {
      const { editor } = setup('sprite', { spriteSize: 16 })
      editor.selectSprite(-1)
      expect(editor.selectedSprite).toBe(0)
      editor.selectSprite(999)
      expect(editor.selectedSprite).toBe(63)
    })

    it('paints a 16×16 pixel into the correct hardware quadrant, undoably', () => {
      const { projects, editor } = setup('sprite', { spriteSize: 16 })
      editor.selectSprite(1) // patterns 4–7
      editor.beginStroke('Draw')
      editor.paintPixel(8, 8, true) // bottom-right quadrant → pattern 7
      editor.endStroke()

      const charset = projects.current!.charsets[0]!
      expect(charset[7]?.[0]).toBe(0x80)
      expect(charset[4]?.[0]).toBe(0) // other quadrants untouched
      expect(charset[5]?.[0]).toBe(0)
      expect(charset[6]?.[0]).toBe(0)
      expect(editor.currentSpriteGrid?.[8]?.[8]).toBe(true)

      editor.undo()
      expect(projects.current!.charsets[0]![7]?.[0]).toBe(0)
      expect(editor.currentSpriteGrid?.[8]?.[8]).toBe(false)
    })

    it('coalesces a sprite stroke into one undo entry', () => {
      const { editor } = setup('sprite', { spriteSize: 16 })
      editor.beginStroke('Draw')
      editor.paintPixel(0, 0, true)
      editor.paintPixel(1, 0, true)
      editor.paintPixel(9, 9, true) // a different quadrant, same stroke
      editor.endStroke()

      expect(editor.undo()).toBe('Draw')
      expect(editor.currentSpriteGrid?.[0]?.[0]).toBe(false)
      expect(editor.currentSpriteGrid?.[9]?.[9]).toBe(false)
      expect(editor.canUndo).toBe(false)
    })

    it('applyTransform routes to spriteOps and covers the whole 16×16 sprite', () => {
      const { editor } = setup('sprite', { spriteSize: 16 })
      editor.paintPixel(2, 5, true)
      editor.applyTransform('flipH')
      // Flipping across the full 16-pixel span, not per 8×8 quadrant.
      expect(editor.currentSpriteGrid?.[5]?.[13]).toBe(true)
      expect(editor.currentSpriteGrid?.[5]?.[2]).toBe(false)

      expect(editor.undo()).toBe('Flip Horizontal')
      expect(editor.currentSpriteGrid?.[5]?.[2]).toBe(true)
    })

    it('applyTransform still drives charOps in character modes', () => {
      const { editor } = setup('graphics1')
      editor.applyTransform('fill')
      expect(editor.currentPattern).toEqual(charOps.fill())
      expect(editor.undo()).toBe('Fill')
    })

    it('sets the sprite colour at the quad base as an undoable command', () => {
      const { projects, editor } = setup('sprite', { spriteSize: 16 })
      editor.selectSprite(3) // patterns 12–15
      editor.setSpriteColor(7)

      const colors = projects.current!.colors as { sprites: number[] }
      expect(editor.spriteColor).toBe(7)
      expect(colors.sprites[12]).toBe(7)
      expect(colors.sprites[13]).toBe(15) // siblings untouched — size changes stay lossless
      expect(projects.saveState).toBe('unsaved')

      expect(editor.undo()).toBe('Set Sprite Color')
      expect(editor.spriteColor).toBe(15)
    })

    it('setSpriteColor no-ops on the same value, a bad index, or another mode', () => {
      const sprite = setup('sprite')
      sprite.editor.setSpriteColor(15) // already white
      sprite.editor.setSpriteColor(99)
      expect(sprite.editor.canUndo).toBe(false)

      const text = setup('text')
      text.editor.setSpriteColor(4)
      expect(text.editor.canUndo).toBe(false)
    })

    it('groups up to 16×16 without touching pattern or colour data', () => {
      const { projects, editor } = setup('sprite', { spriteSize: 8 })
      editor.selectSprite(6)
      editor.paintPixel(1, 1, true)
      editor.setSpriteColor(9)
      const patterns = JSON.parse(JSON.stringify(projects.current!.charsets[0]))
      const colors = JSON.parse(JSON.stringify(projects.current!.colors))

      editor.setSpriteSize(16)
      expect(editor.spriteSize).toBe(16)
      expect(editor.spriteSlots).toBe(64)
      expect(projects.current!.charsets[0]).toEqual(patterns)
      expect(projects.current!.colors).toEqual(colors)
      // Pattern 6 now lives inside slot 1 (patterns 4–7), so the view follows it.
      expect(editor.selectedSprite).toBe(1)

      expect(editor.undo()).toBe('Use 16×16 Sprites')
      expect(editor.spriteSize).toBe(8)
      expect(editor.selectedSprite).toBe(6)
      expect(projects.current!.charsets[0]).toEqual(patterns)
    })

    it('carries the quad colour onto all four sprites when splitting back to 8×8', () => {
      // Reproduces the smoke-test report: draw an 8×8 sprite green, switch to
      // 16×16, fill the other three quadrants, switch back. All four 8×8
      // sprites must still be green — not just the one that was coloured.
      const { projects, editor } = setup('sprite', { spriteSize: 8 })
      editor.setSpriteColor(2) // Medium Green on slot 0
      editor.paintPixel(0, 0, true)

      editor.setSpriteSize(16)
      expect(editor.spriteColor).toBe(2) // the 16×16 sprite reads the quad base
      editor.paintPixel(8, 0, true) // top-right quadrant  → pattern 2
      editor.paintPixel(0, 8, true) // bottom-left         → pattern 1
      editor.paintPixel(8, 8, true) // bottom-right        → pattern 3

      editor.setSpriteSize(8)
      const sprites = (projects.current!.colors as { sprites: number[] }).sprites
      expect(sprites.slice(0, 4)).toEqual([2, 2, 2, 2])
      // …and the pixels went where the hardware expects them.
      const charset = projects.current!.charsets[0]!
      expect(charset[1]?.[0]).toBe(0x80)
      expect(charset[2]?.[0]).toBe(0x80)
      expect(charset[3]?.[0]).toBe(0x80)
    })

    it('leaves untouched quads alone when splitting', () => {
      const { projects, editor } = setup('sprite', { spriteSize: 16 })
      editor.selectSprite(2) // patterns 8–11
      editor.setSpriteColor(6)
      editor.setSpriteSize(8)

      const sprites = (projects.current!.colors as { sprites: number[] }).sprites
      expect(sprites.slice(8, 12)).toEqual([6, 6, 6, 6])
      expect(sprites.slice(0, 4)).toEqual([15, 15, 15, 15]) // still the default
    })

    it('undo restores the pre-split colour table exactly', () => {
      const { projects, editor } = setup('sprite', { spriteSize: 8 })
      // Four distinct 8×8 colours in one quad — the case the spread overwrites.
      editor.selectSprite(0)
      editor.setSpriteColor(2)
      editor.selectSprite(1)
      editor.setSpriteColor(4)
      editor.selectSprite(2)
      editor.setSpriteColor(6)
      editor.selectSprite(3)
      editor.setSpriteColor(8)

      editor.setSpriteSize(16)
      editor.setSpriteSize(8)
      const spread = (projects.current!.colors as { sprites: number[] }).sprites
      expect(spread.slice(0, 4)).toEqual([2, 2, 2, 2])

      expect(editor.undo()).toBe('Use 8×8 Sprites')
      editor.undo() // back through the 8→16 switch
      const restored = (projects.current!.colors as { sprites: number[] }).sprites
      expect(restored.slice(0, 4)).toEqual([2, 4, 6, 8])
    })

    it('setSpriteSize/setSpriteMag no-op on the same value or another mode', () => {
      const sprite = setup('sprite', { spriteSize: 8 })
      sprite.editor.setSpriteSize(8)
      sprite.editor.setSpriteMag(1)
      expect(sprite.editor.canUndo).toBe(false)

      const text = setup('text')
      text.editor.setSpriteSize(16)
      text.editor.setSpriteMag(2)
      expect(text.editor.canUndo).toBe(false)
    })

    it('sets magnification as an undoable command', () => {
      const { projects, editor } = setup('sprite')
      expect(editor.spriteMag).toBe(1)
      editor.setSpriteMag(2)
      expect(projects.current?.settings.spriteMag).toBe(2)
      expect(editor.undo()).toBe('Magnify Sprites 2×')
      expect(editor.spriteMag).toBe(1)
    })

    it('setPatternBytes writes all four patterns of a 16×16 sprite', () => {
      const { projects, editor } = setup('sprite', { spriteSize: 16 })
      const bytes = Array.from({ length: 32 }, (_, i) => i + 1)
      editor.setPatternBytes(bytes)

      const charset = projects.current!.charsets[0]!
      expect(charset[0]).toEqual(bytes.slice(0, 8))
      expect(charset[3]).toEqual(bytes.slice(24))
      expect(editor.currentSpriteBytes).toEqual(bytes)

      expect(editor.undo()).toBe('Set Bytes')
      expect(charset[0]).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
    })

    it('setPatternBytes rejects the wrong byte count and still sets characters', () => {
      const sprite = setup('sprite', { spriteSize: 16 })
      sprite.editor.setPatternBytes(Array.from({ length: 8 }, () => 0xff)) // 8 ≠ 32
      expect(sprite.editor.canUndo).toBe(false)

      const g1 = setup('graphics1')
      g1.editor.setPatternBytes(Array.from({ length: 8 }, () => 0xff))
      expect(g1.editor.currentPattern).toEqual(charOps.fill())
    })

    it('shares the backdrop control with multicolor', () => {
      const { projects, editor } = setup('sprite')
      editor.setBackdrop(4)
      expect(projects.current?.settings.backdrop).toBe(4)
      expect(editor.undo()).toBe('Set Backdrop Color')
      expect(editor.backdrop).toBe(1)
    })
  })

  describe('animations (Phase 27)', () => {
    it('starts on the factory animation', () => {
      const { editor } = setup('sprite')
      expect(editor.animationCount).toBe(1)
      expect(editor.currentAnimation).toEqual({ name: 'Animation 1', frames: [0], fps: 8 })
      expect(editor.selectedFrame).toBe(0)
      expect(editor.playing).toBe(false)
    })

    it('adds, renames and deletes animations undoably, never dropping the last', () => {
      const { editor } = setup('sprite')
      editor.addAnimation()
      expect(editor.animationCount).toBe(2)
      expect(editor.selectedAnimation).toBe(1)

      editor.renameAnimation(1, 'Walk')
      expect(editor.currentAnimation?.name).toBe('Walk')
      expect(editor.undo()).toBe('Rename Animation')
      expect(editor.currentAnimation?.name).toBe('Animation 2')

      editor.removeAnimation(1)
      expect(editor.animationCount).toBe(1)
      expect(editor.undo()).toBe('Delete Animation')
      expect(editor.animationCount).toBe(2)

      editor.removeAnimation(1)
      editor.removeAnimation(0) // the last one must survive
      expect(editor.animationCount).toBe(1)
    })

    it('appends the edited sprite as a frame and moves the playhead to it', () => {
      const { editor } = setup('sprite', { spriteSize: 16 })
      editor.selectSprite(5)
      editor.addFrame()
      expect(editor.currentAnimation?.frames).toEqual([0, 5])
      expect(editor.selectedFrame).toBe(1)

      expect(editor.undo()).toBe('Add Frame')
      expect(editor.currentAnimation?.frames).toEqual([0])
      expect(editor.selectedFrame).toBe(0) // clamped back into range
    })

    it('rejects a frame outside the slot range for the current size', () => {
      const { editor } = setup('sprite', { spriteSize: 16 })
      editor.addFrame(64) // only 0–63 exist at 16×16
      expect(editor.currentAnimation?.frames).toEqual([0])
      expect(editor.canUndo).toBe(false)
    })

    it('removes and reorders frames undoably', () => {
      const { editor } = setup('sprite')
      editor.addFrame(1)
      editor.addFrame(2)
      expect(editor.currentAnimation?.frames).toEqual([0, 1, 2])

      editor.reorderFrame(0, 2)
      expect(editor.currentAnimation?.frames).toEqual([1, 2, 0])
      expect(editor.selectedFrame).toBe(2) // the playhead follows the frame
      expect(editor.undo()).toBe('Move Frame')
      expect(editor.currentAnimation?.frames).toEqual([0, 1, 2])

      editor.removeFrame(1)
      expect(editor.currentAnimation?.frames).toEqual([0, 2])
      expect(editor.undo()).toBe('Remove Frame')
      expect(editor.currentAnimation?.frames).toEqual([0, 1, 2])
    })

    it('no-ops on out-of-range frame operations', () => {
      const { editor } = setup('sprite')
      editor.removeFrame(9)
      editor.reorderFrame(0, 9)
      editor.reorderFrame(0, 0)
      editor.setFrame(9, 3)
      expect(editor.canUndo).toBe(false)
    })

    it('retargets an existing frame at another sprite', () => {
      const { editor } = setup('sprite')
      editor.setFrame(0, 12)
      expect(editor.currentAnimation?.frames).toEqual([12])
      expect(editor.undo()).toBe('Set Frame')
      expect(editor.currentAnimation?.frames).toEqual([0])
    })

    it('clamps the frame rate and stores it undoably', () => {
      const { editor } = setup('sprite')
      editor.setAnimationFps(0, 99)
      expect(editor.currentAnimation?.fps).toBe(30)
      editor.setAnimationFps(0, 0)
      expect(editor.currentAnimation?.fps).toBe(1)
      expect(editor.undo()).toBe('Set Frame Rate')
      expect(editor.currentAnimation?.fps).toBe(30)

      editor.setAnimationFps(0, 30) // unchanged → no history entry
      const depth = editor.canUndo
      editor.setAnimationFps(0, 30)
      expect(editor.canUndo).toBe(depth)
    })

    it('wraps the playhead in both directions', () => {
      const { editor } = setup('sprite')
      editor.addFrame(1)
      editor.addFrame(2)
      editor.selectFrame(0)

      editor.stepFrame(1)
      expect(editor.selectedFrame).toBe(1)
      editor.stepFrame(-1)
      expect(editor.selectedFrame).toBe(0)
      editor.stepFrame(-1)
      expect(editor.selectedFrame).toBe(2) // wraps to the end
      editor.stepFrame(1)
      expect(editor.selectedFrame).toBe(0)
    })

    it('refuses to play below two frames', () => {
      const { editor } = setup('sprite')
      expect(editor.frameCount).toBe(1)
      editor.setPlaying(true)
      expect(editor.playing).toBe(false)

      editor.addFrame(1)
      editor.togglePlaying()
      expect(editor.playing).toBe(true)
      editor.togglePlaying()
      expect(editor.playing).toBe(false)
    })

    it('previews the current frame, falling back to the edited sprite when empty', () => {
      const { editor } = setup('sprite')
      editor.addFrame(7)
      editor.selectFrame(1)
      expect(editor.previewSlot).toBe(7)

      editor.removeFrame(1)
      editor.removeFrame(0) // no frames left
      editor.selectSprite(3)
      expect(editor.frameCount).toBe(0)
      expect(editor.previewSlot).toBe(3)
    })

    it('selecting an animation resets the playhead', () => {
      const { editor } = setup('sprite')
      editor.addFrame(1)
      editor.selectFrame(1)
      editor.addAnimation()
      expect(editor.selectedFrame).toBe(0)
      editor.selectAnimation(0)
      expect(editor.selectedFrame).toBe(0)
    })

    it('leaves non-sprite projects without animations alone', () => {
      const { projects, editor } = setup('graphics1')
      editor.addAnimation()
      editor.addFrame(2)
      expect(projects.current?.animations).toBeUndefined()
      expect(editor.animationCount).toBe(0)
      expect(editor.canUndo).toBe(false)
    })

    it('keeps every animation edit in the project file', () => {
      const { projects, editor } = setup('sprite')
      editor.addFrame(4)
      expect(projects.saveState).toBe('unsaved')
      expect(projects.current?.animations?.[0]?.frames).toEqual([0, 4])
    })
  })

  describe('screen view state (Phase 8)', () => {
    it('zoomScreen clamps to 1–8 and marks manual zoom', () => {
      const { editor } = setup()
      expect(editor.screenZoomedManually).toBe(false)
      editor.zoomScreen(10)
      expect(editor.screenScale).toBe(8)
      expect(editor.screenZoomedManually).toBe(true)
      editor.zoomScreen(-20)
      expect(editor.screenScale).toBe(1)
    })

    it('fitScreenScale floors and clamps without marking manual', () => {
      const { editor } = setup()
      editor.fitScreenScale(4.7)
      expect(editor.screenScale).toBe(4)
      expect(editor.screenZoomedManually).toBe(false)
      editor.fitScreenScale(0.2)
      expect(editor.screenScale).toBe(1)
      editor.fitScreenScale(99)
      expect(editor.screenScale).toBe(8)
    })

    it('toggleGrid flips the overlay (default on)', () => {
      const { editor } = setup()
      expect(editor.showGrid).toBe(true)
      editor.toggleGrid()
      expect(editor.showGrid).toBe(false)
    })

    it('reset clears the manual-zoom flag so the next project auto-fits', () => {
      const { editor } = setup()
      editor.zoomScreen(1)
      editor.reset()
      expect(editor.screenZoomedManually).toBe(false)
    })
  })
})
