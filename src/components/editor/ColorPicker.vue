<script setup lang="ts">
import { ref } from 'vue'
import AppTooltip from '@/components/base/AppTooltip.vue'
import { PALETTE } from '@/domain/palette'
import { useEditorStore, type ColorSlot } from '@/stores/editor'

/**
 * `singleSelect` (Multicolor, Decision 9): one active paint colour instead of an
 * fg/bg pair — no F/B badges or touch toggle; any click sets `paintColor`.
 */
const props = defineProps<{ singleSelect?: boolean }>()

const editor = useEditorStore()

/**
 * Left-click target for swatches. Right-click always sets background;
 * this toggle covers touch/tablet where right-click is unavailable.
 */
const target = ref<ColorSlot>('fg')

function onSwatch(event: PointerEvent, index: number) {
  if (event.button !== 0 && event.button !== 2) return
  event.preventDefault()
  if (props.singleSelect) {
    editor.setPaintColor(index)
    return
  }
  editor.setColor(event.button === 2 ? 'bg' : target.value, index)
}

function badge(index: number): string | null {
  const { fg, bg } = editor.activeColors
  if (index === fg && index === bg) return 'FB'
  if (index === fg) return 'F'
  if (index === bg) return 'B'
  return null
}

/** Dark badge text on light swatches, light on dark. Transparent (checkerboard) reads as light. */
function badgeClass(index: number): string {
  const hex = PALETTE[index]?.hex
  if (!hex) return 'text-black'
  const luminance =
    0.299 * parseInt(hex.slice(1, 3), 16) +
    0.587 * parseInt(hex.slice(3, 5), 16) +
    0.114 * parseInt(hex.slice(5, 7), 16)
  return luminance > 140 ? 'text-black' : 'text-white'
}
</script>

<template>
  <div class="flex items-stretch gap-1.5" aria-label="Color picker">
    <!-- 2×8 palette (PLAN.md §4.1) -->
    <div class="grid flex-1 grid-cols-8 gap-1" @contextmenu.prevent>
      <AppTooltip
        v-for="entry in PALETTE"
        :key="entry.index"
        :label="entry.name"
        :placement="entry.index < 8 ? 'top' : 'bottom'"
      >
        <button
          type="button"
          class="relative h-10 w-full cursor-pointer rounded-sm border transition-[border-color] hover:border-ink-300 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink-300"
          :class="[
            { 'bg-checker': !entry.hex },
            singleSelect && entry.index === editor.paintColor
              ? 'border-ink-100 outline-2 outline-offset-2 outline-ink-100'
              : 'border-ink-600',
          ]"
          :style="entry.hex ? { backgroundColor: entry.hex } : undefined"
          :aria-label="
            singleSelect
              ? `${entry.name} — click to paint`
              : `${entry.name} — left-click foreground, right-click background`
          "
          :aria-pressed="singleSelect ? entry.index === editor.paintColor : undefined"
          @pointerdown="onSwatch($event, entry.index)"
        >
          <span
            v-if="!singleSelect && badge(entry.index)"
            class="font-display absolute inset-0 flex items-center justify-center text-sm tracking-wider"
            :class="badgeClass(entry.index)"
          >
            {{ badge(entry.index) }}
          </span>
        </button>
      </AppTooltip>
    </div>

    <!-- Touch fallback: choose what a plain tap sets (fg/bg modes only) -->
    <div
      v-if="!singleSelect"
      class="flex flex-col gap-1"
      role="radiogroup"
      aria-label="Tap sets foreground or background"
    >
      <AppTooltip label="Tap sets Foreground" placement="top">
        <button
          type="button"
          class="font-display h-4.75 w-7 rounded-sm border text-xs tracking-wider"
          :class="
            target === 'fg'
              ? 'border-ink-300 bg-ink-100 text-ink-950'
              : 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-500'
          "
          role="radio"
          :aria-checked="target === 'fg'"
          @click="target = 'fg'"
        >
          F
        </button>
      </AppTooltip>
      <AppTooltip label="Tap sets Background" placement="bottom">
        <button
          type="button"
          class="font-display h-4.75 w-7 rounded-sm border text-xs tracking-wider"
          :class="
            target === 'bg'
              ? 'border-ink-300 bg-ink-100 text-ink-950'
              : 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-500'
          "
          role="radio"
          :aria-checked="target === 'bg'"
          @click="target = 'bg'"
        >
          B
        </button>
      </AppTooltip>
    </div>
  </div>
</template>
