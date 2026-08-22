<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  Grid3x3,
  MoreHorizontal,
  PaintBucket,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-vue-next'
import AppButton from '@/components/base/AppButton.vue'
import AppDialog from '@/components/base/AppDialog.vue'
import AppTextInput from '@/components/base/AppTextInput.vue'
import ExportDialog from './ExportDialog.vue'
import ScreenCanvas from './ScreenCanvas.vue'
import * as screenOps from '@/domain/screenOps'
import { MODES } from '@/domain/modes'
import { formatScreenStatus, screenStatus, type PointerCell } from '@/domain/screenStatus'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'
import { modLabel, shiftModLabel } from '@/utils/platform'

const projects = useProjectsStore()
const editor = useEditorStore()

const isMulticolor = computed(() => projects.current?.type === 'multicolor')

/** Fill the whole screen — with the paint colour (multicolor) or the selected character. */
function fillScreen() {
  const code = isMulticolor.value ? editor.paintColor : editor.selectedChar
  editor.screenTransform('Fill Screen', (cells) => screenOps.fill(cells, code))
}

// Scale/grid live in the editor store so keyboard shortcuts can drive them;
// this component owns only the auto-fit measurement.
const viewport = useTemplateRef('viewport')

/**
 * Below sm the secondary tools fold behind More. `display: contents` rather than
 * a nested flex row so they stay items of the same wrapping toolbar — a wrapper
 * box would put them on a line of their own.
 */
const showMore = ref(false)
const secondaryClass = computed(() => (showMore.value ? 'contents' : 'hidden sm:contents'))

/** Hand the scale back to auto-fit, and re-fit now rather than on next resize. */
function refit(): void {
  editor.refitScreen()
  fit()
}

/** A fitted scale is rarely whole — show one decimal when it isn't. */
const scaleLabel = computed(() => {
  const scale = editor.screenScale
  return Number.isInteger(scale) ? String(scale) : scale.toFixed(1)
})

/** Fit the largest whole scale (1–8) where the screen fills the viewport. */
function fit(): void {
  const el = viewport.value
  const mode = MODES[projects.current?.type ?? 'graphics1']
  if (!el || el.clientWidth === 0) return // skip while hidden (e.g. Character tab)
  // p-3 on both sides of the centering wrapper, plus the canvas's own 1px border
  // on each side. Leaving the border out fits the canvas exactly and then
  // overflows by 2px: that is a scrollbar, and a scrollbar changes clientWidth,
  // which re-fits, which removes it — the observer oscillates and Chromium
  // reports "ResizeObserver loop completed with undelivered notifications".
  const padding = 26
  editor.fitScreenScale(
    Math.min(
      (el.clientWidth - padding) / (mode.columns * mode.cellWidth),
      (el.clientHeight - padding) / (mode.rows * mode.cellHeight),
    ),
  )
}

