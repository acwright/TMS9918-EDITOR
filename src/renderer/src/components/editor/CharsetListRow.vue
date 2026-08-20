<script setup lang="ts">
import { computed, useTemplateRef, watchEffect } from 'vue'
import * as charOps from '@/domain/charOps'
import { colorHex, resolveRowColors } from '@/domain/colors'
import { MODES } from '@/domain/modes'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'

/**
 * One row of the list view: the glyph, its code in both bases, and whether the
 * slot is still empty — which is the question the picture of the set can't
 * answer, and the one you ask when looking for somewhere to draw.
 */
const props = defineProps<{ code: number }>()

const projects = useProjectsStore()
const editor = useEditorStore()

/** Rendered at 3×, the scale the blocks view caps at, so glyphs read the same. */
const SCALE = 3
const NEUTRAL = '#0a0a0a' // ink-950: transparent renders as the app background

/** Displayed pixel columns per cell — 6 in Text Mode. */
const cellWidth = computed(() => (projects.current ? MODES[projects.current.type].cellWidth : 8))

const pattern = computed(() => projects.current?.charsets[editor.selectedCharset]?.[props.code])

/** A glyph with no bits set draws nothing — worth saying, since it is a free slot. */
const blank = computed(() => pattern.value?.every((byte) => byte === 0) ?? false)

const selected = computed(() => editor.selectedChar === props.code)

const canvas = useTemplateRef('canvas')

watchEffect(
  () => {
    const project = projects.current
    const ctx = canvas.value?.getContext('2d')
    const bytes = pattern.value
    if (!project || !ctx || !bytes) return
    const width = cellWidth.value
    ctx.fillStyle = NEUTRAL
    ctx.fillRect(0, 0, width, 8)
    const rowColors = resolveRowColors(project, editor.selectedCharset, props.code)
    for (let y = 0; y < 8; y++) {
      const pair = rowColors[y]
      for (let x = 0; x < width; x++) {
        const index = charOps.getPixel(bytes, x, y) ? (pair?.fg ?? 15) : (pair?.bg ?? 1)
        const hex = colorHex(index)
        if (!hex) continue // transparent → neutral base coat
        ctx.fillStyle = hex
        ctx.fillRect(x, y, 1, 1)
      }
    }
  },
  { flush: 'post' },
)

const hex = computed(() => props.code.toString(16).toUpperCase().padStart(2, '0'))

const label = computed(
  () => `Character ${props.code}, $${hex.value}` + (blank.value ? ', blank' : ''),
)
</script>

<template>
  <button
    type="button"
    class="flex w-full cursor-pointer items-center gap-3 border-b border-ink-850 px-2 py-1 text-left transition-colors last:border-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink-300"
    :class="selected ? 'bg-ink-100 text-ink-950' : 'text-ink-300 hover:bg-ink-850'"
    role="option"
    :data-code="code"
    :aria-selected="selected"
    :aria-label="label"
    :tabindex="selected ? 0 : -1"
    @click="editor.selectChar(code)"
  >
    <canvas
      ref="canvas"
      :width="cellWidth"
      :height="8"
      class="shrink-0 rounded-xs border border-ink-700 [image-rendering:pixelated]"
      :style="{ width: `${cellWidth * SCALE}px`, height: `${8 * SCALE}px` }"
    />
    <span class="font-mono text-xs [font-variant-numeric:tabular-nums]">
      #{{ code }} · ${{ hex }}
    </span>
    <span v-if="blank" class="ml-auto text-[10px] tracking-wider uppercase opacity-60">Blank</span>
  </button>
</template>
