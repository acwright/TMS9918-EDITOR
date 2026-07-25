<script setup lang="ts">
import { computed, useTemplateRef, watchEffect } from 'vue'
import { renderSpriteFrame } from '@/utils/spriteRender'
import { useProjectsStore } from '@/stores/projects'

/**
 * One sprite drawn over the backdrop at hardware magnification, then scaled up
 * for viewing. Phase 27 wraps this in the animation transport; `spriteSlot` is
 * what the frame player will drive. (Not named `slot` — that is a reserved
 * attribute name in Vue templates.)
 */
const props = withDefaults(
  defineProps<{
    spriteSlot: number
    /** Hardware magnification (VDP R1 MAG): 2 doubles every sprite pixel. */
    mag?: 1 | 2
    /** View zoom on top of magnification. */
    scale?: number
  }>(),
  { mag: 1, scale: 4 },
)

const projects = useProjectsStore()

/**
 * A 32-pixel stage holds every combination (16×16 at MAG 2 is 32×32), so the
 * preview box never resizes as the size or magnification setting changes.
 */
const STAGE = 32

const canvas = useTemplateRef('canvas')

watchEffect(
  () => {
    const project = projects.current
    const ctx = canvas.value?.getContext('2d')
    if (!project || !ctx) return
    ctx.imageSmoothingEnabled = false
    // Magnification doubles every sprite pixel — draw at half the stage and let
    // the transform scale it, so MAG 2 costs nothing extra to render.
    ctx.setTransform(props.mag, 0, 0, props.mag, 0, 0)
    renderSpriteFrame(ctx, project, props.spriteSlot, STAGE / props.mag)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  },
  { flush: 'post' },
)

const pixelSize = computed(() => STAGE * props.scale)
</script>

<template>
  <canvas
    ref="canvas"
    :width="STAGE"
    :height="STAGE"
    class="rounded-sm border border-ink-700 [image-rendering:pixelated]"
    :style="{ width: `${pixelSize}px`, height: `${pixelSize}px` }"
    aria-label="Sprite preview"
  />
</template>
