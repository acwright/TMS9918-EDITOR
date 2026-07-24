<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, Settings2 } from 'lucide-vue-next'
import AppButton from '@/components/base/AppButton.vue'
import CharsetGrid from './CharsetGrid.vue'
import ExportDialog from './ExportDialog.vue'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'

const projects = useProjectsStore()
const editor = useEditorStore()

const showExport = ref(false)

const emit = defineEmits<{ openSettings: [] }>()

const isG2 = computed(() => projects.current?.type === 'graphics2')
const isIndependent = computed(
  () => isG2.value && projects.current?.settings.g2CharsetMode === 'independent',
)

const G2_SETS = [
  { index: 0, label: 'Set 1 (Top Third)' },
  { index: 1, label: 'Set 2 (Middle Third)' },
  { index: 2, label: 'Set 3 (Bottom Third)' },
]
</script>

<template>
  <!-- min-h-0 lets the grids shrink to fit rather than forcing the page to scroll -->
  <section class="flex min-h-0 flex-1 flex-col gap-2 pb-4" aria-label="Character set picker">
    <div class="flex items-center gap-2">
      <h2 class="text-xl">Character Set</h2>
      <div class="ml-auto flex items-center gap-1">
        <template v-if="isIndependent">
          <AppButton
            v-for="set in G2_SETS"
            :key="set.index"
            :label="set.label"
            :active="editor.selectedCharset === set.index"
            @click="editor.selectCharset(set.index)"
          >
            <span class="font-display text-sm">{{ set.index + 1 }}</span>
          </AppButton>
        </template>
        <AppButton v-if="isG2" label="Charset Settings" @click="emit('openSettings')">
          <Settings2 class="size-4" />
        </AppButton>
        <AppButton label="Export Character Set" @click="showExport = true">
          <Download class="size-4" />
        </AppButton>
      </div>
    </div>

    <ExportDialog v-model="showExport" scope="charset" />

    <!-- Characters 0–127 and 128–255 side by side, centered, scaling to fit -->
    <div class="flex min-h-0 flex-1 items-center justify-center gap-3">
      <CharsetGrid :start-code="0" />
      <CharsetGrid :start-code="128" />
    </div>
  </section>
</template>
