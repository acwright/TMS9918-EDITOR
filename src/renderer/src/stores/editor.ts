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
import type {
  CharPattern,
  Charset,
  ColorPair,
  G2CharsetMode,
  Screen,
  SpriteAnimation,
  SpriteSize,
} from '@/domain/types'
import { isGraphics1Colors, isGraphics2Colors, isSpriteColors, isTextColors } from '@/domain/types'
import * as charOps from '@/domain/charOps'
import * as screenOps from '@/domain/screenOps'
import * as spriteOps from '@/domain/spriteOps'
import type { SpriteGrid } from '@/domain/spriteOps'
import {
  SPRITE_QUAD,
  bytesToPatterns,
  clampFps,
  clampSlot,
  isValidSlot,
  moveFrame,
  patternsForSlot,
  slotToPattern,
  spriteBytes,
  spriteCount,
  spriteGrid,
} from '@/domain/sprites'
import { CommandHistory } from '@/domain/commands'
import { COLOR_GROUP_SIZE, MODES, charsetCount } from '@/domain/modes'
import { isValidColorIndex } from '@/domain/palette'
import { useProjectsStore } from './projects'

export type ColorSlot = 'fg' | 'bg'

/**
 * Transforms shared by the character and sprite editors. Naming them here lets
 * every caller — panel buttons and the keyboard map — stay mode-agnostic;
 * `applyTransform` dispatches to charOps or spriteOps (PLAN.md §14.5).
 */
export type TransformName =
  | 'fill'
  | 'clear'
  | 'invert'
  | 'shiftLeft'
  | 'shiftRight'
  | 'shiftUp'
  | 'shiftDown'
  | 'flipH'
  | 'flipV'
  | 'rotateLeft'
  | 'rotateRight'

const TRANSFORMS: Record<
  TransformName,
  { label: string; char: (p: CharPattern) => CharPattern; sprite: (g: SpriteGrid) => SpriteGrid }
> = {
  fill: { label: 'Fill', char: () => charOps.fill(), sprite: (g) => spriteOps.fill(g.length) },
  clear: { label: 'Clear', char: () => charOps.clear(), sprite: (g) => spriteOps.clear(g.length) },
  invert: { label: 'Invert', char: charOps.invert, sprite: spriteOps.invert },
  shiftLeft: { label: 'Shift Left', char: charOps.shiftLeft, sprite: spriteOps.shiftLeft },
  shiftRight: { label: 'Shift Right', char: charOps.shiftRight, sprite: spriteOps.shiftRight },
  shiftUp: { label: 'Shift Up', char: charOps.shiftUp, sprite: spriteOps.shiftUp },
  shiftDown: { label: 'Shift Down', char: charOps.shiftDown, sprite: spriteOps.shiftDown },
  flipH: { label: 'Flip Horizontal', char: charOps.flipH, sprite: spriteOps.flipH },
  flipV: { label: 'Flip Vertical', char: charOps.flipV, sprite: spriteOps.flipV },
  rotateLeft: { label: 'Rotate Left', char: charOps.rotateLeft, sprite: spriteOps.rotateLeft },
  rotateRight: { label: 'Rotate Right', char: charOps.rotateRight, sprite: spriteOps.rotateRight },
}

const DEFAULT_PAIR: ColorPair = { fg: 15, bg: 1 }

