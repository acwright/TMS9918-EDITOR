<script setup lang="ts">
import { computed, useTemplateRef, watchEffect } from 'vue'
import * as charOps from '@/domain/charOps'
import { colorHex } from '@/domain/colors'
import type { CharPattern, ColorPair } from '@/domain/types'

const props = withDefaults(
  defineProps<{
    pattern: CharPattern
    /** fg/bg pair per pixel row (from resolveRowColors) */
    rowColors: ColorPair[]
    /** Displayed columns per cell — 6 in Text Mode, otherwise 8 */
    cellWidth?: number
  }>(),
  { cellWidth: 8 },
)

const NEUTRAL = '#0a0a0a' // ink-950: transparent renders as the app background
const SCALE = 4

// 3×3 tiling of the displayed cell (8×8, or 6×8 in Text Mode), scaled via CSS
const tileWidth = computed(() => props.cellWidth * 3)
const TILE_HEIGHT = 24

const canvas = useTemplateRef('canvas')

// flush: 'post' so the canvas has its updated width before we draw into it
watchEffect(
  () => {
    const ctx = canvas.value?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = NEUTRAL
    ctx.fillRect(0, 0, tileWidth.value, TILE_HEIGHT)
    for (let y = 0; y < 8; y++) {
      const pair = props.rowColors[y]
      for (let x = 0; x < props.cellWidth; x++) {
        const index = charOps.getPixel(props.pattern, x, y) ? (pair?.fg ?? 15) : (pair?.bg ?? 1)
        const hex = colorHex(index)
        if (!hex) continue // transparent → neutral base coat
        ctx.fillStyle = hex
        for (let ty = 0; ty < 3; ty++) {
          for (let tx = 0; tx < 3; tx++) {
            ctx.fillRect(tx * props.cellWidth + x, ty * 8 + y, 1, 1)
          }
        }
      }
    }
  },
  { flush: 'post' },
)
</script>

<template>
  <canvas
    ref="canvas"
    :width="tileWidth"
    :height="TILE_HEIGHT"
    class="h-24 border border-ink-700 [image-rendering:pixelated]"
    :style="{ width: `${tileWidth * SCALE}px` }"
    aria-label="3×3 tiled preview of the current character"
  />
</template>
