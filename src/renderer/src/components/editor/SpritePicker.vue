<script setup lang="ts">
import { ref } from 'vue'
import { Download, Grid3x3, LayoutGrid, List, Settings2 } from 'lucide-vue-next'
import AppButton from '@/components/base/AppButton.vue'
import AppTooltip from '@/components/base/AppTooltip.vue'
import ExportDialog from './ExportDialog.vue'
import SpriteGrid from './SpriteGrid.vue'
import SpriteGridView from './SpriteGridView.vue'
import SpriteList from './SpriteList.vue'
import { loadPreferences, savePreferences } from '@/persistence/preferences'
import { useEditorStore } from '@/stores/editor'
import { SPRITE_VIEWS, type SpriteView } from '@/utils/spriteView'

const editor = useEditorStore()

const emit = defineEmits<{ openSettings: [] }>()

const showExport = ref(false)

/**
 * The layout, remembered across sessions and independent of the character
 * set's. The sheet is a picture of the set and answers only "which one looks
 * like the ship"; the other two keep the slots at a fixed size and scroll,
 * and the list names what the picture can only hint at
 * (`utils/spriteView.ts`).
 */
const view = ref<SpriteView>(loadPreferences().spriteView)

function setView(next: SpriteView): void {
  view.value = next
  savePreferences({ spriteView: next })
}

const VIEW_ICONS = { sheet: LayoutGrid, grid: Grid3x3, list: List }
</script>

<template>
  <!-- The same floor the character set picker has: as `min-h-0` this was
       crushed to about a hundred pixels, below the sheet's own `min-h-32`, so
       the bottom rows of sprites were clipped. The column around it scrolls,
       so there was never a reason to squeeze it that far. -->
  <section class="flex min-h-64 flex-1 flex-col gap-2 pb-4" aria-label="Sprite picker">
    <!-- Wrapping, as the character set's header does: three layout buttons
         beside Settings and Export no longer fit the column in one row. -->
    <div class="flex flex-wrap items-center gap-2">
      <h2 class="text-xl">Sprites</h2>
      <span class="font-mono text-xs text-ink-500">
        {{ editor.spriteSize }}×{{ editor.spriteSize }} · {{ editor.spriteSlots }}
      </span>
      <!-- Wraps rather than overflowing: eight buttons at a coarse pointer's
           40px are wider than a 320px phone's column -->
      <div class="ml-auto flex flex-wrap items-center justify-end gap-1">
        <!-- Layout: which of the three arrangements suits this window -->
        <div class="flex gap-1" role="radiogroup" aria-label="Sprite layout">
          <AppTooltip
            v-for="option in SPRITE_VIEWS"
            :key="option.view"
            :label="option.label"
            placement="bottom"
          >
            <button
              type="button"
              class="inline-flex h-9 min-w-9 items-center justify-center rounded-sm border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-300 pointer-coarse:h-10 pointer-coarse:min-w-10"
              :class="
                view === option.view
                  ? 'border-ink-300 bg-ink-100 text-ink-950'
                  : 'border-ink-700 bg-ink-850 text-ink-200 hover:border-ink-500 hover:bg-ink-800'
              "
              role="radio"
              :aria-checked="view === option.view"
              :aria-label="option.label"
              @click="setView(option.view)"
            >
              <component :is="VIEW_ICONS[option.view]" class="size-4" />
            </button>
          </AppTooltip>
        </div>

        <div class="mx-0.5 h-6 w-px bg-ink-800" />

        <AppButton label="Sprite Settings" @click="emit('openSettings')">
          <Settings2 class="size-4" />
        </AppButton>
        <AppButton label="Export Sprites" @click="showExport = true">
          <Download class="size-4" />
        </AppButton>
      </div>
    </div>

    <ExportDialog v-model="showExport" scope="sprite" />

    <!-- Sheet: the whole set as one square canvas, scaled to the space -->
    <div v-if="view === 'sheet'" class="flex min-h-0 flex-1 items-center justify-center">
      <SpriteGrid />
    </div>

    <SpriteGridView v-else-if="view === 'grid'" />

    <SpriteList v-else />
  </section>
</template>
