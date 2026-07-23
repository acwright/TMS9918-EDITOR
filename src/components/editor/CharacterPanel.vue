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
import Ca65Box from './Ca65Box.vue'
import ColorPicker from './ColorPicker.vue'
import PixelEditor from './PixelEditor.vue'
import WallpaperPreview from './WallpaperPreview.vue'
import * as charOps from '@/domain/charOps'
import { colorHex, resolveRowColors } from '@/domain/colors'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'
import { altLabel, shiftLabel } from '@/utils/platform'

const projects = useProjectsStore()
const editor = useEditorStore()

const rowColors = computed(() => {
  const project = projects.current
  if (!project) return []
  return resolveRowColors(project, editor.selectedCharset, editor.selectedChar)
})

const charLabel = computed(() => {
  const code = editor.selectedChar
  return `#${code} · $${code.toString(16).toUpperCase().padStart(2, '0')}`
})

// Text Mode displays only pattern columns 0–5 (PLAN.md §4.2)
const dimFrom = computed(() => (projects.current?.type === 'text' ? 6 : 8))

// GMII: per-row color chips beside the editor + targeted-row highlight (Decision 2)
const isG2 = computed(() => projects.current?.type === 'graphics2')

const NEUTRAL = 'var(--color-ink-950)' // transparent renders as the app background

function chipHalfStyle(index: number): { backgroundColor: string } {
  return { backgroundColor: colorHex(index) ?? NEUTRAL }
}
</script>

<template>
  <section
    v-if="editor.currentPattern"
    class="flex w-fit flex-col gap-3"
    aria-label="Character editor"
  >
    <div class="flex items-center justify-between">
      <h2 class="text-xl">Character</h2>
      <div class="flex items-center gap-1.5">
        <AppButton
          label="Previous Character"
          shortcut="["
          @click="editor.selectChar(editor.selectedChar - 1)"
        >
          <ChevronLeft class="size-4" />
        </AppButton>
        <span class="w-20 text-center font-mono text-xs text-ink-300">{{ charLabel }}</span>
        <AppButton
          label="Next Character"
          shortcut="]"
          @click="editor.selectChar(editor.selectedChar + 1)"
        >
          <ChevronRight class="size-4" />
        </AppButton>
      </div>
    </div>

    <!-- Directional transforms frame the grid: shifts on each side,
         rotates flanking shift-up, flips flanking shift-down -->
    <div class="grid w-fit grid-cols-[auto_auto_auto] items-center gap-2">
      <AppButton
        label="Rotate Left"
        :shortcut="shiftLabel('R')"
        @click="editor.transform('Rotate Left', charOps.rotateLeft)"
      >
        <RotateCcw class="size-4" />
      </AppButton>
      <div class="flex justify-center">
        <AppButton
          label="Shift Up"
          :shortcut="altLabel('↑')"
          @click="editor.transform('Shift Up', charOps.shiftUp)"
        >
          <ArrowUp class="size-4" />
        </AppButton>
      </div>
      <div class="flex justify-end">
        <AppButton
          label="Rotate Right"
          shortcut="R"
          @click="editor.transform('Rotate Right', charOps.rotateRight)"
        >
          <RotateCw class="size-4" />
        </AppButton>
      </div>

      <AppButton
        label="Shift Left"
        :shortcut="altLabel('←')"
        @click="editor.transform('Shift Left', charOps.shiftLeft)"
      >
        <ArrowLeft class="size-4" />
      </AppButton>
      <div class="flex items-stretch gap-1.5">
        <div class="size-80">
          <PixelEditor
            :pattern="editor.currentPattern"
            :row-colors="rowColors"
            :dim-from="dimFrom"
            :highlight-row="isG2 ? editor.selectedRow : null"
            @stroke-start="editor.beginStroke('Draw')"
            @paint="(x, y, on) => editor.paintPixel(x, y, on)"
            @stroke-end="editor.endStroke()"
          />
        </div>
        <!-- GMII row chips: each shows its row's fg/bg; click targets the row -->
        <div
          v-if="isG2"
          class="flex w-4 flex-col gap-px py-px"
          role="radiogroup"
          aria-label="Color row targeting"
        >
          <AppTooltip
            v-for="(pair, y) in rowColors"
            :key="y"
            :label="`Colors for Row ${y}`"
            class="min-h-0 flex-1"
          >
            <button
              type="button"
              class="flex h-full w-4 cursor-pointer flex-col overflow-hidden rounded-xs border"
              :class="
                editor.selectedRow === y ? 'border-ink-200' : 'border-ink-700 hover:border-ink-500'
              "
              role="radio"
              :aria-checked="editor.selectedRow === y"
              @click="editor.selectRow(y)"
            >
              <span class="flex-1" :style="chipHalfStyle(pair.fg)" />
              <span class="flex-1" :style="chipHalfStyle(pair.bg)" />
            </button>
          </AppTooltip>
        </div>
      </div>
      <div class="flex justify-end">
        <AppButton
          label="Shift Right"
          :shortcut="altLabel('→')"
          @click="editor.transform('Shift Right', charOps.shiftRight)"
        >
          <ArrowRight class="size-4" />
        </AppButton>
      </div>

      <AppButton
        label="Flip Horizontal"
        shortcut="H"
        @click="editor.transform('Flip Horizontal', charOps.flipH)"
      >
        <FlipHorizontal2 class="size-4" />
      </AppButton>
      <div class="flex justify-center">
        <AppButton
          label="Shift Down"
          :shortcut="altLabel('↓')"
          @click="editor.transform('Shift Down', charOps.shiftDown)"
        >
          <ArrowDown class="size-4" />
        </AppButton>
      </div>
      <div class="flex justify-end">
        <AppButton
          label="Flip Vertical"
          shortcut="V"
          @click="editor.transform('Flip Vertical', charOps.flipV)"
        >
          <FlipVertical2 class="size-4" />
        </AppButton>
      </div>
    </div>

    <ColorPicker />

    <div class="flex items-center justify-between gap-3">
      <div class="flex gap-1">
        <AppButton
          label="Fill"
          shortcut="F"
          @click="editor.transform('Fill', () => charOps.fill())"
        >
          <PaintBucket class="size-4" />
        </AppButton>
        <AppButton
          label="Clear"
          shortcut="C"
          @click="editor.transform('Clear', () => charOps.clear())"
        >
          <Eraser class="size-4" />
        </AppButton>
        <AppButton label="Invert" shortcut="I" @click="editor.transform('Invert', charOps.invert)">
          <Contrast class="size-4" />
        </AppButton>
      </div>
      <WallpaperPreview
        :pattern="editor.currentPattern"
        :row-colors="rowColors"
        :cell-width="dimFrom"
      />
    </div>

    <Ca65Box :pattern="editor.currentPattern" />
  </section>
</template>
