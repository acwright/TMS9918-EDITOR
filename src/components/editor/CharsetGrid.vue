<script setup lang="ts">
import { computed, useTemplateRef, watchEffect } from 'vue'
import * as charOps from '@/domain/charOps'
import { colorHex, resolveRowColors } from '@/domain/colors'
import { MODES } from '@/domain/modes'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'

const props = defineProps<{
  /** First character code in this grid (0 or 128) */
  startCode: number
}>()

const projects = useProjectsStore()
const editor = useEditorStore()

const COLUMNS = 8
const ROWS = 16 // 128 characters per half
const SCALE = 3
const NEUTRAL = '#0a0a0a' // ink-950: transparent renders as the app background

/** Displayed pixel columns per cell — 6 in Text Mode. */
const cellWidth = computed(() => (projects.current ? MODES[projects.current.type].cellWidth : 8))
const logicalWidth = computed(() => COLUMNS * cellWidth.value)
const logicalHeight = ROWS * 8

const canvas = useTemplateRef('canvas')

// Full re-render — cheap enough (128 chars) and tracks every pattern/color read
watchEffect(
  () => {
    const project = projects.current
    const ctx = canvas.value?.getContext('2d')
    if (!project || !ctx) return
    const width = cellWidth.value
    ctx.fillStyle = NEUTRAL
    ctx.fillRect(0, 0, logicalWidth.value, logicalHeight)
    for (let i = 0; i < COLUMNS * ROWS; i++) {
      const code = props.startCode + i
      const pattern = project.charsets[editor.selectedCharset]?.[code]
      if (!pattern) continue
      const rowColors = resolveRowColors(project, editor.selectedCharset, code)
      const originX = (i % COLUMNS) * width
      const originY = Math.floor(i / COLUMNS) * 8
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
  const col = Math.floor(((event.clientX - rect.left) / rect.width) * COLUMNS)
  const row = Math.floor(((event.clientY - rect.top) / rect.height) * ROWS)
  if (col < 0 || col >= COLUMNS || row < 0 || row >= ROWS) return
  editor.selectChar(props.startCode + row * COLUMNS + col)
}

const hasSelection = computed(
  () => editor.selectedChar >= props.startCode && editor.selectedChar < props.startCode + 128,
)

/**
 * Graphics I: a grid row is exactly one 8-character color group — highlight
 * the selected character's group so the color picker's target is visible.
 */
const groupRow = computed(() => {
  if (projects.current?.type !== 'graphics1' || !hasSelection.value) return null
  return Math.floor((editor.selectedChar - props.startCode) / COLUMNS)
})

// Overlays are percentage-positioned so they track the scaled canvas
const groupStyle = computed(() => ({
  top: `${((groupRow.value ?? 0) / ROWS) * 100}%`,
  height: `${100 / ROWS}%`,
}))

// Per-cell grid overlay
const gridStyle = {
  backgroundImage:
    'linear-gradient(to right, rgb(255 255 255 / 0.14) 1px, transparent 1px), ' +
    'linear-gradient(to bottom, rgb(255 255 255 / 0.14) 1px, transparent 1px)',
  backgroundSize: `${100 / COLUMNS}% ${100 / ROWS}%`,
}

const ringStyle = computed(() => {
  const i = editor.selectedChar - props.startCode
  return {
    left: `${((i % COLUMNS) / COLUMNS) * 100}%`,
    top: `${(Math.floor(i / COLUMNS) / ROWS) * 100}%`,
    width: `${100 / COLUMNS}%`,
    height: `${100 / ROWS}%`,
  }
})
</script>

<template>
  <!-- Height-driven: shrinks with the available space, capped at ×3 scale -->
  <div
    class="relative h-full min-h-32 w-fit rounded-sm border border-ink-700"
    :style="{ maxHeight: `${logicalHeight * SCALE}px` }"
  >
    <canvas
      ref="canvas"
      :width="logicalWidth"
      :height="logicalHeight"
      class="block h-full w-auto cursor-pointer [image-rendering:pixelated] select-none"
      :aria-label="`Characters ${startCode}–${startCode + 127} — click to select`"
      @pointerdown="onPointerDown"
      @contextmenu.prevent
    />
    <!-- Per-cell grid overlay -->
    <div class="pointer-events-none absolute inset-0" :style="gridStyle" />
    <!-- Graphics I color-group highlight (behind the selection ring).
         A non-TMS pure magenta so it reads as UI chrome, not palette color. -->
    <div
      v-if="groupRow !== null"
      class="pointer-events-none absolute inset-x-0 border-2 border-[#FF00FF] bg-[#FF00FF]/15 shadow-[0_0_0_1px_rgb(0_0_0/0.6)]"
      :style="groupStyle"
    />
    <div
      v-if="hasSelection"
      class="pointer-events-none absolute border-2 border-ink-50 outline outline-black/70"
      :style="ringStyle"
    />
  </div>
</template>
