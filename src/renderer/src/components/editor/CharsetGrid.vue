<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watchEffect } from 'vue'
import * as charOps from '@/domain/charOps'
import { colorHex, resolveRowColors } from '@/domain/colors'
import { MODES } from '@/domain/modes'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'

const props = withDefaults(
  defineProps<{
    /** First character code in this grid (0 or 128) */
    startCode: number
    /** How many characters this grid shows — a half of the set, or all of it. */
    count?: number
    /**
     * Which axis the glyphs are sized from. `height` scales the block to the
     * space it is given (the Blocks view); `width` fixes it to the column and
     * lets it run as tall as it needs, for a caller that scrolls it.
     */
    fit?: 'height' | 'width'
  }>(),
  { count: 128, fit: 'height' },
)

const projects = useProjectsStore()
const editor = useEditorStore()

const MIN_COLUMNS = 8
/**
 * Widest a glyph gets in the width-fitted view. Without it a wide column
 * stretches eight glyphs across it at ten times life size, which is a lot of
 * scrolling for a set you are trying to see.
 */
const MAX_CELL_PX = 48
const SCALE = 3
const NEUTRAL = '#0a0a0a' // ink-950: transparent renders as the app background

const root = useTemplateRef('root')
const availableWidth = ref(0)

/**
 * Columns double — 8, 16, 32 — rather than filling with whatever number fits.
 * A row then holds a whole number of the 8-character groups the hardware works
 * in, so Graphics I's color groups and the $x0 column of the code map still
 * line up. The step happens where the cells would otherwise grow past
 * MAX_CELL_PX, which puts every cell in (MAX_CELL_PX / 2, MAX_CELL_PX].
 */
const columns = computed(() => {
  if (props.fit !== 'width' || !availableWidth.value) return MIN_COLUMNS
  let count = MIN_COLUMNS
  while (count * 2 <= props.count && availableWidth.value / count > MAX_CELL_PX) count *= 2
  return count
})

// The width-fitted grid fills its column, so its own box is what to measure —
// it carries no max-width that could feed a narrower answer back into this.
let observer: ResizeObserver | undefined
let pending = 0
onMounted(() => {
  if (props.fit !== 'width' || !root.value) return
  observer = new ResizeObserver(([entry]) => {
    // Width only: the height is this component's own output — the column count
    // sets the number of rows — so reacting to it would be chasing itself.
    const width = entry?.contentRect.width ?? 0
    if (width === availableWidth.value) return
    // Applied on the next frame rather than inside the delivery: changing the
    // column count relays out the grid, and a layout change made while
    // observations are being delivered is what Chromium reports as
    // "ResizeObserver loop completed with undelivered notifications".
    cancelAnimationFrame(pending)
    pending = requestAnimationFrame(() => {
      availableWidth.value = width
    })
  })
  observer.observe(root.value)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(pending)
  observer?.disconnect()
})

/** Rows this grid draws — 16 for a half of the set at 8 columns, fewer as it widens. */
const rows = computed(() => Math.ceil(props.count / columns.value))

/** Displayed pixel columns per cell — 6 in Text Mode. */
const cellWidth = computed(() => (projects.current ? MODES[projects.current.type].cellWidth : 8))
const logicalWidth = computed(() => columns.value * cellWidth.value)
const logicalHeight = computed(() => rows.value * 8)

const canvas = useTemplateRef('canvas')

// Full re-render — cheap enough (128 chars) and tracks every pattern/color read
watchEffect(
  () => {
    const project = projects.current
    const ctx = canvas.value?.getContext('2d')
    if (!project || !ctx) return
    const width = cellWidth.value
    ctx.fillStyle = NEUTRAL
    ctx.fillRect(0, 0, logicalWidth.value, logicalHeight.value)
    for (let i = 0; i < props.count; i++) {
      const code = props.startCode + i
      const pattern = project.charsets[editor.selectedCharset]?.[code]
      if (!pattern) continue
      const rowColors = resolveRowColors(project, editor.selectedCharset, code)
      const originX = (i % columns.value) * width
      const originY = Math.floor(i / columns.value) * 8
      for (let y = 0; y < 8; y++) {
        const pair = rowColors[y]
        for (let x = 0; x < width; x++) {
          const index = charOps.getPixel(pattern, x, y) ? (pair?.fg ?? 15) : (pair?.bg ?? 1)
          const hex = colorHex(index)
          if (!hex) continue // transparent → neutral base coat
          ctx.fillStyle = hex
          ctx.fillRect(originX + x, originY + y, 1, 1)
        }
      }
    }
  },
  { flush: 'post' },
)

