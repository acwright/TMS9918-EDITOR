import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as charOps from '@/domain/charOps'
import { isGraphics1Colors, isGraphics2Colors, isTextColors } from '@/domain/types'
import { useEditorStore } from '../editor'
import { useProjectsStore } from '../projects'

function setup(type: 'text' | 'graphics1' | 'graphics2' = 'graphics1') {
  localStorage.clear()
  setActivePinia(createPinia())
  const projects = useProjectsStore()
  const editor = useEditorStore()
  const project = projects.create({ name: 'Test', type })!
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