/** Starting frame rate for a new animation, matching the factory default. */
const DEFAULT_FPS = 8

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

  /** Multicolor: the palette index (0–15) the screen brush paints (Decision 9). */
  const paintColor = ref(15)

  /** Sprite: the selected sprite slot (0–255 at 8×8, 0–63 at 16×16). */
  const selectedSprite = ref(0)

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
    selectedSprite.value = 0
    selectedAnimation.value = 0
    selectedFrame.value = 0
    playing.value = false
    previewScale.value = 6
    screenZoomedManually.value = false
    history.clear()
  }

  function selectChar(code: number): void {
    selectedChar.value = ((code % 256) + 256) % 256
  }

  function selectRow(row: number): void {
    selectedRow.value = Math.max(0, Math.min(7, row))
  }

  /** Multicolor: set the brush colour (no-op on an invalid index). Not undoable — view state. */
  function setPaintColor(index: number): void {
    if (isValidColorIndex(index)) paintColor.value = index
  }

  /** Multicolor + sprite: palette index shown behind transparent pixels (VDP register 7). */
  const backdrop = computed(() => projects.current?.settings.backdrop ?? 1)

  /** Multicolor + sprite: set the backdrop colour as an undoable command. */
  function setBackdrop(index: number): void {
    const project = projects.current
    const usesBackdrop = project?.type === 'multicolor' || project?.type === 'sprite'
    if (!project || !usesBackdrop || !isValidColorIndex(index)) return
    const prev = project.settings.backdrop ?? 1
    if (prev === index) return
    const apply = (value: number) => {
      const p = projects.current
      if (!p) return
      p.settings.backdrop = value
      projects.markDirty()
    }
    history.execute({
      label: 'Set Backdrop Color',
      do: () => apply(index),
      undo: () => apply(prev),
    })
  }

  // --- Sprites (PLAN.md §14) ---

  const isSprite = computed(() => projects.current?.type === 'sprite')

  /** Pattern grouping: 8×8 (256 slots) or 16×16 (64 slots). */
  const spriteSize = computed<SpriteSize>(() =>
    projects.current?.settings.spriteSize === 16 ? 16 : 8,
  )

  /** Hardware magnification — display only; the pattern data is unaffected. */
  const spriteMag = computed<1 | 2>(() => (projects.current?.settings.spriteMag === 2 ? 2 : 1))

  /** Selectable slots at the current size. */
  const spriteSlots = computed(() => spriteCount(spriteSize.value))

  function selectSprite(slot: number): void {
    selectedSprite.value = clampSlot(slot, spriteSize.value)
  }

  /** The selected sprite as a `size × size` boolean grid. */
  const currentSpriteGrid = computed<SpriteGrid | null>(() => {
    const charset = projects.current?.charsets[0]
    if (!charset || !isSprite.value) return null
    return spriteGrid(charset, selectedSprite.value, spriteSize.value)
  })

  /** The selected sprite's bytes in hardware order (8 at 8×8, 32 at 16×16). */
  const currentSpriteBytes = computed<number[]>(() => {
    const charset = projects.current?.charsets[0]
    if (!charset || !isSprite.value) return []
    return spriteBytes(charset, selectedSprite.value, spriteSize.value)
  })

  /** The selected sprite's palette index (16×16 reads the quad base — Decision 27). */
  const spriteColor = computed(() => {
    const colors = projects.current?.colors
    if (!colors || !isSpriteColors(colors)) return 15
    return colors.sprites[slotToPattern(selectedSprite.value, spriteSize.value)] ?? 15
  })

  /** Replace every pattern a sprite slot occupies, as one undoable command. */
  function executeSpriteChange(label: string, slot: number, next: CharPattern[]): void {
    const charset = projects.current?.charsets[0]
    if (!charset) return
    const patterns = patternsForSlot(slot, spriteSize.value)
    const prev = patterns.map((p) => (charset[p] ?? []).slice())
    if (next.every((pattern, i) => pattern.every((b, j) => b === prev[i]?.[j]))) return
    const apply = (values: CharPattern[]) => {
      const set = projects.current?.charsets[0]
      if (!set) return
      patterns.forEach((p, i) => {
        const value = values[i]
        if (value) set[p] = value.slice()
      })
      projects.markDirty()
    }
    history.execute({ label, do: () => apply(next), undo: () => apply(prev) })
  }

  /** Set the selected sprite's colour as an undoable command. */
  function setSpriteColor(index: number): void {
    const project = projects.current
    const colors = project?.colors
    if (!project || !colors || !isSpriteColors(colors) || !isValidColorIndex(index)) return
    // Capture the pattern slot now so undo lands on the same entry after the
    // selection (or the size setting) moves on.
    const patternIndex = slotToPattern(selectedSprite.value, spriteSize.value)
    const prev = colors.sprites[patternIndex]
    if (prev === undefined || prev === index) return
    const apply = (value: number) => {
      const c = projects.current?.colors
      if (!c || !isSpriteColors(c)) return
      c.sprites[patternIndex] = value
      projects.markDirty()
    }
    history.execute({
      label: 'Set Sprite Color',
      do: () => apply(index),
      undo: () => apply(prev),
    })
  }

  /**
   * Switch between 8×8 and 16×16 as an undoable command (Decision 24). Pattern
   * bytes are never touched — only their *grouping* changes.
   *
   * Colour needs one adjustment, though. A 16×16 sprite has a single colour,
   * held in its quad-base entry (Decision 27); its other three entries are
   * unreachable while that size is active. Splitting back to 8×8 turns those
   * three into sprites of their own, so they inherit the colour the quad was
   * displaying — otherwise three of every four sprites would suddenly revert to
   * whatever their 8×8 entry last held, discarding the colour that was on
   * screen a moment earlier. Undo restores the previous table exactly.
   */
  function setSpriteSize(size: SpriteSize): void {
    const project = projects.current
    if (!project || project.type !== 'sprite') return
    const prev = spriteSize.value
    if (prev === size) return
    const prevSlot = selectedSprite.value

    const colors = project.colors
    const splitting = size === 8 && isSpriteColors(colors)
    const prevSprites = splitting ? colors.sprites.slice() : null
    // Every entry takes its quad base's colour: 0,1,2,3 ← 0; 4,5,6,7 ← 4; …
    const nextSprites =
      prevSprites?.map((color, i) => prevSprites[i - (i % SPRITE_QUAD)] ?? color) ?? null

    const apply = (value: SpriteSize, slot: number, sprites: number[] | null) => {
      const p = projects.current
      if (!p) return
      p.settings.spriteSize = value
      if (sprites && isSpriteColors(p.colors)) p.colors.sprites = sprites.slice()
      selectedSprite.value = clampSlot(slot, value)
      projects.markDirty()
    }

    history.execute({
      label: size === 16 ? 'Use 16×16 Sprites' : 'Use 8×8 Sprites',
      // Keep the same *pattern* in view across the change rather than the same
      // slot number, which would jump to a different sprite.
      do: () => apply(size, size === 16 ? Math.floor(prevSlot / 4) : prevSlot * 4, nextSprites),
      undo: () => apply(prev, prevSlot, prevSprites),
    })
  }

  // --- Animations (PLAN.md §14, Decision 29) ---

  /** Animation index within the project. */
  const selectedAnimation = ref(0)
  /**
   * Playhead: the frame index the preview shows. Doubles as the frame strip's
   * selection when paused. View state — never undoable, never persisted.
   */
  const selectedFrame = ref(0)
  const playing = ref(false)
  /**
   * Preview zoom, on top of hardware magnification. Lives here rather than in
   * the panel so the `+`/`-` shortcuts can drive it, the same reason screen
   * scale moved into the store in Phase 8.
   */
  const previewScale = ref(6)

  function zoomPreview(delta: number): void {
    previewScale.value = Math.max(1, Math.min(12, previewScale.value + delta))
  }

  const animations = computed<SpriteAnimation[]>(() => projects.current?.animations ?? [])

  const animationCount = computed(() => animations.value.length)

  const currentAnimation = computed<SpriteAnimation | null>(
    () => animations.value[selectedAnimation.value] ?? null,
  )

  const frameCount = computed(() => currentAnimation.value?.frames.length ?? 0)

  function selectAnimation(index: number): void {
    selectedAnimation.value = Math.max(0, Math.min(animationCount.value - 1, index))
    selectFrame(0)
  }

  function selectFrame(index: number): void {
    const count = frameCount.value
    selectedFrame.value = count === 0 ? 0 : Math.max(0, Math.min(count - 1, index))
  }

  /** Advance the playhead, wrapping — the playback loop's only entry point. */
  function stepFrame(delta: number): void {
    const count = frameCount.value
    if (count === 0) return
    selectedFrame.value = (((selectedFrame.value + delta) % count) + count) % count
  }

  function setPlaying(value: boolean): void {
    // Nothing to animate below two frames (Decision 31).
    playing.value = value && frameCount.value > 1
  }

  function togglePlaying(): void {
    setPlaying(!playing.value)
  }

  /** The slot the preview renders: the current frame, or the edited sprite when empty. */
  const previewSlot = computed(() => {
    const frames = currentAnimation.value?.frames ?? []
    if (frames.length === 0) return selectedSprite.value
    return frames[Math.min(selectedFrame.value, frames.length - 1)] ?? 0
  })

  /** Replace one animation's frame list as an undoable command. */
  function executeFramesChange(label: string, index: number, next: number[]): void {
    const prev = projects.current?.animations?.[index]?.frames
    if (!prev) return
    const apply = (frames: number[]) => {
      const animation = projects.current?.animations?.[index]
      if (!animation) return
      animation.frames = frames
      selectFrame(selectedFrame.value)
      projects.markDirty()
    }
    history.execute({ label, do: () => apply(next), undo: () => apply(prev.slice()) })
  }

  function addAnimation(): void {
    const project = projects.current
    if (!project || project.type !== 'sprite' || !project.animations) return
    const index = project.animations.length
    const animation: SpriteAnimation = {
      name: `Animation ${index + 1}`,
      frames: [selectedSprite.value],
      fps: DEFAULT_FPS,
    }
    const apply = (insert: boolean) => {
      const list = projects.current?.animations
      if (!list) return
      if (insert) {
        list.splice(index, 0, animation)
        selectedAnimation.value = index
      } else {
        list.splice(index, 1)
        selectAnimation(selectedAnimation.value)
      }
      selectFrame(0)
      projects.markDirty()
    }
    history.execute({ label: 'Add Animation', do: () => apply(true), undo: () => apply(false) })
  }

  /** Remove an animation (callers confirm first). The last one cannot be removed. */
  function removeAnimation(index: number): void {
    const list = projects.current?.animations
    const animation = list?.[index]
    if (!list || !animation || list.length <= 1) return
    const apply = (restore: boolean) => {
      const l = projects.current?.animations
      if (!l) return
      if (restore) {
        l.splice(index, 0, animation)
        selectedAnimation.value = index
      } else {
        l.splice(index, 1)
        selectAnimation(selectedAnimation.value)
      }
      selectFrame(0)
      projects.markDirty()
    }
    history.execute({
      label: 'Delete Animation',
      do: () => apply(false),
      undo: () => apply(true),
    })
  }

  function renameAnimation(index: number, name: string): void {
    const animation = projects.current?.animations?.[index]
    if (!animation || !name || animation.name === name) return
    const prev = animation.name
    const apply = (value: string) => {
      const a = projects.current?.animations?.[index]
      if (!a) return
      a.name = value
      projects.markDirty()
    }
    history.execute({ label: 'Rename Animation', do: () => apply(name), undo: () => apply(prev) })
  }

  function setAnimationFps(index: number, fps: number): void {
    const animation = projects.current?.animations?.[index]
    if (!animation) return
    const next = clampFps(fps)
    const prev = animation.fps
    if (prev === next) return
    const apply = (value: number) => {
      const a = projects.current?.animations?.[index]
      if (!a) return
      a.fps = value
      projects.markDirty()
    }
    history.execute({ label: 'Set Frame Rate', do: () => apply(next), undo: () => apply(prev) })
  }

  /** Append a sprite slot to the current animation (defaults to the edited sprite). */
  function addFrame(slot: number = selectedSprite.value): void {
    const animation = currentAnimation.value
    if (!animation || !isValidSlot(slot, spriteSize.value)) return
    const index = selectedAnimation.value
    executeFramesChange('Add Frame', index, [...animation.frames, slot])
    selectFrame(animation.frames.length - 1)
  }

  function removeFrame(frameIndex: number): void {
    const animation = currentAnimation.value
    if (!animation || frameIndex < 0 || frameIndex >= animation.frames.length) return
    const next = animation.frames.slice()
    next.splice(frameIndex, 1)
    executeFramesChange('Remove Frame', selectedAnimation.value, next)
  }

  /** Reorder one frame; the playhead follows it. */
  function reorderFrame(from: number, to: number): void {
    const animation = currentAnimation.value
    if (!animation) return
    const next = moveFrame(animation.frames, from, to)
    if (next.every((slot, i) => slot === animation.frames[i])) return
    executeFramesChange('Move Frame', selectedAnimation.value, next)
    selectFrame(to)
  }

  /** Point an existing frame at a different sprite slot. */
  function setFrame(frameIndex: number, slot: number): void {
    const animation = currentAnimation.value
    if (!animation || !isValidSlot(slot, spriteSize.value)) return
    if (animation.frames[frameIndex] === slot) return
    if (frameIndex < 0 || frameIndex >= animation.frames.length) return
    const next = animation.frames.slice()
    next[frameIndex] = slot
    executeFramesChange('Set Frame', selectedAnimation.value, next)
  }

  /** Set hardware magnification (VDP R1 MAG) as an undoable command. */
  function setSpriteMag(mag: 1 | 2): void {
    const project = projects.current
    if (!project || project.type !== 'sprite') return
    const prev = spriteMag.value
    if (prev === mag) return
    const apply = (value: 1 | 2) => {
      const p = projects.current
      if (!p) return
      p.settings.spriteMag = value
      projects.markDirty()
    }
    history.execute({
      label: mag === 2 ? 'Magnify Sprites 2×' : 'Magnify Sprites 1×',
      do: () => apply(mag),
      undo: () => apply(prev),
    })
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

  /** Apply a pure transform (spriteOps) to the selected sprite. */
  function spriteTransform(label: string, op: (grid: SpriteGrid) => SpriteGrid): void {
    const charset = projects.current?.charsets[0]
    if (!charset) return
    executeSpriteChange(
      label,
      selectedSprite.value,
      spriteOps.transformSprite(charset, selectedSprite.value, spriteSize.value, op),
    )
  }

  /**
   * Apply a named transform to whatever the active mode is editing — the
   * character pattern, or the whole 8×8 / 16×16 sprite. Panels and the keyboard
   * map both call this so neither has to know which mode is open.
   */
  function applyTransform(name: TransformName): void {
    const entry = TRANSFORMS[name]
    if (isSprite.value) spriteTransform(entry.label, entry.sprite)
    else transform(entry.label, entry.char)
  }

  /** Overwrite the selected character's pattern (e.g. pasted bytes) as an undoable command. */
  function setCharPattern(bytes: CharPattern): void {
    const pattern = currentPattern.value
    if (!pattern || bytes.length !== pattern.length) return
    if (bytes.every((b, i) => b === pattern[i])) return // no-op: identical bytes
    executePatternChange('Set Bytes', selectedCharset.value, selectedChar.value, bytes.slice())
  }

  /**
   * Overwrite the bytes of whatever is being edited: one 8-byte character
   * pattern, or a sprite's 8 (8×8) or 32 (16×16) bytes in hardware order.
   */
  function setPatternBytes(bytes: number[]): void {
    if (!isSprite.value) {
      setCharPattern(bytes)
      return
    }
    const expected = spriteSize.value === 16 ? 32 : 8
    if (bytes.length !== expected) return
    executeSpriteChange('Set Bytes', selectedSprite.value, bytesToPatterns(bytes, spriteSize.value))
  }

  // --- Pixel strokes ---

  function beginStroke(label: string): void {
    history.beginBatch(label)
  }

  function endStroke(): void {
    history.endBatch()
  }

  /** Set one pixel of the selected character (or sprite); no-op if already that state. */
  function paintPixel(x: number, y: number, on: boolean): void {
    if (isSprite.value) {
      const grid = currentSpriteGrid.value
      if (!grid || (grid[y]?.[x] ?? false) === on) return
      spriteTransform(on ? 'Draw pixel' : 'Erase pixel', (g) => spriteOps.setPixel(g, x, y, on))
      return
    }
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
    // Multicolor paints with `paintColor` and sprite with `spriteColor`; neither
    // has an fg/bg pair, so both fall through to the default.
    if (!isGraphics2Colors(colors)) return DEFAULT_PAIR
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
    const isMulticolor = project.type === 'multicolor'
    const label =
      code === 0
        ? isMulticolor
          ? 'Erase Block'
          : 'Erase Cell'
        : isMulticolor
          ? 'Paint Block'
          : 'Place Character'
    executeCellsChange(label, selectedScreen.value, screenOps.setCell(screen.cells, columns, x, y, code))
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
    paintColor,
    backdrop,
    selectedSprite,
    isSprite,
    spriteSize,
    spriteMag,
    spriteSlots,
    spriteColor,
    currentSpriteGrid,
    currentSpriteBytes,
    selectedAnimation,
    selectedFrame,
    playing,
    previewScale,
    zoomPreview,
    animations,
    animationCount,
    currentAnimation,
    frameCount,
    previewSlot,
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
    setPaintColor,
    setBackdrop,
    selectSprite,
    setSpriteColor,
    setSpriteSize,
    setSpriteMag,
    selectAnimation,
    selectFrame,
    stepFrame,
    setPlaying,
    togglePlaying,
    addAnimation,
    removeAnimation,
    renameAnimation,
    setAnimationFps,
    addFrame,
    removeFrame,
    reorderFrame,
    setFrame,
    spriteTransform,
    selectScreen,
    setG2CharsetMode,
    setColor,
    transform,
    applyTransform,
    setCharPattern,
    setPatternBytes,
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