function onPointerDown(event: PointerEvent) {
  // The canvas scales with the viewport — derive cell size from its rendered rect
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const col = Math.floor(((event.clientX - rect.left) / rect.width) * columns.value)
  const row = Math.floor(((event.clientY - rect.top) / rect.height) * rows.value)
  if (col < 0 || col >= columns.value || row < 0 || row >= rows.value) return
  const index = row * columns.value + col
  if (index >= props.count) return
  editor.selectChar(props.startCode + index)
}

const hasSelection = computed(
  () =>
    editor.selectedChar >= props.startCode && editor.selectedChar < props.startCode + props.count,
)

/**
 * Graphics I: a grid row is exactly one 8-character color group — highlight
 * the selected character's group so the color picker's target is visible.
 */
const GROUP_SIZE = 8
const groupIndex = computed(() => {
  if (projects.current?.type !== 'graphics1' || !hasSelection.value) return null
  return Math.floor((editor.selectedChar - props.startCode) / GROUP_SIZE)
})

// Overlays are percentage-positioned so they track the scaled canvas. A group is
// eight characters wide, which is a whole row only while there are 8 columns —
// past that it is a run within one, so this spans cells rather than the row.
const groupStyle = computed(() => {
  const first = (groupIndex.value ?? 0) * GROUP_SIZE
  return {
    left: `${((first % columns.value) / columns.value) * 100}%`,
    width: `${(GROUP_SIZE / columns.value) * 100}%`,
    top: `${(Math.floor(first / columns.value) / rows.value) * 100}%`,
    height: `${100 / rows.value}%`,
  }
})

// Per-cell grid overlay
const gridStyle = computed(() => ({
  backgroundImage:
    'linear-gradient(to right, rgb(255 255 255 / 0.14) 1px, transparent 1px), ' +
    'linear-gradient(to bottom, rgb(255 255 255 / 0.14) 1px, transparent 1px)',
  backgroundSize: `${100 / columns.value}% ${100 / rows.value}%`,
}))

const ringStyle = computed(() => {
  const i = editor.selectedChar - props.startCode
  return {
    left: `${((i % columns.value) / columns.value) * 100}%`,
    top: `${(Math.floor(i / columns.value) / rows.value) * 100}%`,
    width: `${100 / columns.value}%`,
    height: `${100 / rows.value}%`,
  }
})
</script>

<template>
  <!-- Height-driven: shrinks with the available space, capped at ×3 scale.
       Width-driven: fills the column, as tall as the glyphs make it. -->
  <div
    ref="root"
    class="relative rounded-sm border border-ink-700"
    :class="fit === 'height' ? 'h-full min-h-32 w-fit' : 'w-full'"
    :style="fit === 'height' ? { maxHeight: `${logicalHeight * SCALE}px` } : undefined"
  >
    <canvas
      ref="canvas"
      :width="logicalWidth"
      :height="logicalHeight"
      class="block cursor-pointer [image-rendering:pixelated] select-none"
      :class="fit === 'height' ? 'h-full w-auto' : 'h-auto w-full'"
      :aria-label="`Characters ${startCode}–${startCode + count - 1} — click to select`"
      @pointerdown="onPointerDown"
      @contextmenu.prevent
    />
    <!-- Per-cell grid overlay -->
    <div class="pointer-events-none absolute inset-0" :style="gridStyle" />
    <!-- Graphics I color-group highlight (behind the selection ring).
         A non-TMS pure magenta so it reads as UI chrome, not palette color. -->
    <div
      v-if="groupIndex !== null"
      class="pointer-events-none absolute border-2 border-[#FF00FF] bg-[#FF00FF]/15 shadow-[0_0_0_1px_rgb(0_0_0/0.6)]"
      :style="groupStyle"
    />
    <div
      v-if="hasSelection"
      class="pointer-events-none absolute border-2 border-ink-50 outline outline-black/70"
      :style="ringStyle"
    />
  </div>
</template>
