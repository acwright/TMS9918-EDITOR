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
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'
import { modLabel, shiftModLabel } from '@/utils/platform'

const projects = useProjectsStore()
const editor = useEditorStore()

// Scale/grid live in the editor store so keyboard shortcuts can drive them;
// this component owns only the auto-fit measurement.
const viewport = useTemplateRef('viewport')

/** Fit the largest whole scale (1–8) where the screen fills the viewport. */
function fit(): void {
  const el = viewport.value
  const mode = MODES[projects.current?.type ?? 'graphics1']
  if (!el || el.clientWidth === 0) return // skip while hidden (e.g. Character tab)
  const padding = 16 // p-2 on both sides of the centering wrapper
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
</script>

<template>
  <section class="flex min-h-0 min-w-0 flex-1 flex-col gap-3" aria-label="Screen editor">
    <!-- Toolbar — ordered per PLAN.md §6/Phase 7 -->
    <div class="flex flex-wrap items-center justify-center gap-1">
      <AppButton label="Export Screen" @click="showExport = true">
        <Download class="size-4" />
      </AppButton>

      <div class="mx-1.5 h-6 w-px bg-ink-800" />

      <AppButton
        label="Zoom Out"
        shortcut="−"
        :disabled="editor.screenScale <= 1"
        @click="editor.zoomScreen(-1)"
      >
        <ZoomOut class="size-4" />
      </AppButton>
      <span class="w-6 text-center font-mono text-xs text-ink-400">{{ editor.screenScale }}×</span>
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

      <div class="mx-1.5 h-6 w-px bg-ink-800" />

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

      <div class="mx-1.5 h-6 w-px bg-ink-800" />

      <AppButton
        label="Clear Screen"
        @click="editor.screenTransform('Clear Screen', (cells) => screenOps.clear(cells))"
      >
        <Eraser class="size-4" />
      </AppButton>
      <AppButton
        label="Fill Screen with Selected Character"
        @click="
          editor.screenTransform('Fill Screen', (cells) =>
            screenOps.fill(cells, editor.selectedChar),
          )
        "
      >
        <PaintBucket class="size-4" />
      </AppButton>

      <div class="mx-1.5 h-6 w-px bg-ink-800" />

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

      <div class="mx-1.5 h-6 w-px bg-ink-800" />

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

    <p class="text-center font-mono text-xs text-ink-500">{{ editor.currentScreen?.name }}</p>

    <!-- Canvas viewport: scrolls when zoomed past the panel, centers when smaller -->
    <div ref="viewport" class="min-h-0 flex-1 overflow-auto">
      <!-- "safe" centering falls back to start alignment when the canvas
           overflows, so the left/top edges stay scrollable (plain center
           pushes overflow off the unreachable start side) -->
      <div class="flex min-h-full min-w-full items-center-safe justify-center-safe p-2">
        <ScreenCanvas :scale="editor.screenScale" :show-grid="editor.showGrid" />
      </div>
    </div>

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
