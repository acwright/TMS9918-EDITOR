/**
 * Editor store — selection state and the project-wide undo history
 * (PLAN.md Decision 3). Every mutation of the open project goes through the
 * command layer here; commands capture the target charset/character so
 * undo/redo applies to the right slot even after the selection moves on.
 *
 * Drag strokes on the pixel editor are wrapped in beginStroke/endStroke so a
 * whole stroke undoes as one entry.
 */

import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import type { CharPattern, Charset, ColorPair, G2CharsetMode, Screen } from '@/domain/types'
import { isGraphics1Colors, isGraphics2Colors, isTextColors } from '@/domain/types'
import * as charOps from '@/domain/charOps'
import * as screenOps from '@/domain/screenOps'
import { CommandHistory } from '@/domain/commands'
import { COLOR_GROUP_SIZE, MODES, charsetCount } from '@/domain/modes'
import { isValidColorIndex } from '@/domain/palette'
import { useProjectsStore } from './projects'

export type ColorSlot = 'fg' | 'bg'

const DEFAULT_PAIR: ColorPair = { fg: 15, bg: 1 }

export const useEditorStore = defineStore('editor', () => {
  const projects = useProjectsStore()

  /** Charset index (0 except for independent-GMII sets 0–2). */
  const selectedCharset = ref(0)
  /** Character code 0–255. */
  const selectedChar = ref(0)
  /**
   * GMII: the pixel row (0–7) currently targeted by the color picker
   * (Decision 2). Set by clicking a row chip and auto-follows pixel edits.
   */
  const selectedRow = ref(0)

  const history = reactive(new CommandHistory())

  const canUndo = computed(() => history.canUndo)
  const canRedo = computed(() => history.canRedo)
  const undoLabel = computed(() => history.undoLabel)
  const redoLabel = computed(() => history.redoLabel)

  const currentPattern = computed<CharPattern | null>(
    () => projects.current?.charsets[selectedCharset.value]?.[selectedChar.value] ?? null,
  )

  /** Screen index within the project. */
  const selectedScreen = ref(0)

  // --- Screen view state (not persisted) ---
  const screenScale = ref(3)
  const showGrid = ref(true)
  /** True once the user zooms manually; auto-fit pauses until the next project. */
  const screenZoomedManually = ref(false)

  function zoomScreen(delta: number): void {
    screenZoomedManually.value = true
    screenScale.value = Math.max(1, Math.min(8, screenScale.value + delta))
  }

  /** Auto-fit path — sets the scale without marking it manual. */
  function fitScreenScale(value: number): void {
    screenScale.value = Math.max(1, Math.min(8, Math.floor(value)))
  }

  function toggleGrid(): void {
    showGrid.value = !showGrid.value
  }

  /** Reset selection and history — call when a (different) project opens. */
  function reset(): void {
    selectedCharset.value = 0
    selectedChar.value = 0
    selectedRow.value = 0
    selectedScreen.value = 0
    screenZoomedManually.value = false
    history.clear()
  }

  function selectChar(code: number): void {
    selectedChar.value = ((code % 256) + 256) % 256
  }

  function selectRow(row: number): void {
    selectedRow.value = Math.max(0, Math.min(7, row))
  }

  /** Number of charsets the open project carries (3 for independent GMII). */
  const charsets = computed(() => {
    const project = projects.current
    return project ? charsetCount(project.type, project.settings.g2CharsetMode) : 1
  })

  function selectCharset(index: number): void {
    selectedCharset.value = Math.max(0, Math.min(charsets.value - 1, index))
  }

  /**
   * Convert a GMII project between mirrored and independent charsets
   * (PLAN.md Decision 1) as an undoable command. mirrored → independent
   * copies the single set ×3; independent → mirrored keeps set 1 and drops
   * sets 2–3 (callers show the destructive-change warning first).
   */
  function setG2CharsetMode(mode: G2CharsetMode): void {
    const project = projects.current
    if (!project || project.type !== 'graphics2' || !isGraphics2Colors(project.colors)) return
    const prevMode = project.settings.g2CharsetMode ?? 'mirrored'
    if (prevMode === mode) return

    const baseCharset = project.charsets[0]
    const baseRows = project.colors.rows[0]
    if (!baseCharset || !baseRows) return

    const cloneCharset = (set: Charset): Charset => set.map((pattern) => pattern.slice())
    const cloneRows = (rows: ColorPair[][]): ColorPair[][] =>
      rows.map((char) => char.map((pair) => ({ ...pair })))

    const prevCharsets = project.charsets
    const prevRows = project.colors.rows
    const nextCharsets =
      mode === 'independent'
        ? [baseCharset, cloneCharset(baseCharset), cloneCharset(baseCharset)]
        : [baseCharset]
    const nextRows =
      mode === 'independent' ? [baseRows, cloneRows(baseRows), cloneRows(baseRows)] : [baseRows]

    const apply = (sets: Charset[], rows: ColorPair[][][], m: G2CharsetMode) => {
      const p = projects.current
      if (!p || !isGraphics2Colors(p.colors)) return
      p.charsets = sets
      p.colors.rows = rows
      p.settings.g2CharsetMode = m
      selectedCharset.value = 0
      projects.markDirty()
    }

    history.execute({
      label:
        mode === 'independent' ? 'Convert to Independent Charsets' : 'Convert to Mirrored Charset',
      do: () => apply(nextCharsets, nextRows, mode),
      undo: () => apply(prevCharsets, prevRows, prevMode),
    })
  }

  /** Replace one character's pattern as an undoable command. */
  function executePatternChange(
    label: string,
    charsetIndex: number,
    charCode: number,
    next: CharPattern,
  ): void {
    const prev = projects.current?.charsets[charsetIndex]?.[charCode]
    if (!prev) return
    const apply = (pattern: CharPattern) => {
      const charset = projects.current?.charsets[charsetIndex]
      if (!charset) return
      charset[charCode] = pattern
      projects.markDirty()
    }
    history.execute({ label, do: () => apply(next), undo: () => apply(prev) })
  }

  /** Apply a pure transform (charOps) to the selected character. */
  function transform(label: string, fn: (pattern: CharPattern) => CharPattern): void {
    const pattern = currentPattern.value
    if (!pattern) return
    executePatternChange(label, selectedCharset.value, selectedChar.value, fn(pattern))
  }

  // --- Pixel strokes ---

  function beginStroke(label: string): void {
    history.beginBatch(label)
  }

  function endStroke(): void {
    history.endBatch()
  }

  /** Set one pixel of the selected character; no-op if already that state. */
  function paintPixel(x: number, y: number, on: boolean): void {
    selectRow(y) // GMII color targeting auto-follows edits (Decision 2)
    const pattern = currentPattern.value
    if (!pattern || charOps.getPixel(pattern, x, y) === on) return
    executePatternChange(
      on ? 'Draw pixel' : 'Erase pixel',
      selectedCharset.value,
      selectedChar.value,
      charOps.setPixel(pattern, x, y, on),
    )
  }

  // --- Colors ---

  /** The fg/bg pair the color picker currently targets, per the mode's model. */
  const activeColors = computed<ColorPair>(() => {
    const colors = projects.current?.colors
    if (!colors) return DEFAULT_PAIR
    if (isTextColors(colors)) return { fg: colors.fg, bg: colors.bg }
    if (isGraphics1Colors(colors)) {
      return colors.groups[Math.floor(selectedChar.value / COLOR_GROUP_SIZE)] ?? DEFAULT_PAIR
    }
    return (
      colors.rows[selectedCharset.value]?.[selectedChar.value]?.[selectedRow.value] ?? DEFAULT_PAIR
    )
  })

  /**
   * Set the targeted foreground/background color as an undoable command.
   * Target per mode: text = the global pair; Graphics I = the selected
   * character's 8-char group; Graphics II = the selected character's targeted
   * pixel row (selectedRow).
   */
  function setColor(slot: ColorSlot, index: number): void {
    const colors = projects.current?.colors
    if (!colors || !isValidColorIndex(index)) return
    const label = slot === 'fg' ? 'Set Foreground Color' : 'Set Background Color'

    /** Resolve the mutable pair a command targets, capturing indices now. */
    let resolvePair: () => ColorPair | undefined
    if (isTextColors(colors)) {
      resolvePair = () => {
        const c = projects.current?.colors
        return c && isTextColors(c) ? c : undefined
      }
    } else if (isGraphics1Colors(colors)) {
      const group = Math.floor(selectedChar.value / COLOR_GROUP_SIZE)
      resolvePair = () => {
        const c = projects.current?.colors
        return c && isGraphics1Colors(c) ? c.groups[group] : undefined
      }
    } else {
      const charset = selectedCharset.value
      const char = selectedChar.value
      const row = selectedRow.value
      resolvePair = () => {
        const c = projects.current?.colors
        return c && isGraphics2Colors(c) ? c.rows[charset]?.[char]?.[row] : undefined
      }
    }

    const prev = resolvePair()?.[slot]
    if (prev === undefined || prev === index) return
    const apply = (value: number) => {
      const pair = resolvePair()
      if (!pair) return
      pair[slot] = value
      projects.markDirty()
    }
    history.execute({ label, do: () => apply(index), undo: () => apply(prev) })
  }

  // --- Screens ---

  const currentScreen = computed<Screen | null>(
    () => projects.current?.screens[selectedScreen.value] ?? null,
  )

  const screenCount = computed(() => projects.current?.screens.length ?? 0)

  function selectScreen(index: number): void {
    selectedScreen.value = Math.max(0, Math.min(screenCount.value - 1, index))
  }

  /** Replace one screen's cells as an undoable command. */
  function executeCellsChange(label: string, screenIndex: number, next: number[]): void {
    const prev = projects.current?.screens[screenIndex]?.cells
    if (!prev) return
    const apply = (cells: number[]) => {
      const screen = projects.current?.screens[screenIndex]
      if (!screen) return
      screen.cells = cells
      projects.markDirty()
    }
    history.execute({ label, do: () => apply(next), undo: () => apply(prev) })
  }

  /** Apply a pure transform (screenOps) to the selected screen. */
  function screenTransform(
    label: string,
    fn: (cells: number[], columns: number) => number[],
  ): void {
    const project = projects.current
    const screen = currentScreen.value
    if (!project || !screen) return
    const { columns } = MODES[project.type]
    executeCellsChange(label, selectedScreen.value, fn(screen.cells, columns))
  }

  /** Paint one cell of the selected screen; no-op if it already holds `code`. */
  function paintCell(x: number, y: number, code: number): void {
    const project = projects.current
    const screen = currentScreen.value
    if (!project || !screen) return
    const { columns } = MODES[project.type]
    if (screenOps.getCell(screen.cells, columns, x, y) === code) return
    executeCellsChange(
      code === 0 ? 'Erase Cell' : 'Place Character',
      selectedScreen.value,
      screenOps.setCell(screen.cells, columns, x, y, code),
    )
  }

  function addScreen(): void {
    const project = projects.current
    if (!project) return
    const index = project.screens.length
    const screen: Screen = {
      name: `Screen ${index + 1}`,
      cells: Array.from({ length: MODES[project.type].cellCount }, () => 0),
    }
    const apply = (insert: boolean) => {
      const p = projects.current
      if (!p) return
      if (insert) {
        p.screens.splice(index, 0, screen)
        selectedScreen.value = index
      } else {
        p.screens.splice(index, 1)
        selectScreen(selectedScreen.value)
      }
      projects.markDirty()
    }
    history.execute({ label: 'Add Screen', do: () => apply(true), undo: () => apply(false) })
  }

  /** Remove a screen (callers confirm first). The last screen cannot be removed. */
  function removeScreen(index: number): void {
    const project = projects.current
    const screen = project?.screens[index]
    if (!project || !screen || project.screens.length <= 1) return
    const apply = (restore: boolean) => {
      const p = projects.current
      if (!p) return
      if (restore) {
        p.screens.splice(index, 0, screen)
        selectedScreen.value = index
      } else {
        p.screens.splice(index, 1)
        selectScreen(selectedScreen.value)
      }
      projects.markDirty()
    }
    history.execute({ label: 'Delete Screen', do: () => apply(false), undo: () => apply(true) })
  }

  function renameScreen(index: number, name: string): void {
    const screen = projects.current?.screens[index]
    if (!screen || !name || screen.name === name) return
    const prev = screen.name
    const apply = (value: string) => {
      const s = projects.current?.screens[index]
      if (!s) return
      s.name = value
      projects.markDirty()
    }
    history.execute({ label: 'Rename Screen', do: () => apply(name), undo: () => apply(prev) })
  }

  // --- Undo / redo ---

  function undo(): string | null {
    return history.undo()
  }

  function redo(): string | null {
    return history.redo()
  }

  return {
    selectedCharset,
    selectedChar,
    selectedRow,
    selectedScreen,
    screenScale,
    showGrid,
    screenZoomedManually,
    charsets,
    currentPattern,
    currentScreen,
    screenCount,
    activeColors,
    zoomScreen,
    fitScreenScale,
    toggleGrid,
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    reset,
    selectChar,
    selectCharset,
    selectRow,
    selectScreen,
    setG2CharsetMode,
    setColor,
    transform,
    beginStroke,
    endStroke,
    paintPixel,
    screenTransform,
    paintCell,
    addScreen,
    removeScreen,
    renameScreen,
    undo,
    redo,
  }
})