// A ResizeObserver re-fits on window resize, orientation change, and when the
// Screen tab becomes visible (0 → real size) — all as one signal.
let observer: ResizeObserver | undefined
onMounted(() => {
  if (viewport.value) {
    observer = new ResizeObserver(() => {
      if (!editor.screenZoomedManually) fit()
    })
    observer.observe(viewport.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())

// Re-fit when a different project opens (dimensions/space may differ);
// editor.reset() has already cleared the manual-zoom flag by then
watch(() => projects.current?.id, fit, { flush: 'post' })

// --- Screen management dialogs ---
const showRename = ref(false)
const renameValue = ref('')

function startRename() {
  renameValue.value = editor.currentScreen?.name ?? ''
  showRename.value = true
}

function confirmRename() {
  const name = renameValue.value.trim()
  if (!name) return
  editor.renameScreen(editor.selectedScreen, name)
  showRename.value = false
}

const showDelete = ref(false)
const showExport = ref(false)

function confirmDelete() {
  editor.removeScreen(editor.selectedScreen)
  showDelete.value = false
}

const pageLabel = computed(() => `${editor.selectedScreen + 1}/${editor.screenCount}`)

// --- Pointer status (PLAN.md §12 Decisions 15–16) ---
const hoverCell = ref<PointerCell | null>(null)

const status = computed(() => {
  const project = projects.current
  if (!project) return null
  return screenStatus(project, editor.currentScreen, hoverCell.value)
})
const statusText = computed(() => (status.value ? formatScreenStatus(status.value) : ''))
</script>

<template>
  <section class="flex min-h-0 min-w-0 flex-1 flex-col gap-3" aria-label="Screen editor">
    <!-- Toolbar — ordered per PLAN.md §6/Phase 7 -->
    <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:gap-x-1">
      <div :class="secondaryClass">
        <AppButton label="Export Screen" @click="showExport = true">
          <Download class="size-4" />
        </AppButton>

        <div class="mx-1 hidden h-6 w-px bg-ink-800 sm:block" />
      </div>

      <div class="flex items-center gap-1">
        <AppButton
          label="Zoom Out"
          shortcut="−"
          :disabled="editor.screenScale <= 1"
          @click="editor.zoomScreen(-1)"
        >
          <ZoomOut class="size-4" />
        </AppButton>
        <!-- The scale readout is also the fit control, rather than a sixth button
             in a toolbar that already wraps onto three rows on a phone. It carries
             the full button chrome because as bare text nothing said it was one;
             the width that costs is paid for by the dividers' tighter margins. -->
        <AppButton label="Fit to Window" @click="refit">
          <span class="font-mono text-xs">{{ scaleLabel }}×</span>
        </AppButton>
        <AppButton
          label="Zoom In"
          shortcut="+"
          :disabled="editor.screenScale >= 8"
          @click="editor.zoomScreen(1)"
        >
          <ZoomIn class="size-4" />
        </AppButton>
        <AppButton
          label="Grid Overlay"
          shortcut="G"
          :active="editor.showGrid"
          @click="editor.toggleGrid()"
        >
          <Grid3x3 class="size-4" />
        </AppButton>
      </div>

      <div :class="secondaryClass">
        <div class="mx-1 hidden h-6 w-px bg-ink-800 sm:block" />

        <AppButton
          label="Rotate Left"
          @click="editor.screenTransform('Rotate Screen Left', screenOps.rotateLeft)"
        >
          <RotateCcw class="size-4" />
        </AppButton>
        <AppButton
          label="Rotate Right"
          @click="editor.screenTransform('Rotate Screen Right', screenOps.rotateRight)"
        >
          <RotateCw class="size-4" />
        </AppButton>
        <AppButton
          label="Flip Horizontal"
          @click="editor.screenTransform('Flip Screen Horizontal', screenOps.flipH)"
        >
          <FlipHorizontal2 class="size-4" />
        </AppButton>
        <AppButton
          label="Flip Vertical"
          @click="editor.screenTransform('Flip Screen Vertical', screenOps.flipV)"
        >
          <FlipVertical2 class="size-4" />
        </AppButton>
        <AppButton
          label="Shift Left"
          @click="editor.screenTransform('Shift Screen Left', screenOps.shiftLeft)"
        >
          <ArrowLeft class="size-4" />
        </AppButton>
        <AppButton
          label="Shift Right"
          @click="editor.screenTransform('Shift Screen Right', screenOps.shiftRight)"
        >
          <ArrowRight class="size-4" />
        </AppButton>
        <AppButton
          label="Shift Up"
          @click="editor.screenTransform('Shift Screen Up', screenOps.shiftUp)"
        >
          <ArrowUp class="size-4" />
        </AppButton>
        <AppButton
          label="Shift Down"
          @click="editor.screenTransform('Shift Screen Down', screenOps.shiftDown)"
        >
          <ArrowDown class="size-4" />
        </AppButton>

        <div class="mx-1 hidden h-6 w-px bg-ink-800 sm:block" />

        <AppButton
          label="Clear Screen"
          @click="editor.screenTransform('Clear Screen', (cells) => screenOps.clear(cells))"
        >
          <Eraser class="size-4" />
        </AppButton>
        <AppButton
          :label="
            isMulticolor ? 'Fill Screen with Paint Colour' : 'Fill Screen with Selected Character'
          "
          @click="fillScreen"
        >
          <PaintBucket class="size-4" />
        </AppButton>
      </div>

      <div class="mx-1 hidden h-6 w-px bg-ink-800 sm:block" />

      <div class="flex items-center gap-1">
        <AppButton
          label="Undo"
          :shortcut="modLabel('Z')"
          :disabled="!editor.canUndo"
          @click="editor.undo()"
        >
          <Undo2 class="size-4" />
        </AppButton>
        <AppButton
          label="Redo"
          :shortcut="shiftModLabel('Z')"
          :disabled="!editor.canRedo"
          @click="editor.redo()"
        >
          <Redo2 class="size-4" />
        </AppButton>
      </div>

      <div class="mx-1 hidden h-6 w-px bg-ink-800 sm:block" />

      <div class="flex items-center gap-1">
        <AppButton
          label="Previous Screen"
          shortcut=","
          :disabled="editor.selectedScreen === 0"
          @click="editor.selectScreen(editor.selectedScreen - 1)"
        >
          <ChevronLeft class="size-4" />
        </AppButton>
        <span class="w-8 text-center font-mono text-xs text-ink-400">{{ pageLabel }}</span>
        <AppButton
          label="Next Screen"
          shortcut="."
          :disabled="editor.selectedScreen >= editor.screenCount - 1"
          @click="editor.selectScreen(editor.selectedScreen + 1)"
        >
          <ChevronRight class="size-4" />
        </AppButton>
      </div>
      <div :class="secondaryClass">
        <AppButton label="Rename Screen" @click="startRename">
          <Pencil class="size-4" />
        </AppButton>
        <AppButton label="Add Screen" @click="editor.addScreen()">
          <Plus class="size-4" />
        </AppButton>
        <AppButton
          label="Delete Screen"
          :disabled="editor.screenCount <= 1"
          @click="showDelete = true"
        >
          <Trash2 class="size-4" />
        </AppButton>
      </div>
      <!-- Below sm the toolbar ran to three and four rows. What stays out is
           what you reach for while drawing — zoom, fit, grid, undo, the screen
           stepper; what folds away is what you reach for once. From sm up it is
           all inline as before, so this costs the desktop nothing. -->
      <AppButton
        label="More Tools"
        class="sm:hidden"
        :active="showMore"
        @click="showMore = !showMore"
      >
        <MoreHorizontal class="size-4" />
      </AppButton>
    </div>

    <p class="text-center font-mono text-xs text-ink-500">{{ editor.currentScreen?.name }}</p>

    <!-- Canvas viewport: scrolls when zoomed past the panel, centers when smaller -->
    <div ref="viewport" class="min-h-0 flex-1 overflow-auto">
      <!-- "safe" centering falls back to start alignment when the canvas
           overflows, so the left/top edges stay scrollable (plain center
           pushes overflow off the unreachable start side) -->
      <div class="flex min-h-full min-w-full items-center-safe justify-center-safe p-3">
        <ScreenCanvas
          :scale="editor.screenScale"
          :show-grid="editor.showGrid"
          @hover="hoverCell = $event"
        />
      </div>
    </div>

    <!-- Pointer status: fixed height + tabular figures so nothing shifts as it updates -->
    <p
      class="h-4 shrink-0 text-center font-mono text-xs [font-variant-numeric:tabular-nums]"
      :class="status?.active ? 'text-ink-300' : 'text-ink-600'"
      aria-live="off"
    >
      {{ statusText }}
    </p>

    <ExportDialog v-model="showExport" scope="screen" />

    <AppDialog v-model="showRename" title="Rename Screen">
      <form @submit.prevent="confirmRename">
        <AppTextInput v-model="renameValue" label="Name" autofocus />
      </form>
      <template #footer>
        <AppButton
          label="Rename"
          show-label
          :disabled="renameValue.trim().length === 0"
          @click="confirmRename"
        >
          <Pencil class="size-4" />
        </AppButton>
      </template>
    </AppDialog>

    <AppDialog v-model="showDelete" title="Delete Screen">
      <p class="text-sm text-ink-300">
        Delete <strong class="text-ink-100">{{ editor.currentScreen?.name }}</strong
        >? You can undo this while the project is open.
      </p>
      <template #footer>
        <AppButton label="Cancel" show-label @click="showDelete = false" />
        <AppButton label="Delete" show-label @click="confirmDelete">
          <Trash2 class="size-4" />
        </AppButton>
      </template>
    </AppDialog>
  </section>
</template>
