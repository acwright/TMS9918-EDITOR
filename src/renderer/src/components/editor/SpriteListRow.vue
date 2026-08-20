<script setup lang="ts">
import { computed, useTemplateRef, watchEffect } from 'vue'
import { PALETTE } from '@/domain/palette'
import { patternsForSlot, spritePatterns } from '@/domain/sprites'
import { INVISIBLE_MARKER_HEX, drawSprite, fillBackdrop, spriteColorOf } from '@/utils/spriteRender'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'

/**
 * One row of the list view: the slot in both bases, the hardware patterns it
 * occupies, its colour by name, and whether it is blank or invisible.
 *
 * That last pair is the reason the list exists. The sheet marks a colour-0 slot
 * with a magenta corner, which is a hint; a row can say *invisible*, and can
 * distinguish it from a slot that simply has no pixels set — the two look
 * identical in every picture of the set (PLAN.md §16, Decision 38).
 */
const props = defineProps<{ slotIndex: number }>()

const projects = useProjectsStore()
const editor = useEditorStore()

/** Row scale: 8×8 draws at 3× and 16×16 at 1.5×, so both rows are 24 px tall. */
const ROW_PX = 24

const size = computed(() => editor.spriteSize)

const color = computed(() =>
  projects.current ? spriteColorOf(projects.current, props.slotIndex) : 15,
)

const colorName = computed(() => PALETTE[color.value]?.name ?? 'White')

/** Colour 0 is invisible on hardware — pixels and all. */
const invisible = computed(() => color.value === 0)

/**
 * The patterns this slot occupies: one at 8×8, four at 16×16, since a 16×16
 * sprite is a quad. Displayed as a range rather than four numbers.
 */
const patterns = computed(() => patternsForSlot(props.slotIndex, size.value))

const patternLabel = computed(() => {
  const list = patterns.value
  const first = list[0] ?? 0
  const last = list[list.length - 1] ?? first
  return first === last ? `pat ${first}` : `pat ${first}–${last}`
})

/** No bit set in any of its patterns — a slot that is still free to draw in. */
const blank = computed(() => {
  const charset = projects.current?.charsets[0]
  if (!charset) return false
  return spritePatterns(charset, props.slotIndex, size.value).every((pattern) =>
    pattern.every((byte) => byte === 0),
  )
})

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

const hex = computed(() => props.slotIndex.toString(16).toUpperCase().padStart(2, '0'))

const label = computed(
  () =>
    `Sprite ${props.slotIndex}, $${hex.value}, ${patternLabel.value}, ${colorName.value}` +
    (blank.value ? ', blank' : '') +
    (invisible.value ? ', invisible' : ''),
)
</script>

<template>
  <button
    type="button"
    class="flex w-full cursor-pointer items-center gap-3 border-b border-ink-850 px-2 py-1 text-left transition-colors last:border-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink-300"
    :class="selected ? 'bg-ink-100 text-ink-950' : 'text-ink-300 hover:bg-ink-850'"
    role="option"
    :data-slot="slotIndex"
    :aria-selected="selected"
    :aria-label="label"
    :tabindex="selected ? 0 : -1"
    @click="editor.selectSprite(slotIndex)"
  >
    <canvas
      ref="canvas"
      :width="size"
      :height="size"
      class="shrink-0 rounded-xs border border-ink-700 [image-rendering:pixelated]"
      :style="{ width: `${ROW_PX}px`, height: `${ROW_PX}px` }"
    />
    <span class="font-mono text-xs [font-variant-numeric:tabular-nums]">
      #{{ slotIndex }} · ${{ hex }}
    </span>
    <span class="font-mono text-[10px] opacity-60">{{ patternLabel }}</span>
    <span class="truncate text-xs opacity-70">{{ colorName }}</span>
    <span class="ml-auto flex shrink-0 items-center gap-1 text-[10px] tracking-wider uppercase">
      <span v-if="blank" class="opacity-60">Blank</span>
      <span v-if="invisible" class="opacity-60">Invisible</span>
    </span>
  </button>
</template>
