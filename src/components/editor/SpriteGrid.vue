<script setup lang="ts">
import { computed, useTemplateRef, watchEffect } from 'vue'
import { SPRITE_SHEET_SIZE, renderSpriteSheet, sheetColumns } from '@/utils/spriteRender'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'

const projects = useProjectsStore()
const editor = useEditorStore()

/**
 * Every sprite slot at the project's size: 16 × 16 slots of 8×8 pixels, or
 * 8 × 8 slots of 16×16 pixels. Either way the sheet is 128 × 128 logical pixels
 * (PLAN.md §14.5) — the same layout Phase 28 exports as a PNG.
 */
const SHEET = SPRITE_SHEET_SIZE
const columns = computed(() => sheetColumns(editor.spriteSize))
const rows = computed(() => columns.value)

const canvas = useTemplateRef('canvas')

// Full re-render — 256 slots at most, and it tracks every pattern/colour read.
watchEffect(
  () => {
    const project = projects.current
    const ctx = canvas.value?.getContext('2d')
    if (!project || !ctx) return
    renderSpriteSheet(ctx, project, { markInvisible: true })
  },
  { flush: 'post' },
)

function onPointerDown(event: PointerEvent) {
  // The canvas scales with the viewport — derive cell size from its rendered rect
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const col = Math.floor(((event.clientX - rect.left) / rect.width) * columns.value)
  const row = Math.floor(((event.clientY - rect.top) / rect.height) * rows.value)
  if (col < 0 || col >= columns.value || row < 0 || row >= rows.value) return
  editor.selectSprite(row * columns.value + col)
}

// Overlays are percentage-positioned so they track the scaled canvas
const gridStyle = computed(() => ({
  backgroundImage:
    'linear-gradient(to right, rgb(255 255 255 / 0.14) 1px, transparent 1px), ' +
    'linear-gradient(to bottom, rgb(255 255 255 / 0.14) 1px, transparent 1px)',
  backgroundSize: `${100 / columns.value}% ${100 / rows.value}%`,
}))

const ringStyle = computed(() => {
  const slot = editor.selectedSprite
  return {
    left: `${((slot % columns.value) / columns.value) * 100}%`,
    top: `${(Math.floor(slot / columns.value) / rows.value) * 100}%`,
    width: `${100 / columns.value}%`,
    height: `${100 / rows.value}%`,
  }
})
</script>

<template>
  <div class="relative h-full max-h-128 min-h-32 w-fit rounded-sm border border-ink-700">
    <canvas
      ref="canvas"
      :width="SHEET"
      :height="SHEET"
      class="block h-full w-auto cursor-pointer [image-rendering:pixelated] select-none"
      :aria-label="`Sprites 0–${editor.spriteSlots - 1} — click to select`"
      @pointerdown="onPointerDown"
      @contextmenu.prevent
    />
    <div class="pointer-events-none absolute inset-0" :style="gridStyle" />
    <div
      class="pointer-events-none absolute border-2 border-ink-50 outline outline-black/70"
      :style="ringStyle"
    />
  </div>
</template>
