<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watchEffect } from 'vue'
import * as charOps from '@/domain/charOps'
import * as screenOps from '@/domain/screenOps'
import { colorHex, resolveRowColors } from '@/domain/colors'
import { MODES, charsetForRow } from '@/domain/modes'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'

defineProps<{
  /** Display scale, 1–8 (logical pixel → CSS pixels) */
  scale: number
  showGrid: boolean
}>()

const projects = useProjectsStore()
const editor = useEditorStore()

const NEUTRAL = '#0a0a0a' // ink-950: transparent renders as the app background

const mode = computed(() => MODES[projects.current?.type ?? 'graphics1'])
const logicalWidth = computed(() => mode.value.columns * mode.value.cellWidth)
const logicalHeight = computed(() => mode.value.rows * mode.value.cellHeight)

const canvas = useTemplateRef('canvas')

watchEffect(
  () => {
    const project = projects.current
    const screen = editor.currentScreen
    const ctx = canvas.value?.getContext('2d')
    if (!project || !screen || !ctx) return
    const { columns, rows, cellWidth } = mode.value
    ctx.fillStyle = NEUTRAL
    ctx.fillRect(0, 0, logicalWidth.value, logicalHeight.value)
    for (let cy = 0; cy < rows; cy++) {
      // Independent GMII renders each screen third from its own charset
      const charsetIndex = charsetForRow(project.type, project.settings.g2CharsetMode, cy)
      for (let cx = 0; cx < columns; cx++) {
        const code = screenOps.getCell(screen.cells, columns, cx, cy)
        const pattern = project.charsets[charsetIndex]?.[code]
        if (!pattern) continue
        const rowColors = resolveRowColors(project, charsetIndex, code)
        const originX = cx * cellWidth
        const originY = cy * 8
        for (let y = 0; y < 8; y++) {
          const pair = rowColors[y]
          for (let x = 0; x < cellWidth; x++) {
            const index = charOps.getPixel(pattern, x, y) ? (pair?.fg ?? 15) : (pair?.bg ?? 1)
            const hex = colorHex(index)
            if (!hex) continue // transparent → neutral base coat
            ctx.fillStyle = hex
            ctx.fillRect(originX + x, originY + y, 1, 1)
          }
        }
      }
    }
  },
  { flush: 'post' },
)

// --- Painting: left paints the selected character, right erases (to char 0) ---

/** Char code being painted by the active drag; null when not dragging. */
const painting = ref<number | null>(null)
let lastCell = -1

function cellAt(event: PointerEvent): { x: number; y: number } | null {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * mode.value.columns)
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * mode.value.rows)
  if (x < 0 || x >= mode.value.columns || y < 0 || y >= mode.value.rows) return null
  return { x, y }
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 && event.button !== 2) return
  event.preventDefault()
  const cell = cellAt(event)
  if (!cell) return
  // Capture so touch drags keep reporting to the canvas even off its bounds
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  const code = event.button === 2 ? 0 : editor.selectedChar
  painting.value = code
  lastCell = cell.y * mode.value.columns + cell.x
  editor.beginStroke(code === 0 ? 'Erase' : 'Draw')
  editor.paintCell(cell.x, cell.y, code)
}

function onPointerMove(event: PointerEvent) {
  if (painting.value === null) return
  const cell = cellAt(event)
  if (!cell) return
  const index = cell.y * mode.value.columns + cell.x
  if (index === lastCell) return
  lastCell = index
  editor.paintCell(cell.x, cell.y, painting.value)
}

function endStroke() {
  if (painting.value === null) return
  painting.value = null
  lastCell = -1
  editor.endStroke()
}

// End the stroke even when the pointer is released outside the canvas
window.addEventListener('pointerup', endStroke)
onBeforeUnmount(() => window.removeEventListener('pointerup', endStroke))

const gridStyle = computed(() => ({
  backgroundImage:
    'linear-gradient(to right, rgb(255 255 255 / 0.18) 1px, transparent 1px), ' +
    'linear-gradient(to bottom, rgb(255 255 255 / 0.18) 1px, transparent 1px)',
  backgroundSize: `${100 / mode.value.columns}% ${100 / mode.value.rows}%`,
}))
</script>

<template>
  <div class="relative w-fit border border-ink-700">
    <canvas
      ref="canvas"
      :width="logicalWidth"
      :height="logicalHeight"
      class="block cursor-crosshair touch-none [image-rendering:pixelated] select-none"
      :style="{ width: `${logicalWidth * scale}px`, height: `${logicalHeight * scale}px` }"
      aria-label="Screen editor — left-click paints the selected character, right-click erases"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @contextmenu.prevent
    />
    <div v-if="showGrid" class="pointer-events-none absolute inset-0" :style="gridStyle" />
  </div>
</template>
