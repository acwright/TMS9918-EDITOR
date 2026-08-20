<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watchEffect } from 'vue'
import { MODES } from '@/domain/modes'
import type { PointerCell } from '@/domain/screenStatus'
import { renderScreen } from '@/utils/screenRender'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'

defineProps<{
  /** Display scale, 1–8 (logical pixel → CSS pixels) */
  scale: number
  showGrid: boolean
}>()

/** The cell under the pointer, or null once it leaves — drives the status bar. */
const emit = defineEmits<{ hover: [PointerCell | null] }>()

const projects = useProjectsStore()
const editor = useEditorStore()

const mode = computed(() => MODES[projects.current?.type ?? 'graphics1'])
const logicalWidth = computed(() => mode.value.columns * mode.value.cellWidth)
const logicalHeight = computed(() => mode.value.rows * mode.value.cellHeight)

const isMulticolor = computed(() => projects.current?.type === 'multicolor')
/** The code a left-click/drag paints: a palette index (multicolor) or char code. */
const brushCode = computed(() => (isMulticolor.value ? editor.paintColor : editor.selectedChar))

const canvas = useTemplateRef('canvas')

watchEffect(
  () => {
    const project = projects.current
    const screen = editor.currentScreen
    const ctx = canvas.value?.getContext('2d')
    if (!project || !screen || !ctx) return
    renderScreen(ctx, project, screen)
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

/** Touch/pen leave no pointer behind, so their strokes end the hover readout. */
let lastPointerType = 'mouse'

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 && event.button !== 2) return
  event.preventDefault()
  lastPointerType = event.pointerType
  const cell = cellAt(event)
  emit('hover', cell)
  if (!cell) return
  // Capture so touch drags keep reporting to the canvas even off its bounds
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  const code = event.button === 2 ? 0 : brushCode.value
  painting.value = code
  lastCell = cell.y * mode.value.columns + cell.x
  editor.beginStroke(code === 0 ? 'Erase' : 'Draw')
  editor.paintCell(cell.x, cell.y, code)
}

function onPointerMove(event: PointerEvent) {
  lastPointerType = event.pointerType
  const cell = cellAt(event)
  emit('hover', cell)
  if (painting.value === null || !cell) return
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
  if (lastPointerType !== 'mouse') emit('hover', null)
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
      :aria-label="
        isMulticolor
          ? 'Screen editor — left-click paints the selected colour, right-click erases'
          : 'Screen editor — left-click paints the selected character, right-click erases'
      "
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerleave="emit('hover', null)"
      @contextmenu.prevent
    />
    <div v-if="showGrid" class="pointer-events-none absolute inset-0" :style="gridStyle" />
  </div>
</template>
