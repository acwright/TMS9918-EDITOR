<script setup lang="ts">
import { onBeforeUnmount, ref, useTemplateRef } from 'vue'
import type { CharPattern, ColorPair } from '@/domain/types'
import * as charOps from '@/domain/charOps'
import { colorHex } from '@/domain/colors'

const props = withDefaults(
  defineProps<{
    pattern: CharPattern
    /** fg/bg pair per pixel row (from resolveRowColors) */
    rowColors: ColorPair[]
    /** Columns from this index on are dimmed/hatched (Text Mode: 6) */
    dimFrom?: number
    /** GMII: subtly highlight the color-targeted row (Decision 2) */
    highlightRow?: number | null
  }>(),
  { dimFrom: 8, highlightRow: null },
)

const emit = defineEmits<{
  strokeStart: []
  paint: [x: number, y: number, on: boolean]
  strokeEnd: []
}>()

const CELLS = Array.from({ length: 64 }, (_, i) => ({ x: i % 8, y: Math.floor(i / 8) }))

const grid = useTemplateRef('grid')

/** Pixel state currently being painted by a drag; null when not dragging. */
const painting = ref<boolean | null>(null)
let lastCell = -1

// Pointer position → cell. Computed from the grid rect so it works for both
// mouse and touch drags (touch fires pointermove on the capturing element
// only, so per-cell pointerenter can't drive touch strokes).
function cellAt(event: PointerEvent): { x: number; y: number } | null {
  const rect = grid.value?.getBoundingClientRect()
  if (!rect) return null
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * 8)
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * 8)
  if (x < 0 || x >= 8 || y < 0 || y >= 8) return null
  return { x, y }
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 && event.button !== 2) return
  const cell = cellAt(event)
  if (!cell) return
  event.preventDefault()
  grid.value?.setPointerCapture(event.pointerId)
  // Left/touch toggles the pixel and drags paint that state; right erases.
  const on = event.button === 2 ? false : !charOps.getPixel(props.pattern, cell.x, cell.y)
  painting.value = on
  lastCell = cell.y * 8 + cell.x
  emit('strokeStart')
  emit('paint', cell.x, cell.y, on)
}

function onPointerMove(event: PointerEvent) {
  if (painting.value === null) return
  const cell = cellAt(event)
  if (!cell) return
  const index = cell.y * 8 + cell.x
  if (index === lastCell) return
  lastCell = index
  emit('paint', cell.x, cell.y, painting.value)
}

function endStroke() {
  if (painting.value === null) return
  painting.value = null
  lastCell = -1
  emit('strokeEnd')
}

// End the stroke even when the pointer is released outside the grid
window.addEventListener('pointerup', endStroke)
onBeforeUnmount(() => window.removeEventListener('pointerup', endStroke))

function cellStyle(x: number, y: number): { backgroundColor: string } {
  const pair = props.rowColors[y]
  const index = charOps.getPixel(props.pattern, x, y) ? (pair?.fg ?? 15) : (pair?.bg ?? 1)
  // Transparent renders as the app's neutral background (PLAN.md §4.1)
  return { backgroundColor: colorHex(index) ?? 'var(--color-ink-950)' }
}
</script>

<template>
  <div
    ref="grid"
    class="relative grid aspect-square size-full cursor-crosshair grid-cols-8 gap-px border border-ink-700 bg-ink-700 touch-none select-none"
    aria-label="Pixel editor — draw to toggle pixels"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @contextmenu.prevent
  >
    <!-- Color-targeted row indicator (GMII) -->
    <div
      v-if="highlightRow !== null"
      class="pointer-events-none absolute inset-x-0 z-10 border-y border-ink-300/60"
      :style="{ top: `${highlightRow * 12.5}%`, height: '12.5%' }"
    />
    <div
      v-for="cell in CELLS"
      :key="`${cell.x},${cell.y}`"
      class="pointer-events-none relative"
      :style="cellStyle(cell.x, cell.y)"
    >
      <!-- Text Mode: columns 6–7 are stored but never displayed — hatch them -->
      <span
        v-if="cell.x >= dimFrom"
        class="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgb(0_0_0/0.55)_3px,rgb(0_0_0/0.55)_6px)]"
      />
    </div>
  </div>
</template>
