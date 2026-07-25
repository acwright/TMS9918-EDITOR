<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef } from 'vue'
import { colorHex } from '@/domain/colors'

/**
 * A square pixel grid. Purely presentational: the parent supplies the pixel
 * states and each cell's palette colour, and receives `paint` events — so the
 * same component drives 8×8 characters (via charOps) and 8×8 / 16×16 sprites
 * (via spriteOps), neither of which it knows about (PLAN.md §14.8, Phase 26).
 */
const props = withDefaults(
  defineProps<{
    /** Pixel states, row-major, `size × size` entries. */
    pixels: boolean[]
    /** Palette index to paint each cell, row-major, `size × size` entries. */
    colors: number[]
    /** Grid side length in cells. */
    size?: number
    /** Columns from this index on are dimmed/hatched (Text Mode: 6). */
    dimFrom?: number | null
    /** GMII: subtly highlight the color-targeted row (Decision 2). */
    highlightRow?: number | null
    /** 16×16 sprites: draw the seams between the four hardware quadrants (§14.3). */
    quadrantGuides?: boolean
  }>(),
  { size: 8, dimFrom: null, highlightRow: null, quadrantGuides: false },
)

const emit = defineEmits<{
  strokeStart: []
  paint: [x: number, y: number, on: boolean]
  strokeEnd: []
}>()

const cells = computed(() =>
  Array.from({ length: props.size * props.size }, (_, i) => ({
    x: i % props.size,
    y: Math.floor(i / props.size),
  })),
)

const templateColumns = computed(() => `repeat(${props.size}, minmax(0, 1fr))`)

/** Percentage height of one row — drives the row highlight and quadrant seams. */
const rowPercent = computed(() => 100 / props.size)

const grid = useTemplateRef('grid')

/** Pixel state currently being painted by a drag; null when not dragging. */
const painting = ref<boolean | null>(null)
let lastCell = -1

function pixelAt(x: number, y: number): boolean {
  return props.pixels[y * props.size + x] ?? false
}

// Pointer position → cell. Computed from the grid rect so it works for both
// mouse and touch drags (touch fires pointermove on the capturing element
// only, so per-cell pointerenter can't drive touch strokes).
function cellAt(event: PointerEvent): { x: number; y: number } | null {
  const rect = grid.value?.getBoundingClientRect()
  if (!rect) return null
  const size = props.size
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * size)
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * size)
  if (x < 0 || x >= size || y < 0 || y >= size) return null
  return { x, y }
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 && event.button !== 2) return
  const cell = cellAt(event)
  if (!cell) return
  event.preventDefault()
  grid.value?.setPointerCapture(event.pointerId)
  // Left/touch toggles the pixel and drags paint that state; right erases.
  const on = event.button === 2 ? false : !pixelAt(cell.x, cell.y)
  painting.value = on
  lastCell = cell.y * props.size + cell.x
  emit('strokeStart')
  emit('paint', cell.x, cell.y, on)
}

function onPointerMove(event: PointerEvent) {
  if (painting.value === null) return
  const cell = cellAt(event)
  if (!cell) return
  const index = cell.y * props.size + cell.x
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
  const index = props.colors[y * props.size + x] ?? 1
  // Transparent renders as the app's neutral background (PLAN.md §4.1)
  return { backgroundColor: colorHex(index) ?? 'var(--color-ink-950)' }
}
</script>

<template>
  <div
    ref="grid"
    class="relative grid aspect-square size-full cursor-crosshair gap-px border border-ink-700 bg-ink-700 touch-none select-none"
    :style="{ gridTemplateColumns: templateColumns }"
    aria-label="Pixel editor — draw to toggle pixels"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @contextmenu.prevent
  >
    <!-- Color-targeted row indicator (GMII) -->
    <div
      v-if="highlightRow !== null"
      class="pointer-events-none absolute inset-x-0 z-10 border-y border-ink-300/60"
      :style="{ top: `${highlightRow * rowPercent}%`, height: `${rowPercent}%` }"
    />
    <!-- 16×16 sprite quadrant seams: each quadrant is a separate hardware pattern -->
    <template v-if="quadrantGuides">
      <div class="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px bg-ink-300/40" />
      <div class="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px bg-ink-300/40" />
    </template>
    <div
      v-for="cell in cells"
      :key="`${cell.x},${cell.y}`"
      class="pointer-events-none relative"
      :style="cellStyle(cell.x, cell.y)"
    >
      <!-- Text Mode: columns 6–7 are stored but never displayed — hatch them -->
      <span
        v-if="dimFrom !== null && cell.x >= dimFrom"
        class="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgb(0_0_0/0.55)_3px,rgb(0_0_0/0.55)_6px)]"
      />
    </div>
  </div>
</template>
