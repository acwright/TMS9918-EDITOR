<script setup lang="ts">
import { computed, useTemplateRef, watchEffect } from 'vue'
import { INVISIBLE_MARKER_HEX, drawSprite, fillBackdrop, spriteColorOf } from '@/utils/spriteRender'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'

/**
 * One sprite slot as its own canvas, drawn at the project's sprite size and
 * scaled by CSS — the unit the grid view lays out.
 *
 * The sheet draws all of these into one canvas and does the click arithmetic
 * itself; a fixed-size cell can't, because it wraps to whatever the column
 * fits. So each slot is an element: it can carry `data-slot` for
 * scroll-into-view, its own selection ring, and its own click handler.
 */
// `slotIndex`, not `slot`: `:slot` is a deprecated Vue 2 attribute and the
// linter rejects it, however ordinary a prop name it would otherwise be.
const props = defineProps<{ slotIndex: number }>()

const projects = useProjectsStore()
const editor = useEditorStore()

const size = computed(() => editor.spriteSize)

const color = computed(() =>
  projects.current ? spriteColorOf(projects.current, props.slotIndex) : 15,
)

/** Colour 0 is invisible on hardware — the same marker the sheet draws. */
const invisible = computed(() => color.value === 0)

const selected = computed(() => editor.selectedSprite === props.slotIndex)

const canvas = useTemplateRef('canvas')

watchEffect(
  () => {
    const project = projects.current
    const ctx = canvas.value?.getContext('2d')
    if (!project || !ctx) return
    const side = size.value
    fillBackdrop(ctx, project, side, side)
    drawSprite(ctx, project, props.slotIndex, { color: color.value })
    if (color.value === 0) {
      ctx.fillStyle = INVISIBLE_MARKER_HEX
      ctx.fillRect(0, 0, 2, 2)
    }
  },
  { flush: 'post' },
)

const label = computed(() => {
  const hex = props.slotIndex.toString(16).toUpperCase().padStart(2, '0')
  return `Sprite ${props.slotIndex}, $${hex}` + (invisible.value ? ', invisible' : '')
})
</script>

<template>
  <button
    type="button"
    class="relative aspect-square cursor-pointer rounded-sm border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-300"
    :class="
      selected ? 'border-ink-50 outline outline-black/70' : 'border-ink-700 hover:border-ink-500'
    "
    :data-slot="slotIndex"
    :aria-label="label"
    :aria-pressed="selected"
    @click="editor.selectSprite(slotIndex)"
    @contextmenu.prevent
  >
    <canvas
      ref="canvas"
      :width="size"
      :height="size"
      class="block size-full [image-rendering:pixelated] select-none"
    />
  </button>
</template>
