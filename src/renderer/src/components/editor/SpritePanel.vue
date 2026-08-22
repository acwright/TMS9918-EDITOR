<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Contrast,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  PaintBucket,
  RotateCcw,
  RotateCw,
} from 'lucide-vue-next'
import AppButton from '@/components/base/AppButton.vue'
import AppTooltip from '@/components/base/AppTooltip.vue'
import CharBytesBox from './CharBytesBox.vue'
import ColorPicker from './ColorPicker.vue'
import PixelEditor from './PixelEditor.vue'
import { PALETTE } from '@/domain/palette'
import { slotToPattern } from '@/domain/sprites'
import { useEditorStore } from '@/stores/editor'
import { altLabel, shiftLabel } from '@/utils/platform'

const editor = useEditorStore()

const size = computed(() => editor.spriteSize)

/** Flattened pixel states for the (presentational) pixel editor. */
const pixels = computed(() => (editor.currentSpriteGrid ?? []).flat())

/**
 * Every set pixel paints the sprite's one colour; clear pixels are transparent
 * on hardware, so they show the backdrop (Decision 27 / §14.3).
 */
const cellColors = computed(() =>
  pixels.value.map((on) => (on ? editor.spriteColor : editor.backdrop)),
)

const colorName = computed(() => PALETTE[editor.spriteColor]?.name ?? '—')

/** Slot number plus the hardware pattern name it maps to (§14.3). */
const slotLabel = computed(() => {
  const slot = editor.selectedSprite
  const pattern = slotToPattern(slot, size.value)
  return size.value === 16 ? `#${slot} · pat ${pattern}` : `#${slot}`
})
</script>

<template>
  <section
    v-if="editor.currentSpriteGrid"
    class="flex w-full flex-col gap-3 lg:w-fit"
    aria-label="Sprite editor"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-xl">Sprite</h2>
      <!-- ml-auto keeps the controls right-aligned on the line of their own they
           take on a phone, where they and the heading don't fit side by side -->
      <div class="ml-auto flex flex-wrap items-center justify-end gap-1.5">
        <AppButton
          label="Previous Sprite"
          shortcut="["
          @click="editor.selectSprite(editor.selectedSprite - 1)"
        >
          <ChevronLeft class="size-4" />
        </AppButton>
        <span class="w-24 text-center font-mono text-xs text-ink-300">{{ slotLabel }}</span>
        <AppButton
          label="Next Sprite"
          shortcut="]"
          @click="editor.selectSprite(editor.selectedSprite + 1)"
        >
          <ChevronRight class="size-4" />
        </AppButton>
      </div>
    </div>

    <!-- The editor stack keeps its own width and centres in the column, while
         the heading row above spans it: that is the shape of the picker below,
         whose title sits at the column's left edge and whose grid is centred. -->
    <div class="mx-auto flex w-fit flex-col gap-3">
      <!-- Directional transforms frame the grid: shifts on each side,
           rotates flanking shift-up, flips flanking shift-down -->
      <div class="grid w-fit grid-cols-[auto_auto_auto] items-center gap-2">
        <AppButton
          label="Rotate Left"
          :shortcut="shiftLabel('R')"
          @click="editor.applyTransform('rotateLeft')"
        >
          <RotateCcw class="size-4" />
        </AppButton>
        <div class="flex justify-center">
          <AppButton
            label="Shift Up"
            :shortcut="altLabel('↑')"
            @click="editor.applyTransform('shiftUp')"
          >
            <ArrowUp class="size-4" />
          </AppButton>
        </div>
        <div class="flex justify-end">
          <AppButton
            label="Rotate Right"
            shortcut="R"
            @click="editor.applyTransform('rotateRight')"
          >
            <RotateCw class="size-4" />
          </AppButton>
        </div>

        <AppButton
          label="Shift Left"
          :shortcut="altLabel('←')"
          @click="editor.applyTransform('shiftLeft')"
        >
          <ArrowLeft class="size-4" />
        </AppButton>
        <!-- The flex wrapper is load-bearing, not decoration: a grid item with a
             definite width will not shrink, so the row's min-content stayed 416px
             and the flanking buttons went off a phone screen, unreachable behind
             the column's overflow-x-hidden. As a flex item the box shrinks. -->
        <div class="flex min-w-0 justify-center">
          <div class="aspect-square w-80 max-w-full min-w-0">
            <PixelEditor
              :pixels="pixels"
              :colors="cellColors"
              :size="size"
              :quadrant-guides="size === 16"
              @stroke-start="editor.beginStroke('Draw')"
              @paint="(x, y, on) => editor.paintPixel(x, y, on)"
              @stroke-end="editor.endStroke()"
            />
          </div>
        </div>
        <div class="flex justify-end">
          <AppButton
            label="Shift Right"
            :shortcut="altLabel('→')"
            @click="editor.applyTransform('shiftRight')"
          >
            <ArrowRight class="size-4" />
          </AppButton>
        </div>

        <AppButton label="Flip Horizontal" shortcut="H" @click="editor.applyTransform('flipH')">
          <FlipHorizontal2 class="size-4" />
        </AppButton>
        <div class="flex justify-center">
          <AppButton
            label="Shift Down"
            :shortcut="altLabel('↓')"
            @click="editor.applyTransform('shiftDown')"
          >
            <ArrowDown class="size-4" />
          </AppButton>
        </div>
        <div class="flex justify-end">
          <AppButton label="Flip Vertical" shortcut="V" @click="editor.applyTransform('flipV')">
            <FlipVertical2 class="size-4" />
          </AppButton>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="font-display text-sm tracking-wider text-ink-400">Sprite Colour</h3>
          <span
            class="truncate text-xs"
            :class="editor.spriteColor === 0 ? 'text-vdp-light-red' : 'text-ink-500'"
          >
            {{ editor.spriteColor === 0 ? 'Transparent — invisible' : colorName }}
          </span>
        </div>
        <ColorPicker single-select :selected="editor.spriteColor" @select="editor.setSpriteColor" />
      </div>

      <div class="flex flex-col gap-1.5">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="font-display text-sm tracking-wider text-ink-400">Backdrop</h3>
          <span class="truncate text-xs text-ink-500">
            {{ PALETTE[editor.backdrop]?.name ?? '—' }}
          </span>
        </div>
        <div class="grid grid-cols-8 gap-1" @contextmenu.prevent>
          <AppTooltip
            v-for="entry in PALETTE"
            :key="entry.index"
            :label="entry.name"
            :placement="entry.index < 8 ? 'top' : 'bottom'"
          >
            <button
              type="button"
              class="h-6 w-full cursor-pointer rounded-sm border transition-[border-color] hover:border-ink-300 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink-300"
              :class="[
                { 'bg-checker': !entry.hex },
                entry.index === editor.backdrop
                  ? 'border-ink-100 outline-2 outline-offset-2 outline-ink-100'
                  : 'border-ink-600',
              ]"
              :style="entry.hex ? { backgroundColor: entry.hex } : undefined"
              :aria-label="`Backdrop: ${entry.name}`"
              :aria-pressed="entry.index === editor.backdrop"
              @click="editor.setBackdrop(entry.index)"
            />
          </AppTooltip>
        </div>
      </div>

      <div class="flex gap-1">
        <AppButton label="Fill" shortcut="F" @click="editor.applyTransform('fill')">
          <PaintBucket class="size-4" />
        </AppButton>
        <AppButton label="Clear" shortcut="C" @click="editor.applyTransform('clear')">
          <Eraser class="size-4" />
        </AppButton>
        <AppButton label="Invert" shortcut="I" @click="editor.applyTransform('invert')">
          <Contrast class="size-4" />
        </AppButton>
      </div>

      <CharBytesBox :bytes="editor.currentSpriteBytes" />
    </div>
  </section>
</template>
